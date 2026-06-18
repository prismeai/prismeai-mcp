---
name: guide
description: Index of the custom Prisme.ai skills installed in this repo. Use this when starting work and unsure which skill applies, or to discover what is available.
allowed-tools: Read, AskUserQuestion
---

# Prisme.ai skills catalog

This repo ships a set of custom skills for Prisme.ai workspace development. They are grouped by domain below — pick the one that matches your task.

---

## App + MCP connectors

The connector workflow: scaffold a new SaaS connector, test it, consolidate tests in a consumer workspace, document it, and keep the whole fleet in sync over time.

| Skill | When to use |
|---|---|
| `/app-mcp-implement` | Scaffold a brand-new App + MCP workspace for a third-party SaaS (REST or GraphQL). Produces `index.yml`, `security.yml`, `.import.yml`, helpers, Custom Code, MCP Core, tool/method automations, and pushes to the target env. |
| `/app-mcp-test` | E2E smoke-test the tools exposed by an existing App + MCP workspace. Asks for credentials, lists every MCP tool, executes them one by one, fixes errors until the suite passes. Supports static tokens, Basic, OAuth2 client-credentials, and OAuth2 authorization-code (PKCE). |
| `/app-mcp-build-consumer` | Build or audit the matching `*-consumer` workspace that consolidates the proven smoke-test coverage into a durable DSUL test suite. Typically chained after `/app-mcp-test`. |
| `/app-mcp-document` | Generate the public MDX documentation page for an existing connector in the `prismeai/docs` repo (Mintlify). Mirrors the layout of existing pages like `gryzzly.mdx`, `data-galaxy.mdx`. |
---

## Agent UI surfaces

| Skill | When to use |
|---|---|
| `/agent-implement-a2ui` | Add A2UI (Agent-to-UI) surfaces to a Prisme.ai MCP workspace so that LLM agents can render interactive UI (cards, forms, tables, action-cards, confirmations…) through MCP tool calls. The host UI reads the tool's `__surface` payload and renders it from the `prisme://blocks/v1` catalog. |

---

## Embedded React apps

| Skill | When to use |
|---|---|
| `/workspace-page-implement` | Edit (or bootstrap) the React app embedded in a Prisme.ai workspace following the [starter-spa](https://github.com/prismeai/starter-spa) pattern. Modifies `src/` (React) and/or `automations/` (DSUL), builds the CJS bundle, and pushes to the workspace. |

---

## Quick reference

| Situation | Skill |
|---|---|
| Build a new third-party SaaS connector (App + MCP) | `/app-mcp-implement` |
| Test the tools of an existing connector with real credentials | `/app-mcp-test` |
| Consolidate test coverage into a `*-consumer` workspace | `/app-mcp-build-consumer` |
| Write or update the public docs of a connector | `/app-mcp-document` || Render interactive UI from agent tool calls | `/agent-implement-a2ui` |
| Edit the React frontend of a workspace | `/workspace-page-implement` |
| I don't know where to start | `/guide` (this) |
