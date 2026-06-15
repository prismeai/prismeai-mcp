# Ticket: Add Tests for `claudeBootstrap/setup.sh`

## Context

`claudeBootstrap/setup.sh` is a ~940-line monolithic bash installer script with 6 modes (fresh, update, update_key, toggle_feedback, delete_env, migrate). It handles:

- Prerequisites checking (node, npm, claude, jq)
- Anthropic API key configuration
- MCP server build (`npm install && npm run build`)
- Multi-environment JSON configuration (create, update, delete, migrate)
- Feedback tools toggle
- Agent file installation

It is currently **untested** and contains non-trivial logic (jq JSON manipulation, legacy config migration, default environment reassignment, JWT validation) that is prone to regressions.

---

## Objective

Introduce automated tests for `setup.sh` using a two-layer strategy:

1. **Unit tests** for extracted pure functions (JSON logic, validation, config parsing)
2. **Integration tests** for full interactive flows with mocked externals

---

## Plan

### Phase 1: Refactor `setup.sh` into testable modules

#### 1.1 Create `setup-lib.sh` (extractable functions)

Extract all pure logic into sourced functions. The key pattern (from [Advanced Web Machinery](https://advancedweb.hu/unit-testing-bash-scripts/)):

```bash
# setup-lib.sh — no side effects when sourced

check_prerequisites() {
  command -v node >/dev/null || { echo "Error: Node.js required"; return 1; }
  command -v npm >/dev/null || { echo "Error: npm required"; return 1; }
  command -v claude >/dev/null || { echo "Error: Claude CLI required"; return 1; }
}

build_environment_json() {
  local env_name="$1" api_url="$2" api_key="$3" is_first="$4"
  local env_obj
  if [[ "$is_first" == "true" ]]; then
    env_obj=$(jq -n --arg u "$api_url" --arg k "$api_key" \
      '{"apiUrl": $u, "apiKey": $k, "default": true}')
  else
    env_obj=$(jq -n --arg u "$api_url" --arg k "$api_key" \
      '{"apiUrl": $u, "apiKey": $k}')
  fi
  echo "$env_obj"
}

add_environment_to_json() {
  local envs_json="$1" env_name="$2" env_obj="$3"
  echo "$envs_json" | jq --arg name "$env_name" --argjson env "$env_obj" '.[$name] = $env'
}

validate_jwt_format() {
  local token="$1"
  [[ "$token" =~ ^ey ]]
}

extract_existing_config() {
  local claude_json="$1"
  jq -r '.mcpServers."prisme-ai-builder" // null' "$claude_json" 2>/dev/null
}

extract_environments_from_config() {
  local config="$1"
  echo "$config" | jq -r '.env.PRISME_ENVIRONMENTS // empty'
}

get_default_environment() {
  local envs_json="$1"
  echo "$envs_json" | jq -r 'to_entries[] | select(.value.default == true) | .key' | head -1
}

delete_environment() {
  local envs_json="$1" target="$2"
  echo "$envs_json" | jq --arg env "$target" 'del(.[$env])'
}

reassign_default_environment() {
  local envs_json="$1"
  local new_default
  new_default=$(echo "$envs_json" | jq -r 'keys[0]')
  echo "$envs_json" | jq --arg env "$new_default" '.[$env].default = true'
}

count_environments() {
  local envs_json="$1"
  echo "$envs_json" | jq 'keys | length'
}

migrate_legacy_config() {
  local old_api_key="$1" old_api_url="$2" old_default_env="$3"
  local env_name="${old_default_env:-default}"
  jq -n --arg u "$old_api_url" --arg k "$old_api_key" \
    '{"apiUrl": $u, "apiKey": $k, "default": true}' |
  jq -n --arg name "$env_name" --argjson env "$(cat)" '{($name): $env}'
}

create_api_key_helper() {
  local key="$1" path="$2"
  mkdir -p "$(dirname "$path")"
  cat > "$path" << EOF
#!/bin/sh
echo "$key"
EOF
  chmod 700 "$path"
}
```

#### 1.2 Update `setup.sh` as thin wrapper

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup-lib.sh"

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  main "$@"
fi
```

**Important**: Move `set -euo pipefail` into `main()` only — not at the top of `setup-lib.sh`. Sourcing a file with `set -e` globally changes how bash interprets commands in the test shell ([source](https://advancedweb.hu/unit-testing-bash-scripts/)).

#### 1.3 Functions to extract (priority)

| Function | Current lines | Complexity | Test value |
|----------|--------------|------------|------------|
| `build_environment_json` | 254-265 | Low | High — core building block |
| `add_environment_to_json` | 268 | Low | High |
| `validate_jwt_format` | 245-251 | Low | Medium |
| `extract_existing_config` | 328, 489, 529, 580, 682 | Low | High — repeated 5x |
| `get_default_environment` | 356-358 | Low | High |
| `delete_environment` | 656 | Low | High |
| `reassign_default_environment` | 659-662 | Medium | High — bug-prone |
| `count_environments` | 606 | Low | Medium |
| `migrate_legacy_config` | 691-822 | High | Very High — complex transformation |
| `check_prerequisites` | 84-114 | Medium | Medium |
| `create_api_key_helper` | 139-146 | Low | Medium |

---

### Phase 2: Set up BATS test infrastructure

#### 2.1 Install BATS as git submodules

```bash
git submodule add https://github.com/bats-core/bats-core.git claudeBootstrap/__tests__/bats
git submodule add https://github.com/bats-core/bats-support.git claudeBootstrap/__tests__/test_helper/bats-support
git submodule add https://github.com/bats-core/bats-assert.git claudeBootstrap/__tests__/test_helper/bats-assert
```

#### 2.2 Project structure

```
claudeBootstrap/
  setup.sh                 # thin entrypoint (calls main from lib)
  setup-lib.sh             # extracted functions (sourceable)
  __tests__/
    bats/                  # git submodule: bats-core
    test_helper/
      bats-support/        # git submodule
      bats-assert/         # git submodule
      common.bash          # shared setup/teardown helpers
    mocks/
      claude               # mock: records calls to $MOCK_LOG
      node                 # mock: returns fake version
      npm                  # mock: no-op for install/build
    unit/
      json-logic.bats      # JSON manipulation functions
      validation.bats      # JWT validation, prerequisites
      migration.bats       # Legacy config migration
    integration/
      fresh-install.bats   # Full fresh install flow
      update-key.bats      # Update API key flow
      delete-env.bats      # Delete environment flow
      toggle-feedback.bats # Toggle feedback flow
      migrate.bats         # Migration flow
```

#### 2.3 Common test helper (`test_helper/common.bash`)

```bash
# Load BATS libraries
load "${BATS_TEST_DIRNAME}/../test_helper/bats-support/load"
load "${BATS_TEST_DIRNAME}/../test_helper/bats-assert/load"

# Set up isolated environment
setup() {
  export ORIGINAL_PATH="$PATH"
  export MOCK_DIR="${BATS_TEST_DIRNAME}/../mocks"
  export HOME="$(mktemp -d)"
  export CLAUDE_CONFIG_DIR="$HOME/.claude"
  mkdir -p "$CLAUDE_CONFIG_DIR"

  # Prepend mocks to PATH (mock claude, node, npm)
  export PATH="$MOCK_DIR:$PATH"

  # Source the library
  source "${BATS_TEST_DIRNAME}/../../setup-lib.sh"
}

teardown() {
  export PATH="$ORIGINAL_PATH"
  rm -rf "$HOME"
}
```

#### 2.4 Mock scripts

**`mocks/claude`**:
```bash
#!/bin/bash
echo "$@" >> "${MOCK_LOG:-/tmp/claude-mock.log}"
# Simulate 'mcp add' and 'mcp remove' as no-ops
```

**`mocks/node`**:
```bash
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "v20.0.0"; else exec /usr/bin/env node "$@"; fi
```

**`mocks/npm`**:
```bash
#!/bin/bash
echo "npm mock: $@" >> "${MOCK_LOG:-/tmp/npm-mock.log}"
```

---

### Phase 3: Write unit tests

#### 3.1 `unit/json-logic.bats` — JSON manipulation

```bash
load '../test_helper/common'

@test "build_environment_json: first env has default=true" {
  run build_environment_json "sandbox" "https://api.sandbox.prisme.ai/v2" "eyFakeToken" "true"
  assert_success
  assert_output --partial '"default": true'
  assert_output --partial '"apiUrl": "https://api.sandbox.prisme.ai/v2"'
}

@test "build_environment_json: non-first env has no default" {
  run build_environment_json "prod" "https://api.studio.prisme.ai/v2" "eyFakeToken" "false"
  assert_success
  refute_output --partial '"default"'
}

@test "add_environment_to_json: adds to empty object" {
  local env_obj='{"apiUrl":"https://example.com","apiKey":"eyTest","default":true}'
  run add_environment_to_json "{}" "sandbox" "$env_obj"
  assert_success
  result=$(echo "$output" | jq -r '.sandbox.apiUrl')
  [ "$result" = "https://example.com" ]
}

@test "delete_environment: removes target env" {
  local envs='{"sandbox":{"apiUrl":"u1","apiKey":"k1"},"prod":{"apiUrl":"u2","apiKey":"k2"}}'
  run delete_environment "$envs" "sandbox"
  assert_success
  count=$(echo "$output" | jq 'keys | length')
  [ "$count" -eq 1 ]
  refute_output --partial '"sandbox"'
}

@test "reassign_default_environment: sets first remaining as default" {
  local envs='{"prod":{"apiUrl":"u2","apiKey":"k2"},"staging":{"apiUrl":"u3","apiKey":"k3"}}'
  run reassign_default_environment "$envs"
  assert_success
  default=$(echo "$output" | jq -r '.prod.default')
  [ "$default" = "true" ]
}

@test "get_default_environment: returns env with default=true" {
  local envs='{"sandbox":{"default":true},"prod":{}}'
  run get_default_environment "$envs"
  assert_success
  assert_output "sandbox"
}

@test "count_environments: returns correct count" {
  local envs='{"a":{},"b":{},"c":{}}'
  run count_environments "$envs"
  assert_success
  assert_output "3"
}
```

#### 3.2 `unit/validation.bats` — Input validation

```bash
load '../test_helper/common'

@test "validate_jwt_format: accepts token starting with ey" {
  run validate_jwt_format "eyJhbGciOiJIUzI1NiJ9.test"
  assert_success
}

@test "validate_jwt_format: rejects token not starting with ey" {
  run validate_jwt_format "sk-ant-1234"
  assert_failure
}

@test "validate_jwt_format: rejects empty string" {
  run validate_jwt_format ""
  assert_failure
}
```

#### 3.3 `unit/migration.bats` — Legacy config migration

```bash
load '../test_helper/common'

@test "migrate_legacy_config: creates environment from old vars" {
  run migrate_legacy_config "eyOldKey" "https://api.sandbox.prisme.ai/v2" "sandbox"
  assert_success
  assert_output --partial '"sandbox"'
  assert_output --partial '"default": true'
  assert_output --partial '"apiKey": "eyOldKey"'
}

@test "migrate_legacy_config: uses 'default' name when env name missing" {
  run migrate_legacy_config "eyOldKey" "https://api.example.com/v2" ""
  assert_success
  assert_output --partial '"default"'
}

@test "extract_existing_config: returns null for missing server" {
  echo '{}' > "$HOME/.claude.json"
  run extract_existing_config "$HOME/.claude.json"
  assert_output "null"
}

@test "extract_existing_config: extracts server config" {
  cat > "$HOME/.claude.json" << 'EOF'
{"mcpServers":{"prisme-ai-builder":{"env":{"PRISME_ENVIRONMENTS":"{}"}}}}
EOF
  run extract_existing_config "$HOME/.claude.json"
  assert_success
  assert_output --partial "PRISME_ENVIRONMENTS"
}
```

---

### Phase 4: Write integration tests

#### 4.1 `integration/fresh-install.bats` — Full flow with stdin piping

```bash
load '../test_helper/common'

@test "fresh install: single environment" {
  # Inputs: mode=1, anthropic=2(skip), add_env=y, name=sandbox,
  # url=https://api.sandbox.prisme.ai/v2, token=eyFake, add_more=n, feedback=1
  input="1\n2\ny\nsandbox\nhttps://api.sandbox.prisme.ai/v2\neyFakeToken\nn\n1\n"
  run bash -c "printf '$input' | bash ${BATS_TEST_DIRNAME}/../../setup.sh"
  assert_success
  assert_output --partial "Setup Complete"
  assert_output --partial "sandbox"
}

@test "fresh install: rejects empty environment list" {
  # Inputs: mode=1, anthropic=2(skip), add_env=n
  input="1\n2\nn\n"
  run bash -c "printf '$input' | bash ${BATS_TEST_DIRNAME}/../../setup.sh"
  assert_failure
  assert_output --partial "At least one environment is required"
}
```

#### 4.2 `integration/delete-env.bats` — Delete environment

```bash
load '../test_helper/common'

setup() {
  # ... common setup ...
  # Pre-seed ~/.claude.json with 2 environments
  cat > "$HOME/.claude.json" << 'EOF'
{
  "mcpServers": {
    "prisme-ai-builder": {
      "env": {
        "PRISME_ENVIRONMENTS": "{\"sandbox\":{\"apiUrl\":\"u1\",\"apiKey\":\"k1\",\"default\":true},\"prod\":{\"apiUrl\":\"u2\",\"apiKey\":\"k2\"}}",
        "PRISME_DISABLE_FEEDBACK_TOOLS": "false"
      }
    }
  }
}
EOF
}

@test "delete env: cannot delete last environment" {
  # Pre-seed with only 1 environment
  cat > "$HOME/.claude.json" << 'EOF'
{
  "mcpServers": {
    "prisme-ai-builder": {
      "env": {
        "PRISME_ENVIRONMENTS": "{\"sandbox\":{\"apiUrl\":\"u1\",\"apiKey\":\"k1\",\"default\":true}}",
        "PRISME_DISABLE_FEEDBACK_TOOLS": "false"
      }
    }
  }
}
EOF
  input="5\n"
  run bash -c "printf '$input' | bash ${BATS_TEST_DIRNAME}/../../setup.sh"
  assert_failure
  assert_output --partial "Cannot delete the only configured environment"
}
```

---

### Phase 5: CI integration

Add to `package.json`:

```json
{
  "scripts": {
    "test:setup": "claudeBootstrap/__tests__/bats/bin/bats claudeBootstrap/__tests__/"
  }
}
```

Or run directly:

```bash
./claudeBootstrap/__tests__/bats/bin/bats claudeBootstrap/__tests__/unit/
./claudeBootstrap/__tests__/bats/bin/bats claudeBootstrap/__tests__/integration/
```

---

## API / File Changes Summary

| File | Change | Type |
|------|--------|------|
| `claudeBootstrap/setup-lib.sh` | **NEW** — Extracted functions from setup.sh | Refactor |
| `claudeBootstrap/setup.sh` | **MODIFIED** — Thin wrapper sourcing setup-lib.sh | Refactor |
| `claudeBootstrap/__tests__/test_helper/common.bash` | **NEW** — Shared BATS helpers | Test infra |
| `claudeBootstrap/__tests__/mocks/claude` | **NEW** — Mock for claude CLI | Test infra |
| `claudeBootstrap/__tests__/mocks/node` | **NEW** — Mock for node | Test infra |
| `claudeBootstrap/__tests__/mocks/npm` | **NEW** — Mock for npm | Test infra |
| `claudeBootstrap/__tests__/unit/json-logic.bats` | **NEW** — JSON manipulation tests | Tests |
| `claudeBootstrap/__tests__/unit/validation.bats` | **NEW** — Input validation tests | Tests |
| `claudeBootstrap/__tests__/unit/migration.bats` | **NEW** — Migration logic tests | Tests |
| `claudeBootstrap/__tests__/integration/fresh-install.bats` | **NEW** — Fresh install flow tests | Tests |
| `claudeBootstrap/__tests__/integration/update-key.bats` | **NEW** — Update key flow tests | Tests |
| `claudeBootstrap/__tests__/integration/delete-env.bats` | **NEW** — Delete env flow tests | Tests |
| `claudeBootstrap/__tests__/integration/toggle-feedback.bats` | **NEW** — Toggle feedback tests | Tests |
| `claudeBootstrap/__tests__/integration/migrate.bats` | **NEW** — Migration flow tests | Tests |
| `.gitmodules` | **MODIFIED** — Add bats-core, bats-support, bats-assert | Config |
| `package.json` | **MODIFIED** — Add `test:setup` script | Config |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `set -euo pipefail` when sourcing breaks tests | Move it into `main()` only, not top-level in lib |
| Refactor introduces regression in setup.sh | Run manual smoke test of each mode before merging |
| Git submodules add complexity | Alternative: `npm install bats` or `brew install bats-core` in CI |
| Integration tests are slow (spawn subshells) | Keep integration tests minimal; most coverage via unit tests |
| Mock scripts don't capture all `claude mcp` args | Log all args to `$MOCK_LOG` and assert on log contents |

---

## Implementation Order

1. Extract `setup-lib.sh` functions + update `setup.sh` wrapper
2. Manual smoke test all 6 modes still work
3. Set up BATS submodules + test helper + mocks
4. Write unit tests (json-logic, validation, migration)
5. Write integration tests (fresh, delete, update-key)
6. Add `test:setup` script to package.json
7. Document in README

---

## Sources

- [BATS-core GitHub](https://github.com/bats-core/bats-core) — Test framework
- [BATS Documentation: Writing Tests](https://bats-core.readthedocs.io/en/stable/writing-tests.html) — Official docs
- [Unit Testing Bash Scripts — Advanced Web Machinery](https://advancedweb.hu/unit-testing-bash-scripts/) — Source-vs-execute pattern, function extraction
- [How to Mock in Bash Tests — Advanced Web Machinery](https://advancedweb.hu/how-to-mock-in-bash-tests/) — PATH-based mocking
- [Testing Bash Scripts Using BATS — The Water Tower (2025)](https://blog.thewatertower.org/2025/02/10/testing-bash-scripts-using-bats/) — Practical BATS patterns, `run --separate-stderr`
- [Effective Methods for Unit Testing Bash Scripts — Repeato](https://www.repeato.app/effective-methods-for-unit-testing-bash-scripts/) — Framework comparison (BATS vs ShellSpec vs shunit2)
- [On Bash Testing: Design, Not Just Safety — Lost in IT](https://www.lost-in-it.com/posts/on-bash-testing-design-not-just-safety/) — Testability design principles
- [How To Write a Bash Script That Answers Interactive Prompts — Baeldung](https://www.baeldung.com/linux/bash-interactive-prompts) — stdin piping for interactive scripts
- [Testing Your Shell Scripts with Bats — Tim Perry / Medium](https://medium.com/@pimterry/testing-your-shell-scripts-with-bats-abfca9bdc5b9) — Practical guide
- [Capital One bash_shell_mock](https://github.com/capitalone/bash_shell_mock) — Alternative mocking framework
- [ShellSpec](https://shellspec.info/) — Alternative BDD framework (considered, BATS preferred for simplicity)
