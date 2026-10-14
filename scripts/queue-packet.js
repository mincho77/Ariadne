#!/usr/bin/env node
'use strict';

const HOST = process.env.ARIADNE_BOARD_HOST || '127.0.0.1';
const PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HUB = process.env.ARIADNE_HUB_URL || `http://${HOST}:${PORT}`;

function usage() {
  console.error(`Usage: node scripts/queue-packet.js <project-slug> <task-id>

Writes a run packet under <project>/.ariadne/ (lane queue + run-packets/) without claiming.
Optional: --tier cheap|strong --max-cycles 1..20

Example:
  npm run queue:packet -- ariadne AH-E-38 --tier strong --max-cycles 5
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();
  const [project, taskId, ...flags] = args;
  const options = {};
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--tier') options.modelTier = flags[++index];
    else if (flag === '--max-cycles') options.maxCycles = Number(flags[++index]);
    else usage();
  }
  if (options.modelTier && !['cheap', 'strong'].includes(options.modelTier)) usage();
  if (options.maxCycles != null && (!Number.isInteger(options.maxCycles) || options.maxCycles < 1 || options.maxCycles > 20)) usage();
  const response = await fetch(
    `${HUB}/api/queue/packet?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: taskId, ...options }),
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
    modelTier: body.modelTier,
    modelTierReason: body.modelTierReason,
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
