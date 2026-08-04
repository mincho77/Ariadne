const test = require('node:test'); const assert = require('node:assert/strict'); const { once } = require('node:events'); const { spawn } = require('node:child_process'); const { slugify, parseTask, sortTasksByPriority, sortQueuedTasks, nextQueuedTask, pickNextImprovement, pickNextBug, summarize, taskDetail, taskDetailHtml, queueBoardPage, validateTaskSource, updateTaskSource, updateTaskDependencies, projectTasks, buildProjectGantt, patchProjectTask, applyKanbanTemporalSync, applyTaskStateFallback, updateTaskStatus, computeSourceHash, evaluateDependencyGate, updateTaskChecklist } = require('./server'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');

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
      // Server is still booting.
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

function createDependencyHttpSandbox(prefix = 'ariadne-http-deps-') {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'jm-e-1 - Base.md'), '---\nid: JM-E-1\ntitle: Base\nstatus: To Do\npriority: Medium\ntype: feature\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'jm-e-2 - Child.md'), '---\nid: JM-E-2\ntitle: Child\nstatus: To Do\npriority: Medium\ntype: feature\ndependencies:\n  - JM-E-1\n---\n');
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    {
      slug: 'demo-http',
      name: 'Demo HTTP',
      path: projectRoot,
      port: 6521,
    },
  ], null, 2)}\n`);
  return { sandbox, projectRoot, tasksDir, catalogPath };
}

function createAiCapacityHttpSandbox(prefix = 'ariadne-http-ai-capacity-') {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'jm-e-1 - One.md'), '---\nid: JM-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'jm-e-2 - Two.md'), '---\nid: JM-E-2\ntitle: Two\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\n---\n');
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    {
      slug: 'demo-http',
      name: 'Demo HTTP',
      path: projectRoot,
      port: 6521,
    },
  ], null, 2)}\n`);
  return { sandbox, projectRoot, tasksDir, catalogPath };
}

function createPatchHttpSandbox(prefix = 'ariadne-http-patch-') {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - Demo.md'), '---\nid: AH-E-1\ntitle: Demo\nstatus: To Do\npriority: Medium\ntype: task\nupdated_date: \'2026-08-04 10:00\'\n---\n\n## Description\n\nHola\n');
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    {
      slug: 'demo-http',
      name: 'Demo HTTP',
      path: projectRoot,
      port: 6521,
    },
  ], null, 2)}\n`);
  return { sandbox, projectRoot, tasksDir, catalogPath };
}

function createBaselineHttpSandbox(prefix = 'ariadne-http-baseline-') {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - One.md'), '---\nid: AH-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: task\nestimate_days: 2\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'ah-e-2 - Two.md'), '---\nid: AH-E-2\ntitle: Two\nstatus: To Do\npriority: Medium\ntype: task\nestimate_days: 2\n---\n');
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    {
      slug: 'demo-http',
      name: 'Demo HTTP',
      path: projectRoot,
      port: 6521,
    },
  ], null, 2)}\n`);
  return { sandbox, projectRoot, tasksDir, catalogPath };
}

