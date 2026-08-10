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
  assert.match(instruction, /swarm -- run --project jurismate --task JM-B-9/);
});

test('improvementQueueState and packet target mejoras lane', () => {
  const { improvementQueueState, buildImprovementRunInstruction, improvementRunPacket } = require('./bug-queue');
  const tasks = [
    { id: 'AH-E-1', title: 'Mejora A', status: 'Queued', type: 'enhancement', ordinal: 20 },
    { id: 'AH-E-2', title: 'Mejora B', status: 'Queued', type: 'feature', ordinal: 10 },
    { id: 'AH-B-1', title: 'Bug', status: 'Queued', type: 'bug', ordinal: 5 },
  ];
  const isImprovement = (task) => task.type !== 'bug';
  const state = improvementQueueState(tasks, isImprovement);
  assert.equal(state.next.id, 'AH-E-2');
  assert.equal(state.queueLength, 2);

  const instruction = buildImprovementRunInstruction(
    { id: 'AH-E-2', title: 'Mejora B', file: 'tasks/ah-e-2.md' },
    { name: 'Ariadne', slug: 'ariadne', path: '/tmp/ariadne' },
  );
  assert.match(instruction, /AH-E-2/);
  assert.match(instruction, /## Evidence/);
  assert.match(instruction, /swarm -- run --project ariadne --task AH-E-2/);

  const packet = improvementRunPacket(
    { id: 'AH-E-2', title: 'Mejora B', status: 'Queued', priority: 'High', file: 'tasks/ah-e-2.md' },
    { name: 'Ariadne', slug: 'ariadne', path: '/tmp/ariadne' },
  );
  assert.equal(packet.lane, 'mejoras');
  assert.equal(packet.project, 'ariadne');
});
