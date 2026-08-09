'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  computeSwarmStatus,
  assertRunnable,
  resolveRunTarget,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
  appendHandoff,
  appendEvidence,
} = require('./swarm');
const server = require('./server');

function createSandbox(prefix = 'ariadne-swarm-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const project = { slug: 'fixture', name: 'Fixture', path: root, taskCode: 'FX' };
  return { root, tasksDir, project };
}

function writeTask(tasksDir, spec) {
  const lines = [
    '---',
    `id: ${spec.id}`,
    `title: ${spec.title}`,
    `status: ${spec.status || 'To Do'}`,
    `priority: ${spec.priority || 'Medium'}`,
    `type: ${spec.type || 'feature'}`,
  ];
  if (spec.ordinal != null) lines.push(`ordinal: ${spec.ordinal}`);
  if (spec.dependencies?.length) {
    lines.push('dependencies:');
    for (const dep of spec.dependencies) lines.push(`  - ${dep}`);
  }
  lines.push('---', '');
  const file = path.join(tasksDir, `${String(spec.id).toLowerCase()} - task.md`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return file;
}

function memoryDeps(store) {
  return {
    listTasks: () => store.tasks,
    setStatus: async (_project, taskId, status) => {
      const task = store.tasks.find((item) => item.id.toLowerCase() === String(taskId).toLowerCase());
      if (!task) throw new Error('tarea no encontrada');
      task.status = status;
      task.source = String(task.source || '').replace(/^status:\s*.+$/mi, `status: ${status}`);
      return { ...task };
    },
    writeSource: async (_project, taskId, source) => {
      const task = store.tasks.find((item) => item.id.toLowerCase() === String(taskId).toLowerCase());
      if (!task) throw new Error('tarea no encontrada');
      task.source = source;
      return { ...task };
    },
  };
}

test('computeSwarmStatus exposes next when head deps are Done', () => {
  const tasks = [
    {
      id: 'FX-E-1',
      title: 'Dep',
      status: 'Done',
      ordinal: 10,
      source: '---\nid: FX-E-1\nstatus: Done\n---\n',
    },
    {
      id: 'FX-E-2',
      title: 'Head',
      status: 'Queued',
      ordinal: 10,
      source: '---\nid: FX-E-2\nstatus: Queued\nordinal: 10\ndependencies:\n  - FX-E-1\n---\n',
    },
    {
      id: 'FX-E-3',
      title: 'Later',
      status: 'Queued',
      ordinal: 20,
      source: '---\nid: FX-E-3\nstatus: Queued\nordinal: 20\n---\n',
    },
  ];
  const status = computeSwarmStatus(tasks);
  assert.equal(status.queueLength, 2);
  assert.equal(status.next.id, 'FX-E-2');
  assert.equal(status.readyCount, 2);
  assert.equal(status.blockedHead, null);
});

test('computeSwarmStatus marks blocked head when dep not Done', () => {
  const tasks = [
    {
      id: 'FX-E-1',
      title: 'Dep',
      status: 'To Do',
      ordinal: 5,
      source: '---\nid: FX-E-1\nstatus: To Do\n---\n',
    },
    {
      id: 'FX-E-2',
      title: 'Head',
      status: 'Queued',
      ordinal: 10,
      source: '---\nid: FX-E-2\nstatus: Queued\nordinal: 10\ndependencies:\n  - FX-E-1\n---\n',
    },
  ];
  const status = computeSwarmStatus(tasks);
  assert.equal(status.next, null);
  assert.equal(status.blockedHead.id, 'FX-E-2');
  assert.equal(status.blockedHead.blockers[0].id, 'FX-E-1');
});

test('assertRunnable rejects To Do and unfinished deps', () => {
  const dep = {
    id: 'FX-E-1',
    title: 'Dep',
    status: 'In Progress',
    source: '---\nid: FX-E-1\nstatus: In Progress\n---\n',
  };
  const queued = {
    id: 'FX-E-2',
    title: 'Work',
    status: 'Queued',
    source: '---\nid: FX-E-2\nstatus: Queued\ndependencies:\n  - FX-E-1\n---\n',
  };
  assert.throws(() => assertRunnable({ ...queued, status: 'To Do' }, [dep, queued]), /Queue/);
  assert.throws(() => assertRunnable(queued, [dep, queued]), /pendientes/);
});

test('runSwarmTask moves Queue head to In Progress', async () => {
  const store = {
    tasks: [
      {
        id: 'FX-E-9',
        title: 'CLI',
        status: 'Queued',
        ordinal: 10,
        source: '---\nid: FX-E-9\ntitle: CLI\nstatus: Queued\nordinal: 10\n---\n',
      },
    ],
  };
  const result = await runSwarmTask({}, {}, memoryDeps(store));
  assert.equal(result.action, 'run');
  assert.equal(result.resumed, false);
  assert.equal(result.task.status, 'In Progress');
  assert.equal(store.tasks[0].status, 'In Progress');
});

test('runSwarmTask refuses blocked head', async () => {
  const store = {
    tasks: [
      {
        id: 'FX-E-1',
        title: 'Dep',
        status: 'To Do',
        source: '---\nid: FX-E-1\nstatus: To Do\n---\n',
      },
      {
        id: 'FX-E-2',
        title: 'Head',
        status: 'Queued',
        ordinal: 10,
        source: '---\nid: FX-E-2\nstatus: Queued\nordinal: 10\ndependencies:\n  - FX-E-1\n---\n',
      },
    ],
  };
  await assert.rejects(() => runSwarmTask({}, {}, memoryDeps(store)), /bloqueada|pendientes/);
});

test('handoff and complete append sections then mark Done', async () => {
  const store = {
    tasks: [
      {
        id: 'FX-E-7',
        title: 'Work',
        status: 'In Progress',
        source: '---\nid: FX-E-7\ntitle: Work\nstatus: In Progress\n---\n\n## Description\n\nok\n',
      },
    ],
  };
  const deps = memoryDeps(store);
  await handoffSwarmTask({}, {
    taskId: 'FX-E-7',
    fromRole: 'coder',
    toRole: 'cleaner',
    summary: 'tests green',
    commit: 'abc123',
  }, deps);
  assert.match(store.tasks[0].source, /Swarm handoffs/);
  assert.match(store.tasks[0].source, /coder → cleaner/);

  const done = await completeSwarmTask({}, {
    taskId: 'FX-E-7',
    evidence: 'node --test swarm.test.js ok',
    notes: 'AH-E-31',
  }, deps);
  assert.equal(done.task.status, 'Done');
  assert.match(store.tasks[0].source, /## Evidence/);
  assert.match(store.tasks[0].source, /node --test swarm\.test\.js ok/);
});

test('append helpers require content', () => {
  assert.throws(() => appendHandoff('x', { fromRole: 'a', toRole: 'b', summary: '' }), /handoff/);
  assert.throws(() => appendEvidence('x', { evidence: '' }), /evidence/);
});

test('resolveRunTarget picks explicit id over queue head', () => {
  const tasks = [
    { id: 'FX-E-1', title: 'A', status: 'Queued', ordinal: 10, source: '---\nid: FX-E-1\nstatus: Queued\n---\n' },
    { id: 'FX-E-2', title: 'B', status: 'Queued', ordinal: 20, source: '---\nid: FX-E-2\nstatus: Queued\n---\n' },
  ];
  assert.equal(resolveRunTarget(tasks, 'FX-E-2').id, 'FX-E-2');
  assert.equal(resolveRunTarget(tasks).id, 'FX-E-1');
});

test('createServerDeps run/complete against sandbox project', async () => {
  const { project, tasksDir } = createSandbox('ariadne-swarm-');
  writeTask(tasksDir, { id: 'FX-E-1', title: 'Ready', status: 'Queued', ordinal: 10, type: 'feature' });
  // Sandboxes sin backlog.md: usar fallback de filesystem (mismo path que Hub cuando CLI falla).
  const deps = {
    listTasks: (p) => server.projectTasks(p),
    setStatus: async (p, taskId, status) => server.applyTaskStateFallback(p, taskId, status, false),
    writeSource: async (p, taskId, source) => server.updateTaskSource(p, taskId, source),
  };
  const started = await runSwarmTask(project, {}, deps);
  assert.equal(started.task.status, 'In Progress');

  await handoffSwarmTask(project, {
    taskId: 'FX-E-1',
    fromRole: 'coder',
    toRole: 'qa',
    summary: 'ready for verify',
  }, deps);

  const finished = await completeSwarmTask(project, {
    taskId: 'FX-E-1',
    evidence: 'sandbox npm test',
  }, deps);
  assert.equal(finished.task.status, 'Done');

  const file = fs.readFileSync(path.join(tasksDir, fs.readdirSync(tasksDir)[0]), 'utf8');
  assert.match(file, /Swarm handoffs/);
  assert.match(file, /## Evidence/);
});