async function startHttpServerForTest(catalogPath) {
  const port = await reservePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      ARIADNE_HUB_PORT: String(port),
      ARIADNE_BOARD_PORT: String(port),
      ARIADNE_CATALOG_PATH: catalogPath,
    },
    stdio: 'ignore',
  });
  await waitForHttp(`http://127.0.0.1:${port}/api/projects`);
  return { port, child };
}
test('slugify produces stable local ids', () => assert.equal(slugify('JurisMate IA / Tokens'), 'jurismate-ia-tokens'));
test('parseTask reads Backlog id, status and metadata', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-task-')); const file = path.join(dir, 'ARIADNE-1 - Demo.md'); fs.writeFileSync(file, '---\nid: ARIADNE-1\nstatus: In Progress\npriority: Ultra High\ntype: bug\nordinal: 1000\n---\n'); assert.deepEqual(parseTask(file), { id: 'ARIADNE-1', title: 'Demo', status: 'In Progress', priority: 'Ultra High', type: 'bug', ordinal: 1000, labels: [], createdDate: '', substatus: '', nextAction: '', effectiveSubstatus: 'En Curso' }); });
test('parseTask unfolds YAML multiline titles', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-task-')); const file = path.join(dir, 'JM-19 - Pretensiones.md'); fs.writeFileSync(file, '---\nid: JM-19\ntitle: >-\n  BUG producción · Justo no resuelve extracción\n  de pretensiones\nstatus: To Do\n---\n'); assert.equal(parseTask(file).title, 'BUG producción · Justo no resuelve extracción de pretensiones'); });
test('sortTasksByPriority puts production incidents first', () => { const tasks = [{ title: 'normal', priority: 'Medium' }, { title: 'prod', priority: 'Ultra High' }, { title: 'high', priority: 'High' }]; assert.deepEqual(sortTasksByPriority(tasks).map((task) => task.title), ['prod', 'high', 'normal']); });
test('nextQueuedTask chooses lowest ordinal in queue', () => { const tasks = [{ title: 'later', status: 'Queued', priority: 'High', ordinal: 30 }, { title: 'first', status: 'Queued', priority: 'Medium', ordinal: 10 }, { title: 'todo', status: 'To Do', priority: 'Ultra High', ordinal: 1 }]; assert.equal(nextQueuedTask(tasks).title, 'first'); });
test('pickNextImprovement ignores bugs and picks active improvement work', () => {
  const tasks = [
    { id: 'JM-2', title: 'Feature alta', status: 'In Progress', priority: 'Ultra High', type: 'feature' },
    { id: 'JM-1', title: 'BUG upload', status: 'To Do', priority: 'Medium', type: 'bug' },
    { id: 'JM-3', title: 'Otra mejora', status: 'To Do', priority: 'Low', type: 'task' },
  ];
  const next = pickNextImprovement(tasks);
  assert.equal(next.id, 'JM-2');
  assert.equal(pickNextImprovement(tasks.filter((task) => task.type === 'bug')), null);
});
test('summarize exposes split bug and improvement lanes for the hub', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-summarize-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Bug.md'), '---\nid: JM-1\ntitle: BUG upload\nstatus: In Progress\npriority: Ultra High\ntype: bug\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-2 - Feature.md'), '---\nid: JM-2\ntitle: Feature normal\nstatus: To Do\npriority: Low\ntype: feature\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-3 - Done.md'), '---\nid: JM-3\ntitle: Mejora hecha\nstatus: Done\npriority: Low\ntype: task\n---\n');
  const summary = summarize({ name: 'Demo', slug: 'demo', path: root, port: 6421 });
  assert.equal(summary.tasks, 2);
  assert.equal(summary.improvementsOpen, 1);
  assert.equal(summary.bugsOpen, 1);
  assert.equal(summary.focus, 'bugs');
  assert.match(summary.nextBug, /BUG upload/);
  assert.match(summary.next, /JM-2/);
});
test('sortQueuedTasks ignores priority and keeps manual order', () => { const tasks = [{ title: 'b', status: 'Queued', priority: 'Low', ordinal: 20 }, { title: 'a', status: 'Queued', priority: 'Ultra High', ordinal: 10 }]; assert.deepEqual(sortQueuedTasks(tasks).map((task) => task.title), ['a', 'b']); });
test('taskDetail hides frontmatter from the task modal', () => { const detail = taskDetail('---\ntitle: Demo\npriority: Ultra High\n---\n\n## Description\n\nTexto útil'); assert.equal(detail, 'Description\n\nTexto útil'); });
test('taskDetailHtml renders readable sections and checklists safely', () => { const html = taskDetailHtml('---\ntitle: Demo\n---\n\n## Description\n\nTexto **útil**\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [x] #1 Listo\n- [ ] #2 <script>alert(1)</script>\n<!-- AC:END -->'); assert.match(html, /<section class="detail-section">/); assert.match(html, /Description/); assert.match(html, /check-toggle/); assert.match(html, /check-item checked/); assert.doesNotMatch(html, /<script>/); assert.doesNotMatch(html, /AC:BEGIN|title: Demo/); });
test('queue board exposes ordered queue and drag targets for every status', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-board-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Primero.md'), '---\nid: JM-1\ntitle: Primero\nstatus: Queued\npriority: Ultra High\ntype: bug\nordinal: 1\n---\n\n## Description\n\nPrimero');
  fs.writeFileSync(path.join(dir, 'jm-2 - Segundo.md'), '---\nid: JM-2\ntitle: Segundo\nstatus: Queued\npriority: High\ntype: task\nordinal: 2\n---\n');
  const html = queueBoardPage({ name: 'Demo', slug: 'demo', path: root });
  assert.match(html, /class="column queue-column" data-column="Queued"/);
  assert.match(html, /class="queue-position"[^>]*><small>Turno<\/small>1/);
  assert.match(html, /draggable="true"/);
  for (const status of ['To Do', 'Queued', 'In Progress', 'Done']) assert.match(html, new RegExp(`data-column="${status}"`));
  assert.match(html, /addEventListener\('drop'/);
});
test('queue board search really hides cards and updates column state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-board-search-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Cache.md'), '---\nid: JM-1\ntitle: Cache\nstatus: To Do\npriority: Ultra High\ntype: bug\nordinal: 1\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-2 - Racha.md'), '---\nid: JM-2\ntitle: Racha\nstatus: Done\npriority: High\ntype: bug\nordinal: 2\n---\n');
  const html = queueBoardPage({ name: 'Demo', slug: 'demo', path: root });
  assert.match(html, /\.task\[hidden\]\{display:none!important\}/);
  assert.match(html, /card\.classList\.toggle\('search-match'/);
  assert.match(html, /countEl\.textContent=count/);
  assert.match(html, /column\.classList\.toggle\('search-no-results'/);
  assert.match(html, /<p class="search-empty">Sin coincidencias en esta columna\.<\/p>/);
});
test('validateTaskSource requires frontmatter and stable id', () => {
  assert.throws(() => validateTaskSource('JM-1', 'sin frontmatter'), /frontmatter/);
  assert.throws(() => validateTaskSource('JM-1', '---\nid: JM-2\n---\n'), /no cambies el id/);
  assert.doesNotThrow(() => validateTaskSource('JM-1', '---\nid: JM-1\n---\n\n## Description\n\nTexto'));
});
test('updateTaskSource writes markdown back to backlog file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-edit-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'jm-1 - Demo.md');
  const original = '---\nid: JM-1\ntitle: Demo\nstatus: To Do\nupdated_date: \'2026-07-28 00:00\'\n---\n\n## Description\n\nAntes';
  fs.writeFileSync(file, original);
  const project = { path: root };
  const updated = updateTaskSource(project, 'JM-1', '---\nid: JM-1\ntitle: Demo editado\nstatus: To Do\nupdated_date: \'2026-07-28 00:00\'\n---\n\n## Description\n\nDespués');
  assert.match(updated.title, /editado/);
  const saved = fs.readFileSync(file, 'utf8');
  assert.match(saved, /Después/);
  assert.match(saved, /updated_date: '\d{4}-\d{2}-\d{2}/);
  assert.equal(projectTasks(project).length, 1);
});
test('queue board exposes task text editor controls', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-board-edit-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Cache.md'), '---\nid: JM-1\ntitle: Cache\nstatus: To Do\npriority: Ultra High\ntype: bug\nordinal: 1\n---\n');
  const html = queueBoardPage({ name: 'Demo', slug: 'demo', path: root });
  assert.match(html, /id="edit-task"/);
  assert.match(html, /id="source-editor"/);
  assert.match(html, /\/api\/tasks\/content/);
  assert.match(html, /\/api\/tasks\/queue-order/);
  assert.match(html, /buildQueueOrder/);
  assert.match(html, /Arrastra dentro de la cola para cambiar el turno/);
});
test('queue board exposes substatus controls', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-board-substatus-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-e-21 - E2E.md'), '---\nid: JM-E-21\ntitle: VALIDACIÓN E2E\nstatus: In Progress\nsubstatus: "Pendiente Resultado Prueba"\nnext_action: "El abogado valida en EXT-8522026339404"\ntype: task\npriority: High\n---\n');
  const html = queueBoardPage({ name: 'Demo', slug: 'demo', path: root });
  assert.match(html, /Pendiente Resultado Prueba/);
  assert.match(html, /El abogado valida en EXT-8522026339404/);
  assert.match(html, /\/api\/tasks\/substatus/);
  assert.match(html, /id="substatus-panel"/);
});
test('queue board stretches columns for full-height drag targets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-board-height-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Cache.md'), '---\nid: JM-1\ntitle: Cache\nstatus: To Do\npriority: Ultra High\ntype: bug\nordinal: 1\n---\n');
  const html = queueBoardPage({ name: 'Demo', slug: 'demo', path: root });
  assert.match(html, /align-items:stretch/);
  assert.match(html, /\.column\{display:flex;flex-direction:column/);
  assert.match(html, /\.task-list\{flex:1 1 auto;display:flex;flex-direction:column/);
});

