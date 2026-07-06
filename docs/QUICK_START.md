# Quick Start

Install the Prisme.ai plugin from GitHub and start using the bundled MCP server, skills, agents, and DSUL linter in Claude Code or Codex.

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)

## Installation

```bash
# Clone the repository
git clone https://github.com/prisme-ai/mcp-prisme.ai.git
cd mcp-prisme.ai

# Run the setup script
./claudeBootstrap/setup.sh
```

## What the Setup Does

The script guides you through:

| Step | Description |
|------|-------------|
| Prerequisites check | Verifies Node.js, npm, Claude CLI, installs jq if needed |
| Anthropic API key | Optional - configure if you don't have Claude Max |
| Build | Compiles the MCP server |
| Prisme.ai environments | Add one or more environments with custom API URLs and JWT tokens |
| Feedback tools | Choose whether to enable bug reporting tools |
| Agent installation | Installs the `prisme-assistant` agent |

### Environment Setup Flow

During fresh install, you'll be prompted to add environments:

1. **"Do you want to add a Prisme.ai environment?"** - Answer `y` to add an environment
2. **Environment name** - e.g., `sandbox`, `staging`, `prod`, or any custom name
3. **API URL** - e.g., `https://api.sandbox.prisme.ai/v2`
4. **JWT token** - Found in browser: Inspect > Application > Cookies > `access-token` (starts with `ey...`)
5. Repeat to add more environments, or answer `n` to finish

## Setup Modes

| Mode | Use Case |
|------|----------|
| **Fresh install** | First-time setup |
| **Update** | Rebuild server and update agent (preserves API keys) |
| **Update API key** | Add or update an environment API key |
| **Toggle feedback tools** | Enable/disable bug reporting tools (privacy control) |

## What Gets Installed

| Component | Description |
|-----------|-------------|
| MCP Server (`prisme-ai-builder`) | Workspaces, automations, apps, events, files, AI Knowledge, DSUL linter |
| Skills (`/prisme-ai:*`) | Connector scaffolding/testing/docs, A2UI, agent workspaces, `prisme-assistant`, `ticket-validator` — see `/prisme-ai:guide` |
| Agents (Claude only) | `code-review`, `prisme-assistant` |
| Hooks (Claude only) | `allow-workspace.sh` workspace allowlist template |

### Project Setup (Optional)

To enable Prisme.ai context in your projects, copy the `.claude` folder:

```bash
cp -r /path/to/mcp-prisme.ai/claudeBootstrap/dot_claude /path/to/your/project/.claude
```

This folder contains `CLAUDE.md` with Prisme.ai-specific instructions for Claude Code.

## After Setup

Run `/prisme-ai:guide` for the skills catalog and Prisme.ai context. In Claude Code, type `@` to see available `mcp__prisme-ai-builder__*` tools. In Codex, plugin MCP tools may be loaded lazily; use a request that clearly needs Prisme.ai tools, or search for the Prisme.ai Builder tools.

## Verify Installation

Test with a simple command in Claude:

```
List all automations in the ai-knowledge workspace on <env>
```

---

**Next:** [Available Tools](./TOOLS.md) | [Environment Configuration](./ENVIRONMENTS.md)
