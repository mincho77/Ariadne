'use strict';

const { getFrontmatterList } = require('./task-markdown');
const { parseDependencySpec } = require('./gantt/dependencies');
const { isDoneStatus } = require('./gantt/planning-task');

function normalizeGatePolicy(value) {
  const key = String(value || 'strict').trim().toLowerCase();
  return key === 'warn' || key === 'warning' ? 'warn' : 'strict';
}

function evaluateDependencyGate(task, allTasks, options = {}) {
  const policy = normalizeGatePolicy(options.policy);
  const byId = new Map(allTasks.map((item) => [String(item.id).toLowerCase(), item]));
  const links = getFrontmatterList(task.source, 'dependencies')
    .map((token) => parseDependencySpec(token, options.iaHoursPerDay || 8))
    .filter((item) => item && item.id);

  const blocking = [];
  for (const link of links) {
    const relation = String(link.relation || 'FS').toUpperCase();
    if (relation !== 'FS') continue;
    const predecessor = byId.get(String(link.id).toLowerCase());
    if (!predecessor) {
      blocking.push({
        id: link.id,
        title: link.id,
        relation,
        reason: 'unresolved',
      });
      continue;
    }
    if (!isDoneStatus(predecessor.status)) {
      blocking.push({
        id: predecessor.id,
        title: predecessor.title,
        relation,
        status: predecessor.status,
        reason: 'pending',
      });
    }
  }

  return {
    taskId: task.id,
    policy,
    blocked: blocking.some((item) => item.reason === 'pending'),
    unresolved: blocking.some((item) => item.reason === 'unresolved'),
    blocking,
    canStart: blocking.length === 0 || (policy === 'warn' && blocking.every((item) => item.reason !== 'pending')),
    strictBlocked: blocking.some((item) => item.reason === 'pending'),
  };
}

function assertCanStartWork(task, allTasks, options = {}) {
  const gate = evaluateDependencyGate(task, allTasks, options);
  if (!gate.strictBlocked) return gate;
  if (gate.policy === 'warn') return gate;

  const pending = gate.blocking.filter((item) => item.reason === 'pending');
  const labels = pending.map((item) => `${item.id} (${item.status})`).join(', ');
  throw new Error(`Dependencia FS pendiente: ${labels}. Termina ${pending.map((item) => item.id).join(', ')} antes de mover a In Progress.`);
}

module.exports = {
  normalizeGatePolicy,
  evaluateDependencyGate,
  assertCanStartWork,
};