test('createTask allocates typed bug and enhancement ids', () => {
  const { createTask } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-create-task-'));
  fs.mkdirSync(path.join(root, 'backlog', 'tasks'), { recursive: true });
  const project = { slug: 'jurismate', name: 'JurisMate', taskCode: 'JM', path: root };
  const bug = createTask(project, { title: 'BUG producción · Upload', type: 'bug', priority: 'Ultra High' });
  const enhancement = createTask(project, { title: 'Mejora ranking', type: 'feature', priority: 'High' });
  assert.equal(bug.id, 'JM-B-1');
  assert.equal(enhancement.id, 'JM-E-1');
});

test('buildProjectGantt schedules dependencies before dependents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-gantt-deps-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-e-1 - Base.md'), '---\nid: JM-E-1\ntitle: Base\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\ndependencies: []\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-2 - API.md'), '---\nid: JM-E-2\ntitle: API\nstatus: To Do\npriority: High\ntype: feature\nestimate_days: 3\ndependencies:\n  - JM-E-1\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-3 - UI.md'), '---\nid: JM-E-3\ntitle: UI\nstatus: To Do\npriority: High\ntype: feature\nestimate_days: 2\ndependencies:\n  - JM-E-2\n---\n');
  const plan = buildProjectGantt({ slug: 'demo', name: 'Demo', path: root }, { capacity: 2 });
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  assert.ok(byId.get('JM-E-1').startDay <= byId.get('JM-E-2').startDay);
  assert.ok(byId.get('JM-E-2').startDay <= byId.get('JM-E-3').startDay);
  assert.equal(plan.summary.pendingTasks, 3);
  assert.ok(plan.criticalPath.route.length >= 2);
  assert.ok(plan.criticalPath.estimatedIaHours >= 1);
  assert.ok(plan.dependencyEdges.length >= 2);
});

