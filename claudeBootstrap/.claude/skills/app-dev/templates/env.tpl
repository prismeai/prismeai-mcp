# Prisme.ai API URL (must include /v2 suffix).
PRISMEAI_API_URL={{api_url}}

# Personal access token (JWT). Auto-filled from the prisme-ai-builder MCP env.
# Do NOT commit this file (.env is gitignored).
PRISMEAI_ACCESS_TOKEN={{access_token}}

# Workspace ID where the bundle will be deployed (short ID, e.g. B4eoHS6).
PRISMEAI_WORKSPACE_ID={{workspace_id}}

# Prisme.ai platform UI URL (where end users browse, e.g. https://sandbox.prisme.ai).
# Optional: only required to upload embed.js for 3rd-party <script> embedding.
PRISMEAI_PLATFORM_URL={{studio_url}}

# Optional: bundle key. Defaults to the workspace slug returned by the API.
# Override only if you publish multiple bundles to the same workspace.
# PRISMEAI_BUNDLE_SLUG=

# Optional: app version label written to workspace.config.value.bundles[slug].version
PRISMEAI_APP_VERSION=0.1.0

# For multi-env, copy this file to .env.<name> and pick at deploy time:
#   npm run deploy -- --env=staging
#   PRISMEAI_ENV=production npm run release

# Optional: skip steps you don't need
# PRISMEAI_SKIP_AUTOMATIONS_SYNC=true
# PRISMEAI_SKIP_SOURCE_SYNC=true
# PRISMEAI_SKIP_BUNDLE_CLEANUP=true
# PRISMEAI_SKIP_VERSION_SNAPSHOT=true
