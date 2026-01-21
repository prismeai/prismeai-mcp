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

# Color codes (defined early for use throughout)
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m' # No Color

echo "=== Claude Code + Prisme.ai Setup ==="
echo ""

# Show what will be installed
echo -e "${YELLOW}What will be installed:${NC}"
echo ""
echo -e "  ${GREEN}1. MCP Server${NC} ${DIM}(prisme-ai-builder)${NC}"
echo -e "     Provides Prisme.ai tools to Claude Code"
echo -e "     ${DIM}Location: $BUILD_PATH${NC}"
echo ""
echo -e "  ${GREEN}2. Prisme Assistant Agent${NC}"
echo -e "     Specialized agent for Prisme.ai development"
echo -e "     ${DIM}Location: ~/.claude/agents/prisme-assistant.md${NC}"
echo ""
echo -e "  ${GREEN}3. Environment Configuration${NC}"
echo -e "     API keys and endpoints for your Prisme.ai environments"
echo -e "     ${DIM}Location: ~/.claude.json${NC}"
echo ""

# 0. Select installation mode
echo "Installation mode:"
echo "  1) Fresh install - Configure API keys and install everything"
echo "  2) Update - Rebuild and update agent configuration only"
echo "  3) Update API key - Add or update a Prisme.ai environment API key"
echo "  4) Toggle feedback tools - Enable/disable bug reporting tools"
echo "  5) Delete environment - Remove a configured environment"
echo "  6) Migrate - Fix old configuration format (run this if MCP server fails to start)"
echo ""
read -p "Select mode [1/2/3/4/5/6]: " MODE_CHOICE

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
    4)
        INSTALL_MODE="toggle_feedback"
        echo "Mode: Toggle feedback tools"
        ;;
    5)
        INSTALL_MODE="delete_env"
        echo "Mode: Delete environment"
        ;;
    6)
        INSTALL_MODE="migrate"
        echo "Mode: Migrate configuration"
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
    echo ""
    echo "Do you want to configure an Anthropic API key?"
    echo "(Required if you don't have Claude Max subscription)"
    echo "  1) Yes - I want to use my own Anthropic API key"
    echo "  2) No - I'll use Claude Max or another authentication method"
    echo ""
    read -p "Select option [1/2]: " ANTHROPIC_CHOICE

    if [[ "$ANTHROPIC_CHOICE" == "1" ]]; then
        echo ""
        echo "Retrieve it from https://studio.prisme.ai/fr/workspaces/wW3UZla/settings/advanced"
        read -sp "Enter your Anthropic API key (sk-ant-...): " ANTHROPIC_API_KEY
        echo ""

        if [[ -z "$ANTHROPIC_API_KEY" ]]; then
            echo "Error: Anthropic API key required when option 1 is selected"
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
        echo "  Skipping Anthropic API key configuration"
    fi
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

    # Initialize environments JSON as empty object
    ENVIRONMENTS_JSON="{}"
    ENV_COUNT=0
    FIRST_ENV_NAME=""
    FIRST_API_URL=""
    FIRST_API_KEY=""
    CONFIGURED_ENVS=()

    # Loop to add environments
    while true; do
        echo ""
        if [[ $ENV_COUNT -eq 0 ]]; then
            read -p "Do you want to add a Prisme.ai environment? [y/n]: " ADD_ENV
        else
            read -p "Do you want to add another Prisme.ai environment? [y/n]: " ADD_ENV
        fi

        if [[ "$ADD_ENV" != "y" && "$ADD_ENV" != "Y" ]]; then
            break
        fi

        echo ""
        # Ask for environment name
        read -p "Environment name (e.g., sandbox, staging, prod): " ENV_NAME

        if [[ -z "$ENV_NAME" ]]; then
            echo "  Error: Environment name is required"
            continue
        fi

        # Check if environment already exists
        if echo "$ENVIRONMENTS_JSON" | jq -e --arg name "$ENV_NAME" '.[$name]' >/dev/null 2>&1; then
            echo "  Error: Environment '$ENV_NAME' already configured"
            continue
        fi

        echo ""
        # Ask for API URL
        echo "Enter the base API URL for this environment"
        echo "  Example: https://api.sandbox.prisme.ai/v2"
        read -p "API URL: " ENV_API_URL

        if [[ -z "$ENV_API_URL" ]]; then
            echo "  Error: API URL is required"
            continue
        fi

        echo ""
        # Ask for JWT token
        echo "Enter your JWT token for this environment"
        echo "  You can find it in your browser: Inspect > Application > Cookies > access-token"
        echo "  The token starts with 'ey...'"
        read -sp "JWT token: " ENV_API_KEY
        echo ""

        if [[ -z "$ENV_API_KEY" ]]; then
            echo "  Error: JWT token is required"
            continue
        fi

        # Validate JWT token format
        if [[ ! "$ENV_API_KEY" =~ ^ey ]]; then
            echo "  Warning: Token doesn't start with 'ey'. Are you sure this is correct?"
            read -p "  Continue anyway? [y/n]: " CONTINUE_ANYWAY
            if [[ "$CONTINUE_ANYWAY" != "y" && "$CONTINUE_ANYWAY" != "Y" ]]; then
                continue
            fi
        fi

        # Build environment JSON object (first environment gets default: true)
        if [[ $ENV_COUNT -eq 0 ]]; then
            ENV_OBJ=$(jq -n \
                --arg apiUrl "$ENV_API_URL" \
                --arg apiKey "$ENV_API_KEY" \
                '{"apiUrl": $apiUrl, "apiKey": $apiKey, "default": true}')
            FIRST_ENV_NAME="$ENV_NAME"
        else
            ENV_OBJ=$(jq -n \
                --arg apiUrl "$ENV_API_URL" \
                --arg apiKey "$ENV_API_KEY" \
                '{"apiUrl": $apiUrl, "apiKey": $apiKey}')
        fi

        # Add to environments JSON
        ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg name "$ENV_NAME" --argjson env "$ENV_OBJ" '.[$name] = $env')

        CONFIGURED_ENVS+=("$ENV_NAME")
        ((ENV_COUNT++))

        echo "  Environment '$ENV_NAME' configured successfully"
    done

    # Validate at least one environment is configured
    if [[ $ENV_COUNT -eq 0 ]]; then
        echo ""
        echo "Error: At least one environment is required"
        exit 1
    fi

    # Set default environment (first configured)
    DEFAULT_ENV="$FIRST_ENV_NAME"

    # Ask about feedback tools
    echo ""
    echo "Feedback reporting tools (report_issue_or_feedback, update_report, get_reports)"
    echo "allow Claude to send bug reports and feedback to Prisme.ai servers."
    echo ""
    echo "Do you want to enable these feedback tools?"
    echo "  1) Yes - Enable feedback tools (data will be sent to Prisme.ai)"
    echo "  2) No - Disable feedback tools (no data sent to Prisme.ai)"
    echo ""
    read -p "Select option [1/2]: " FEEDBACK_CHOICE

    if [[ "$FEEDBACK_CHOICE" == "2" ]]; then
        DISABLE_FEEDBACK_TOOLS="true"
        echo "  Feedback tools will be disabled"
    else
        DISABLE_FEEDBACK_TOOLS="false"
        echo "  Feedback tools will be enabled"
    fi

    # Remove existing server if present
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    # Add MCP server with environment variables (user scope = globally available)
    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DEFAULT_ENVIRONMENT="$DEFAULT_ENV" \
        -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
        -- node "$BUILD_PATH"

    echo ""
    echo "  MCP server configured"
    echo "  Default environment: $DEFAULT_ENV"
    echo "  Feedback tools: $([ "$DISABLE_FEEDBACK_TOOLS" == "true" ] && echo "disabled" || echo "enabled")"
    for env in "${CONFIGURED_ENVS[@]}"; do
        echo "  - $env: configured"
    done
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
    ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
    DISABLE_FEEDBACK_TOOLS=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DISABLE_FEEDBACK_TOOLS // "false"')

    if [[ -z "$ENVIRONMENTS_JSON" || "$ENVIRONMENTS_JSON" == "{}" ]]; then
        echo "  Error: No environments configuration found"
        echo "  Run in fresh install mode to reconfigure"
        exit 1
    fi

    # Get list of configured environments
    ENV_NAMES=($(echo "$ENVIRONMENTS_JSON" | jq -r 'keys[]'))

    if [[ ${#ENV_NAMES[@]} -eq 0 ]]; then
        echo "  Error: No environments found in configuration"
        echo "  Run in fresh install mode to reconfigure"
        exit 1
    fi

    # Find the default environment (one with default: true)
    DEFAULT_ENV=$(echo "$ENVIRONMENTS_JSON" | jq -r 'to_entries[] | select(.value.default == true) | .key' | head -1)
    if [[ -z "$DEFAULT_ENV" ]]; then
        DEFAULT_ENV="${ENV_NAMES[0]}"
    fi

    # Show current status
    echo ""
    echo "Current configuration:"
    for env in "${ENV_NAMES[@]}"; do
        HAS_KEY=$(echo "$ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].apiKey // empty')
        IS_DEFAULT=$(echo "$ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].default // false')
        if [[ -n "$HAS_KEY" ]]; then
            if [[ "$IS_DEFAULT" == "true" ]]; then
                echo "  $env: configured (default)"
            else
                echo "  $env: configured"
            fi
        else
            echo "  $env: NOT configured"
        fi
    done
    echo ""

    # Ask what to do
    echo "What do you want to do?"
    echo "  1) Update an existing environment's API key"
    echo "  2) Add a new environment"
    echo ""
    read -p "Select option [1/2]: " UPDATE_CHOICE

    if [[ "$UPDATE_CHOICE" == "2" ]]; then
        # Add new environment
        echo ""
        read -p "Environment name: " NEW_ENV_NAME

        if [[ -z "$NEW_ENV_NAME" ]]; then
            echo "Error: Environment name is required"
            exit 1
        fi

        # Check if environment already exists
        if echo "$ENVIRONMENTS_JSON" | jq -e --arg name "$NEW_ENV_NAME" '.[$name]' >/dev/null 2>&1; then
            echo "Error: Environment '$NEW_ENV_NAME' already exists. Use option 1 to update it."
            exit 1
        fi

        echo ""
        echo "Enter the base API URL for this environment"
        echo "  Example: https://api.sandbox.prisme.ai/v2"
        read -p "API URL: " NEW_ENV_URL

        if [[ -z "$NEW_ENV_URL" ]]; then
            echo "Error: API URL is required"
            exit 1
        fi

        echo ""
        echo "Enter your JWT token for this environment"
        echo "  You can find it in your browser: Inspect > Application > Cookies > access-token"
        echo "  The token starts with 'ey...'"
        read -sp "JWT token: " NEW_API_KEY
        echo ""

        if [[ -z "$NEW_API_KEY" ]]; then
            echo "Error: JWT token is required"
            exit 1
        fi

        # Build and add new environment
        ENV_OBJ=$(jq -n \
            --arg apiUrl "$NEW_ENV_URL" \
            --arg apiKey "$NEW_API_KEY" \
            '{"apiUrl": $apiUrl, "apiKey": $apiKey}')
        ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg name "$NEW_ENV_NAME" --argjson env "$ENV_OBJ" '.[$name] = $env')

        TARGET_ENV="$NEW_ENV_NAME"
        TARGET_URL="$NEW_ENV_URL"
        TARGET_KEY="$NEW_API_KEY"
    else
        # Update existing environment
        echo ""
        echo "Which environment do you want to update?"
        idx=1
        for env in "${ENV_NAMES[@]}"; do
            echo "  $idx) $env"
            ((idx++))
        done
        echo ""
        read -p "Select environment [1-${#ENV_NAMES[@]}]: " ENV_CHOICE

        # Validate choice
        if ! [[ "$ENV_CHOICE" =~ ^[0-9]+$ ]] || [[ "$ENV_CHOICE" -lt 1 ]] || [[ "$ENV_CHOICE" -gt ${#ENV_NAMES[@]} ]]; then
            echo "Invalid choice"
            exit 1
        fi

        TARGET_ENV="${ENV_NAMES[$((ENV_CHOICE-1))]}"

        echo ""
        echo "Enter your JWT token for '$TARGET_ENV'"
        echo "  You can find it in your browser: Inspect > Application > Cookies > access-token"
        echo "  The token starts with 'ey...'"
        read -sp "JWT token: " NEW_API_KEY
        echo ""

        if [[ -z "$NEW_API_KEY" ]]; then
            echo "Error: JWT token is required"
            exit 1
        fi

        # Update the environment's API key
        ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg env "$TARGET_ENV" --arg key "$NEW_API_KEY" '.[$env].apiKey = $key')
    fi

    # Remove existing server and re-add with updated config
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
        -- node "$BUILD_PATH"

    echo ""
    echo "  Environment '$TARGET_ENV' updated successfully"
    echo "  Default environment: $DEFAULT_ENV"
    echo "  Feedback tools: $([ "$DISABLE_FEEDBACK_TOOLS" == "true" ] && echo "disabled" || echo "enabled")"
elif [[ "$INSTALL_MODE" == "update" ]]; then
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
        ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
        DISABLE_FEEDBACK_TOOLS=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DISABLE_FEEDBACK_TOOLS // "false"')

        if [[ -n "$ENVIRONMENTS_JSON" && "$ENVIRONMENTS_JSON" != "{}" ]]; then
            # Remove existing server
            claude mcp remove prisme-ai-builder 2>/dev/null || true

            # Re-add with user scope to ensure it's globally available
            claude mcp add prisme-ai-builder \
                --scope user \
                -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
                -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
                -- node "$BUILD_PATH"

            echo "  MCP server updated with user scope (now globally available)"
            echo "  Feedback tools: $([ "$DISABLE_FEEDBACK_TOOLS" == "true" ] && echo "disabled" || echo "enabled")"
        else
            echo "  Error: Could not extract configuration from existing MCP server"
            echo "  Run in fresh install mode to reconfigure"
        fi
    fi
elif [[ "$INSTALL_MODE" == "toggle_feedback" ]]; then
    echo ""
    echo "[4/5] Toggling feedback tools setting..."

    # Extract existing MCP server configuration from ~/.claude.json
    EXISTING_CONFIG=$(jq -r '.mcpServers."prisme-ai-builder" // null' ~/.claude.json 2>/dev/null)

    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        echo "  Error: No existing prisme-ai-builder MCP server found"
        echo "  Run in fresh install mode first"
        exit 1
    fi

    # Extract existing environment variables
    ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
    CURRENT_FEEDBACK_SETTING=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DISABLE_FEEDBACK_TOOLS // "false"')

    echo ""
    echo "Feedback reporting tools (report_issue_or_feedback, update_report, get_reports)"
    echo "allow Claude to send bug reports and feedback to Prisme.ai servers."
    echo ""
    if [[ "$CURRENT_FEEDBACK_SETTING" == "true" ]]; then
        echo "Current status: DISABLED"
    else
        echo "Current status: ENABLED"
    fi
    echo ""
    echo "What do you want to do?"
    echo "  1) Enable feedback tools (data will be sent to Prisme.ai)"
    echo "  2) Disable feedback tools (no data sent to Prisme.ai)"
    echo ""
    read -p "Select option [1/2]: " FEEDBACK_CHOICE

    if [[ "$FEEDBACK_CHOICE" == "2" ]]; then
        DISABLE_FEEDBACK_TOOLS="true"
    else
        DISABLE_FEEDBACK_TOOLS="false"
    fi

    # Remove existing server and re-add with updated config
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
        -- node "$BUILD_PATH"

    echo ""
    echo "  Feedback tools setting updated"
    echo "  Feedback tools: $([ "$DISABLE_FEEDBACK_TOOLS" == "true" ] && echo "disabled" || echo "enabled")"
elif [[ "$INSTALL_MODE" == "delete_env" ]]; then
    echo ""
    echo "[4/5] Deleting a Prisme.ai environment..."

    # Extract existing MCP server configuration from ~/.claude.json
    EXISTING_CONFIG=$(jq -r '.mcpServers."prisme-ai-builder" // null' ~/.claude.json 2>/dev/null)

    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        echo "  Error: No existing prisme-ai-builder MCP server found"
        echo "  Run in fresh install mode first"
        exit 1
    fi

    # Extract existing environment variables
    ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
    DISABLE_FEEDBACK_TOOLS=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DISABLE_FEEDBACK_TOOLS // "false"')

    if [[ -z "$ENVIRONMENTS_JSON" || "$ENVIRONMENTS_JSON" == "{}" ]]; then
        echo "  Error: No environments configuration found"
        echo "  Nothing to delete"
        exit 1
    fi

    # Get list of configured environments
    ENV_NAMES=($(echo "$ENVIRONMENTS_JSON" | jq -r 'keys[]'))

    if [[ ${#ENV_NAMES[@]} -eq 0 ]]; then
        echo "  Error: No environments found in configuration"
        exit 1
    fi

    if [[ ${#ENV_NAMES[@]} -eq 1 ]]; then
        echo "  Error: Cannot delete the only configured environment"
        echo "  You must have at least one environment configured"
        exit 1
    fi

    # Find the default environment (one with default: true)
    DEFAULT_ENV=$(echo "$ENVIRONMENTS_JSON" | jq -r 'to_entries[] | select(.value.default == true) | .key' | head -1)
    if [[ -z "$DEFAULT_ENV" ]]; then
        DEFAULT_ENV="${ENV_NAMES[0]}"
    fi

    # Show current environments
    echo ""
    echo "Configured environments:"
    idx=1
    for env in "${ENV_NAMES[@]}"; do
        IS_DEFAULT=$(echo "$ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].default // false')
        if [[ "$IS_DEFAULT" == "true" ]]; then
            echo "  $idx) $env (default)"
        else
            echo "  $idx) $env"
        fi
        ((idx++))
    done
    echo ""

    # Ask which environment to delete
    read -p "Select environment to delete [1-${#ENV_NAMES[@]}]: " DELETE_CHOICE

    # Validate choice
    if ! [[ "$DELETE_CHOICE" =~ ^[0-9]+$ ]] || [[ "$DELETE_CHOICE" -lt 1 ]] || [[ "$DELETE_CHOICE" -gt ${#ENV_NAMES[@]} ]]; then
        echo "Invalid choice"
        exit 1
    fi

    TARGET_ENV="${ENV_NAMES[$((DELETE_CHOICE-1))]}"

    # Confirm deletion
    echo ""
    read -p "Are you sure you want to delete '$TARGET_ENV'? [y/n]: " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "Cancelled"
        exit 0
    fi

    # Check if deleting the default environment
    IS_DELETING_DEFAULT=$(echo "$ENVIRONMENTS_JSON" | jq -r --arg e "$TARGET_ENV" '.[$e].default // false')

    # Remove the environment from JSON
    ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg env "$TARGET_ENV" 'del(.[$env])')

    # If deleting the default environment, set default: true on the first remaining environment
    if [[ "$IS_DELETING_DEFAULT" == "true" ]]; then
        NEW_DEFAULT=$(echo "$ENVIRONMENTS_JSON" | jq -r 'keys[0]')
        ENVIRONMENTS_JSON=$(echo "$ENVIRONMENTS_JSON" | jq --arg env "$NEW_DEFAULT" '.[$env].default = true')
        echo ""
        echo "  Default environment changed to: $NEW_DEFAULT"
    fi

    # Remove existing server and re-add with updated config
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_ENVIRONMENTS="$ENVIRONMENTS_JSON" \
        -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
        -- node "$BUILD_PATH"

    echo ""
    echo "  Environment '$TARGET_ENV' deleted successfully"
elif [[ "$INSTALL_MODE" == "migrate" ]]; then
    echo ""
    echo "[4/5] Migrating old configuration..."

    # Extract existing MCP server configuration from ~/.claude.json
    EXISTING_CONFIG=$(jq -r '.mcpServers."prisme-ai-builder" // null' ~/.claude.json 2>/dev/null)

    if [[ "$EXISTING_CONFIG" == "null" || -z "$EXISTING_CONFIG" ]]; then
        echo "  Error: No existing prisme-ai-builder MCP server found"
        echo "  Run in fresh install mode instead"
        exit 1
    fi

    # Extract all existing environment variables
    OLD_ENVIRONMENTS_JSON=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_ENVIRONMENTS // empty')
    OLD_API_KEY=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_KEY // empty')
    OLD_API_URL=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_API_BASE_URL // empty')
    OLD_WORKSPACE_ID=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_WORKSPACE_ID // empty')
    OLD_DEFAULT_ENV=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DEFAULT_ENVIRONMENT // empty')
    DISABLE_FEEDBACK_TOOLS=$(echo "$EXISTING_CONFIG" | jq -r '.env.PRISME_DISABLE_FEEDBACK_TOOLS // "false"')

    echo ""
    echo "Analyzing existing configuration..."

    # Known API URLs for environments (used for migration)
    declare -A KNOWN_API_URLS
    KNOWN_API_URLS["sandbox"]="https://api.sandbox.prisme.ai/v2"
    KNOWN_API_URLS["staging"]="https://api.staging.prisme.ai/v2"
    KNOWN_API_URLS["prod"]="https://api.studio.prisme.ai/v2"
    KNOWN_API_URLS["production"]="https://api.studio.prisme.ai/v2"

    # Initialize new environments JSON
    NEW_ENVIRONMENTS_JSON="{}"
    MIGRATED_COUNT=0
    FIRST_ENV=""

    if [[ -n "$OLD_ENVIRONMENTS_JSON" && "$OLD_ENVIRONMENTS_JSON" != "{}" ]]; then
        # Parse existing environments and fix them
        ENV_NAMES=($(echo "$OLD_ENVIRONMENTS_JSON" | jq -r 'keys[]' 2>/dev/null))

        if [[ ${#ENV_NAMES[@]} -gt 0 ]]; then
            echo "  Found ${#ENV_NAMES[@]} environment(s) to migrate"
            echo ""

            for env in "${ENV_NAMES[@]}"; do
                echo "  Processing environment: $env"

                # Extract existing values
                ENV_API_URL=$(echo "$OLD_ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].apiUrl // empty')
                ENV_API_KEY=$(echo "$OLD_ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].apiKey // empty')
                ENV_IS_DEFAULT=$(echo "$OLD_ENVIRONMENTS_JSON" | jq -r --arg e "$env" '.[$e].default // false')

                # If apiUrl is missing, try to infer from environment name or ask user
                if [[ -z "$ENV_API_URL" ]]; then
                    echo "    Missing apiUrl for '$env'"

                    # Try to use known URL
                    if [[ -n "${KNOWN_API_URLS[$env]}" ]]; then
                        ENV_API_URL="${KNOWN_API_URLS[$env]}"
                        echo "    Using known URL: $ENV_API_URL"
                    else
                        # Ask user
                        echo "    Enter the API URL for '$env'"
                        echo "    Examples:"
                        echo "      - https://api.sandbox.prisme.ai/v2"
                        echo "      - https://api.staging.prisme.ai/v2"
                        echo "      - https://api.studio.prisme.ai/v2 (prod)"
                        read -p "    API URL: " ENV_API_URL

                        if [[ -z "$ENV_API_URL" ]]; then
                            echo "    Skipping '$env' (no URL provided)"
                            continue
                        fi
                    fi
                fi

                # If apiKey is missing, try to use legacy root key or ask user
                if [[ -z "$ENV_API_KEY" ]]; then
                    echo "    Missing apiKey for '$env'"

                    # If this is the default env and we have a legacy key, use it
                    if [[ "$env" == "$OLD_DEFAULT_ENV" && -n "$OLD_API_KEY" ]]; then
                        ENV_API_KEY="$OLD_API_KEY"
                        echo "    Using legacy API key from root config"
                    else
                        echo "    Enter your JWT token for '$env'"
                        echo "    (You can find it in your browser: Inspect > Application > Cookies > access-token)"
                        read -sp "    JWT token (or press Enter to skip): " ENV_API_KEY
                        echo ""

                        if [[ -z "$ENV_API_KEY" ]]; then
                            echo "    Warning: No API key for '$env' - you'll need to add it later"
                        fi
                    fi
                fi

                # Build environment object
                if [[ $MIGRATED_COUNT -eq 0 ]]; then
                    # First environment gets default: true
                    if [[ -n "$ENV_API_KEY" ]]; then
                        ENV_OBJ=$(jq -n \
                            --arg apiUrl "$ENV_API_URL" \
                            --arg apiKey "$ENV_API_KEY" \
                            '{"apiUrl": $apiUrl, "apiKey": $apiKey, "default": true}')
                    else
                        ENV_OBJ=$(jq -n \
                            --arg apiUrl "$ENV_API_URL" \
                            '{"apiUrl": $apiUrl, "default": true}')
                    fi
                    FIRST_ENV="$env"
                else
                    if [[ -n "$ENV_API_KEY" ]]; then
                        ENV_OBJ=$(jq -n \
                            --arg apiUrl "$ENV_API_URL" \
                            --arg apiKey "$ENV_API_KEY" \
                            '{"apiUrl": $apiUrl, "apiKey": $apiKey}')
                    else
                        ENV_OBJ=$(jq -n \
                            --arg apiUrl "$ENV_API_URL" \
                            '{"apiUrl": $apiUrl}')
                    fi
                fi

                NEW_ENVIRONMENTS_JSON=$(echo "$NEW_ENVIRONMENTS_JSON" | jq --arg name "$env" --argjson env "$ENV_OBJ" '.[$name] = $env')
                ((MIGRATED_COUNT++))
                echo "    Migrated '$env' successfully"
            done
        fi
    fi

    # If no environments were migrated but we have legacy vars, create one from them
    if [[ $MIGRATED_COUNT -eq 0 && -n "$OLD_API_KEY" && -n "$OLD_API_URL" ]]; then
        echo ""
        echo "  No environments found, but legacy configuration detected"
        echo "  Creating environment from legacy config..."

        ENV_NAME="${OLD_DEFAULT_ENV:-default}"
        ENV_OBJ=$(jq -n \
            --arg apiUrl "$OLD_API_URL" \
            --arg apiKey "$OLD_API_KEY" \
            '{"apiUrl": $apiUrl, "apiKey": $apiKey, "default": true}')
        NEW_ENVIRONMENTS_JSON=$(echo "$NEW_ENVIRONMENTS_JSON" | jq --arg name "$ENV_NAME" --argjson env "$ENV_OBJ" '.[$name] = $env')
        FIRST_ENV="$ENV_NAME"
        ((MIGRATED_COUNT++))
        echo "  Created environment '$ENV_NAME'"
    fi

    if [[ $MIGRATED_COUNT -eq 0 ]]; then
        echo ""
        echo "  Error: No valid configuration found to migrate"
        echo "  Run in fresh install mode instead"
        exit 1
    fi

    echo ""
    echo "Migration summary:"
    echo "  Migrated $MIGRATED_COUNT environment(s)"
    echo "  Default environment: $FIRST_ENV"
    echo ""
    echo "New configuration:"
    echo "$NEW_ENVIRONMENTS_JSON" | jq '.'
    echo ""

    read -p "Apply this configuration? [y/n]: " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "Migration cancelled"
        exit 0
    fi

    # Remove existing server and re-add with migrated config
    claude mcp remove prisme-ai-builder 2>/dev/null || true

    claude mcp add prisme-ai-builder \
        --scope user \
        -e PRISME_ENVIRONMENTS="$NEW_ENVIRONMENTS_JSON" \
        -e PRISME_DISABLE_FEEDBACK_TOOLS="$DISABLE_FEEDBACK_TOOLS" \
        -- node "$BUILD_PATH"

    echo ""
    echo "  Migration completed successfully"
    echo "  Legacy variables (PRISME_API_KEY, PRISME_WORKSPACE_ID, etc.) have been removed"
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
    for env in "${CONFIGURED_ENVS[@]}"; do
        echo "  - $env"
    done
    echo ""
    echo "Default environment: $DEFAULT_ENV"
    echo ""
elif [[ "$INSTALL_MODE" == "update_key" ]]; then
    echo "API key update completed successfully!"
    echo ""
    echo "Updated environment: $TARGET_ENV"
    echo "Default environment: $DEFAULT_ENV"
    echo ""
elif [[ "$INSTALL_MODE" == "toggle_feedback" ]]; then
    echo "Feedback tools setting updated successfully!"
    echo ""
    echo "Feedback tools: $([ "$DISABLE_FEEDBACK_TOOLS" == "true" ] && echo "DISABLED" || echo "ENABLED")"
    echo ""
    if [[ "$DISABLE_FEEDBACK_TOOLS" == "true" ]]; then
        echo "The following tools are now disabled:"
        echo "  - report_issue_or_feedback"
        echo "  - update_report"
        echo "  - get_reports"
        echo ""
        echo "No data will be sent to Prisme.ai servers."
    else
        echo "Claude can now send bug reports and feedback to Prisme.ai servers."
    fi
    echo ""
elif [[ "$INSTALL_MODE" == "delete_env" ]]; then
    echo "Environment deleted successfully!"
    echo ""
    echo "Deleted environment: $TARGET_ENV"
    echo "Default environment: $DEFAULT_ENV"
    echo ""
    # Show remaining environments
    REMAINING_ENVS=($(echo "$ENVIRONMENTS_JSON" | jq -r 'keys[]'))
    echo "Remaining environments:"
    for env in "${REMAINING_ENVS[@]}"; do
        echo "  - $env"
    done
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
echo ""

echo -e "${YELLOW}=== Important: Project Setup ===${NC}"
echo ""
echo -e "To enable Prisme.ai context in your projects, copy the ${CYAN}.claude${NC} folder:"
echo ""
echo -e "  ${CYAN}cp -r \"$SCRIPT_DIR/.claude\" /path/to/your/project/.claude${NC}"
echo ""
echo "This folder contains CLAUDE.md with Prisme.ai-specific instructions for Claude Code."
echo ""
echo -e "${YELLOW}=== Getting Started ===${NC}"
echo ""
echo -e "Run ${CYAN}/guide${NC} in Claude Code to start the automated Prisme.ai development flow."