test('buildProjectGantt uses capacity to unlock parallel work', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-gantt-cap-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-e-1 - A.md'), '---\nid: JM-E-1\ntitle: A\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\ndependencies: []\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-2 - B.md'), '---\nid: JM-E-2\ntitle: B\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\ndependencies: []\n---\n');
  const serial = buildProjectGantt({ slug: 'demo', name: 'Demo', path: root }, { capacity: 1 });
  const parallel = buildProjectGantt({ slug: 'demo', name: 'Demo', path: root }, { capacity: 2 });
  assert.ok(serial.summary.estimatedPendingDays > parallel.summary.estimatedPendingDays);
  assert.ok(parallel.parallelGroups.length >= 1);
});

test('buildProjectGantt enforces FS/SS/FF/SF constraints with lag', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-gantt-rel-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-e-1 - Base.md'), '---\nid: JM-E-1\ntitle: Base\nstatus: To Do\npriority: High\ntype: feature\nestimate_days: 2\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-2 - SS.md'), '---\nid: JM-E-2\ntitle: SS\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\ndependencies:\n  - JM-E-1:SS+1d\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-3 - FS.md'), '---\nid: JM-E-3\ntitle: FS\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\ndependencies:\n  - JM-E-1:FS\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-4 - FF.md'), '---\nid: JM-E-4\ntitle: FF\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\ndependencies:\n  - JM-E-1:FF+1d\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-5 - SF.md'), '---\nid: JM-E-5\ntitle: SF\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\ndependencies:\n  - JM-E-1:SF+1d\n---\n');

  const plan = buildProjectGantt({ slug: 'demo', name: 'Demo', path: root }, { capacity: 5, iaHoursPerDay: 8 });
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  const base = byId.get('JM-E-1');
  const ss = byId.get('JM-E-2');
  const fsTask = byId.get('JM-E-3');
  const ff = byId.get('JM-E-4');
  const sf = byId.get('JM-E-5');

  assert.ok(ss.startIaHour >= base.startIaHour + 8);
  assert.ok(fsTask.startIaHour >= base.endIaHour);
  assert.ok(ff.endIaHour >= base.endIaHour + 8);
  assert.ok(sf.endIaHour >= base.startIaHour + 8);

  const ffEdge = plan.dependencyEdges.find((edge) => edge.fromId === 'JM-E-1' && edge.toId === 'JM-E-4');
  const sfEdge = plan.dependencyEdges.find((edge) => edge.fromId === 'JM-E-1' && edge.toId === 'JM-E-5');
  assert.equal(ffEdge?.relation, 'FF');
  assert.equal(ffEdge?.lagIaHours, 8);
  assert.equal(sfEdge?.relation, 'SF');
  assert.equal(sfEdge?.toAnchor, 'end');
});

