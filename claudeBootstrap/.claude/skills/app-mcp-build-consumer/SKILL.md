---
name: app-mcp-build-consumer
description: Build or audit Prisme.ai App+MCP consumer DSUL workspaces that consolidate tests for a target App surface and its MCP server through Agent Factory agents. Use when implementing, recreating, or assessing connector consumer workspaces.
---

# App MCP Consumer

Use this skill to implement or assess a Prisme.ai `*-consumer` workspace. Consumer workspaces are thin integration-test workspaces: they configure credentials, call imported App surfaces, create temporary Agent Factory agents for MCP tool calls, and assert contracts. They must not duplicate product logic from the target App or MCP workspace.

## Workflow

1. Read this skill before editing.
2. Work locally only. Do not mutate remote workspace state unless the user explicitly asks.
3. If recreating a deleted consumer, create the scaffold first, then explore local target workspaces.
4. If a local consumer already exists, inspect it only to infer expected operation coverage, fixtures, and response assertions. Do not copy unrelated historical surfaces blindly.
5. Explore locally and timebox it. Read the target App workspace, target MCP workspace, and one or two nearby consumers only until you can identify current operations, tool names, credentials, fixture needs, and response shapes.
6. Build a coverage matrix from the local source:
   - every supported App operation must have an App test;
   - every supported MCP tool must have an Agent Factory agent test;
   - unsafe or unsupported operations must have an explicit skip reason.
7. Add/update `docs/{workspace}/automations.md`.
8. Run local checks:
   - YAML parse for every `workspaces/{workspace}/**/*.yml`
   - automation filename equals `slug`
   - no `{{secret.*}}` in automations/imports
   - no YAML `#` comments in automations
   - no snake_case MCP config fields
   - no spaced import aliases
9. Do not stage, commit, or push.

## Scope Rules

- Generate tests only for the current target App import and current target MCP server.
- Do not create tests for unrelated chat, page, document, historical, or cross-product surfaces unless the user explicitly includes them.
- Do not create direct MCP JSON-RPC tests for tool behavior. MCP tool coverage must go through an Agent Factory agent that has the target MCP server attached. A narrow DSUL `fetch` transport-contract test is allowed and expected for `initialize`, `notifications/initialized`, and `tools/list` HTTP status/body compliance.
- Do not create UI/pages unless the user asks for UI/pages.
- Prefer comprehensive tool coverage over a small smoke-test subset.

## Naming

| Item | Convention |
|---|---|
| Workspace folder | kebab-case `{service}-consumer` |
| Workspace slug | kebab-case `{service}-consumer` |
| Workspace name | `{Service} Consumer` |
| Labels | lower-case domain labels plus `consumer`, `test` |
| Import alias | PascalCase, no spaces |
| Import file | Same as import alias |
| Automation slug/file | camelCase, exact match |
| Test slug/file | `test{Operation}` or `testMcp{Tool}` |
| Agent helper | `_call{Service}McpWithAgent` or `_runMcpToolWithAgent` |
| Fixture helper | leading underscore, private |
| Aggregator | `testRunAll` |
| Secret key | lowerCamel |
| Config field | lowerCamel |
| Test fixture config | lowerCamel under `test` |

Keep the leading underscore only for private helpers. Do not copy existing kebab-case consumer automation names unless the workspace already requires them for compatibility.

## Layout

```text
workspaces/{service}-consumer/
+-- index.yml
+-- security.yml
+-- .import.yml
+-- imports/
|   +-- {AppAlias}.yml
|   +-- {AgentFactoryAlias}.yml
+-- automations/
    +-- {operationName}.yml
    +-- test{OperationName}.yml
    +-- _runMcpToolWithAgent.yml
    +-- testMcp{ToolName}.yml
    +-- testRunAll.yml
docs/{service}-consumer/
+-- automations.md
```

Operation wrappers are optional, but useful when tests should read as a stable consumer API.

## Discovery And Coverage

Discover current coverage from local files before writing final tests:

1. Identify the target App import and its public operations.
2. Identify the target MCP workspace and its exposed tool names.
3. Read the operation and tool implementations only enough to know argument names, required credentials, response shapes, and safe fixture needs.
4. Build a matrix with one row per App operation and one row per MCP tool.
5. Mark each row as tested, skipped, or out of scope. Skips require a concrete reason in the test output and docs.

Do not require remote metadata fields that appear only after publishing, such as workspace IDs, checksums, export timestamps, or equivalent generated import metadata. Minimal `security.yml` forms are acceptable when they preserve the same local behavior as nearby consumers.

## Secrets And Config

Declare secrets in `index.yml` under `secrets.schema`, reference them from `config.value`, and read only `{{config.*}}` in automations/imports.

```yaml
config:
  value:
    serviceMcpSlug: service-mcp
    serviceMcpApiKey: '{{secret.serviceMcpApiKey}}'
    agentFactoryApiKey: '{{secret.agentFactoryApiKey}}'
secrets:
  schema:
    serviceMcpApiKey:
      type: string
      title: Service MCP API Key
      ui:widget: password
    agentFactoryApiKey:
      type: string
      title: Agent Factory API Key
      ui:widget: password
```

Do not use `{{secret.*}}` inside automations or import files.

## App Tests

For every supported App operation:

1. Create a focused test automation.
2. Call the App import or local wrapper.
3. Assert the operation contract from the target implementation, not just absence of errors.
4. For list/search/read operations, assert collection presence, numeric counts when present, and required item identity fields.
5. For create/update/delete/action operations, use disposable fixtures and cleanup.
6. If required fixture config is missing, return success with `testsSkipped`, `testsPassed: 0`, and a clear `skippedReason`.

Mutation tests must not mutate shared fixtures unless explicitly marked destructive and requested by the user.

## Agent Factory MCP Tests

For every supported MCP tool, create a test that proves Agent Factory can call that tool.

Required flow:

1. Create a temporary Agent Factory agent.
2. Attach the target MCP server to the agent with config-backed URL and headers.
3. Send a message that instructs the agent to call the exact MCP tool with explicit arguments.
4. Assert the send call has no error.
5. Assert `sendResult.task.status.state == "completed"`.
6. Assert `sendResult.task.tool_calls` exists and is non-empty.
7. Assert one tool call matches the expected tool name.
8. Assert the matching tool call status is `completed` or another success value documented for that platform response.
9. Delete the temporary agent even when setup, send, or assertions fail.

Do not pass an MCP test based on final natural-language answer text. The tool-call trace is the source of truth.

Use one shared private helper for the repeated Agent Factory setup/send/cleanup flow when more than one MCP tool is tested. Individual `testMcp{ToolName}` automations should prepare tool arguments, call the helper, and assert the returned tool-call trace plus any structured result that is available.

Required cleanup shape:

```yaml
- set:
    name: agentId
    value: ''
- try:
    do:
      - AgentFactory.createAgent:
          output: createdAgent
      - set:
          name: agentId
          value: '{{createdAgent.id}}'
      - AgentFactory.addTool:
          agent_id: '{{agentId}}'
          output: addedTool
      - AgentFactory.sendMessage:
          agent_id: '{{agentId}}'
          output: sendResult
    catch:
      - set:
          name: errors
          type: push
          value: 'Agent MCP test crashed: {{$error.message}}'
- conditions:
    '{{agentId}}':
      - try:
          do:
            - AgentFactory.deleteAgent:
                agent_id: '{{agentId}}'
                output: deleteAgentResult
          catch:
            - set:
                name: errors
                type: push
                value: 'Cleanup failed for temporary agent {{agentId}}: {{$error.message}}'
```

Adapt the import alias to the local Agent Factory import, but keep the workflow and assertions.

## MCP Transport Contract Tests

Consumer workspaces should include a direct webhook transport test for the target MCP endpoint, using DSUL `fetch`, in addition to Agent Factory tool-call coverage.

The transport test must call the deployed MCP webhook and assert the actual HTTP status/body contract:

- `initialize` with a JSON-RPC `id` returns HTTP 200 and a JSON-RPC result.
- `notifications/initialized` without an `id` returns HTTP 202 and an empty body.
- `tools/list` with a JSON-RPC `id` returns HTTP 200 and `result.tools`.

Do not use direct MCP JSON-RPC tests as the only MCP coverage. Agent Factory tests remain required for tool-call behavior. The direct fetch test exists only to catch HTTP transport regressions that `execute_automation` and Agent Factory tool assertions can hide, especially webhook serialization bugs like empty notification responses being coerced to `{}`.

## Fixtures

Prefer disposable resources for mutating tests.

- Create disposable setup resources immediately before the operation under test.
- Save cleanup identifiers immediately after creation.
- Cleanup whenever the identifier exists, including after caught failures.
- If a safe mutation path cannot be inferred, skip explicitly.
- Use tokenized file URLs for file-upload style tests.
- Factor repeated setup/cleanup into private helpers once two or more tests need the same fixture lifecycle.

## Aggregator

Every consumer should expose `testRunAll`. It must:

- initialize `results`, `totalRun`, `totalPassed`, `totalFailed`, `totalSkipped`, and `allErrors`;
- run every generated App test and every generated Agent Factory MCP test in dependency order;
- wrap each suite in `try/catch`;
- push every suite result;
- aggregate totals from suite outputs;
- prefix suite errors with the suite label;
- include per-suite results in output.

Full `testRunAll` runs may take longer than the client timeout, especially when many Agent Factory MCP tests are included. A client timeout does not automatically mean the execution failed.

When a full run times out, inspect the activity feed/events for the run correlation ID after the execution finishes. Use the trace to recover the completed suite result, failed step, and final output.

## Docs

Create or update `docs/{workspace}/automations.md` with:

- target App import and Agent Factory import;
- secrets/config contract;
- operation wrappers;
- private fixture or Agent Factory helpers;
- App tests;
- Agent Factory MCP tests;
- `testRunAll`;
- a coverage table with operation/tool, App test, Agent Factory MCP test, fixture needs, cleanup behavior, and skip condition.

## DSUL Rules

- Use `comment:` instructions, not YAML `#` comments.
- Use `set: type: push` for array appends.
- Argument types are only `string`, `number`, `object`, `array`, `boolean`.
- Do not combine `required: true` and `properties` on the same argument node.
- Use `private: true` for helpers and internal test suites.
- Use `{{variable}}` for substitution and `{% expression %}` for computed values.
- Keep `matches`, `and`, and `or` in condition keys, not inside `{% %}` expressions.
