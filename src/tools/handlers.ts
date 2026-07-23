import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { basename, dirname, join, resolve, extname } from "path";
import AdmZip from "adm-zip";
import axios from "axios";
import yaml from "js-yaml";
import { PrismeApiClient, AIKnowledgeQueryParams, AIKnowledgeCompletionParams, AIKnowledgeDocumentParams, AIKnowledgeProjectParams, AIKnowledgeAuth, AppInstance } from "../api-client.js";
import { resolveWorkspaceAndEnvironment, environmentsConfig, PRISME_API_BASE_URL, PRISME_FORCE_READONLY } from "../config.js";
import {
  persistToken,
  persistTopology,
  deriveTokenUrl,
  type StoredTopology,
} from "../auth/persist.js";
import { enforceReadonlyMode, truncateJsonOutput } from "../utils.js";
import { lintAutomation, type AutomationLintResult } from "../../linter/dist/index.js";

const PROTECTED_WORKSPACE_LABEL = "one-product";

/**
 * Format linting errors for human-readable output
 */
function formatLintErrors(result: AutomationLintResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("Validation passed: No errors found.");
  } else {
    const errorLines = result.errors.map((err, i) => {
      const path = err.instancePath || "(root)";
      const message = err.message || "Unknown error";
      const params = err.params ? ` (${JSON.stringify(err.params)})` : "";
      return `${i + 1}. [${err.keyword}] ${path}: ${message}${params}`;
    });
    lines.push(`Validation failed with ${result.errors.length} error(s):\n${errorLines.join("\n")}`);
  }

  if (result.warnings?.length > 0) {
    const warningLines = result.warnings.map((w, i) => {
      const path = w.instancePath || "(root)";
      return `${i + 1}. [${w.keyword}] ${path}: ${w.message}`;
    });
    lines.push(`\nWarning(s):\n${warningLines.join("\n")}`);
  }

  return lines.join("\n");
}

function formatAutomationWriteResult(result: unknown, lintResult: AutomationLintResult, action: "created" | "updated"): string {
  if (!lintResult.warnings || lintResult.warnings.length === 0) {
    return JSON.stringify(result, null, 2);
  }

  const payload: Record<string, unknown> = {
    result,
    warningCount: lintResult.warnings.length,
    warnings: lintResult.warnings.map((warning) => ({
      path: warning.instancePath || "(root)",
      keyword: warning.keyword,
      message: warning.message,
      ...(warning.params && { params: warning.params }),
    })),
    instruction: `The automation was ${action}, but validation warnings were found. If this automation was newly created for the current task, update it to fix the listed issue(s).`,
  };

  return JSON.stringify(payload, null, 2);
}

function resolveLocalWorkspaceDirectory(resolvedPath: string): string {
  const currentDir = join(resolvedPath, "current");
  if (
    basename(resolvedPath) !== "current" &&
    existsSync(currentDir) &&
    statSync(currentDir).isDirectory()
  ) {
    const looksLikeWorkspaceRoot = ["automations", "pages", "imports", "ux", "collections"].some((name) =>
      existsSync(join(resolvedPath, name))
    );
    if (!looksLikeWorkspaceRoot) {
      return currentDir;
    }
  }

  return resolvedPath;
}