test('updateTaskDependencies persists typed relation tokens in frontmatter', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-deps-edit-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-e-1 - Base.md'), '---\nid: JM-E-1\ntitle: Base\nstatus: To Do\npriority: Medium\ntype: feature\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-e-2 - Child.md'), '---\nid: JM-E-2\ntitle: Child\nstatus: To Do\npriority: Medium\ntype: feature\ndependencies:\n  - JM-E-1\n---\n');

  const project = { slug: 'demo', name: 'Demo', path: root };
  const updated = updateTaskDependencies(project, 'JM-E-2', [
    { id: 'JM-E-1', relation: 'FF', lagValue: 1, lagUnit: 'd' },
  ]);

  assert.deepEqual(updated.dependencies, ['JM-E-1']);
  assert.equal(updated.dependencyLinks?.[0]?.relation, 'FF');
  assert.equal(updated.dependencyLinks?.[0]?.lagIaHours, 8);

  const source = fs.readFileSync(path.join(dir, 'jm-e-2 - Child.md'), 'utf8');
  assert.match(source, /dependencies:[\s\S]*JM-E-1:FF\+1d/);
});

test('dependencies endpoint persists typed tokens over HTTP', { timeout: 20000 }, async () => {
  const { tasksDir, catalogPath } = createDependencyHttpSandbox('ariadne-http-deps-ok-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-2',
        dependencies: [
          { id: 'JM-E-1', relation: 'SS', lagValue: 2, lagUnit: 'h' },
        ],
      }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.id, 'JM-E-2');
    assert.equal(payload.dependencyLinks?.[0]?.relation, 'SS');
    assert.equal(payload.dependencyLinks?.[0]?.lagIaHours, 2);

    const source = fs.readFileSync(path.join(tasksDir, 'jm-e-2 - Child.md'), 'utf8');
    assert.match(source, /dependencies:[\s\S]*JM-E-1:SS\+2h/);
  } finally {
    await stopProcess(child);
  }
});

test('dependencies endpoint rejects missing id over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath } = createDependencyHttpSandbox('ariadne-http-deps-missing-id-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dependencies: [{ id: 'JM-E-1', relation: 'FS' }] }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload.error || ''), /id is required/i);
  } finally {
    await stopProcess(child);
  }
});

test('dependencies endpoint rejects self dependency over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath, tasksDir } = createDependencyHttpSandbox('ariadne-http-deps-self-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-2',
        dependencies: [{ id: 'JM-E-2', relation: 'FS' }],
      }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload.error || ''), /depender de s[ií]/i);

    const source = fs.readFileSync(path.join(tasksDir, 'jm-e-2 - Child.md'), 'utf8');
    assert.match(source, /dependencies:\n\s+- JM-E-1/);
    assert.doesNotMatch(source, /JM-E-2:FS/);
  } finally {
    await stopProcess(child);
  }
});

test('dependencies endpoint rejects invalid relation and malformed lag over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath } = createDependencyHttpSandbox('ariadne-http-deps-invalid-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const invalidRelation = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-2',
        dependencies: [{ id: 'JM-E-1', relation: 'XS' }],
      }),
    });
    assert.equal(invalidRelation.status, 400);
    const relationPayload = await invalidRelation.json();
    assert.match(String(relationPayload.error || ''), /relaci[oó]n inv[aá]lida/i);

    const malformedLag = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-2',
        dependencies: ['JM-E-1:FS+2x'],
      }),
    });
    assert.equal(malformedLag.status, 400);
    const lagPayload = await malformedLag.json();
    assert.match(String(lagPayload.error || ''), /dependencia inv[aá]lida/i);
  } finally {
    await stopProcess(child);
  }
});

test('dependencies endpoint returns 404 for unknown project over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath } = createDependencyHttpSandbox('ariadne-http-deps-missing-project-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/no-existe/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-2',
        dependencies: [{ id: 'JM-E-1', relation: 'FS' }],
      }),
    });
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.match(String(payload.error || ''), /project not found/i);
  } finally {
    await stopProcess(child);
  }
});

test('dependencies endpoint returns 400 for unknown task over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath } = createDependencyHttpSandbox('ariadne-http-deps-missing-task-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'JM-E-999',
        dependencies: [{ id: 'JM-E-1', relation: 'FS' }],
      }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload.error || ''), /tarea no encontrada/i);
  } finally {
    await stopProcess(child);
  }
});

