#!/usr/bin/env bash
#
# setup.sh - Claude Code + Prisme.ai MCP Setup
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_PATH="$PROJECT_DIR/build/index.js"
CLAUDE_CONFIG_DIR="$HOME/.claude"
API_KEY_HELPER_PATH="$CLAUDE_CONFIG_DIR/anthropic-api-key.sh"

echo "=== Claude Code + Prisme.ai Setup ==="
echo ""

# 1. Check prerequisites
echo "[1/5] Checking prerequisites..."
command -v node >/dev/null || { echo "Error: Node.js required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null || { echo "Error: npm required"; exit 1; }
command -v claude >/dev/null || { echo "Error: Claude Code CLI required. Install: npm install -g @anthropic-ai/claude-code"; exit 1; }
echo "  Node.js $(node --version)"
echo "  Claude CLI installed"

# 2. Configure Anthropic API key
echo ""
echo "[2/5] Configuring Anthropic API key..."
echo "Retrieve it from https://studio.prisme.ai/fr/workspaces/wW3UZla/settings/advanced"
read -sp "Enter your Anthropic API key (sk-ant-...): " ANTHROPIC_API_KEY
echo ""

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    echo "Error: Anthropic API key required"
    exit 1
fi

# Create API key helper script
mkdir -p "$CLAUDE_CONFIG_DIR"
cat > "$API_KEY_HELPER_PATH" << EOF
#!/bin/sh
echo "$ANTHROPIC_API_KEY"
EOF
chmod 700 "$API_KEY_HELPER_PATH"
echo "  API key helper created at $API_KEY_HELPER_PATH"

# Configure Claude Code to use the helper via settings.json
SETTINGS_FILE="$CLAUDE_CONFIG_DIR/settings.json"
if [[ -f "$SETTINGS_FILE" ]]; then
    # Merge apiKeyHelper into existing settings using jq or Python
    if command -v jq >/dev/null; then
        TMP_FILE=$(mktemp)
        if jq --arg path "$API_KEY_HELPER_PATH" '. + {apiKeyHelper: $path}' "$SETTINGS_FILE" > "$TMP_FILE" && [[ -s "$TMP_FILE" ]]; then
            mv "$TMP_FILE" "$SETTINGS_FILE"
        else
            rm -f "$TMP_FILE"
            echo "  Error: Failed to update settings.json with jq"
            exit 1
        fi
    elif command -v python3 >/dev/null; then
        python3 -c "
import json, sys
try:
    with open('$SETTINGS_FILE', 'r') as f:
        data = json.load(f)
    data['apiKeyHelper'] = '$API_KEY_HELPER_PATH'
    with open('$SETTINGS_FILE', 'w') as f:
        json.dump(data, f, indent=2)
except Exception as e:
    print(f'  Error: {e}', file=sys.stderr)
    sys.exit(1)
"
    else
        echo "  Warning: jq or python3 required to update existing settings.json"
        echo "  Please manually add: \"apiKeyHelper\": \"$API_KEY_HELPER_PATH\" to $SETTINGS_FILE"
    fi
else
    # Create new settings file
    cat > "$SETTINGS_FILE" << EOF
{
  "apiKeyHelper": "$API_KEY_HELPER_PATH"
}
EOF
fi
echo "  Claude Code configured with apiKeyHelper in $SETTINGS_FILE"

# 3. Build MCP server
echo ""
echo "[3/5] Building MCP server..."
(cd "$PROJECT_DIR" && npm install && npm run build)

# 4. Configure Prisme MCP server
echo ""
echo "[4/5] Configuring Prisme MCP server..."
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

# 5. Install agent
echo ""
echo "[5/5] Installing Prisme assistant agent..."
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
