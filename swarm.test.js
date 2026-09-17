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

const { listPacks, getPack, suggestPack, buildTaskBrief } = require('./swarm');

test('listPacks exposes two four six with roles', () => {
  const packs = listPacks();
  assert.equal(packs.length, 3);
  assert.deepEqual(getPack('four').roles, ['specifier', 'coder', 'cleaner', 'architect']);
  assert.equal(getPack('six').roles.includes('qa'), true);
});

test('suggestPack maps bug→two ultra→six high→four', () => {
  assert.equal(suggestPack({ type: 'bug', priority: 'Medium' }).id, 'two');
  assert.equal(suggestPack({ priority: 'Ultra High' }).id, 'six');
  assert.equal(suggestPack({ priority: 'High' }).id, 'four');
});

test('recommendPackPolicy exposes modelHint cheap/strong', () => {
  const { recommendPackPolicy } = require('./swarm');
  const bug = recommendPackPolicy({ type: 'bug', title: 'fix login' });
  assert.equal(bug.pack.id, 'two');
  assert.equal(bug.modelHint, 'cheap');

  const mejoraHigh = recommendPackPolicy({ type: 'enhancement', priority: 'High', title: 'Mejora ranking' });
  assert.equal(mejoraHigh.pack.id, 'four');
  assert.equal(mejoraHigh.modelHint, 'strong');

  const mvp = recommendPackPolicy({ type: 'feature', priority: 'Medium', title: 'MVP onboarding' });
  assert.equal(mvp.pack.id, 'six');
  assert.equal(mvp.modelHint, 'strong');
});

