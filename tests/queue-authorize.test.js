'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { insertTaskInQueueOrder } = require('../lib/gantt/queue-authorize');
const { buildHubGanttUiConfig } = require('../lib/gantt/ui-contract');
const {
  authorizeTaskToQueue,
  applyTaskStateFallback,
  projectTasks,
  findTask,
} = require('../server');

test('insertTaskInQueueOrder supports end head and ordinal slot', () => {
  assert.deepEqual(insertTaskInQueueOrder(['A', 'B'], 'C'), ['A', 'B', 'C']);
  assert.deepEqual(insertTaskInQueueOrder(['A', 'B'], 'C', { position: 'head' }), ['C', 'A', 'B']);
  assert.deepEqual(insertTaskInQueueOrder(['A', 'B', 'C'], 'X', { ordinal: 20 }), ['A', 'X', 'B', 'C']);
  assert.deepEqual(insertTaskInQueueOrder(['A', 'B'], 'A', { position: 'head' }), ['A', 'B']);
});

test('hub-config contract advertises taskQueueAuthorize', () => {
  const config = buildHubGanttUiConfig({ hubApiBase: 'http://127.0.0.1:4177' });
  assert.equal(config.endpoints.taskQueueAuthorize.method, 'POST');
  assert.match(config.endpoints.taskQueueAuthorize.path, /\/queue$/);
});

test('authorizeTaskToQueue sets Queued and ordinal order', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-queue-auth-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'fx-e-1.md'), `---
id: FX-E-1
title: Already queued
status: Queued
type: feature
ordinal: 10
---
`);
  fs.writeFileSync(path.join(tasksDir, 'fx-e-2.md'), `---
id: FX-E-2
title: To authorize
status: To Do
type: feature
ordinal: 99
---
`);
  const project = { slug: 'fixture', name: 'Fixture', path: root, taskCode: 'FX' };

  // Without backlog CLI, enqueue uses fallback path via ensureTaskQueued errors —
  // seed Queued via fallback then authorize head for FX-E-2
  applyTaskStateFallback(project, 'FX-E-2', 'Queued', true);

  const result = await authorizeTaskToQueue(project, 'FX-E-2', { position: 'head' });
  assert.equal(result.status, 'Queued');
  assert.equal(result.queueOrder[0], 'FX-E-2');
  assert.ok(result.queueOrder.includes('FX-E-1'));

  const tasks = projectTasks(project);
  const head = tasks.find((task) => task.id === 'FX-E-2');
  const tail = tasks.find((task) => task.id === 'FX-E-1');
  assert.equal(head.status, 'Queued');
  assert.ok(Number(head.ordinal) <= Number(tail.ordinal));
});
