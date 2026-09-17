#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4177}"
PROJECT_SLUG="${2:-costos-azure}"

echo "== AI capacity endpoint smoke check =="
echo "Base URL: ${BASE_URL}"
echo "Project:  ${PROJECT_SLUG}"
echo

echo "1) GET current"
curl -sS "${BASE_URL}/api/projects/${PROJECT_SLUG}/ai-capacity-config"
echo
echo

echo "2) POST sample payload"
NOW_TAG="$(date +%H%M%S)"
PAYLOAD="{\"capacity\":6,\"aiModels\":[{\"key\":\"gpt-5.3-codex\",\"name\":\"GPT-5.3 Codex\",\"initials\":\"G5C\",\"maxParallel\":3,\"requiresOperator\":true,\"operatorName\":\"Operator-${NOW_TAG}\",\"enabled\":true},{\"key\":\"claude-sonnet\",\"name\":\"Claude Sonnet\",\"initials\":\"CS\",\"maxParallel\":2,\"requiresOperator\":false,\"operatorName\":\"\",\"enabled\":true}]}"
curl -sS -X POST "${BASE_URL}/api/projects/${PROJECT_SLUG}/ai-capacity-config" \
  -H "content-type: application/json" \
  --data "${PAYLOAD}"
echo
echo

echo "3) GET after POST"
curl -sS "${BASE_URL}/api/projects/${PROJECT_SLUG}/ai-capacity-config"
echo
echo

echo "Done."
