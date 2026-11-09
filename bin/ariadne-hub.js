#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const { defaultUserCatalogPath } = require('../lib/ariadne-onboarding');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = process.env.ARIADNE_CATALOG_PATH || defaultUserCatalogPath();
const TRANSIENT_NPX_INSTALL = /[\\/]_npx[\\/]/i.test(ROOT);

function help() {
  console.log(`Ariadne Hub — ayuda local para organizar y auditar proyectos.

Comandos:
  ariadne-hub setup             Configura el Hub y registra un proyecto existente
  ariadne-hub doctor            Revisa requisitos, proyectos y estado del Hub
  ariadne-hub start             Abre el Hub local en primer plano
  ariadne-hub autostart install Inicia el Hub automáticamente al entrar a tu sesión
  ariadne-hub autostart status  Muestra el estado del inicio automático
  ariadne-hub autostart uninstall Quita el inicio automático

Hub local: http://127.0.0.1:4177/
`);
}

function runScript(script, args) {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    env: { ...process.env, ARIADNE_CATALOG_PATH: CATALOG_PATH },
    stdio: 'inherit',
  });
  child.once('error', (error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) process.exitCode = 1;
    else process.exitCode = Number(code) || 0;
  });
}

function start() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ARIADNE_CATALOG_PATH: CATALOG_PATH },
    stdio: 'inherit',
  });
  console.log('Ariadne Hub: http://127.0.0.1:4177/');
  const stop = () => child.kill('SIGINT');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  child.once('error', (error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    process.exitCode = signal ? 0 : Number(code) || 0;
  });
}

function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') return help();
  if (command === 'setup') {
    const setupArgs = ['--package-mode', '--catalog-path', CATALOG_PATH, ...rest];
    if (TRANSIENT_NPX_INSTALL) setupArgs.push('--package-transient');
    return runScript('ariadne-setup.js', setupArgs);
  }
  if (command === 'doctor') return runScript('ariadne-doctor.js', ['--root', ROOT, '--catalog-path', CATALOG_PATH, ...rest]);
  if (command === 'start') return start();
  if (command === 'autostart') {
    const [action, ...options] = rest;
    if (!['install', 'uninstall', 'status'].includes(action)) throw new Error('Usa autostart install, autostart status o autostart uninstall.');
    if (TRANSIENT_NPX_INSTALL && action === 'install') {
      throw new Error('npx usa una carpeta temporal. Para dejar Ariadne activo en cada sesión, clónalo desde GitHub o instala el paquete globalmente y configura el autoinicio desde esa ruta estable.');
    }
    return runScript('install-hub-autostart.js', [action, '--root', ROOT, '--catalog-path', CATALOG_PATH, ...options]);
  }
  throw new Error(`Comando desconocido: ${command}. Ejecuta ariadne-hub --help.`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.message || error);
    process.exitCode = 2;
  }
}

module.exports = { CATALOG_PATH, main };
