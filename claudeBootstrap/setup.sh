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

# 0. Select installation mode
echo "Installation mode:"
echo "  1) Fresh install - Configure API keys and install everything"
echo "  2) Update - Rebuild and update agent configuration only"
echo "  3) Update API key - Add or update a Prisme.ai environment API key"
echo ""
read -p "Select mode [1/2/3]: " MODE_CHOICE

case "$MODE_CHOICE" in
    1)
        INSTALL_MODE="fresh"
        echo "Mode: Fresh install"
        ;;
    2)
        INSTALL_MODE="update"
        echo "Mode: Update"
        ;;
    3)
        INSTALL_MODE="update_key"
        echo "Mode: Update API key"
        ;;
    *)
        echo "Invalid choice. Defaulting to fresh install."
        INSTALL_MODE="fresh"
        ;;
esac
echo ""

# 1. Check prerequisites
echo "[1/5] Checking prerequisites..."
command -v node >/dev/null || { echo "Error: Node.js required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null || { echo "Error: npm required"; exit 1; }
command -v claude >/dev/null || { echo "Error: Claude Code CLI required. Install: npm install -g @anthropic-ai/claude-code"; exit 1; }
echo "  Node.js $(node --version)"
echo "  Claude CLI installed"

# Install jq if not available (needed for JSON manipulation)
if ! command -v jq >/dev/null; then
    echo "  jq not found, installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew >/dev/null; then
            brew install jq
        else
            echo "Error: Homebrew required to install jq on macOS"
            echo "Install Homebrew: https://brew.sh"
            exit 1
        fi
    elif command -v apt-get >/dev/null; then
        sudo apt-get update && sudo apt-get install -y jq
    elif command -v yum >/dev/null; then
        sudo yum install -y jq
    elif command -v apk >/dev/null; then
        sudo apk add jq
    else
        echo "Error: Could not install jq. Please install it manually."
        exit 1
    fi
    echo "  jq installed"
else
    echo "  jq available"
fi

# 2. Configure Anthropic API key
if [[ "$INSTALL_MODE" == "fresh" ]]; then
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
        # Merge apiKeyHelper into existing settings
        TMP_FILE=$(mktemp)
        if jq --arg path "$API_KEY_HELPER_PATH" '. + {apiKeyHelper: $path}' "$SETTINGS_FILE" > "$TMP_FILE" && [[ -s "$TMP_FILE" ]]; then
            mv "$TMP_FILE" "$SETTINGS_FILE"
        else
            rm -f "$TMP_FILE"
            echo "  Error: Failed to update settings.json"
            exit 1
        fi
    else
        # Create new settings file
        echo "{\"apiKeyHelper\": \"$API_KEY_HELPER_PATH\"}" | jq . > "$SETTINGS_FILE"
    fi
    echo "  Claude Code configured with apiKeyHelper in $SETTINGS_FILE"
else
    echo ""
    echo "[2/5] Skipping Anthropic API key configuration (update mode)"
fi

# 3. Build MCP server
echo ""
echo "[3/5] Building MCP server..."
(cd "$PROJECT_DIR" && npm install && npm run build)

# 4. Configure Prisme MCP server
if [[ "$INSTALL_MODE" == "fresh" ]]; then
    echo ""
    echo "[4/5] Configuring Prisme MCP server..."
    echo ""
    echo "You can configure API keys for one or both environments."
    echo "Press Enter to skip an environment if you don't have access."
    echo ""

    # Ask for sandbox API key
    read -sp "Enter your Prisme.ai SANDBOX API key (JWT token) [press Enter to skip]: " SANDBOX_API_KEY
    echo ""

    # Ask for prod API key
    read -sp "Enter your Prisme.ai PROD API key (JWT token) [press Enter to skip]: " PROD_API_KEY
    echo ""

    # Validate at least one API key is provided
    if [[ -z "$SANDBOX_API_KEY" && -z "$PROD_API_KEY" ]]; then
        echo "Error: At least one API key (sandbox or prod) is required"
        exit 1
    fi

    # Build environments JSON with API keys
    SANDBOX_ENV=$(cat <<EOF
{
  "apiUrl": "https://api.sandbox.prisme.ai/v2",
  "workspaces": {
    "ai-knowledge": "gQxyd2S",
    "ai-store": "K5boVst"
  }$(if [[ -n "$SANDBOX_API_KEY" ]]; then echo ",
  \"apiKey\": \"$SANDBOX_API_KEY\""; fi)
}
EOF
)

    PROD_ENV=$(cat <<EOF
{
  "apiUrl": "https://api.studio.prisme.ai/v2",
  "workspaces": {
    "ai-knowledge": "wW3UZla",
    "ai-store": "KgIMCs2"
  }$(if [[ -n "$PROD_API_KEY" ]]; then echo ",
  \"apiKey\": \"$PROD_API_KEY\""; fi)
}
EOF
)

    ENVIRONMENTS_JSON=$(cat <<EOF
{
  "sandbox": $SANDBOX_ENV,
  "prod": $PROD_ENV
}
EOF
)

    # Determine default environment and credentials
    if [[ -n "$PROD_API_KEY" ]]; then
        DEFAULT_WORKSPACE="wW3UZla"
        API_URL="https://api.studio.prisme.ai/v2"
        PRISME_API_KEY="$PROD_API_KEY"
        DEFAULT_ENV="prod"
    else
        DEFAULT_WORKSPACE="gQxyd2S"
        API_URL="https://api.sandbox.prisme.ai/v2"
        PRISME_API_KEY="$SANDBOX_API_KEY"
        DEFAULT_ENV="sandbox"
    fi

    # Remove existing server if present
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    # Add MCP server with environment variables (user scope = globally available)
    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_API_KEY="$PRISME_API_KEY" \
        -e PRISME_API_BASE_URL="$API_URL" \
        -e PRISME_WORKSPACE_ID="$DEFAULT_WORKSPACE" \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DEFAULT_ENVIRONMENT="$DEFAULT_ENV" \
        -- node "$BUILD_PATH"

    echo "  MCP server configured"
    echo "  Default environment: $DEFAULT_ENV"
    if [[ -n "$SANDBOX_API_KEY" ]]; then
        echo "  Sandbox environment: configured"
    else
        echo "  Sandbox environment: not configured"
    fi
    if [[ -n "$PROD_API_KEY" ]]; then
        echo "  Prod environment: configured"
    else
        echo "  Prod environment: not configured"
    fi
elif [[ "$INSTALL_MODE" == "update_key" ]]; then
    echo ""
    echo "[4/5] Updating Prisme.ai API key..."

    # Extract existing MCP server configuration from ~/.claude.json
    EXISTING_CONFIG=$(jq -r '.mcpServers."prisme-ai-builder" // null' ~/.claude.json 2>/dev/null)

    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        echo "  Error: No existing prisme-ai-builder MCP server found"
        echo "  Run in fresh install mode first"
        exit 1
    fi

    # Extract existing environment variables
    PRISME_API_KEY=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_KEY // empty')
    API_URL=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_BASE_URL // empty')
    DEFAULT_WORKSPACE=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_WORKSPACE_ID // empty')
    ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
    DEFAULT_ENV=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DEFAULT_ENVIRONMENT // "sandbox"')

    if [[ -z "$ENVIRONMENTS_JSON" ]]; then
        echo "  Error: No environments configuration found"
        echo "  Run in fresh install mode to reconfigure"
        exit 1
    fi

    # Show current status
    echo ""
    echo "Current configuration:"
    SANDBOX_HAS_KEY=$(echo "$ENVIRONMENTS_JSON" | jq -r '.sandbox.apiKey // empty')
    PROD_HAS_KEY=$(echo "$ENVIRONMENTS_JSON" | jq -r '.prod.apiKey // empty')
    if [[ -n "$SANDBOX_HAS_KEY" ]]; then
        echo "  sandbox: configured"
    else
        echo "  sandbox: NOT configured"
    fi
    if [[ -n "$PROD_HAS_KEY" ]]; then
        echo "  prod: configured"
    else
        echo "  prod: NOT configured"
    fi
    echo "  default: $DEFAULT_ENV"
    echo ""

    # Ask which environment to update
    echo "Which environment API key do you want to update?"
    echo "  1) sandbox"
    echo "  2) prod"
    echo ""
    read -p "Select environment [1/2]: " ENV_CHOICE

    case "$ENV_CHOICE" in
        1)
            TARGET_ENV="sandbox"
            ;;
        2)
            TARGET_ENV="prod"
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac

    # Ask for new API key
    read -sp "Enter your Prisme.ai $TARGET_ENV API key (JWT token): " NEW_API_KEY
    echo ""

    if [[ -z "$NEW_API_KEY" ]]; then
        echo "Error: API key required"
        exit 1
    fi

    # Update the environments JSON with the new API key
    ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg env "$TARGET_ENV" --arg key "$NEW_API_KEY" '.[$env].apiKey = $key')

    # If updating the default environment or if it wasn't set, update default API key too
    if [[ "$TARGET_ENV" == "$DEFAULT_ENV" ]] || [[ -z "$PRISME_API_KEY" ]]; then
        PRISME_API_KEY="$NEW_API_KEY"
        if [[ "$TARGET_ENV" == "prod" ]]; then
            API_URL="https://api.studio.prisme.ai/v2"
            DEFAULT_WORKSPACE="wW3UZla"
            DEFAULT_ENV="prod"
        else
            API_URL="https://api.sandbox.prisme.ai/v2"
            DEFAULT_WORKSPACE="gQxyd2S"
            DEFAULT_ENV="sandbox"
        fi
    fi

    # Remove existing server and re-add with updated config
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_API_KEY="$PRISME_API_KEY" \
        -e PRISME_API_BASE_URL="$API_URL" \
        -e PRISME_WORKSPACE_ID="$DEFAULT_WORKSPACE" \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DEFAULT_ENVIRONMENT="$DEFAULT_ENV" \
        -- node "$BUILD_PATH"

    echo "  API key for $TARGET_ENV updated successfully"
    echo "  Default environment: $DEFAULT_ENV"
