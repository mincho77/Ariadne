#!/usr/bin/env bash
# Eval exports for external Codex/Cursor wrappers: eval "$(./scripts/ariadne-launcher.sh 'mueve a cola')"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MESSAGE="${*:-}"
if [ -z "$MESSAGE" ] && [ ! -t 0 ]; then
  MESSAGE="$(cat)"
fi
if [ -z "$MESSAGE" ]; then
  echo "Usage: eval \"\$(./scripts/ariadne-launcher.sh '<message>')\"" >&2
  exit 1
fi

node "$ROOT/scripts/ariadne-launcher.js" "$MESSAGE" | node -e "
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const plan = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  for (const [key, value] of Object.entries(plan.env || {})) {
    process.stdout.write('export ' + key + '=' + JSON.stringify(String(value)) + ';');
  }
  process.stdout.write('export ARIADNE_SKILL_FILE=' + JSON.stringify(plan.skillFile) + ';');
  if (process.env.ARIADNE_LAUNCHER_VERBOSE === '1') {
    process.stdout.write(' echo \"ariadne-launcher: skill=' + plan.skillName + ' tier=' + plan.env.ARIADNE_MODEL_TIER + '\";');
  }
});
"
