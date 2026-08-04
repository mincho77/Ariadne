'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
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

function initBacklogProject(projectRoot, name) {
  const backlogBin = path.join(__dirname, '..', 'node_modules', '.bin', 'backlog');
  const result = spawnSync(
    backlogBin,
    ['init', name, '--defaults', '--no-git', '--integration-mode', 'none', '--backlog-dir', 'backlog', '--config-location', 'root', '--task-prefix', name.replace(/\s+/g, '').slice(0, 8).toLowerCase()],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `backlog init failed for ${name}`);
  }
}

function seedProject(root, { initName }) {
  fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(path.join(root, 'backlog.config.yml'))) {
    initBacklogProject(root, initName);
  }
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  return tasksDir;
}

function createTwoProjectSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-two-project-'));
  const alphaRoot = path.join(sandbox, 'alpha');
  const betaRoot = path.join(sandbox, 'beta');
  const alphaTasks = seedProject(alphaRoot, { initName: 'Alpha' });
  const betaTasks = seedProject(betaRoot, { initName: 'Beta' });
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'proj-alpha', name: 'Project Alpha', taskCode: 'PA', path: alphaRoot, port: 6611 },
    { slug: 'proj-beta', name: 'Project Beta', taskCode: 'PB', path: betaRoot, port: 6612 },
  ], null, 2)}\n`);
  return { sandbox, catalogPath, alphaRoot, betaRoot, alphaTasks, betaTasks };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function findTaskFile(tasksDir, taskId) {
  const needle = `${String(taskId).toLowerCase()} -`;
  const match = fs.readdirSync(tasksDir).find((name) => name.startsWith(needle));
  assert.ok(match, `task file for ${taskId} in ${tasksDir}`);
  return path.join(tasksDir, match);
}

async function runFullLifecycle(base, slug, tasksDir, taskCode) {
  const create = await postJson(`${base}/api/tasks/create?project=${encodeURIComponent(slug)}`, {
    title: `Lifecycle ${slug}`,
    type: 'task',
    priority: 'High',
  });
  assert.equal(create.response.status, 201, create.payload.error || 'create failed');
  const taskId = create.payload.id;
  assert.match(taskId, new RegExp(`^${taskCode}-E-\\d+$`));

  const queued = await postJson(`${base}/api/tasks/status?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    status: 'Queued',
  });
  assert.equal(queued.response.status, 200, queued.payload.error);
  assert.equal(queued.payload.status, 'Queued');

  const order = await postJson(`${base}/api/tasks/queue-order?project=${encodeURIComponent(slug)}`, {
    order: [taskId],
  });
  assert.equal(order.response.status, 200, order.payload.error);

  const doing = await postJson(`${base}/api/tasks/status?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    status: 'In Progress',
  });
  assert.equal(doing.response.status, 200, doing.payload.error);
  assert.equal(doing.payload.status, 'In Progress');

  const filePath = findTaskFile(tasksDir, taskId);
  const editedSource = `${fs.readFileSync(filePath, 'utf8').trim()}

## Acceptance Criteria

- [ ] #1 Evidencia de prueba ${slug}
`;
  const content = await postJson(`${base}/api/tasks/content?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    source: editedSource,
  });
  assert.equal(content.response.status, 200, content.payload.error);
  assert.match(content.payload.source, /Evidencia de prueba/);

  const blocked = await postJson(`${base}/api/tasks/status?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    status: 'To Do',
  });
  assert.equal(blocked.response.status, 200, blocked.payload.error);

  const blockMeta = await postJson(`${base}/api/tasks/substatus?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    substatus: 'Bloqueado',
    next_action: `Esperar desbloqueo ${slug}`,
  });
  assert.equal(blockMeta.response.status, 200, blockMeta.payload.error);
  assert.equal(blockMeta.payload.substatus, 'Bloqueado');
  assert.match(blockMeta.payload.nextAction, /desbloqueo/);

  const unblock = await postJson(`${base}/api/tasks/substatus?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    substatus: 'Por priorizar',
    next_action: '',
  });
  assert.equal(unblock.response.status, 200, unblock.payload.error);

  const resumeDoing = await postJson(`${base}/api/tasks/status?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    status: 'In Progress',
  });
  assert.equal(resumeDoing.response.status, 200, resumeDoing.payload.error);
  assert.equal(resumeDoing.payload.status, 'In Progress');

  const done = await postJson(`${base}/api/tasks/status?project=${encodeURIComponent(slug)}`, {
    id: taskId,
    status: 'Done',
  });
  assert.equal(done.response.status, 200, done.payload.error);
  assert.equal(done.payload.status, 'Done');

  const onDisk = parseTask(filePath);
  assert.equal(onDisk.status, 'Done');
  assert.match(fs.readFileSync(filePath, 'utf8'), /Evidencia de prueba/);
  assert.match(fs.readFileSync(filePath, 'utf8'), /actual_finish:/);

  return taskId;
}

test('ARLOCAL-010: full task lifecycle on two projects without data loss', { timeout: 45000 }, async () => {
  const { catalogPath, alphaTasks, betaTasks } = createTwoProjectSandbox();
  const hubPort = await reservePort();
  const boardPort = await reservePort();
  const root = path.join(__dirname, '..');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      ARIADNE_HUB_PORT: String(hubPort),
      ARIADNE_BOARD_PORT: String(boardPort),
      ARIADNE_CATALOG_PATH: catalogPath,
    },
    stdio: 'ignore',
  });

  const hubBase = `http://127.0.0.1:${hubPort}`;
  const boardBase = `http://127.0.0.1:${boardPort}`;

  try {
    await waitForHttp(`${hubBase}/api/projects`);
    await waitForHttp(`${boardBase}/?project=proj-alpha`);

    const alphaId = await runFullLifecycle(boardBase, 'proj-alpha', alphaTasks, 'PA');
    const betaId = await runFullLifecycle(boardBase, 'proj-beta', betaTasks, 'PB');

    const projects = await fetch(`${hubBase}/api/projects`);
    assert.equal(projects.status, 200);
    const list = await projects.json();
    assert.equal(list.length, 2);
    const alphaSummary = list.find((row) => row.slug === 'proj-alpha');
    const betaSummary = list.find((row) => row.slug === 'proj-beta');
    assert.ok(alphaSummary);
    assert.ok(betaSummary);
    assert.ok(alphaSummary.tasks >= 1);
    assert.ok(betaSummary.tasks >= 1);

    const portfolio = await fetch(`${hubBase}/api/gantt/portfolio?includeDone=1&startDate=2026-08-04`);
    assert.equal(portfolio.status, 200);
    const portfolioBody = await portfolio.json();
    assert.equal(portfolioBody.summary.projectCount, 2);

    assert.notEqual(alphaId, betaId);
    assert.match(alphaId, /^PA-E-/);
    assert.match(betaId, /^PB-E-/);

    assert.ok(fs.existsSync(findTaskFile(alphaTasks, alphaId)));
    assert.ok(fs.existsSync(findTaskFile(betaTasks, betaId)));
  } finally {
    await stopProcess(child);
  }
});

test('ARLOCAL-010: ariadne audit passes on two-project catalog', () => {
  const { catalogPath } = createTwoProjectSandbox();
  const root = path.join(__dirname, '..');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'gantt-backlog-audit.js'), '--all', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ARIADNE_CATALOG_PATH: catalogPath },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout || '{}');
  assert.equal(body.totalIssues, 0);
});
