'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDependencyGate, assertCanStartWork } = require('../lib/dependency-gate');

const tasks = [
  {
    id: 'GT-E-1',
    title: 'Base',
    status: 'To Do',
    source: '---\nid: GT-E-1\nstatus: To Do\n---\n',
  },
  {
    id: 'GT-E-2',
    title: 'Child',
    status: 'To Do',
    source: '---\nid: GT-E-2\nstatus: To Do\ndependencies:\n  - GT-E-1:FS\n---\n',
  },
  {
    id: 'GT-E-3',
    title: 'Ready',
    status: 'To Do',
    source: '---\nid: GT-E-3\nstatus: To Do\n---\n',
  },
];

test('evaluateDependencyGate blocks FS until predecessor is Done', () => {
  const gate = evaluateDependencyGate(tasks[1], tasks, { policy: 'strict' });
  assert.equal(gate.blocked, true);
  assert.equal(gate.blocking[0].id, 'GT-E-1');
});

test('evaluateDependencyGate allows start when predecessor is Done', () => {
  const done = tasks.map((task) => (task.id === 'GT-E-1' ? { ...task, status: 'Done' } : task));
  const gate = evaluateDependencyGate(done[1], done, { policy: 'strict' });
  assert.equal(gate.blocked, false);
});

test('assertCanStartWork throws for pending FS predecessor', () => {
  assert.throws(
    () => assertCanStartWork(tasks[1], tasks, { policy: 'strict' }),
    /Dependencia FS pendiente/i,
  );
});

test('assertCanStartWork allows independent tasks', () => {
  const gate = assertCanStartWork(tasks[2], tasks, { policy: 'strict' });
  assert.equal(gate.blocked, false);
});
