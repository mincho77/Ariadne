#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED = [
  'bin/ariadne-hub.js',
  'server.js',
  'public/index.html',
  'scripts/ariadne-setup.js',
  'scripts/ariadne-doctor.js',
  'scripts/install-hub-autostart.js',
  'lib/ariadne-onboarding.js',
  'docs/INSTALLING.md',
  'docs/instalacion.md',
  'README.md',
  'README.es.md',
  'LICENSE',
];
const FORBIDDEN = [
  /^projects\.json$/i,
  /^tests\//i,
  /^node_modules\//i,
  /^backlog\/tasks\//i,
  /^projects\//i,
  /^\.ariadne\//i,
  /(^|\/)\.env($|\.)/i,
];

function runPack({ root = ROOT, npmExecPath = process.env.npm_execpath, platform = process.platform } = {}) {
  if (npmExecPath) return spawnSync(process.execPath, [npmExecPath, 'pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
  if (platform === 'win32') throw new Error('Ejecuta este control con npm run package:check para usar el npm activo.');
  return spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
}

function main(options = {}) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (packageJson.private === true) throw new Error('package.json sigue marcado como private; no puede publicarse para npx.');
  if (!packageJson.bin?.['ariadne-hub']) throw new Error('Falta el ejecutable bin/ariadne-hub.js en package.json.');

  const result = runPack(options);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'npm pack --dry-run falló').trim());
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error('npm pack no devolvió un informe JSON válido.'); }
  const files = (report[0]?.files || []).map((entry) => entry.path.replace(/\\/g, '/'));
  const missing = REQUIRED.filter((file) => !files.includes(file));
  const leaked = files.filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)));
  if (missing.length || leaked.length) {
    const details = [
      missing.length ? `Faltan del paquete: ${missing.join(', ')}` : '',
      leaked.length ? `Archivos locales o de desarrollo incluidos: ${leaked.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    throw new Error(details);
  }
  console.log(`Paquete ${packageJson.name}@${packageJson.version}: ${files.length} archivos; ejecutable y archivos locales verificados.`);
  return { name: packageJson.name, version: packageJson.version, files };
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Control del paquete falló: ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = { FORBIDDEN, REQUIRED, main, runPack };