function getWorkspaceIndexLabels(workspaceDir: string): { indexPath?: string; labels: string[]; error?: string } {
  const indexPath = join(workspaceDir, "index.yml");
  if (!existsSync(indexPath)) {
    return {
      labels: [],
      error: `Workspace index.yml not found at ${indexPath}; cannot verify protected workspace labels.`,
    };
  }

  try {
    const parsed = yaml.load(readFileSync(indexPath, "utf-8"));
    const labels = parsed && typeof parsed === "object" && "labels" in parsed
      ? (parsed as { labels?: unknown }).labels
      : undefined;

    return {
      indexPath,
      labels: Array.isArray(labels) ? labels.filter((label): label is string => typeof label === "string") : [],
    };
  } catch (error) {
    return {
      indexPath,
      labels: [],
      error: `Unable to read workspace labels from ${indexPath}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
};

function guessContentType(filenameOrPath: string): string {
  const ext = extname(filenameOrPath).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || "application/octet-stream";
}

export async function handleToolCall(
  name: string,
  args: any,
  apiClient: PrismeApiClient
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  switch (name) {
    case "call_api": {
      const { path, method, query, body, environment, pick, asSession, apiKey, withUserBearer } = args as {
        path: string;
        method?: string;
        query?: Record<string, any>;
        body?: any;
        environment?: string;
        pick?: string[];
        asSession?: boolean;
        apiKey?: string;
        withUserBearer?: boolean;
      };
      const httpMethod = (method || "GET").toUpperCase();
      if (
        PRISME_FORCE_READONLY &&
        !["GET", "HEAD", "OPTIONS"].includes(httpMethod)
      ) {
        throw new Error(
          `call_api with method ${httpMethod} is not available in readonly mode (PRISME_FORCE_READONLY=true).`
        );
      }
      const apiResult = await apiClient.callApi({
        path,
        method: httpMethod,
        query,
        body,
        environment,
        pick,
        asSession,
        apiKey,
        withUserBearer,
      });
      return truncateJsonOutput(apiResult, `call_api ${httpMethod} ${path}`);
    }

    case "create_automation": {
      enforceReadonlyMode("create_automation");
      const { automation, workspaceId, workspaceName, environment } = args as {
        automation: any;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };

      // Validate automation before creating
      const lintResult = lintAutomation(automation);
      if (!lintResult.valid) {
        return {
          content: [
            {
              type: "text",
              text: `Automation validation failed. Please fix the following errors before creating:\n\n${formatLintErrors(lintResult)}`,
            },
          ],
          isError: true,
        };
      }

      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.createAutomation(
        automation,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: formatAutomationWriteResult(result, lintResult, "created"),
          },
        ],
      };
    }

    case "get_automation": {
      const { automationSlug, workspaceId, workspaceName, environment } =
        args as {
          automationSlug: string;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.getAutomation(
        automationSlug,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "update_automation": {
      enforceReadonlyMode("update_automation");
      const {
        automationSlug,
        automation,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        automationSlug: string;
        automation: any;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };

      // Validate automation before updating
      const lintResult = lintAutomation(automation);
      if (!lintResult.valid) {
        return {
          content: [
            {
              type: "text",
              text: `Automation validation failed. Please fix the following errors before updating:\n\n${formatLintErrors(lintResult)}`,
            },
          ],
          isError: true,
        };
      }

      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.updateAutomation(
        automationSlug,
        automation,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "delete_automation": {
      enforceReadonlyMode("delete_automation");
      const { automationSlug, workspaceId, workspaceName, environment } =
        args as {
          automationSlug: string;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.deleteAutomation(
        automationSlug,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "list_automations": {
      const { workspaceId, workspaceName, environment } = args as {
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.listAutomations(
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "list_apps": {
      const {
        text,
        workspaceId,
        workspaceName,
        environment,
        page,
        limit,
        labels,
      } = args as {
        text?: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
        page?: number;
        limit?: number;
        labels?: string;
      };
      // Resolve environment to get the correct API URL
      const { workspaceId: resolvedWorkspaceId, apiUrl } =
        resolveWorkspaceAndEnvironment({ workspaceName, environment });
      // For list_apps, workspaceId is used for filtering
      const filterWorkspaceId =
        workspaceId || (workspaceName ? resolvedWorkspaceId : undefined);
      const result = await apiClient.listApps(
        { text, workspaceId: filterWorkspaceId, page, limit, labels },
        apiUrl,
        environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "get_app": {
      const { appSlug, environment } = args as {
        appSlug: string;
        environment?: string;
      };
      const { apiUrl } = resolveWorkspaceAndEnvironment({ environment });
      const app = await apiClient.getApp(appSlug, apiUrl, environment);
      const automations: Record<
        string,
        { description?: string; arguments?: Record<string, any> }
      > = {};
      if (app.automations) {
        for (const [slug, automation] of Object.entries(
          app.automations as Record<string, any>
        )) {
          automations[slug] = {
            description: automation.description,
            arguments: automation.arguments,
          };
        }
      }
      const result = {
        slug: app.slug,
        name: app.name,
        description: app.description,
        configSchema: app.config?.schema || {},
        automations,
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "publish_app": {
      enforceReadonlyMode("publish_app");
      const { workspaceId, workspaceName, environment, slug, name, description, workspaceVersion } = args as {
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
        slug?: string;
        name?: string;
        description?: string | Record<string, string>;
        workspaceVersion?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.publishApp(
        {
          workspaceId: resolved.workspaceId,
          slug,
          name,
          description,
          workspaceVersion,
        },
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "push_workspace_version": {
      enforceReadonlyMode("push_workspace_version");
      const {
        description,
        name,
        repositoryId,
        gitPlatform,
        workspaceName,
        environment,
        workspaceId,
      } = args as {
        description: string | Record<string, string>;
        name?: string;
        repositoryId?: string;
        gitPlatform?: string;
        workspaceName?: string;
        environment?: string;
        workspaceId?: string;
      };

      if (repositoryId && gitPlatform) {
        return {
          content: [
            {
              type: "text",
              text: "Error: `repositoryId` and `gitPlatform` are mutually exclusive — provide only one.",
            },
          ],
          isError: true,
        };
      }

      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });

      let resolvedRepositoryId = repositoryId;
      if (gitPlatform) {
        const workspace = await apiClient.getWorkspace(
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        const platformRepos = (workspace?.platformRepositories || {}) as Record<string, unknown>;
        if (!platformRepos[gitPlatform]) {
          const available = Object.keys(platformRepos);
          return {
            content: [
              {
                type: "text",
                text:
                  `Error: Platform repository "${gitPlatform}" not found on workspace ${resolved.workspaceId}. ` +
                  (available.length
                    ? `Available platform repositories: ${available.join(", ")}.`
                    : "No platform repositories are exposed on this workspace."),
              },
            ],
            isError: true,
          };
        }
        resolvedRepositoryId = gitPlatform;
      }

      const body: {
        description: string | Record<string, string>;
        name?: string;
        repository?: { id: string };
      } = {
        description,
      };
      if (name) body.name = name;
      if (resolvedRepositoryId) body.repository = { id: resolvedRepositoryId };

      const result = await apiClient.pushWorkspaceVersion(
        body,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );

      const pushedRepositoryId: string | undefined =
        result?.repository?.id ?? resolvedRepositoryId;
      const pushedToGit = Boolean(pushedRepositoryId);
      const target = pushedToGit
        ? `git repository "${pushedRepositoryId}"`
        : "local (non-git) workspace version";
      const log = `Version "${result?.name ?? name ?? "(unnamed)"}" created — pushed to ${target}.`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                pushedToGit,
                target,
                log,
                version: result,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "pull_workspace_version": {
      enforceReadonlyMode("pull_workspace_version");
      const {
        versionId,
        repositoryId,
        gitPlatform,
        workspaceName,
        environment,
        workspaceId,
      } = args as {
        versionId: string;
        repositoryId?: string;
        gitPlatform?: string;
        workspaceName?: string;
        environment?: string;
        workspaceId?: string;
      };

      if (repositoryId && gitPlatform) {
        return {
          content: [
            {
              type: "text",
              text: "Error: `repositoryId` and `gitPlatform` are mutually exclusive — provide only one.",
            },
          ],
          isError: true,
        };
      }

      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });

      let resolvedRepositoryId = repositoryId;
      if (gitPlatform) {
        const workspace = await apiClient.getWorkspace(
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        const platformRepos = (workspace?.platformRepositories || {}) as Record<string, unknown>;
        if (!platformRepos[gitPlatform]) {
          const available = Object.keys(platformRepos);
          return {
            content: [
              {
                type: "text",
                text:
                  `Error: Platform repository "${gitPlatform}" not found on workspace ${resolved.workspaceId}. ` +
                  (available.length
                    ? `Available platform repositories: ${available.join(", ")}.`
                    : "No platform repositories are exposed on this workspace."),
              },
            ],
            isError: true,
          };
        }
        resolvedRepositoryId = gitPlatform;
      }

      const body: {
        repository?: { id: string };
      } = {};
      if (resolvedRepositoryId) body.repository = { id: resolvedRepositoryId };

      const result = await apiClient.pullWorkspaceVersion(
        versionId,
        body,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );

      const pulledFromGit = Boolean(resolvedRepositoryId);
      const source = pulledFromGit
        ? `git repository "${resolvedRepositoryId}"`
        : "existing workspace version";
      const log = `Version "${versionId}" pulled from ${source}.`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                pulledFromGit,
                source,
                log,
                result,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "unlock_workspace": {
      enforceReadonlyMode("unlock_workspace");
      const { workspaceName, environment, workspaceId } = args as {
        workspaceName?: string;
        environment?: string;
        workspaceId?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.unlockWorkspace(
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "create_workspace": {
      enforceReadonlyMode("create_workspace");
      const { workspace, environment } = args as {
        workspace: {
          name: string;
          description?: string | Record<string, string>;
          photo?: string;
          slug?: string;
          labels?: string[];
        };
        environment: string;
      };
      const { apiUrl } = resolveWorkspaceAndEnvironment({ environment });
      const result = await apiClient.createWorkspace(
        workspace,
        apiUrl,
        environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "search_workspaces": {
      const { search, name, slug, page, limit, labels, environment } =
        args as {
          search?: string;
          name?: string;
          slug?: string;
          page?: number;
          limit?: number;
          labels?: string;
          environment: string;
        };
      const { apiUrl } = resolveWorkspaceAndEnvironment({ environment });
      const result = await apiClient.searchWorkspaces(
        { search, name, slug, page, limit, labels },
        apiUrl,
        environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "execute_automation": {
      enforceReadonlyMode("execute_automation");
      const {
        automationSlug,
        payload,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        automationSlug: string;
        payload?: any;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.testAutomation(
        automationSlug,
        payload,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "search_events": {
      const { workspaceId, workspaceName, environment, ...searchQuery } =
        args as any;
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.search(
        searchQuery,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return truncateJsonOutput(result, "search_events");
    }

    case "get_prisme_documentation": {
      try {
        const { section = "index" } = args as { section?: string };

        // Map section to file path
        const sectionToFile: Record<string, string> = {
          index: "README.md",
          automations: "01-automations.md",
          "pages-blocks": "02-pages-blocks.md",
          "workspace-config": "03-workspace-config.md",
          "advanced-features": "04-advanced-features.md",
          "products-overview": "05-products-overview.md",
          "agent-creation": "06-agent-creation.md",
          "api-selfhosting": "07-api-selfhosting.md",
          "product-agent-factory": "products/agent-factory.md",
          "product-storage": "products/storage.md",
          "product-llm-gateway": "products/llm-gateway.md",
          "product-capabilities": "products/capabilities.md",
          "product-agent-evaluations": "products/agent-evaluations.md",
          "product-governance-v2": "products/ai-governance-v2.md",
          "product-insights-v2": "products/ai-insights-v2.md",
          "product-collection-v3": "products/ai-collection-v3.md",
          "product-prompt-library": "products/prompt-library.md",
          "product-builder": "products/ai-builder.md",
          "capability-workspaces": "products/capability-workspaces.md",
          "legacy-products-overview": "legacy/products-overview.md",
          "legacy-product-securechat": "legacy/products/ai-securechat.md",
          "legacy-product-store": "legacy/products/ai-store.md",
          "legacy-product-knowledge": "legacy/products/ai-knowledge.md",
          "legacy-product-governance": "legacy/products/ai-governance.md",
          "legacy-product-insights": "legacy/products/ai-insights.md",
          "legacy-product-collection": "legacy/products/ai-collection.md",
        };

        const fileName = sectionToFile[section];
        if (!fileName) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown section: ${section}. Valid sections: ${Object.keys(sectionToFile).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        // llmDoc ships inside plugin/. From the bundled layout
        // (plugin/build/index.js) it is one level up; from the tsc layout
        // (build/tools/) it is at <repo>/plugin/llmDoc.
        const docCandidates = [
          join(__dirname, "..", "llmDoc", fileName),
          join(__dirname, "..", "..", "plugin", "llmDoc", fileName),
        ];
        const docPath = docCandidates.find((p) => existsSync(p)) ?? docCandidates[0];
        const documentation = readFileSync(docPath, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: documentation,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading documentation: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }

    case "validate_automation": {
      const { path: inputPath, automation, strict, validateExpressions: validateExprs } = args as {
        path?: string;
        automation?: any;
        strict?: boolean;
        validateExpressions?: boolean;
      };

      const lintOptions = { strict, validateExpressions: validateExprs };

      // Helper to validate a single file
      const validateFile = (filePath: string): { path: string; valid: boolean; errors?: any[]; warnings?: any[]; error?: string } => {
        try {
          const fileContent = readFileSync(filePath, "utf-8");
          const ext = filePath.toLowerCase();
          const parsed = ext.endsWith(".json") ? JSON.parse(fileContent) : yaml.load(fileContent);
          const result = lintAutomation(parsed, lintOptions);
          const mappedWarnings = result.warnings?.length > 0
            ? result.warnings.map((w) => ({
                path: w.instancePath || "(root)",
                keyword: w.keyword,
                message: w.message,
              }))
            : undefined;

          if (result.valid) {
            return { path: filePath, valid: true, ...(mappedWarnings && { warnings: mappedWarnings }) };
          }
          return {
            path: filePath,
            valid: false,
            errors: result.errors.map((err) => ({
              path: err.instancePath || "(root)",
              keyword: err.keyword,
              message: err.message,
            })),
            ...(mappedWarnings && { warnings: mappedWarnings }),
          };
        } catch (err) {
          return { path: filePath, valid: false, error: err instanceof Error ? err.message : "Parse error" };
        }
      };

      if (inputPath) {
        const resolvedPath = resolve(inputPath);
        if (!existsSync(resolvedPath)) {
          return {
            content: [{ type: "text", text: `Error: Path not found: ${resolvedPath}` }],
            isError: true,
          };
        }

        const stat = statSync(resolvedPath);

        if (stat.isDirectory()) {
          // Validate all automation files in folder
          const files = readdirSync(resolvedPath)
            .filter((f) => /\.(ya?ml|json)$/i.test(f))
            .map((f) => join(resolvedPath, f));

          if (files.length === 0) {
            return {
              content: [{ type: "text", text: JSON.stringify({ path: resolvedPath, message: "No .yml, .yaml, or .json files found in folder." }, null, 2) }],
            };
          }

          const results = files.map(validateFile);
          const validCount = results.filter((r) => r.valid).length;
          const invalidCount = results.length - validCount;
          const warningCount = results.filter((r) => r.warnings && r.warnings.length > 0).length;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    path: resolvedPath,
                    summary: `${validCount}/${results.length} files valid${invalidCount > 0 ? `, ${invalidCount} with errors` : ""}${warningCount > 0 ? `, ${warningCount} with warnings` : ""}`,
                    results,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          // Single file
          const result = validateFile(resolvedPath);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
      } else if (automation) {
        const result = lintAutomation(automation, lintOptions);
        const mappedWarnings = result.warnings?.length > 0
          ? result.warnings.map((w) => ({
              path: w.instancePath || "(root)",
              keyword: w.keyword,
              message: w.message,
            }))
          : undefined;

        if (result.valid) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              valid: true,
              message: "Automation is valid.",
              ...(mappedWarnings && { warningCount: mappedWarnings.length, warnings: mappedWarnings }),
            }, null, 2) }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  valid: false,
                  errorCount: result.errors.length,
                  errors: result.errors.map((err) => ({
                    path: err.instancePath || "(root)",
                    keyword: err.keyword,
                    message: err.message,
                  })),
                  ...(mappedWarnings && { warningCount: mappedWarnings.length, warnings: mappedWarnings }),
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text", text: "Error: Either 'path' or 'automation' must be provided." }],
          isError: true,
        };
      }
    }

    case "report_issue_or_feedback": {
      const { type, message, context } = args as {
        type: "bug" | "feedback";
        message: string;
        context?: {
          tool?: string;
          input?: any;
          error?: string;
        };
      };

      const FEEDBACK_API_URL =
        "https://api.studio.prisme.ai/v2/workspaces/UwDCbK8/webhooks/report";

      const response = await fetch(FEEDBACK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          message,
          ...(context && { context }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Failed to submit report: ${response.status} - ${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const result = (await response.json()) as {
        success: boolean;
        reportId?: string;
        message?: string;
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                reportId: result.reportId,
                message: "Report submitted successfully. Thank you for helping improve the Prisme.ai MCP tools!",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "update_report": {
      const { reportId, status, message, type } = args as {
        reportId: string;
        status?: "cancelled" | "acknowledged";
        message?: string;
        type?: "bug" | "feedback";
      };

      const UPDATE_REPORT_API_URL =
        "https://api.studio.prisme.ai/v2/workspaces/UwDCbK8/webhooks/update-report";

      const response = await fetch(UPDATE_REPORT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId,
          ...(status && { status }),
          ...(message && { message }),
          ...(type && { type }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Failed to update report: ${response.status} - ${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                reportId,
                message: result.message || "Report updated successfully.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_reports": {
      const { type, status, completed, limit, page } = args as {
        type?: "bug" | "feedback";
        status?: "new" | "acknowledged" | "resolved" | "wontfix" | "cancelled";
        completed?: boolean;
        limit?: number;
        page?: number;
      };

      const GET_REPORTS_API_URL =
        "https://api.studio.prisme.ai/v2/workspaces/UwDCbK8/webhooks/get-reports";

      const params = new URLSearchParams();
      if (type) params.append("type", type);
      if (status) params.append("status", status);
      if (completed !== undefined) params.append("completed", String(completed));
      if (limit) params.append("limit", String(limit));
      if (page) params.append("page", String(page));

      const url = params.toString()
        ? `${GET_REPORTS_API_URL}?${params.toString()}`
        : GET_REPORTS_API_URL;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve reports: ${response.status} - ${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const result = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "pull_workspace": {
      enforceReadonlyMode("pull_workspace");
      const {
        path: targetPath,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        path: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolvedPath = resolve(targetPath);
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });

      const zipBuffer = await apiClient.exportWorkspace(
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      const zip = new AdmZip(zipBuffer);

      if (!existsSync(resolvedPath)) {
        mkdirSync(resolvedPath, { recursive: true });
      }

      const extractedFiles: string[] = [];
      const currentPrefix = "current/";

      zip.getEntries().forEach((entry) => {
        if (entry.entryName.startsWith(currentPrefix)) {
          const relativePath = entry.entryName.slice(currentPrefix.length);
          if (relativePath) {
            const targetFilePath = join(resolvedPath, relativePath);
            if (entry.isDirectory) {
              if (!existsSync(targetFilePath)) {
                mkdirSync(targetFilePath, { recursive: true });
              }
            } else {
              const fileDir = dirname(targetFilePath);
              if (!existsSync(fileDir)) {
                mkdirSync(fileDir, { recursive: true });
              }
              writeFileSync(targetFilePath, entry.getData());
              extractedFiles.push(relativePath);
            }
          }
        }
      });

      // Limit file list to avoid token limits on large workspaces
      const maxFilesToShow = 20;
      const truncatedFiles = extractedFiles.slice(0, maxFilesToShow);
      const hasMore = extractedFiles.length > maxFilesToShow;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                path: resolvedPath,
                filesExtracted: extractedFiles.length,
                files: truncatedFiles,
                ...(hasMore && { note: `Showing first ${maxFilesToShow} of ${extractedFiles.length} files` }),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "push_workspace": {
      enforceReadonlyMode("push_workspace");
      const {
        path: sourcePath,
        message,
        prune = true,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        path: string;
        message: string;
        prune?: boolean;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolvedPath = resolve(sourcePath);
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });

      if (!existsSync(resolvedPath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Directory not found: ${resolvedPath}`,
            },
          ],
          isError: true,
        };
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(message)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid message format. Only letters, numbers, hyphens, and underscores are allowed (no spaces).`,
            },
          ],
          isError: true,
        };
      }

      if (message.length > 15) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Version name must be 15 characters or less (got ${message.length} characters).`,
            },
          ],
          isError: true,
        };
      }

      // Import API expects the archive to contain a top-level "current/" directory
      // (same structure as workspace exports).
      const workspaceDir = resolveLocalWorkspaceDirectory(resolvedPath);
      const labelCheck = getWorkspaceIndexLabels(workspaceDir);
      if (labelCheck.error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${labelCheck.error}`,
            },
          ],
          isError: true,
        };
      }

      if (labelCheck.labels.includes(PROTECTED_WORKSPACE_LABEL)) {
        return {
          content: [
            {
              type: "text",
              text:
                `Error: Workspace is protected because ${labelCheck.indexPath} contains label "${PROTECTED_WORKSPACE_LABEL}". ` +
                "This workspace must not be updated through push_workspace. Warn the user that it is a protected one-product workspace and do not retry this push.",
            },
          ],
          isError: true,
        };
      }

      const backupResult = await apiClient.publishVersion(
        message,
        `Backup before MCP push: ${message}`,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );

      const zip = new AdmZip();

      const addDirectoryToZip = (dirPath: string, zipPath: string = "") => {
        const entries = readdirSync(dirPath);
        for (const entry of entries) {
          const fullPath = join(dirPath, entry);
          const entryZipPath = zipPath ? `${zipPath}/${entry}` : entry;
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            addDirectoryToZip(fullPath, entryZipPath);
          } else {
            zip.addLocalFile(fullPath, zipPath || undefined);
          }
        }
      };

      addDirectoryToZip(workspaceDir, "current");

      const zipBuffer = zip.toBuffer();
      const importResult = await apiClient.importWorkspace(
        zipBuffer,
        prune,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );

      // Check for import errors
      const hasErrors = importResult?.errors && importResult.errors.length > 0;

      // Return only a summary to avoid token limits (full responses contain entire workspace config)
      const summary = {
        success: !hasErrors,
        backup: {
          versionName: backupResult?.name || message,
          createdAt: backupResult?.createdAt,
        },
        import: {
          workspaceId: importResult?.id || resolved.workspaceId,
          workspaceName: importResult?.name,
          ...(importResult?.imported !== undefined && { imported: importResult.imported }),
          ...(importResult?.processing !== undefined && { processing: importResult.processing }),
          ...(importResult?.message && { message: importResult.message }),
          ...(hasErrors && { errors: importResult.errors }),
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
        ...(hasErrors && { isError: true }),
      };
    }

    // File management tools
    case "upload_file": {
      enforceReadonlyMode("upload_file");
      const {
        path: filePath,
        url: fileUrl,
        dataUri,
        fileName,
        contentType,
        expiresAfter,
        public: isPublic,
        shareToken,
        metadata,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        path?: string;
        url?: string;
        dataUri?: string;
        fileName?: string;
        contentType?: string;
        expiresAfter?: number;
        public?: boolean;
        shareToken?: boolean;
        metadata?: Record<string, any>;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };

      const sources = [filePath, fileUrl, dataUri].filter(
        (v) => v !== undefined && v !== null && v !== ""
      );
      if (sources.length !== 1) {
        return {
          content: [
            {
              type: "text",
              text: "Error: exactly one of `path`, `url`, or `dataUri` must be provided.",
            },
          ],
          isError: true,
        };
      }

      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });

      let buffer: Buffer;
      let resolvedFileName = fileName;
      let resolvedContentType = contentType;

      if (filePath) {
        const absPath = resolve(filePath);
        if (!existsSync(absPath)) {
          return {
            content: [
              { type: "text", text: `Error: File not found: ${absPath}` },
            ],
            isError: true,
          };
        }
        buffer = readFileSync(absPath);
        if (!resolvedFileName) resolvedFileName = basename(absPath);
        if (!resolvedContentType) resolvedContentType = guessContentType(absPath);
      } else if (fileUrl) {
        const downloaded = await axios.get(fileUrl, {
          responseType: "arraybuffer",
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
        buffer = Buffer.from(downloaded.data);
        if (!resolvedFileName) {
          try {
            const parsedName = basename(new URL(fileUrl).pathname);
            resolvedFileName = parsedName || "download";
          } catch {
            resolvedFileName = "download";
          }
        }
        if (!resolvedContentType) {
          const headerType = downloaded.headers?.["content-type"];
          if (typeof headerType === "string") {
            resolvedContentType = headerType.split(";")[0].trim();
          } else {
            resolvedContentType = guessContentType(resolvedFileName);
          }
        }
      } else {
        const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri!);
        if (!match) {
          return {
            content: [
              {
                type: "text",
                text: "Error: invalid dataUri (expected `data:[<mime>][;base64],<payload>`).",
              },
            ],
            isError: true,
          };
        }
        const [, mime, base64Flag, payload] = match;
        buffer = base64Flag
          ? Buffer.from(payload, "base64")
          : Buffer.from(decodeURIComponent(payload), "utf-8");
        if (!resolvedContentType) resolvedContentType = mime || "application/octet-stream";
        if (!resolvedFileName) resolvedFileName = "upload";
      }

      const result = await apiClient.uploadFile(
        buffer,
        {
          fileName: resolvedFileName,
          contentType: resolvedContentType,
          expiresAfter,
          public: isPublic,
          shareToken,
          metadata,
        },
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    }

    case "list_files": {
      const {
        page,
        limit,
        query,
        sort,
        workspaceId,
        workspaceName,
        environment,
      } = args as {
        page?: number;
        limit?: number;
        query?: Record<string, any>;
        sort?: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.listFiles(
        { page, limit, query, sort },
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    }

    case "get_file": {
      const { fileId, workspaceId, workspaceName, environment } = args as {
        fileId: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.getFile(
        fileId,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    }

    case "delete_file": {
      enforceReadonlyMode("delete_file");
      const { fileId, workspaceId, workspaceName, environment } = args as {
        fileId: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.deleteFile(
        fileId,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    }

    // AI Knowledge tools
    case "ai_knowledge_query": {
      const { apiKey, environment, method, projectId, text, filters, numberOfSearchResults, history, tool_choice } = args as {
        apiKey: string;
        environment?: string;
        method?: 'query' | 'context';
        projectId: string;
        text: string;
        filters?: Array<{ field: string; type: string; value: string | string[] }>;
        numberOfSearchResults?: number;
        history?: { id?: string; messages?: Array<{ role: string; content: string }> };
        tool_choice?: string[];
      };

      // Get API URL from environment if provided
      let apiUrl = PRISME_API_BASE_URL;
      if (environment && environmentsConfig[environment]) {
        apiUrl = environmentsConfig[environment].apiUrl;
      }

      const params: AIKnowledgeQueryParams = {
        method,
        projectId,
        text,
        filters,
        numberOfSearchResults,
        history,
        tool_choice,
      };

      const result = await apiClient.aiKnowledgeQuery(params, apiKey, apiUrl);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "ai_knowledge_completion": {
      const { apiKey, environment, method, projectId, prompt, messages, model, temperature, max_tokens, stream, input, dimensions } = args as {
        apiKey: string;
        environment?: string;
        method: 'chat' | 'openai' | 'embeddings' | 'models';
        projectId?: string;
        prompt?: string;
        messages?: Array<{ role: string; content: string | any[] }>;
        model?: string;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
        input?: string | string[];
        dimensions?: number;
      };

      let apiUrl = PRISME_API_BASE_URL;
      if (environment && environmentsConfig[environment]) {
        apiUrl = environmentsConfig[environment].apiUrl;
      }

      const params: AIKnowledgeCompletionParams = {
        method,
        projectId,
        prompt,
        messages,
        model,
        temperature,
        max_tokens,
        stream,
        input,
        dimensions,
      };

      const result = await apiClient.aiKnowledgeCompletion(params, apiKey, apiUrl);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "ai_knowledge_document": {
      const { apiKey, environment, method, projectId, id, externalId, page, limit, filters, includeContent, includeMetadata, name, content, tags, parser, status, recrawl, replace, flags } = args as {
        apiKey: string;
        environment?: string;
        method: 'get' | 'list' | 'create' | 'update' | 'delete' | 'reindex' | 'download';
        projectId: string;
        id?: string;
        externalId?: string;
        page?: number;
        limit?: number;
        filters?: Array<{ field: string; type: string; value: string | string[] }>;
        includeContent?: boolean;
        includeMetadata?: boolean;
        name?: string;
        content?: { text?: string; url?: string };
        tags?: string[];
        parser?: 'project' | 'tika' | 'unstructured' | 'llm';
        status?: 'pending' | 'published' | 'inactive';
        recrawl?: boolean;
        replace?: boolean;
        flags?: string[];
      };

      // Enforce readonly mode for write operations
      if (['create', 'update', 'delete', 'reindex'].includes(method)) {
        enforceReadonlyMode(`ai_knowledge_document:${method}`);
      }

      let apiUrl = PRISME_API_BASE_URL;
      if (environment && environmentsConfig[environment]) {
        apiUrl = environmentsConfig[environment].apiUrl;
      }

      const params: AIKnowledgeDocumentParams = {
        method,
        projectId,
        id,
        externalId,
        page,
        limit,
        filters,
        includeContent,
        includeMetadata,
        name,
        content,
        tags,
        parser,
        status,
        recrawl,
        replace,
        flags,
      };

      const result = await apiClient.aiKnowledgeDocument(params, apiKey, apiUrl);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // App Instance handlers
    case "install_app_instance": {
      enforceReadonlyMode("install_app_instance");
      const { appInstance, workspaceId, workspaceName, environment } = args as {
        appInstance: AppInstance;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.installAppInstance(
        appInstance,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "list_app_instances": {
      const { workspaceId, workspaceName, environment } = args as {
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.listAppInstances(
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      // Return only summary info - use get_app_instance for full details
      const summary = result.map((instance) => ({
        slug: instance.slug,
        appSlug: instance.appSlug,
        appName: instance.appName,
        disabled: instance.disabled,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }

    case "get_app_instance": {
      const { instanceSlug, workspaceId, workspaceName, environment } = args as {
        instanceSlug: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.getAppInstance(
        instanceSlug,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "update_app_instance": {
      enforceReadonlyMode("update_app_instance");
      const { instanceSlug, appInstance, workspaceId, workspaceName, environment } = args as {
        instanceSlug: string;
        appInstance: Partial<AppInstance>;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.updateAppInstance(
        instanceSlug,
        appInstance,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "uninstall_app_instance": {
      enforceReadonlyMode("uninstall_app_instance");
      const { instanceSlug, workspaceId, workspaceName, environment } = args as {
        instanceSlug: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.uninstallAppInstance(
        instanceSlug,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "get_app_instance_config": {
      const { instanceSlug, workspaceId, workspaceName, environment } = args as {
        instanceSlug: string;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.getAppInstanceConfig(
        instanceSlug,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "update_app_instance_config": {
      enforceReadonlyMode("update_app_instance_config");
      const { instanceSlug, config, workspaceId, workspaceName, environment } = args as {
        instanceSlug: string;
        config: Record<string, any>;
        workspaceId?: string;
        workspaceName?: string;
        environment?: string;
      };
      const resolved = resolveWorkspaceAndEnvironment({
        workspaceId,
        workspaceName,
        environment,
      });
      const result = await apiClient.updateAppInstanceConfig(
        instanceSlug,
        config,
        resolved.workspaceId,
        resolved.apiUrl,
        resolved.environment
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "ai_knowledge_project": {
      const { apiKey, environment, workspaceName, method, id, page, perPage, search, category, owned, public: isPublic, withTools, withDatasources, name, description, ai, all } = args as {
        apiKey?: string;
        environment?: string;
        workspaceName?: string;
        method: 'get' | 'list' | 'create' | 'update' | 'delete' | 'tools' | 'datasources' | 'categories';
        id?: string;
        page?: number;
        perPage?: number;
        search?: string;
        category?: string;
        owned?: boolean;
        public?: boolean;
        withTools?: boolean;
        withDatasources?: boolean;
        name?: string;
        description?: string;
        ai?: { model?: string; prompt?: string; temperature?: number };
        all?: boolean;
      };

      // Enforce readonly mode for write operations
      if (['create', 'update', 'delete'].includes(method)) {
        enforceReadonlyMode(`ai_knowledge_project:${method}`);
      }

      // Methods that use Bearer token vs apiKey
      const usesBearerToken = ['list', 'create', 'categories'].includes(method);

      let auth: AIKnowledgeAuth;
      let apiUrl = PRISME_API_BASE_URL;
      let resolvedEnvironment: string | undefined = environment;

      if (usesBearerToken) {
        // These methods need Bearer token auth via workspaceName/environment
        if (!workspaceName && !environment) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Method "${method}" requires workspaceName or environment for Bearer token auth`,
              },
            ],
            isError: true,
          };
        }
        const resolved = resolveWorkspaceAndEnvironment({ workspaceName, environment });
        apiUrl = resolved.apiUrl;
        resolvedEnvironment = resolved.environment;
        auth = { type: 'bearer' };
      } else {
        // These methods need project apiKey
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Method "${method}" requires apiKey parameter`,
              },
            ],
            isError: true,
          };
        }
        if (environment && environmentsConfig[environment]) {
          apiUrl = environmentsConfig[environment].apiUrl;
        }
        auth = { type: 'apiKey', apiKey };
      }

      const params: AIKnowledgeProjectParams = {
        method,
        id,
        page,
        perPage,
        search,
        category,
        owned,
        public: isPublic,
        withTools,
        withDatasources,
        name,
        description,
        ai,
        all,
      };

      const result = await apiClient.aiKnowledgeProject(params, auth, apiUrl, resolvedEnvironment);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "set_token": {
      const { environment, token, apiUrl, studioUrl, nodeExtraCaCerts } = args as {
        environment: string;
        token: string;
        apiUrl?: string;
        studioUrl?: string;
        nodeExtraCaCerts?: string;
      };

      if (!environment) {
        throw new Error("`environment` is required");
      }
      if (!token) {
        throw new Error("`token` is required");
      }

      const existing = environmentsConfig[environment];
      if (!existing && !apiUrl) {
        const available = Object.keys(environmentsConfig).join(", ") || "(none)";
        throw new Error(
          `Unknown environment "${environment}" (available: ${available}). ` +
            `Pass \`apiUrl\` (e.g. https://api.sandbox.prisme.ai/v2) to register it as a new environment.`
        );
      }

      const envCfg = {
        ...(existing ?? {}),
        apiUrl: apiUrl ?? existing!.apiUrl,
        ...(studioUrl ? { studioUrl } : {}),
        ...(nodeExtraCaCerts ? { nodeExtraCaCerts } : {}),
      };

      // Probe-validate the token before persisting anything: an invalid token
      // must fail here and persist nothing.
      let me: any;
      try {
        me = await apiClient.probeToken(
          envCfg.apiUrl,
          token,
          envCfg.nodeExtraCaCerts
        );
      } catch (err: any) {
        const status = err?.response?.status;
        const tokenUrl = deriveTokenUrl(envCfg);
        throw new Error(
          `Token validation failed against ${envCfg.apiUrl}` +
            (status ? ` (HTTP ${status})` : "") +
            `. Nothing was persisted. Create a valid token at ${tokenUrl ?? "<studio>/settings/tokens"} and try again.`
        );
      }

      // Update in-memory state
      environmentsConfig[environment] = { ...envCfg, apiKey: token };
      apiClient.upsertEnvironment(environment, { ...envCfg, apiKey: token });

      // Persist: token to credentials.json (600), topology (no tokens) to config.json
      const credentialsPath = await persistToken(environment, token);
      const topology: StoredTopology = { environments: {} };
      for (const [envName, env] of Object.entries(environmentsConfig)) {
        const { apiKey: _omit, ...rest } = env;
        topology.environments[envName] = rest;
      }
      await persistTopology(topology);

      const summary = {
        environment,
        apiUrl: envCfg.apiUrl,
        studioUrl: envCfg.studioUrl,
        nodeExtraCaCerts: envCfg.nodeExtraCaCerts,
        validatedAs: me?.email ?? me?.id ?? "(authenticated)",
        persistedTo: credentialsPath,
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
