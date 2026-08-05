'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { validateGanttPlanForUi } = require('../lib/gantt/ui-contract');

async function reservePort() {
  const net = require('node:net');
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForHttp(url, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function stopProcess(child, timeoutMs = 1500) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit').catch(() => undefined);
  }
}

function createCloudSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-cloud-smoke-'));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - Cloud.md'), `---
id: AH-E-1
title: Cloud smoke task
status: To Do
priority: Medium
type: task
estimate_days: 1
---`);
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'cloud-demo', name: 'Cloud Demo', path: projectRoot, port: 6522 },
  ], null, 2)}\n`);
  return { sandbox, catalogPath, projectRoot };
}

test('cloud dev smoke: hub APIs and gantt stack over HTTP', { timeout: 30000 }, async () => {
  const { catalogPath } = createCloudSandbox();
  const port = await reservePort();
  const root = path.join(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      ARIADNE_HUB_PORT: String(port),
      ARIADNE_BOARD_PORT: String(port),
      ARIADNE_CATALOG_PATH: catalogPath,
    },
    stdio: 'ignore',
  });

  try {
    await waitForHttp(`http://127.0.0.1:${port}/api/projects`);

    const projects = await fetch(`http://127.0.0.1:${port}/api/projects`);
    assert.equal(projects.status, 200);
    const list = await projects.json();
    assert.ok(Array.isArray(list));
    assert.equal(list[0].slug, 'cloud-demo');

    const hubConfig = await fetch(`http://127.0.0.1:${port}/api/hub-config`);
    assert.equal(hubConfig.status, 200);
    const hubBody = await hubConfig.json();
    assert.ok(hubBody.ganttUi?.endpoints?.portfolio);

    const planRes = await fetch(`http://127.0.0.1:${port}/api/projects/cloud-demo/gantt?includeDone=0&startDate=2026-08-04`);
    assert.equal(planRes.status, 200);
    const plan = await planRes.json();
    const validation = validateGanttPlanForUi(plan);
    assert.equal(validation.valid, true, validation.errors?.join('; '));
    assert.ok(plan.slack?.logicalCriticalPath);

    const portfolio = await fetch(`http://127.0.0.1:${port}/api/gantt/portfolio?includeDone=0&startDate=2026-08-04`);
    assert.equal(portfolio.status, 200);
    const portfolioBody = await portfolio.json();
    assert.equal(portfolioBody.summary.projectCount, 1);

    const staticPage = await fetch(`http://127.0.0.1:${port}/portfolio.html`);
    assert.equal(staticPage.status, 200);
    assert.match(await staticPage.text(), /Portafolio Gantt/);
  } finally {
    await stopProcess(child);
  }
});

test('cloud dev smoke: package scripts exist for agent workflows', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  for (const script of [
    'test',
    'gantt:smoke',
    'gantt:ui:bootstrap',
    'gantt:audit',
    'smoke:cloud',
    'smoke:lifecycle',
    'ariadne:audit',
    'ariadne:audit:fix',
    'ariadne:sync',
    'ariadne:launcher',
    'ariadne:route-hint',
  ]) {
    assert.ok(pkg.scripts[script], `missing npm script ${script}`);
  }
});

test('cloud dev smoke: ariadne sync and launcher CLIs exit 0', () => {
  const root = path.join(__dirname, '..');
  const sync = spawnSync(process.execPath, ['scripts/ariadne-sync.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  assert.equal(JSON.parse(sync.stdout).ok, true);

  const launcher = spawnSync(process.execPath, ['scripts/ariadne-launcher.js', 'actualiza el ledger'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(launcher.status, 0, launcher.stderr);
  assert.equal(JSON.parse(launcher.stdout).skill, 'ariadne-lite');

  const bootstrap = spawnSync(process.execPath, ['scripts/gantt-ui-bootstrap.js', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
  const bootstrapBody = JSON.parse(bootstrap.stdout);
  assert.equal(bootstrapBody.blockId, 'AGANTT-DEF-01');
  assert.equal(bootstrapBody.backend.ready, true);
});
