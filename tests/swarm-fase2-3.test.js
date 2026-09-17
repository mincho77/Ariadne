'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildSwarmObservability,
  extractTaskHandoffs,
  appendHandoffLog,
  exportSwarmforgeBundle,
  renderSwarmforgeConf,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
} = require('../swarm');

test('extractTaskHandoffs and observability expose active role', () => {
  const source = `---
id: FX-E-48
status: In Progress
---

## Swarm handoffs

- 2026-08-10 10:00:00 · specifier → coder · AC ok
- 2026-08-10 10:05:00 · coder → cleaner · tests green
`;
  const handoffs = extractTaskHandoffs(source);
  assert.equal(handoffs.length, 2);
  assert.equal(handoffs[1].toRole, 'cleaner');

  const project = { slug: 'fixture', path: fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-obs-')) };
  const snap = buildSwarmObservability(project, [{
    id: 'FX-E-48',
    title: 'Obs',
    status: 'In Progress',
    priority: 'High',
    type: 'enhancement',
    source,
  }], { listWorktrees: () => [{ name: 'fx-e-48-coder', path: '/tmp/x', relativePath: '.worktrees/fx-e-48-coder' }] });
  assert.equal(snap.doingDetail[0].activeRole, 'cleaner');
  assert.equal(snap.doingDetail[0].worktrees[0].name, 'fx-e-48-coder');
  assert.ok(snap.handoffLog);
});

test('appendHandoffLog persists jsonl', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-hlog-'));
  appendHandoffLog(root, { taskId: 'FX-E-1', fromRole: 'coder', toRole: 'cleaner', summary: 'ok' });
  const file = path.join(root, '.ariadne', 'swarm', 'handoffs.jsonl');
  assert.equal(fs.existsSync(file), true);
  assert.match(fs.readFileSync(file, 'utf8'), /FX-E-1/);
});

test('swarm E2E fixture: Queued → run → handoff → Done', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-swarm-e2e-'));
  const store = {
    tasks: [{
      id: 'FX-E-49',
      title: 'E2E adapter',
      status: 'Queued',
      ordinal: 10,
      priority: 'Medium',
      type: 'task',
      source: `---
id: FX-E-49
title: E2E adapter
status: Queued
ordinal: 10
priority: Medium
type: task
---

## Description

Fixture E2E

## Acceptance Criteria
- [ ] #1 Adapter cierra con evidencia
`,
    }],
  };
  const project = { slug: 'fixture', path: root, name: 'Fixture' };
  const deps = {
    listTasks: () => store.tasks,
    setStatus: async (_p, taskId, status) => {
      const task = store.tasks.find((item) => item.id === taskId);
      task.status = status;
      task.source = task.source.replace(/^status:\s*.+$/mi, `status: ${status}`);
      return { ...task };
    },
    writeSource: async (_p, taskId, source) => {
      const task = store.tasks.find((item) => item.id === taskId);
      task.source = source;
      return { ...task };
    },
  };

  const run = await runSwarmTask(project, { taskId: 'FX-E-49' }, deps);
  assert.equal(run.task.status, 'In Progress');

  await handoffSwarmTask(project, {
    taskId: 'FX-E-49',
    fromRole: 'coder',
    toRole: 'cleaner',
    summary: 'fixture green',
  }, deps);
  assert.match(store.tasks[0].source, /Swarm handoffs/);
  assert.equal(fs.existsSync(path.join(root, '.ariadne', 'swarm', 'handoffs.jsonl')), true);

  const done = await completeSwarmTask(project, {
    taskId: 'FX-E-49',
    evidence: 'fixture e2e ok',
    ledger: false,
    skipQa: true,
  }, deps);
  assert.equal(done.task.status, 'Done');
  assert.match(store.tasks[0].source, /## Evidence/);
  assert.match(store.tasks[0].source, /\[x\] #1/);
});

test('exportSwarmforgeBundle writes conf without runtime dep', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-sf-'));
  const conf = renderSwarmforgeConf({ projectSlug: 'demo' });
  assert.match(conf, /\[\[pack\]\]/);
  assert.match(conf, /id = "six"/);
  assert.match(conf, /runtime = "optional"/);

  const result = exportSwarmforgeBundle(out, {
    root: path.join(__dirname, '..'),
    projectSlug: 'demo',
  });
  assert.equal(result.optionalRuntime, true);
  assert.equal(fs.existsSync(path.join(out, 'swarmforge.conf')), true);
  assert.equal(fs.existsSync(path.join(out, 'roles', 'coder.prompt')), true);
  assert.equal(fs.existsSync(path.join(out, 'README.md')), true);
});

test('role backends table and Ariadne governs Done', () => {
  const {
    listRoleBackends,
    governanceNote,
    backendForRole,
    renderBackendsMarkdown,
  } = require('../swarm');
  const roles = listRoleBackends();
  assert.ok(roles.some((row) => row.role === 'coder' && row.primary === 'cursor'));
  assert.ok(roles.some((row) => row.role === 'specifier'));
  assert.ok(roles.some((row) => row.role === 'qa'));
  const gov = governanceNote();
  assert.equal(gov.owner, 'ariadne');
  assert.ok(gov.controls.includes('Done'));
  assert.match(gov.completeCommand, /swarm -- complete/);
  assert.equal(backendForRole('architect').primary, 'claude');
  assert.match(renderBackendsMarkdown(), /\| specifier \|/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'docs', 'swarm', 'backends.md'), 'utf8'), /Ejemplo \(four-pack/);
});