test('ai-capacity-config endpoint persists model and operator configuration over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath, projectRoot } = createAiCapacityHttpSandbox('ariadne-http-ai-config-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const payload = {
      capacity: 4,
      aiModels: [
        {
          key: 'gpt',
          name: 'GPT-5.3-Codex',
          initials: 'GPT',
          maxParallel: 2,
          requiresOperator: true,
          operatorId: 'op-1',
          operatorName: 'AI Operator 1',
          enabled: true,
        },
      ],
      operators: [
        { id: 'op-1', name: 'AI Operator 1', active: true, maxParallel: 2, hoursPerDay: 8 },
      ],
    };

    const post = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/ai-capacity-config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(post.status, 200);
    const postBody = await post.json();
    assert.equal(postBody.config.capacity, 4);
    assert.equal(postBody.config.aiModels?.[0]?.key, 'gpt');
    assert.equal(postBody.config.operators?.[0]?.id, 'op-1');

    const get = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/ai-capacity-config`);
    assert.equal(get.status, 200);
    const getBody = await get.json();
    assert.equal(getBody.config.capacity, 4);
    assert.equal(getBody.config.aiModels?.[0]?.requiresOperator, true);
    assert.equal(getBody.config.aiModels?.[0]?.operatorId, 'op-1');

    const configPath = path.join(projectRoot, 'backlog', 'docs', 'ai-capacity.config.json');
    assert.equal(fs.existsSync(configPath), true);
  } finally {
    await stopProcess(child);
  }
});

test('gantt uses effective capacity from saved ai-capacity config when capacity is omitted', { timeout: 20000 }, async () => {
  const { catalogPath } = createAiCapacityHttpSandbox('ariadne-http-ai-effective-capacity-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const base = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt?includeDone=0&iaHoursPerDay=8&startDate=2026-07-31`);
    assert.equal(base.status, 200);
    const baseBody = await base.json();
    const beforeDays = Number(baseBody?.summary?.estimatedPendingDays || 0);

    const save = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/ai-capacity-config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        capacity: 6,
        aiModels: [
          {
            key: 'cheap',
            name: 'Cheap Model',
            initials: 'CHP',
            maxParallel: 1,
            requiresOperator: false,
            enabled: true,
          },
        ],
        operators: [],
      }),
    });
    assert.equal(save.status, 200);

    const after = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt?includeDone=0&iaHoursPerDay=8&startDate=2026-07-31`);
    assert.equal(after.status, 200);
    const afterBody = await after.json();
    const afterDays = Number(afterBody?.summary?.estimatedPendingDays || 0);

    assert.ok(afterDays > beforeDays);
    assert.equal(beforeDays, 2);
    assert.equal(afterDays, 4);
  } finally {
    await stopProcess(child);
  }
});

test('patchProjectTask updates temporal fields and preserves markdown body', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-patch-local-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  fs.writeFileSync(file, '---\nid: AH-E-1\ntitle: Demo\nstatus: To Do\npriority: Medium\ntype: task\n---\n\n## Description\n\nCuerpo\n');
  const project = { slug: 'demo', name: 'Demo', path: root };

  const updated = patchProjectTask(project, 'AH-E-1', {
    patch: { actual_start: '2026-08-04', progress: 40 },
  });

  assert.equal(updated.changes.includes('actual_start'), true);
  assert.equal(updated.changes.includes('progress'), true);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /actual_start: '2026-08-04'/);
  assert.match(source, /progress: 40/);
  assert.match(source, /## Description/);
  assert.match(source, /Cuerpo/);
});

test('patchProjectTask rejects hash conflict', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-patch-conflict-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  const original = '---\nid: AH-E-1\ntitle: Demo\nstatus: To Do\npriority: Medium\ntype: task\n---\n';
  fs.writeFileSync(file, original);
  const project = { slug: 'demo', name: 'Demo', path: root };

  assert.throws(
    () => patchProjectTask(project, 'AH-E-1', {
      patch: { progress: 10 },
      expectedHash: 'deadbeefdeadbeef',
    }),
    /conflicto de edición/i,
  );
});

test('applyKanbanTemporalSync records actual dates without destroying history on reopen', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-kanban-sync-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  fs.writeFileSync(file, '---\nid: AH-E-1\ntitle: Demo\nstatus: To Do\npriority: Medium\ntype: task\n---\n');
  const project = { slug: 'demo', name: 'Demo', path: root };

  applyKanbanTemporalSync(project, 'AH-E-1', 'To Do', 'In Progress');
  let source = fs.readFileSync(file, 'utf8');
  assert.match(source, /actual_start: '\d{4}-\d{2}-\d{2}'/);

  applyTaskStateFallback(project, 'AH-E-1', 'Done', false);
  applyKanbanTemporalSync(project, 'AH-E-1', 'In Progress', 'Done');
  source = fs.readFileSync(file, 'utf8');
  assert.match(source, /actual_finish: '\d{4}-\d{2}-\d{2}'/);
  assert.match(source, /progress: 100/);

  applyTaskStateFallback(project, 'AH-E-1', 'In Progress', false);
  applyKanbanTemporalSync(project, 'AH-E-1', 'Done', 'In Progress');
  source = fs.readFileSync(file, 'utf8');
  const startMatches = source.match(/actual_start: '([^']+)'/g) || [];
  const finishMatches = source.match(/actual_finish: '([^']+)'/g) || [];
  assert.equal(startMatches.length, 1);
  assert.equal(finishMatches.length, 1);
});

test('PATCH task endpoint updates fields over HTTP', { timeout: 20000 }, async () => {
  const { tasksDir, catalogPath } = createPatchHttpSandbox('ariadne-http-patch-ok-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const source = fs.readFileSync(path.join(tasksDir, 'ah-e-1 - Demo.md'), 'utf8');
    const hash = computeSourceHash(source);
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/AH-E-1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': hash },
      body: JSON.stringify({ actual_start: '2026-08-04', progress: 55 }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.id, 'AH-E-1');
    assert.equal(payload.changes.includes('actual_start'), true);
    assert.match(payload.sourceHash, /^[a-f0-9]{16}$/);

    const updated = fs.readFileSync(path.join(tasksDir, 'ah-e-1 - Demo.md'), 'utf8');
    assert.match(updated, /actual_start: '2026-08-04'/);
    assert.match(updated, /progress: 55/);
    assert.match(updated, /## Description/);
  } finally {
    await stopProcess(child);
  }
});

test('PATCH task endpoint returns 409 on stale hash', { timeout: 20000 }, async () => {
  const { catalogPath } = createPatchHttpSandbox('ariadne-http-patch-stale-');
  const { port, child } = await startHttpServerForTest(catalogPath);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/tasks/AH-E-1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '0000000000000000' },
      body: JSON.stringify({ progress: 10 }),
    });
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.match(String(payload.error || ''), /conflicto de edición/i);
  } finally {
    await stopProcess(child);
  }
});

test('updateTaskStatus blocks In Progress when FS predecessor is open', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-dep-gate-status-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gt-e-1 - Base.md'), '---\nid: GT-E-1\ntitle: Base\nstatus: To Do\npriority: Medium\ntype: feature\n---\n');
  fs.writeFileSync(path.join(dir, 'gt-e-2 - Child.md'), '---\nid: GT-E-2\ntitle: Child\nstatus: To Do\npriority: Medium\ntype: feature\ndependencies:\n  - GT-E-1:FS\n---\n');
  const project = { slug: 'demo', name: 'Demo', path: root };

  await assert.rejects(
    async () => updateTaskStatus(project, 'GT-E-2', 'In Progress'),
    /Dependencia FS pendiente/i,
  );

  applyTaskStateFallback(project, 'GT-E-1', 'Done', false);
  const gate = evaluateDependencyGate(
    projectTasks(project).find((task) => task.id === 'GT-E-2'),
    projectTasks(project),
    { policy: 'strict' },
  );
  assert.equal(gate.blocked, false);
});

test('evaluateDependencyGate is exposed from server helpers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-dep-gate-helper-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gt-e-1 - Base.md'), '---\nid: GT-E-1\ntitle: Base\nstatus: To Do\npriority: Medium\ntype: feature\n---\n');
  fs.writeFileSync(path.join(dir, 'gt-e-2 - Child.md'), '---\nid: GT-E-2\ntitle: Child\nstatus: To Do\npriority: Medium\ntype: feature\ndependencies:\n  - GT-E-1\n---\n');
  const project = { slug: 'demo', name: 'Demo', path: root };
  const tasks = projectTasks(project);
  const gate = evaluateDependencyGate(tasks[1], tasks, { policy: 'strict' });
  assert.equal(gate.blocked, true);
});

test('baseline API create, list, read and compare over HTTP', { timeout: 20000 }, async () => {
  const { catalogPath } = createBaselineHttpSandbox('ariadne-http-baseline-crud-');
  const { port, child } = await startHttpServerForTest(catalogPath);
  const ganttQuery = 'includeDone=0&iaHoursPerDay=8&startDate=2026-08-04&capacity=1';
  const baselineId = 'bl-20260804-http-test-deadbeef';

  try {
    const create = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/baselines?${ganttQuery}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP baseline', author: 'test-runner', id: baselineId }),
    });
    assert.equal(create.status, 201);
    const created = await create.json();
    assert.equal(created.baseline.id, baselineId);
    assert.equal(created.baseline.name, 'HTTP baseline');
    assert.equal(created.baseline.author, 'test-runner');
    assert.ok(created.baseline.tasks.length >= 2);

    const list = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/baselines`);
    assert.equal(list.status, 200);
    const listBody = await list.json();
    assert.ok(listBody.baselines.some((row) => row.id === baselineId));

    const one = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/baselines/${baselineId}`);
    assert.equal(one.status, 200);
    const oneBody = await one.json();
    assert.equal(oneBody.baseline.id, baselineId);

    const compare = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/baselines/${baselineId}/compare?${ganttQuery}`);
    assert.equal(compare.status, 200);
    const compareBody = await compare.json();
    assert.equal(compareBody.baselineId, baselineId);
    assert.ok(Array.isArray(compareBody.tasks));
    assert.equal(compareBody.summary.unchangedTasks, compareBody.tasks.filter((row) => row.change === 'unchanged').length);

    const duplicate = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/baselines?${ganttQuery}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate', author: 'test-runner', id: baselineId }),
    });
    assert.equal(duplicate.status, 409);
    const duplicateBody = await duplicate.json();
    assert.match(String(duplicateBody.error || ''), /inmutable|ya existe/i);
  } finally {
    await stopProcess(child);
  }
});

