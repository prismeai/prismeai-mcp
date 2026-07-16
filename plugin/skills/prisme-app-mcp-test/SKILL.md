---
name: prisme-app-mcp-test
description: Create or update a Prisme.ai App+MCP consumer workspace that hosts durable end-to-end tests for a connector, then run and repair the consumer or connector until the suite passes. Use when testing an App+MCP connector, creating its `*-consumer` workspace, consolidating connector coverage, or diagnosing failing connector E2E automations.
---

# Test an App + MCP connector through its consumer workspace

Treat the `{connector}-consumer` workspace as the durable E2E test harness. Create or update it first, run its automations, and iterate there until the connector works or the remaining failure is proven external.

Read `../app-mcp-implement/SKILL.md` before generating tests. The connector follows the current tenant-context model: the consumer is the tenant, the connector is installed as an app instance, and MCP calls go through Agent Factory with `context_id,agent_id,user_id` scope.

## Non-negotiable rules

- Default to `sandbox`. Work on `prod` only after explicit confirmation.
- Never request credentials in chat or write them into workspace files. Configure them through the connector config UI and workspace secret store.
- Never use `mcpApiKey`, HMAC, `generateKey`, `getConfig`, `appSecret`, `ensureAuthentication`, `$secret:` injection, or direct credential injection into `routeToolCall`.
- Do not call connector helpers such as `routeToolCall`, `toolRestOp`, or `methodRestOp` as proof of E2E behavior. Exercise the public App operation or MCP endpoint.
- Consumer fixes are in scope after the user confirms the target and environment. Before changing or publishing the connector itself, show the diagnosis and obtain approval.
- Never turn a real auth, permission, quota, or provider failure into a passing test.

## 1. Lock the target and its contract

Collect the connector slug, local workspace path, and environment. Locate the connector locally; pull it only when no current local source exists.

Inspect and resolve the deployed contract, not only the local source:

1. Resolve the published App slug from `index.yml`, `.import.yml`, and the App registry. Enumerate public App operations from the published registry/wrappers; do not assume `index.yml` is complete.
2. Record the local connector revision, published App version, installed app-instance slug, and installed version. If the installed contract is stale, stop and propose the smallest publish/reinstall step before generating assertions.
3. Read `imports/MCP Core.yml` for the MCP tool contract. Compare it with `config.value.mcpTools`; mismatch is a connector defect.
4. Read each MCP tool input schema. When a grouped tool exposes an `action` enum, create one coverage case per `tool + action`, not merely one case per tool.
5. Read `buildAppAuth.yml`, `mcp.yml`, and the public operation wrappers only far enough to identify auth modes, safe fixtures, response contracts, and cleanup needs.

Produce a coverage matrix with one row per App operation and per MCP `tool + action`. Mark every row `planned`, `covered`, or `skipped` with a concrete reason.

## 2. Create or update the consumer

Use `{connector-slug}-consumer` for both workspace slug and local folder. Search the selected environment first.

- If it does not exist, create it with labels `consumer`, `test`, and `app-mcp`, then scaffold the local workspace.
- If it exists, pull the current workspace before editing unless the local checkout is already the declared source of truth.
- Install or import the published connector App and Agent Factory. The connector app instance must run inside the consumer workspace.
- Keep credentials in the connector app instance. Store only non-secret identifiers and fixture settings in consumer config.

Use this minimal layout:

```text
workspaces/{connector}-consumer/
├── index.yml
├── security.yml
├── .import.yml
├── imports/
│   ├── {Connector}.yml
│   └── Agents.yml
└── automations/
    ├── _fixtureSetup.yml
    ├── _fixtureCleanup.yml
    ├── _runMcpCase.yml
    ├── testApp.yml
    ├── testMcpBatch01.yml
    ├── testMcpAuthorization.yml
    ├── testMcpTransport.yml
    └── testRunAll.yml
```

Prefer table-driven cases and bounded batches. Add a dedicated automation only when a case needs distinct setup, assertions, or cleanup; do not create hundreds of nearly identical files or one unbounded aggregator.

### Test agent

Use a dedicated, reusable Agent Factory test agent whose ID and organization are stored in consumer config. A stable agent is preferred because tenant connectors authorize agent IDs. Reuse its model when it already exists; if a new agent is required, ask the user to choose the model and deploy it through the current `agent-builder`/AgentBuilderSync user-context workflow in the target organization.

The test agent must have the connector MCP capability configured with:

- server: the consumer app instance MCP endpoint;
- scope: `context_id,agent_id,user_id`;
- a fresh task or conversation for each test case so cached MCP registries do not hide changes.

