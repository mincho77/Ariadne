#!/usr/bin/env bash
# Kanoa parity shortcut → generic test-plan autopilot.
# Usage:
#   ./scripts/ariadne/run-parity-autopilot.sh [REPO_ROOT] [CONFIG_JSON]
# Env:
#   KANOA_ROOT            project root with backlog/ (default: cwd)
#   KANOA_PARITY_CONFIG   path to plan JSON (relative to ROOT or absolute)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-${KANOA_ROOT:-$PWD}}"
CONFIG="${2:-${KANOA_PARITY_CONFIG:-}}"

cd "$ROOT"

if [[ -z "$CONFIG" ]]; then
  # Prefer a project-local plan; fall back to Ariadne template if present in this repo.
  if [[ -f "backlog/docs/plans/kanoa-parity.test-plan.json" ]]; then
    CONFIG="backlog/docs/plans/kanoa-parity.test-plan.json"
  elif [[ -f "skills/kanoa-parity-autopilot/templates/test-plan.template.json" ]]; then
    CONFIG="skills/kanoa-parity-autopilot/templates/test-plan.template.json"
  else
    echo "No config found. Pass CONFIG path or set KANOA_PARITY_CONFIG."
    echo "Template: skills/kanoa-parity-autopilot/templates/test-plan.template.json"
    exit 1
  fi
fi

AUTOPILOT="$SCRIPT_DIR/test-plan-autopilot.mjs"
if [[ ! -f "$AUTOPILOT" ]]; then
  # When this script is copied into a consumer repo under scripts/ariadne/
  AUTOPILOT="$ROOT/scripts/ariadne/test-plan-autopilot.mjs"
fi

echo "[parity-autopilot] root=$ROOT"
echo "[parity-autopilot] config=$CONFIG"
node "$AUTOPILOT" --config "$CONFIG"
