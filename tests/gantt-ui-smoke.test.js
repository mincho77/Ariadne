'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const {
  buildGanttLaunchUrl,
  buildHubGanttUiConfig,
  validateGanttPlanForUi,
  FRONTEND_REPO,
} = require('../lib/gantt/ui-contract');
const { probeGanttUiReachability } = require('../lib/gantt/ui-probe');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');

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

async function waitForHttp(url, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server booting.
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

function createGanttUiSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-gantt-ui-smoke-'));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'gt-e-1 - One.md'), '---\nid: GT-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'gt-e-2 - Two.md'), '---\nid: GT-E-2\ntitle: Two\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\ndependencies:\n  - GT-E-1\n---\n');
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'demo-gantt-ui', name: 'Demo Gantt UI', path: projectRoot, port: 6521 },
  ], null, 2)}\n`);
  return { catalogPath, projectRoot };
}

test('buildGanttLaunchUrl encodes project slug for external UI', () => {
  const url = buildGanttLaunchUrl('http://localhost:63447/', 'ariadne', { capacity: 2 });
  assert.equal(url, 'http://localhost:63447/?project=ariadne&capacity=2');
});

test('buildHubGanttUiConfig documents frontend repo and block state', () => {
  const config = buildHubGanttUiConfig({
    hubApiBase: 'http://127.0.0.1:4177',
    ganttBaseUrl: 'http://localhost:63447/',
    hubPort: 4177,
    boardPort: 6421,
  });
  assert.equal(config.frontend.repoUrl, FRONTEND_REPO);
  assert.match(config.frontend.repoUrl, /frontend-angular/);
  assert.equal(config.frontend.blockedInWorkspace, true);
  assert.equal(config.frontend.blockId, 'AGANTT-DEF-01');
  assert.ok(config.endpoints.ganttPlan.path.includes('{slug}'));
});

test('validateGanttPlanForUi accepts scheduler output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-ui-contract-local-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'gt-e-1 - One.md'), '---\nid: GT-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\n---\n');
  const tasks = fs.readdirSync(tasksDir).map((name) => {
    const filePath = path.join(tasksDir, name);
    return { ...parseTask(filePath), file: path.join('tasks', name), source: fs.readFileSync(filePath, 'utf8') };
  });
  const plan = buildProjectGanttFromTasks(tasks, { slug: 'demo', name: 'Demo' }, {
    capacity: 1,
    includeDone: false,
    startDate: '2026-08-04',
  });
  const result = validateGanttPlanForUi(plan);
  assert.equal(result.valid, true, result.errors?.join('; '));
});

test('gantt UI smoke: hub-config, contract, plan JSON, launch URL', { timeout: 25000 }, async () => {
  const { catalogPath } = createGanttUiSandbox();
  const port = await reservePort();
  const ganttUiPort = await reservePort();
  const ganttBaseUrl = `http://127.0.0.1:${ganttUiPort}/`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ARIADNE_HUB_PORT: String(port),
      ARIADNE_BOARD_PORT: String(port),
      ARIADNE_CATALOG_PATH: catalogPath,
      ARIADNE_GANTT_BASE_URL: ganttBaseUrl,
    },
    stdio: 'ignore',
  });

  try {
    await waitForHttp(`http://127.0.0.1:${port}/api/hub-config`);

    const hubConfig = await fetch(`http://127.0.0.1:${port}/api/hub-config`);
    assert.equal(hubConfig.status, 200);
    const hubBody = await hubConfig.json();
    assert.equal(hubBody.ganttBaseUrl, ganttBaseUrl);
    assert.ok(hubBody.hubApiBase.includes(String(port)));
    assert.match(hubBody.ganttLaunchExample, /project=demo-gantt-ui/);
    assert.equal(hubBody.ganttUi.frontend.blockedInWorkspace, true);
    assert.equal(hubBody.ganttUi.contractVersion, '1.0');

    const contract = await fetch(`http://127.0.0.1:${port}/api/gantt-ui-contract`);
    assert.equal(contract.status, 200);
    const contractBody = await contract.json();
    assert.equal(contractBody.frontend.repoUrl, FRONTEND_REPO);

    const planRes = await fetch(`http://127.0.0.1:${port}/api/projects/demo-gantt-ui/gantt?includeDone=0&startDate=2026-08-04`);
    assert.equal(planRes.status, 200);
    const plan = await planRes.json();
    const validation = validateGanttPlanForUi(plan);
    assert.equal(validation.valid, true, validation.errors?.join('; '));
    assert.ok(plan.dependencyEdges.length >= 1);
    assert.ok(Array.isArray(plan.dayMarkers));

    const launchUrl = buildGanttLaunchUrl(hubBody.ganttBaseUrl, 'demo-gantt-ui');
    assert.match(launchUrl, /project=demo-gantt-ui/);

    const uiProbe = await probeGanttUiReachability(ganttBaseUrl, { timeoutMs: 800 });
    assert.equal(uiProbe.reachable, false, 'external UI should not be running in smoke sandbox');
  } finally {
    await stopProcess(child);
  }
});
