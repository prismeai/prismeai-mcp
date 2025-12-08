#!/usr/bin/env bash
#
# setup.sh - Claude Code + Prisme.ai MCP Setup
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_PATH="$PROJECT_DIR/build/index.js"

echo "=== Claude Code + Prisme.ai Setup ==="
echo ""

# 1. Check prerequisites
echo "[1/4] Checking prerequisites..."
command -v node >/dev/null || { echo "Error: Node.js required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null || { echo "Error: npm required"; exit 1; }
command -v claude >/dev/null || { echo "Error: Claude Code CLI required. Install: npm install -g @anthropic-ai/claude-code"; exit 1; }
echo "  Node.js $(node --version)"
echo "  Claude CLI installed"

# 2. Build MCP server
echo ""
echo "[2/4] Building MCP server..."
(cd "$PROJECT_DIR" && npm install && npm run build)

# 3. Get API key
echo ""
echo "[3/4] Configuring MCP server..."
echo ""
echo "Environment options:"
echo "  sandbox - https://api.sandbox.prisme.ai"
echo "  prod    - https://api.studio.prisme.ai"
echo ""
read -p "Select default environment (sandbox/prod) [sandbox]: " ENV_CHOICE
ENV_CHOICE="${ENV_CHOICE:-sandbox}"

read -sp "Enter your Prisme.ai API key (JWT token): " PRISME_API_KEY
echo ""

if [[ -z "$PRISME_API_KEY" ]]; then
    echo "Error: API key required"
    exit 1
fi

# Define environments configuration
# Update these workspace IDs for your organization
ENVIRONMENTS_JSON=$(cat <<'EOF'
{
  "sandbox": {
    "apiUrl": "https://api.sandbox.prisme.ai/v2",
    "workspaces": {
      "ai-knowledge": "gQxyd2S",
      "ai-store": "K5boVst"
    }
  },
  "prod": {
    "apiUrl": "https://api.studio.prisme.ai/v2",
    "workspaces": {
      "ai-knowledge": "wW3UZla",
      "ai-store": "KgIMCs2"
    }
  }
}
EOF
)

# Set default workspace based on environment
if [[ "$ENV_CHOICE" == "prod" ]]; then
    DEFAULT_WORKSPACE="wW3UZla"
    API_URL="https://api.studio.prisme.ai/v2"
else
    DEFAULT_WORKSPACE="gQxyd2S"
    API_URL="https://api.sandbox.prisme.ai/v2"
fi

# Remove existing server if present
claude mcp remove prisme-ai-builder 2>/dev/null || true

# Add MCP server with environment variables
claude mcp add prisme-ai-builder \
    -e PRISME_API_KEY="$PRISME_API_KEY" \
    -e PRISME_API_BASE_URL="$API_URL" \
    -e PRISME_WORKSPACE_ID="$DEFAULT_WORKSPACE" \
    -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
    -- node "$BUILD_PATH"

echo "  MCP server configured"

# 4. Install agent
echo ""
echo "[4/4] Installing Prisme assistant agent..."
mkdir -p ~/.claude/agents
cp "$SCRIPT_DIR/prisme-assistant.yml" ~/.claude/agents/
echo "  Agent installed"

# Done
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Usage:"
echo "  claude                          # Start Claude Code"
echo "  claude --agent prisme-assistant # Use Prisme agent"
echo ""
echo "Test: Type '@' in Claude to see mcp__prisme-ai-builder__* tools"
echo ""
echo "Workspaces available via workspaceName parameter:"
echo "  ai-knowledge, ai-store (for $ENV_CHOICE environment)"
