#!/usr/bin/env node
'use strict';

const HOST = process.env.ARIADNE_BOARD_HOST || '127.0.0.1';
const PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HUB = process.env.ARIADNE_HUB_URL || `http://${HOST}:${PORT}`;

function usage() {
  console.error(`Usage: node scripts/queue-complete.js <project-slug> <task-id> [evidence]

Marks a task Done via the Kanban API (used by the bug-queue runner workflow).
Requires ## Evidence / ## Closeout on the task, or pass evidence text as 3rd arg.

Example:
  npm run queue:complete -- project-demo PD-B-23 "npm test + Pharos ok"
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const [project, taskId, evidence] = args;
  const payload = { id: taskId, status: 'Done' };
  if (evidence) payload.evidence = evidence;
  const response = await fetch(
    `${HUB}/api/tasks/status?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    console.error(body.error || `HTTP ${response.status}`);
    process.exit(1);
  }
  console.log(`${body.id} → Done`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
