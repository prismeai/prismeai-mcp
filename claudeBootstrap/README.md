# Claude Code + Prisme.ai Setup

## Quick Start

```bash
./claudeBootstrap/setup.sh
```

Requires: Node.js 18+, Claude Code CLI (`npm i -g @anthropic-ai/claude-code`)

## Manual Setup

If you prefer not to run the script:

```bash
# 1. Build
npm install && npm run build

# 2. Add MCP server (sandbox)
claude mcp add prisme-ai-builder \
  -e PRISME_API_KEY="your-jwt-token" \
  -e PRISME_API_BASE_URL="https://api.sandbox.prisme.ai/v2" \
  -e PRISME_WORKSPACE_ID="gQxyd2S" \
  -e PRISME_ENVIRONMENTS='{"sandbox":{"apiUrl":"https://api.sandbox.prisme.ai/v2","workspaces":{"ai-knowledge":"gQxyd2S","ai-store":"K5boVst"}}}' \
  -- node "$(pwd)/build/index.js"

# 3. Install agent
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
