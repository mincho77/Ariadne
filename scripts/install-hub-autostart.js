#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { renderSystemdUnit, renderWindowsStartupScript, userConfigDirectory } = require('../lib/ariadne-autostart');
const { HUB_LABEL, HUB_PLIST_NAME } = require('../lib/launchagent-hub');

const ROOT = path.resolve(__dirname, '..');
const LINUX_SERVICE = 'ariadne-hub.service';
const WINDOWS_SCRIPT = 'Ariadne Hub.vbs';

function parseArgs(argv) {
  const args = {
    action: '',
    root: ROOT,
    catalogPath: process.env.ARIADNE_CATALOG_PATH || '',
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!args.action && ['install', 'uninstall', 'status'].includes(arg)) args.action = arg;
    else if (arg === '--root') args.root = path.resolve(argv[++index] || '');
    else if (arg === '--catalog-path') args.catalogPath = path.resolve(argv[++index] || '');
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (!args.action && !args.help) throw new Error('Indica install, uninstall o status.');
  return args;
}

function run(command, commandArgs, { dryRun = false, env = process.env } = {}) {
  if (dryRun) {
    console.log(`[simulación] ${command} ${commandArgs.join(' ')}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', env });
  if (result.error) throw result.error;
  return result;
}

function assertHubRoot(root) {
  const serverPath = path.join(root, 'server.js');
  if (!fs.existsSync(serverPath)) throw new Error(`No se encuentra server.js en ${root}.`);
  return serverPath;
}

function macos(args, serverPath) {
  if (args.action === 'status') {
    const status = run('launchctl', ['print', `gui/${process.getuid()}/${HUB_LABEL}`]);
    console.log(status.status === 0
      ? `Autoinicio configurado (${HUB_PLIST_NAME}) y cargado.`
      : 'Autoinicio no está cargado.');
    return;
  }
  const helper = path.join(ROOT, 'scripts', 'install-hub-launchagent.js');
  const helperArgs = args.action === 'uninstall' ? ['--uninstall'] : [];
  if (args.dryRun) helperArgs.push('--dry-run');
  if (args.action !== 'uninstall') helperArgs.push('--root', args.root);
  if (args.catalogPath) helperArgs.push('--catalog-path', args.catalogPath);
  const result = run(process.execPath, [helper, ...helperArgs], { dryRun: false });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error('No se pudo configurar el LaunchAgent de Ariadne.');
  return serverPath;
}

function windows(args, serverPath) {
  const startupDir = path.join(userConfigDirectory(os.homedir(), 'win32'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const startupFile = path.join(startupDir, WINDOWS_SCRIPT);
  if (args.action === 'status') {
    console.log(fs.existsSync(startupFile) ? `Autoinicio configurado: ${startupFile}` : 'Autoinicio no configurado.');
    return;
  }
  if (args.action === 'uninstall') {
    if (!args.dryRun) fs.rmSync(startupFile, { force: true });
    else console.log(`[simulación] eliminar ${startupFile}`);
    console.log('Autoinicio eliminado para esta cuenta de Windows.');
    return;
  }
  const source = renderWindowsStartupScript({
    nodePath: process.execPath,
    serverPath,
    workingDirectory: args.root,
    catalogPath: args.catalogPath,
  });
  if (args.dryRun) console.log(`[simulación] escribir ${startupFile}\n${source}`);
  else {
    fs.mkdirSync(startupDir, { recursive: true });
    fs.writeFileSync(startupFile, source, { encoding: 'utf8', mode: 0o600 });
    console.log(`Autoinicio instalado para esta cuenta: ${startupFile}`);
  }
}

function linux(args, serverPath) {
  const serviceDir = path.join(userConfigDirectory(os.homedir(), 'linux'), 'systemd', 'user');
  const servicePath = path.join(serviceDir, LINUX_SERVICE);
  if (args.action === 'status') {
    const status = run('systemctl', ['--user', 'is-active', LINUX_SERVICE]);
    console.log(status.status === 0 ? 'Autoinicio configurado y activo.' : 'Autoinicio no está activo.');
    return;
  }
  if (args.action === 'uninstall') {
    run('systemctl', ['--user', 'disable', '--now', LINUX_SERVICE], { dryRun: args.dryRun });
    if (args.dryRun) console.log(`[simulación] eliminar ${servicePath}`);
    else fs.rmSync(servicePath, { force: true });
    run('systemctl', ['--user', 'daemon-reload'], { dryRun: args.dryRun });
    console.log('Autoinicio eliminado para esta cuenta de Linux.');
    return;
  }
  const source = renderSystemdUnit({
    nodePath: process.execPath,
    serverPath,
    workingDirectory: args.root,
    catalogPath: args.catalogPath,
  });
  if (args.dryRun) console.log(`[simulación] escribir ${servicePath}\n${source}`);
  else {
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(servicePath, source, { encoding: 'utf8', mode: 0o600 });
  }
  run('systemctl', ['--user', 'daemon-reload'], { dryRun: args.dryRun });
  const enabled = run('systemctl', ['--user', 'enable', '--now', LINUX_SERVICE], { dryRun: args.dryRun });
  if (enabled.status !== 0) {
    throw new Error('No se pudo activar systemd de usuario. La unidad se conservó; inicia manualmente con npm start o configura un gestor de sesión compatible.');
  }
  console.log(args.dryRun ? 'Simulación completa: systemd activaría Ariadne en esta sesión.' : 'Autoinicio instalado y activo para esta cuenta de Linux.');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Uso: node scripts/install-hub-autostart.js <install|uninstall|status> [--root <ruta>] [--catalog-path <archivo>] [--dry-run]');
    return 0;
  }
  const serverPath = args.action === 'uninstall' || args.action === 'status' ? '' : assertHubRoot(args.root);
  if (args.action === 'uninstall' || args.action === 'status') assertHubRoot(args.root);
  if (process.platform === 'darwin') macos(args, serverPath);
  else if (process.platform === 'win32') windows(args, serverPath);
  else if (process.platform === 'linux') linux(args, serverPath);
  else throw new Error(`El inicio automático no está preparado para ${process.platform}. Usa npm start.`);
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(); } catch (error) {
    console.error(`Autoinicio detenido: ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = { LINUX_SERVICE, WINDOWS_SCRIPT, linux, main, macos, parseArgs, run, windows };
