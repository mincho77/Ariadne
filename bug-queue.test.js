const test = require('node:test');
const assert = require('node:assert/strict');
const { bugQueueState, buildBugRunInstruction } = require('./bug-queue');

test('bugQueueState exposes turn 1 only when nothing is active', () => {
  const tasks = [
    { id: 'JM-B-1', title: 'Activo', status: 'In Progress', type: 'bug', ordinal: 10 },
    { id: 'JM-B-2', title: 'En cola', status: 'Queued', type: 'bug', ordinal: 20 },
    { id: 'JM-E-1', title: 'Mejora', status: 'Queued', type: 'enhancement', ordinal: 30 },
  ];
  const state = bugQueueState(tasks, (task) => task.type === 'bug');
  assert.equal(state.active.id, 'JM-B-1');
  assert.equal(state.next, null);
  assert.equal(state.queueLength, 1);
});

test('bugQueueState picks lowest ordinal queued bug as next', () => {
  const tasks = [
    { id: 'JM-B-3', title: 'Tercero', status: 'Queued', type: 'bug', ordinal: 30 },
    { id: 'JM-B-1', title: 'Primero', status: 'Queued', type: 'bug', ordinal: 10 },
    { id: 'JM-B-2', title: 'Segundo', status: 'Queued', type: 'bug', ordinal: 20 },
  ];
  const state = bugQueueState(tasks, (task) => task.type === 'bug');
  assert.equal(state.next.id, 'JM-B-1');
  assert.equal(state.queueLength, 3);
});

test('buildBugRunInstruction includes task id and project path', () => {
  const instruction = buildBugRunInstruction(
    { id: 'JM-B-9', title: 'Upload congela', file: 'tasks/jm-b-9.md' },
    { name: 'JurisMate', slug: 'jurismate', path: '/tmp/jurismate' },
  );
  assert.match(instruction, /JM-B-9/);
  assert.match(instruction, /Upload congela/);
  assert.match(instruction, /\/tmp\/jurismate/);
});
