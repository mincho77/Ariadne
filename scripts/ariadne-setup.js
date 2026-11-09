#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { MIN_NODE_MAJOR, parseNodeMajor, registerProject } = require('../lib/ariadne-onboarding');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    projectPath: '',
    name: '',
    catalogPath: process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json'),
    noAutostart: false,
    yes: false,
    packageMode: false,
    packageTransient: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--project-path' || arg === '-p') options.projectPath = argv[++index] || '';
    else if (arg === '--name') options.name = argv[++index] || '';
    else if (arg === '--catalog-path') options.catalogPath = argv[++index] || '';
    else if (arg === '--no-autostart') options.noAutostart = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--package-mode') options.packageMode = true;
    else if (arg === '--package-transient') options.packageTransient = true;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Ariadne setup — prepara el Hub local y registra un proyecto existente.

Uso:
  npm run setup
  npm run setup -- --project-path <carpeta> --name <nombre> --no-autostart

Opciones:
  --project-path, -p  Ruta de un proyecto ya existente
  --name             Nombre visible en Ariadne
  --catalog-path     Archivo local de catálogo (por defecto, projects.json)
  --no-autostart     No ofrecer el inicio automático
  --yes, -y          Modo sin preguntas; requiere --project-path
`);
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  return trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1)
    : trimmed;
}

async function promptValue(rl, label, fallback = '') {
  const answer = await rl.question(fallback ? `${label} [${fallback}]: ` : `${label}: `);
  return unquote(answer || fallback);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return printHelp();

  const nodeMajor = parseNodeMajor(process.version);
  if (nodeMajor < MIN_NODE_MAJOR) {
    throw new Error(`Ariadne requiere Node.js ${MIN_NODE_MAJOR} o superior. Detectado: ${process.version}.`);
  }
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'backlog.md'))
    || !fs.existsSync(path.join(ROOT, 'node_modules', 'yaml'))) {
    throw new Error('Faltan dependencias. Ejecuta npm install en la carpeta de Ariadne y vuelve a intentar.');
  }

  const interactive = Boolean(stdin.isTTY && stdout.isTTY);
  const rl = interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;
  try {
    console.log('Ariadne — configuración inicial\n');
    let projectPath = options.projectPath || '';
    let projectName = options.name || '';

    if (!projectPath && interactive && !options.yes) {
      projectPath = await promptValue(rl, 'Ruta completa de un proyecto existente');
    }
    if (!projectPath) throw new Error('Indica la ruta de tu proyecto con --project-path o vuelve a iniciar setup en una terminal interactiva.');
    if (!projectName && interactive && !options.yes) {
      projectName = await promptValue(rl, 'Nombre del proyecto en Ariadne', path.basename(path.resolve(projectPath)));
    }

    const result = await registerProject({
      catalogPath: path.resolve(options.catalogPath),
      projectPath,
      name: projectName,
    });
    console.log(result.created
      ? `Proyecto agregado: ${result.project.name} (${result.project.slug}).`
      : `El proyecto ya estaba registrado: ${result.project.name} (${result.project.slug}).`);

    let installAutostart = false;
    if (interactive && !options.yes && !options.noAutostart && !options.packageTransient) {
      const answer = await promptValue(rl, '¿Quieres que Ariadne se inicie al entrar a tu sesión? (s/N)', 'N');
      installAutostart = /^s[ií]?$/i.test(answer);
    }

    if (installAutostart) {
      const installer = path.join(ROOT, 'scripts', 'install-hub-autostart.js');
      const installed = spawnSync(process.execPath, [installer, 'install', '--root', ROOT, '--catalog-path', path.resolve(options.catalogPath)], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'inherit',
      });
      if (installed.error) throw installed.error;
      if (installed.status !== 0) throw new Error('No se pudo activar el inicio automático. El inicio manual sigue disponible.');
    }

    const startCommand = options.packageMode ? 'ariadne-hub start' : 'npm start';
    console.log(`\nListo. Abre el Hub con: ${startCommand}`);
    console.log('Dirección local: http://127.0.0.1:4177/');
    console.log(`Para revisar la instalación: ${options.packageMode ? 'ariadne-hub doctor' : 'npm run doctor'}`);
    console.log('El registro solo guarda la ruta local en el catálogo de esta máquina; no modifica la carpeta del proyecto.');
    if (options.packageTransient) console.log('Como esta versión se ejecuta desde la caché temporal de npx, el autoinicio se omite. Usa una instalación estable desde GitHub o npm global para mantener el Hub activo.');
  } finally {
    rl?.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Setup detenido: ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, printHelp };
