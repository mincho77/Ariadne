#!/usr/bin/env node
'use strict';

const {
  FRONTEND_REPO,
  FRONTEND_DEFAULT_PORT,
} = require('../lib/gantt/ui-contract');
const {
  checkFrontendRepoRemote,
  probeGanttUiReachability,
  buildGanttUiBootstrapReport,
} = require('../lib/gantt/ui-probe');

function usage() {
  console.error(`Usage:
  node scripts/gantt-ui-bootstrap.js [--json] [--strict] [--require-ui]

Diagnóstico AGANTT-DEF-01: repo frontend Git, reachability HTTP :63447, pasos de arranque.
No clona ni instala; solo verifica y documenta.

Exit 0 por defecto (informativo). --strict sale 1 si el repo remoto no responde.
--require-ui con --strict también exige UI HTTP alcanzable.
`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = { json: false, strict: false, requireUi: false };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--require-ui') flags.requireUi = true;
    else if (arg === '--help' || arg === '-h') usage();
    else usage();
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const repoUrl = process.env.ARIADNE_GANTT_UI_REPO || FRONTEND_REPO;
  const uiBaseUrl = process.env.ARIADNE_GANTT_BASE_URL || `http://localhost:${FRONTEND_DEFAULT_PORT}/`;

  const repoCheck = checkFrontendRepoRemote(repoUrl);
  const uiProbe = await probeGanttUiReachability(uiBaseUrl);
  const report = buildGanttUiBootstrapReport({ repoCheck, uiProbe });

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Gantt UI bootstrap (AGANTT-DEF-01)');
    console.log(`  Repo: ${report.frontend.repoUrl}`);
    console.log(`  Repo remoto: ${report.frontend.repoAvailable ? 'OK' : 'NO — ' + (report.frontend.repoError || 'unknown')}`);
    console.log(`  UI ${report.frontend.uiBaseUrl}: ${report.frontend.uiReachable ? 'OK HTTP ' + report.frontend.uiStatus : 'no responde'}`);
    console.log('  Backend listo: npm run gantt:smoke');
    console.log('  Pasos:');
    for (const step of report.nextSteps) {
      console.log(`    - ${step}`);
    }
  }

  if (flags.strict) {
    if (!report.frontend.repoAvailable) process.exit(1);
    if (flags.requireUi && !report.frontend.uiReachable) process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(2);
});