Run Agent Factory calls as the triggering user where supported. If the installed `Agents` App contract requires an organization key for test execution, declare `agentFactoryApiKey` in the consumer secret schema and reference it only from `imports/Agents.yml`; never place its value in source or test input. This credential is for the test harness, not an MCP authentication mechanism.

Authorize the test agent explicitly through the connector config UI. The `*` sentinel may be used temporarily in sandbox to diagnose an allowlist problem, but it must be reverted and cannot satisfy completion. Do not add a plugin hook or reintroduce an MCP key to bypass connector authorization.

## 3. Generate durable E2E tests

### App surface

For each supported public App operation:

1. Call the installed connector import.
2. Assert its response contract, not just the absence of an error.
3. Use disposable fixtures for mutations and always clean them up.
4. Skip only when a required safe fixture cannot be created; return the reason in structured output.

### MCP behavior

For every MCP `tool + action` case:

1. Send an explicit prompt and arguments through the configured Agent Factory test agent.
2. Assert the Agent Factory task completed.
3. Assert `task.tool_calls` contains the expected MCP tool, the matching call completed, and its arguments contain the expected `action` plus the critical fixture identifiers.
4. Assert structured result fields when the connector contract exposes them. If `tool_calls` is not returned directly, recover the tool trace from correlated events. Do not validate only the final natural-language answer.

Keep one authorization test using a second, non-authorized test agent. It must prove the connector denies that agent while the explicitly authorized agent succeeds with the required `context_id,agent_id,user_id` scope.

### MCP transport

Keep one direct transport test, limited to protocol behavior:

- `initialize` returns HTTP 200 and a JSON-RPC result;
- `notifications/initialized` returns HTTP 202 with an empty body;
- `tools/list` returns HTTP 200 and `result.tools` matching the declared contract.

Direct JSON-RPC does not replace Agent Factory tool-call coverage.

### Aggregator and documentation

Make `testRunAll` execute setup, bounded App/MCP batches, transport, authorization, and cleanup in dependency order. Aggregate passed, failed, blocked, skipped, errors, and per-suite results. Cleanup must run in a finalization path whenever a fixture ID exists.

Use `skipped` only for an operation intentionally excluded for a documented safety or product-contract reason. Missing auth, permission, quota, provider availability, or required tenant data is `blocked`, never a passing skip.

Update `docs/{connector}-consumer/automations.md` with the coverage matrix, fixture requirements, cleanup behavior, config contract, and skip reasons.

## 4. Validate and deploy the consumer

Before each push:

1. Parse every YAML file.
2. Ensure each automation filename matches its `slug`.
3. Run `validate_automation` on all changed automations.
4. Confirm there is no literal secret value. A declared `{{secret.*}}` binding is allowed only where an installed App contract requires it, such as `imports/Agents.yml`.
5. Push only the consumer workspace to the selected environment with a short valid version message.

If connector authentication is not configured, stop after deployment and give the user the config UI path. Resume once the app instance reports ready; do not collect the secret yourself.

## 5. Run, diagnose, fix, rerun

Execute `testRunAll` in the consumer workspace.

If the client times out, do not assume failure. Search events by correlation ID, recover the terminal automation output, and run the failing test automation alone when needed.

Classify each failure:

- **Consumer/test defect**: wrong assertion, stale import, bad fixture, cleanup, or Agent Factory wiring. Fix the consumer, validate, push, rerun the targeted test, then rerun `testRunAll`.
- **Connector defect**: wrong public operation, MCP schema, dispatcher mapping, auth resolution, HTTP request, output formatting, or transport status. Show the root cause and proposed diff. After approval, fix and validate the connector, push it, publish the updated App, verify the installed version, then rerun the targeted consumer test and full suite.
- **External condition**: missing user authorization, invalid tenant data, provider permission, quota, rate limit, or outage. Mark the suite blocked with an actionable reason; do not convert it into a passing skip.

Use `search_events` on the consumer correlation first, then follow child correlations into the connector. Do not patch both workspaces speculatively.

Stop and report instead of looping forever when the same blocking condition occurs three times without new evidence.

## Completion criteria

Finish only when:

- `testRunAll` has zero failures and zero blocked cases;
- MCP transport tests pass;
- every App operation and MCP `tool + action` is covered or has an explicit justified skip;
- explicit authorized and unauthorized agent checks pass; wildcard authorization is disabled;
- all disposable fixtures are cleaned up;
- the consumer coverage documentation matches the executed suite;
- any connector change was validated, published, and proven by a rerun from the consumer.

Report the consumer workspace/environment, totals, skipped cases, fixes applied to each workspace, and any remaining external prerequisite.