test('buildTaskBrief includes AC deps paths and role prompts', () => {
  const task = {
    id: 'FX-E-9',
    title: 'Packs',
    status: 'Queued',
    priority: 'High',
    source: `---
id: FX-E-9
title: Packs
status: Queued
priority: High
dependencies:
  - FX-E-1
---

## Description

Implementar en \`swarm/packs.js\` y \`docs/swarm/prompts.md\`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Packs two/four/six disponibles
- [x] #2 Brief por tarea incluye AC deps y paths
<!-- AC:END -->
`,
  };
  const brief = buildTaskBrief(task, { pack: 'four' });
  assert.equal(brief.pack.id, 'four');
  assert.equal(brief.acceptance.length, 2);
  assert.equal(brief.acceptance[1].done, true);
  assert.deepEqual(brief.dependencies, ['FX-E-1']);
  assert.ok(brief.paths.includes('swarm/packs.js'));
  assert.match(brief.markdown, /## Role prompts/);
  assert.match(brief.markdown, /### specifier/);
  assert.match(brief.markdown, /criterios binarios/i);
});

test('ensureRoleWorktree creates and reuses git worktree', () => {
  const { ensureRoleWorktree, listRoleWorktrees, WORKTREE_ROOT } = require('./swarm/worktrees');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-wt-'));
  const { spawnSync } = require('node:child_process');
  const run = (args) => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
  run(['init']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(root, 'README.md'), 'wt\n');
  run(['add', 'README.md']);
  run(['commit', '-m', 'init']);

  const first = ensureRoleWorktree(root, { taskId: 'FX-E-1', role: 'coder' });
  assert.equal(first.action, 'created');
  assert.ok(fs.existsSync(first.path));
  assert.match(first.relativePath, new RegExp(`^${WORKTREE_ROOT}/`));

  const second = ensureRoleWorktree(root, { taskId: 'FX-E-1', role: 'coder' });
  assert.equal(second.action, 'reuse');
  assert.equal(listRoleWorktrees(root).length, 1);
});

test('applyCloseoutToTaskSource marks AC and adds Closeout block', () => {
  const { applyCloseoutToTaskSource, appendLedgerHistorial, formatLedgerCheckpoint } = require('./swarm');
  const source = `---
id: FX-E-8
status: In Progress
---

## Acceptance Criteria
- [ ] #1 One
- [ ] #2 Two

## Description
ok
`;
  const next = applyCloseoutToTaskSource(source, {
    evidence: 'npm test ok',
    notes: 'AH-E-34',
    command: 'npm test',
    at: '2026-08-09 12:00:00',
  });
  assert.match(next, /- \[x\] #1 One/);
  assert.match(next, /- \[x\] #2 Two/);
  assert.match(next, /## Evidence/);
  assert.match(next, /## Closeout/);
  assert.match(next, /proof: npm test ok/);

  const ledger = appendLedgerHistorial('# Plan\n\n## Historial\n\n- old\n', formatLedgerCheckpoint({
    taskId: 'FX-E-8',
    title: 'Close',
    evidence: 'npm test ok',
    at: '2026-08-09 12:00:00',
  }));
  assert.match(ledger, /FX-E-8 \(Close\) Done/);
});

test('completeSwarmTask checkpoints ledger when enabled', async () => {
  const { completeSwarmTask } = require('./swarm');
  const store = {
    tasks: [{
      id: 'FX-E-8',
      title: 'Close',
      status: 'In Progress',
      source: '---\nid: FX-E-8\ntitle: Close\nstatus: In Progress\n---\n\n## Acceptance Criteria\n- [ ] #1 Done me\n',
    }],
  };
  let ledgerPayload = null;
  const deps = {
    listTasks: () => store.tasks,
    setStatus: async (_p, taskId, status) => {
      const task = store.tasks[0];
      task.status = status;
      task.source = task.source.replace(/^status:\s*.+$/mi, `status: ${status}`);
      return { ...task };
    },
    writeSource: async (_p, taskId, source) => {
      store.tasks[0].source = source;
      return { ...store.tasks[0] };
    },
    checkpointLedger: (_project, payload) => {
      ledgerPayload = payload;
      return { written: true, path: 'docs/plans/ariadne-e2e.md', line: '- ok' };
    },
  };
  const done = await completeSwarmTask({}, {
    taskId: 'FX-E-8',
    evidence: 'tests green',
    notes: 'note',
    ledger: true,
  }, deps);
  assert.equal(done.task.status, 'Done');
  assert.equal(done.ledger.written, true);
  assert.equal(ledgerPayload.taskId, 'FX-E-8');
  assert.match(store.tasks[0].source, /\[x\] #1 Done me/);
  assert.match(store.tasks[0].source, /## Closeout/);
});

test('four/six packs start with specifier role', () => {
  const { getPack, packRequiresSpecifier } = require('./swarm');
  assert.equal(getPack('four').roles[0], 'specifier');
  assert.equal(getPack('six').roles[0], 'specifier');
  assert.equal(packRequiresSpecifier(getPack('four')), true);
  assert.equal(packRequiresSpecifier(getPack('two')), false);
});

test('assertSpecifierBeforeCoder blocks coder without AC/approval', () => {
  const { assertSpecifierBeforeCoder, applySpecifierAcceptance, getPack } = require('./swarm');
  const pack = getPack('four');
  const bare = '---\nid: X\n---\n';
  assert.throws(
    () => assertSpecifierBeforeCoder({
      pack,
      fromRole: 'coder',
      toRole: 'coder',
      source: bare,
    }),
    /SPECIFIER_REQUIRED|specifier/,
  );
  assert.throws(
    () => assertSpecifierBeforeCoder({
      pack,
      fromRole: 'specifier',
      toRole: 'coder',
      source: bare,
      approved: true,
    }),
    /MISSING_APPROVABLE_AC|AC/,
  );
  const withAc = applySpecifierAcceptance(bare, {
    criteria: ['Usuario completa el flujo', 'Test smoke pasa'],
  });
  assert.throws(
    () => assertSpecifierBeforeCoder({
      pack,
      fromRole: 'specifier',
      toRole: 'coder',
      source: withAc,
      summary: 'ready',
    }),
    /SPECIFIER_NOT_APPROVED|approved/,
  );
  const ok = assertSpecifierBeforeCoder({
    pack,
    fromRole: 'specifier',
    toRole: 'coder',
    source: withAc,
    summary: 'AC ok',
    approved: true,
  });
  assert.equal(ok.ok, true);
});

test('handoff to coder on four-pack requires specifier gate', async () => {
  const { handoffSwarmTask, applySpecifierAcceptance } = require('./swarm');
  const base = `---
id: FX-E-46
title: Spec gate
status: In Progress
priority: High
type: enhancement
---

## Description

demo
`;
  const store = {
    tasks: [{
      id: 'FX-E-46',
      title: 'Spec gate',
      status: 'In Progress',
      priority: 'High',
      type: 'enhancement',
      source: base,
    }],
  };
  const deps = memoryDeps(store);
  await assert.rejects(
    () => handoffSwarmTask({}, {
      taskId: 'FX-E-46',
      fromRole: 'coder',
      toRole: 'coder',
      summary: 'skip spec',
      pack: 'four',
    }, deps),
    /specifier/i,
  );

  store.tasks[0].source = applySpecifierAcceptance(base, {
    criteria: ['Criterio binario uno', 'Criterio binario dos'],
  });
  await handoffSwarmTask({}, {
    taskId: 'FX-E-46',
    fromRole: 'specifier',
    toRole: 'coder',
    summary: 'AC ok',
    approved: true,
    pack: 'four',
  }, deps);
  assert.match(store.tasks[0].source, /specifier → coder/);
  assert.match(store.tasks[0].source, /Acceptance Criteria/);
});

test('packRequiresQa true for six only', () => {
  const { getPack, packRequiresQa } = require('./swarm');
  assert.equal(packRequiresQa(getPack('six')), true);
  assert.equal(packRequiresQa(getPack('four')), false);
  assert.equal(packRequiresQa(getPack('two')), false);
});

test('runQaGate fails closed and complete blocks Done', async () => {
  const { runQaGate, completeSwarmTask } = require('./swarm');
  assert.throws(
    () => runQaGate({
      runCommand: ({ step }) => ({
        status: step === 'lint' ? 1 : 0,
        stdout: '',
        stderr: 'lint boom',
      }),
    }),
    (error) => error.code === 'QA_GATE_FAILED',
  );

  const store = {
    tasks: [{
      id: 'FX-E-47',
      title: 'MVP QA gate',
      status: 'In Progress',
      priority: 'Ultra High',
      type: 'feature',
      source: '---\nid: FX-E-47\ntitle: MVP QA gate\nstatus: In Progress\npriority: Ultra High\ntype: feature\n---\n',
    }],
  };

  await assert.rejects(
    () => completeSwarmTask({}, {
      taskId: 'FX-E-47',
      evidence: 'should not land',
      pack: 'six',
      ledger: false,
    }, {
      ...memoryDeps(store),
      runCommand: () => ({ status: 1, stdout: '', stderr: 'npm test failed' }),
    }),
    /QA_GATE_FAILED|QA gate/,
  );
  assert.equal(store.tasks[0].status, 'In Progress');

  const done = await completeSwarmTask({}, {
    taskId: 'FX-E-47',
    evidence: 'slice ok',
    pack: 'six',
    ledger: false,
  }, {
    ...memoryDeps(store),
    runCommand: () => ({ status: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(done.task.status, 'Done');
  assert.match(done.evidence, /QA gate/);
  assert.match(store.tasks[0].source, /hardender → qa/);
  assert.match(store.tasks[0].source, /lint\+test gate/);
});
