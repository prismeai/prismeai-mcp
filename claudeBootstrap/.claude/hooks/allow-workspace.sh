# #!/bin/bash

# ALLOWED_WORKSPACE_IDS=("wMezY17" "UjnlJlU")

# # Extract workspaceId from tool input
# WORKSPACE_ID=$(jq -r '.tool_input.workspaceId // empty')

# # Check if workspace is in allowed list
# is_allowed=false
# for allowed in "${ALLOWED_WORKSPACE_IDS[@]}"; do
#   if [ "$WORKSPACE_ID" == "$allowed" ]; then
#     is_allowed=true
#     break
#   fi
# done

# if [ "$is_allowed" == "true" ]; then
#   # Auto-approve
#   jq -n '{
#     hookSpecificOutput: {
#       hookEventName: "PreToolUse",
#       permissionDecision: "allow",
#       permissionDecisionReason: "Workspace wMezY17 auto-approved"
#     }
#   }'
# else
#   # Ask for confirmation (or use "deny" to block)
#   jq -n '{
#     hookSpecificOutput: {
#       hookEventName: "PreToolUse",
#       permissionDecision: "ask",
#       permissionDecisionReason: "Different workspace - requires confirmation"
#     }
#   }'
# fi
