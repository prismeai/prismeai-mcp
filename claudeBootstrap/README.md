# Claude Code + Prisme.ai Setup

## Quick Start

```bash
./claudeBootstrap/setup.sh
```

Requires: Node.js 18+, Claude Code CLI (`npm i -g @anthropic-ai/claude-code`)

## Project Setup

Copy the `.claude` folder to the root of your project where Claude Code will be executed:

```bash
cp -r ./claudeBootstrap/.claude /path/to/your/project/
```

This folder contains Prisme.ai-specific instructions, agents, and skills for Claude Code.

**Getting started**: Once in your project, run `/guide` to learn the full Prisme.ai development workflow.

## Manual Setup

If you prefer not to run the script:

```bash
# 1. Configure Anthropic API key (creates helper script + settings)
mkdir -p ~/.claude
echo '#!/bin/sh
echo "your-anthropic-api-key"' > ~/.claude/anthropic-api-key.sh
chmod 700 ~/.claude/anthropic-api-key.sh
# Add apiKeyHelper to settings.json
echo '{"apiKeyHelper": "~/.claude/anthropic-api-key.sh"}' > ~/.claude/settings.json
# Or merge into existing: jq '. + {apiKeyHelper: "~/.claude/anthropic-api-key.sh"}' ~/.claude/settings.json

# 2. Build
npm install && npm run build

# 3. Add MCP server (sandbox)
claude mcp add prisme-ai-builder \
  -e PRISME_API_KEY="your-jwt-token" \
  -e PRISME_API_BASE_URL="https://api.sandbox.prisme.ai/v2" \
  -e PRISME_WORKSPACE_ID="gQxyd2S" \
  -e PRISME_ENVIRONMENTS='{"sandbox":{"apiUrl":"https://api.sandbox.prisme.ai/v2","workspaces":{"ai-knowledge":"gQxyd2S","ai-store":"K5boVst"}}}' \
  -- node "$(pwd)/build/index.js"

# 4. Install agent
cp claudeBootstrap/prisme-assistant.yml ~/.claude/agents/
```

## Usage

```bash
claude                          # Start, type '@' to see prisme tools
claude --agent prisme-assistant # Use Prisme-specific agent
```

## Workspaces

Use `workspaceName` parameter in tools to target specific workspaces:
- `ai-knowledge` - AI Knowledge product
- `ai-store` - AI Store product

## Troubleshooting

```bash
claude mcp list                 # Check server is registered
claude mcp remove prisme-ai-builder  # Remove and re-add if issues
```

## Changelog

### 2026-01-21
- Renamed `dot_claude` folder to `.claude`
- Added `/guide` skill for onboarding new users
- Added skills: `/design`, `/gitlab-ticket`, `/workspace-edit`
- Added agents: `code-review`, `prisme-assistant`, `ticket-validator`
