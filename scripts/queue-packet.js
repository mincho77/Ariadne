#!/usr/bin/env node
'use strict';

const HOST = process.env.ARIADNE_BOARD_HOST || '127.0.0.1';
const PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HUB = process.env.ARIADNE_HUB_URL || `http://${HOST}:${PORT}`;

function usage() {
  console.error(`Usage: node scripts/queue-packet.js <project-slug> <task-id>

Writes a run packet under <project>/.ariadne/ (lane queue + run-packets/) without claiming.

Example:
  npm run queue:packet -- ariadne AH-E-38
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();
  const [project, taskId] = args;
  const response = await fetch(
    `${HUB}/api/queue/packet?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: taskId }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    console.error(body.error || `HTTP ${response.status}`);
    process.exit(1);
  }
  console.log(JSON.stringify({
    id: body.id,
    lane: body.lane,
    runFile: body.runFile,
    shared: `.ariadne/run-packets/${body.id}.md`,
  }, null, 2));
  console.log('\n--- instruction ---\n');
  console.log(body.instruction);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