test('what-if API simulates without persisting and requires ADOPT token to adopt', { timeout: 20000 }, async () => {
  const { catalogPath } = createBaselineHttpSandbox('ariadne-http-whatif-');
  const { port, child } = await startHttpServerForTest(catalogPath);
  const query = 'includeDone=0&iaHoursPerDay=8&startDate=2026-08-04&capacity=1';
  try {
    const sim = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/what-if?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Cap 2', overrides: { capacity: 2 } }),
    });
    assert.equal(sim.status, 200);
    const body = await sim.json();
    assert.equal(body.persisted, false);
    assert.ok(body.comparison?.tasks);
    assert.ok(body.metrics?.current);

    const rejectAdopt = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/what-if?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmAdopt: true,
        taskPatches: [{ id: 'AH-E-1', estimate_days: 3 }],
      }),
    });
    assert.equal(rejectAdopt.status, 400);

    const adopt = await fetch(`http://127.0.0.1:${port}/api/projects/demo-http/gantt/what-if?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmAdopt: true,
        confirmToken: 'ADOPT',
        taskPatches: [{ id: 'AH-E-1', estimate_days: 3 }],
      }),
    });
    assert.equal(adopt.status, 200);
    const adopted = await adopt.json();
    assert.equal(adopted.persisted, true);
    assert.ok(adopted.adopted?.some((row) => row.id === 'AH-E-1'));
  } finally {
    await stopProcess(child);
  }
});

test('updateTaskChecklist suggests progress without overwriting remaining or progress by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-checklist-suggest-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  fs.writeFileSync(file, `---
id: AH-E-1
title: Demo
status: In Progress
priority: Medium
type: task
progress: 25
remaining_ia_hours: 6
---

## Acceptance Criteria
- [ ] #1 Uno
- [x] #2 Dos
`);
  const project = { slug: 'demo', name: 'Demo', path: root };

  const result = updateTaskChecklist(project, 'AH-E-1', 0, true);
  assert.equal(result.suggestedProgress, 100);
  assert.equal(result.progressApplied, false);
  assert.equal(result.remainingPreserved, true);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /progress: 25/);
  assert.match(source, /remaining_ia_hours: 6/);
});

test('updateTaskChecklist can apply suggested progress when authorized', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-checklist-apply-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  fs.writeFileSync(file, `---
id: AH-E-1
title: Demo
status: In Progress
priority: Medium
type: task
remaining_ia_hours: 6
---

## Acceptance Criteria
- [x] #1 Uno
- [x] #2 Dos
`);
  const project = { slug: 'demo', name: 'Demo', path: root };

  const result = updateTaskChecklist(project, 'AH-E-1', 1, true, { applySuggestedProgress: true });
  assert.equal(result.suggestedProgress, 100);
  assert.equal(result.progressApplied, true);
  assert.equal(result.remainingPreserved, true);
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /progress: 100/);
  assert.match(source, /remaining_ia_hours: 6/);
});

test('patchProjectTask allows progress edits on In Progress tasks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-progress-doing-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ah-e-1 - Demo.md');
  fs.writeFileSync(file, '---\nid: AH-E-1\ntitle: Demo\nstatus: In Progress\npriority: Medium\ntype: task\nestimate_ia_hours: 10\n---\n');
  const project = { slug: 'demo', name: 'Demo', path: root };

  patchProjectTask(project, 'AH-E-1', { patch: { progress: 60, remaining_ia_hours: 4 } });
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /progress: 60/);
  assert.match(source, /remaining_ia_hours: 4/);
  const plan = buildProjectGantt(project, { capacity: 1, includeDone: false, startDate: '2026-08-04' });
  const task = plan.tasks.find((item) => item.id === 'AH-E-1');
  assert.equal(task.durationIaHours, 4);
  assert.equal(task.progress, 60);
});