else
    echo ""
    echo "[4/5] Updating Prisme MCP server configuration (update mode)"

    # Extract existing MCP server configuration from ~/.claude.json
    # Check user scope first (top-level mcpServers)
    EXISTING_CONFIG=$(jq -r '.mcpServers."prisme-ai-builder" // null' ~/.claude.json 2>/dev/null)

    # If not found in user scope, check local scope under .projects[path].mcpServers
    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        EXISTING_CONFIG=$(jq -r --arg proj "$PROJECT_DIR" '
            .projects | to_entries[] | select(.key == $proj) | .value.mcpServers."prisme-ai-builder" // null
        ' ~/.claude.json 2>/dev/null)
    fi

    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        echo "  Warning: No existing prisme-ai-builder MCP server found"
        echo "  Run in fresh install mode to configure from scratch"
    else
        # Extract environment variables from existing config
        PRISME_API_KEY=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_KEY // empty')
        API_URL=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_BASE_URL // empty')
        DEFAULT_WORKSPACE=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_WORKSPACE_ID // empty')
        ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
        DEFAULT_ENV=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DEFAULT_ENVIRONMENT // empty')

        if [[ -n "$PRISME_API_KEY" && -n "$API_URL" && -n "$DEFAULT_WORKSPACE" ]]; then
            # Remove existing server
            claude mcp remove prisme-ai-builder 2>/dev/null || true

            # Re-add with user scope to ensure it's globally available
            claude mcp add prisme-ai-builder \
                --scope user \
                -e PRISME_API_KEY="$PRISME_API_KEY" \
                -e PRISME_API_BASE_URL="$API_URL" \
                -e PRISME_WORKSPACE_ID="$DEFAULT_WORKSPACE" \
                -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
                -e PRISME_DEFAULT_ENVIRONMENT="$DEFAULT_ENV" \
                -- node "$BUILD_PATH"

            echo "  MCP server updated with user scope (now globally available)"
        else
            echo "  Error: Could not extract configuration from existing MCP server"
            echo "  Run in fresh install mode to reconfigure"
        fi
    fi
fi

# 5. Install agent
echo ""
echo "[5/5] Installing Prisme assistant agent..."
mkdir -p ~/.claude/agents
cp "$SCRIPT_DIR/prisme-assistant.md" ~/.claude/agents/
echo "  Agent installed"

# Done
echo ""
echo "=== Setup Complete ==="
echo ""

if [[ "$INSTALL_MODE" == "fresh" ]]; then
    echo "Fresh installation completed successfully!"
    echo ""
    echo "Configured environments:"
    if [[ -n "$SANDBOX_API_KEY" ]]; then
        echo "  sandbox: ai-knowledge, ai-store"
    fi
    if [[ -n "$PROD_API_KEY" ]]; then
        echo "  prod: ai-knowledge, ai-store"
    fi
    echo ""
    echo "Default environment: $DEFAULT_ENV"
    echo ""
elif [[ "$INSTALL_MODE" == "update_key" ]]; then
    echo "API key update completed successfully!"
    echo ""
    echo "Updated environment: $TARGET_ENV"
    echo "Default environment: $DEFAULT_ENV"
    echo ""
else
    echo "Update completed successfully!"
    echo "  - MCP server rebuilt"
    echo "  - Agent configuration updated"
    echo "  - API keys preserved"
    echo ""
fi

echo "Usage:"
echo "  claude                          # Start Claude Code"
echo "  claude --agent prisme-assistant # Use Prisme agent"
echo ""
echo "Test: Type '@' in Claude to see mcp__prisme-ai-builder__* tools"
