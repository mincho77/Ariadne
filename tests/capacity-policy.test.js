'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCapacityPolicy,
  compareOperationalOrder,
  canAcceptTask,
  operationalTier,
} = require('../lib/gantt/capacity-policy');
const { priorityRank } = require('../lib/task-priority');

test('parseCapacityPolicy reads nested capacity.total/bugs/enhancements', () => {
  const policy = parseCapacityPolicy({
    capacity: { total: 3, bugs: 1, enhancements: 2 },
  });
  assert.deepEqual(policy, { total: 3, bugs: 1, enhancements: 2 });
});

test('parseCapacityPolicy keeps legacy numeric capacity', () => {
  const policy = parseCapacityPolicy({
    capacity: 4,
    aiModels: [{ key: 'gpt', enabled: true, maxParallel: 4 }],
  });
  assert.equal(policy.total, 4);
  assert.equal(policy.bugs, 4);
  assert.equal(policy.enhancements, 4);
});

test('compareOperationalOrder prioritizes Doing then Queue by ordinal then To Do by priority', () => {
  const doing = { id: 'A', status: 'In Progress', priority: 'Low', ordinal: 99, title: 'A' };
  const queued = { id: 'B', status: 'Queued', priority: 'Ultra High', ordinal: 20, title: 'B' };
  const todo = { id: 'C', status: 'To Do', priority: 'Ultra High', ordinal: 1, title: 'C' };
  const sorted = [todo, queued, doing].sort((a, b) => compareOperationalOrder(a, b, priorityRank));
  assert.deepEqual(sorted.map((task) => task.id), ['A', 'B', 'C']);
  assert.equal(operationalTier(queued), 1);
});

test('canAcceptTask enforces lane limits within total capacity', () => {
  const policy = { total: 2, bugs: 1, enhancements: 1 };
  const running = [{ lane: 'bugs' }];
  assert.equal(canAcceptTask(running, 'bugs', policy), false);
  assert.equal(canAcceptTask(running, 'mejoras', policy), true);
});
