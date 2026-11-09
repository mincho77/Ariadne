'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultUserCatalogPath,
  normalizedForCompare,
  parseNodeMajor,
  readCatalog,
  registerProject,
  runDoctor,
  slugify,
} = require('../lib/ariadne-onboarding');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-onboarding-'));
}

test('user catalog defaults are isolated by operating system', () => {
  assert.equal(defaultUserCatalogPath({ platform: 'darwin', home: '/Users/test', env: {} }), '/Users/test/Library/Application Support/Ariadne/projects.json');
  assert.equal(defaultUserCatalogPath({ platform: 'win32', home: 'C:\\Users\\test', env: { APPDATA: 'C:\\Users\\test\\Roaming' } }), path.join('C:\\Users\\test\\Roaming', 'Ariadne', 'projects.json'));
  assert.equal(defaultUserCatalogPath({ platform: 'linux', home: '/home/test', env: { XDG_CONFIG_HOME: '/home/test/.config-test' } }), '/home/test/.config-test/ariadne/projects.json');
});

test('catalog registration is atomic, idempotent, and does not edit the project', async () => {
  const root = tempDir();
  const projectPath = path.join(root, 'Mi Proyecto');
  fs.mkdirSync(projectPath);
  fs.writeFileSync(path.join(projectPath, 'README.md'), 'keep this untouched\n');
  const catalogPath = path.join(root, 'config', 'projects.json');
  const first = await registerProject({
    catalogPath,
    projectPath,
    name: 'Mi Proyecto',
    portProbe: async () => true,
  });
  assert.equal(first.created, true);
  assert.equal(first.project.slug, 'mi-proyecto');
  assert.equal(first.project.port, 6421);
  assert.equal(fs.readFileSync(path.join(projectPath, 'README.md'), 'utf8'), 'keep this untouched\n');
  if (process.platform !== 'win32') assert.equal(fs.statSync(catalogPath).mode & 0o777, 0o600);

  const before = fs.readFileSync(catalogPath, 'utf8');
  const duplicate = await registerProject({
    catalogPath,
    projectPath: path.join(projectPath, '.'),
    name: 'Nombre duplicado',
    portProbe: async () => true,
  });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.project.slug, 'mi-proyecto');
  assert.equal(fs.readFileSync(catalogPath, 'utf8'), before);
});

test('registration preserves existing entries and allocates a unique slug and port', async () => {
  const root = tempDir();
  const firstPath = path.join(root, 'first');
  const secondPath = path.join(root, 'second');
  fs.mkdirSync(firstPath);
  fs.mkdirSync(secondPath);
  const catalogPath = path.join(root, 'projects.json');
  const existing = [{ slug: 'mi-proyecto', name: 'Existing', path: firstPath, port: 6424 }];
  fs.writeFileSync(catalogPath, `${JSON.stringify(existing)}\n`);
  const result = await registerProject({
    catalogPath,
    projectPath: secondPath,
    name: 'Mi Proyecto',
    portProbe: async (port) => port !== 6425,
  });
  assert.equal(result.project.slug, 'mi-proyecto-2');
  assert.equal(result.project.port, 6426);
  assert.deepEqual(readCatalog(catalogPath).map((project) => project.slug), ['mi-proyecto', 'mi-proyecto-2']);
});

test('invalid catalogs and missing paths are never overwritten', async () => {
  const root = tempDir();
  const catalogPath = path.join(root, 'projects.json');
  fs.writeFileSync(catalogPath, '{invalid json');
  await assert.rejects(registerProject({ catalogPath, projectPath: root }), /No se pudo leer el catálogo/);
  assert.equal(fs.readFileSync(catalogPath, 'utf8'), '{invalid json');
  await assert.rejects(registerProject({ catalogPath, projectPath: path.join(root, 'missing') }), /No existe una carpeta/);
});

test('path and version helpers normalize user input safely', () => {
  assert.equal(slugify(' Mi Proyecto 2026 '), 'mi-proyecto-2026');
  assert.equal(parseNodeMajor('v20.20.2'), 20);
  assert.equal(parseNodeMajor('not-node'), 0);
  assert.equal(normalizedForCompare('Folder/Project', 'win32'), normalizedForCompare('folder/project', 'win32'));
});

test('doctor passes a healthy install without depending on a running network service', async () => {
  const root = tempDir();
  const projectPath = path.join(root, 'project');
  fs.mkdirSync(path.join(root, 'node_modules', 'backlog.md'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'yaml'), { recursive: true });
  fs.mkdirSync(projectPath);
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const catalogPath = path.join(root, 'projects.json');
  fs.writeFileSync(catalogPath, JSON.stringify([{ slug: 'project', name: 'Project', path: projectPath }]));
  const result = await runDoctor({
    root,
    catalogPath,
    nodeVersion: 'v20.0.0',
    fetchImpl: async () => ({ ok: false }),
    portProbe: async () => true,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.checks.some((item) => item.status === 'fail'), false);
  assert.equal(result.checks.some((item) => item.label === 'Hub local' && item.status === 'info'), true);
});

test('doctor reports actionable failures for invalid local state and old Node', async () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const catalogPath = path.join(root, 'projects.json');
  fs.writeFileSync(catalogPath, '{broken');
  const result = await runDoctor({ root, catalogPath, nodeVersion: 'v16.0.0', fetchImpl: async () => ({ ok: true }), portProbe: async () => true });
  assert.equal(result.exitCode, 1);
  assert.match(result.checks.find((item) => item.label === 'Node.js').detail, /Node.js 18/);
  assert.match(result.checks.find((item) => item.label === 'Dependencias').detail, /npm install/);
  assert.match(result.checks.find((item) => item.label === 'Catálogo').detail, /conservó el archivo/);
});

test('doctor distinguishes an occupied port from a restricted port probe', async () => {
  const root = tempDir();
  fs.mkdirSync(path.join(root, 'node_modules', 'backlog.md'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'yaml'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const catalogPath = path.join(root, 'projects.json');
  const occupied = await runDoctor({ root, catalogPath, fetchImpl: async () => ({ ok: false }), portProbe: async () => false });
  assert.equal(occupied.checks.find((item) => item.label === 'Puerto 4177').status, 'fail');
  const restricted = await runDoctor({ root, catalogPath, fetchImpl: async () => ({ ok: false }), portProbe: async () => null });
  assert.equal(restricted.checks.find((item) => item.label === 'Puerto 4177').status, 'warn');
  assert.equal(restricted.exitCode, 0);
});
