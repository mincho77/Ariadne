#!/usr/bin/env node
'use strict';

const HOST = process.env.ARIADNE_BOARD_HOST || '127.0.0.1';
const PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HUB = process.env.ARIADNE_HUB_URL || `http://${HOST}:${PORT}`;

function usage() {
  console.error(`Usage: node scripts/queue-complete.js <project-slug> <task-id>

Marks a task Done via the Kanban API (used by the bug-queue runner workflow).

Example:
  npm run queue:complete -- jurismate JM-B-23
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const [project, taskId] = args;
  const response = await fetch(
    `${HUB}/api/tasks/status?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: 'Done' }),
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
