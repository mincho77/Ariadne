#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { runDoctor } = require('../lib/ariadne-onboarding');

function parseArgs(argv) {
  const options = {
    root: path.resolve(__dirname, '..'),
    catalogPath: process.env.ARIADNE_CATALOG_PATH || '',
    hubUrl: process.env.ARIADNE_HUB_URL || 'http://127.0.0.1:4177',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.root = path.resolve(argv[++index] || '');
    else if (arg === '--catalog-path') options.catalogPath = path.resolve(argv[++index] || '');
    else if (arg === '--hub-url') options.hubUrl = argv[++index] || options.hubUrl;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (!options.catalogPath) options.catalogPath = path.join(options.root, 'projects.json');
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log('Uso: npm run doctor [-- --root <carpeta Ariadne> --catalog-path <archivo> --hub-url <URL>]');
    return 0;
  }
  const report = await runDoctor(options);
  for (const item of report.checks) {
    const label = item.status === 'ok' ? 'OK' : item.status === 'fail' ? 'ERROR' : 'INFO';
    console.log(`[${label}] ${item.label}: ${item.detail}`);
  }
  console.log(report.ok ? '\nAriadne está lista para usarse.' : '\nAriadne necesita atención. Corrige los puntos marcados como ERROR.');
  return report.exitCode;
}

if (require.main === module) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch((error) => {
    console.error(`Doctor no pudo terminar: ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs };
