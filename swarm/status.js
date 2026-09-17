'use strict';

const { evaluateDependencyGate } = require('../lib/dependency-gate');

function isQueuedStatus(status) {
  return String(status || '').trim().toLowerCase() === 'queued';
}

function isDoingStatus(status) {
  return /^in progress$/i.test(String(status || '').trim());
}

function sortQueued(tasks) {
  return [...(tasks || [])]
    .filter((task) => isQueuedStatus(task.status))
    .sort((a, b) => (
      (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER)
      || String(a.title || '').localeCompare(String(b.title || ''), 'es')
    ));
}

function summarizeTask(task, extras = {}) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    ordinal: task.ordinal,
    priority: task.priority,
    ...extras,
  };
}

function blockersFromGate(task, tasks) {
  const gate = evaluateDependencyGate(task, tasks, { policy: 'strict' });
  return (gate.blocking || []).map((item) => ({
    id: item.id,
    status: item.status || null,
    reason: item.reason,
    message: item.reason === 'unresolved'
      ? `Falta predecesora FS ${item.id}`
      : `Espera a ${item.id} (${item.status || 'pendiente'})`,
  }));
}

/**
 * Snapshot of Queue / Doing for swarm authorization.
 * `next` is null when the queue head is blocked by unfinished FS deps.
 */
function computeSwarmStatus(tasks) {
  const queue = sortQueued(tasks).map((task) => {
    const blockers = blockersFromGate(task, tasks);
    return summarizeTask(task, {
      ready: blockers.length === 0,
      blockers,
    });
  });

  const doing = (tasks || [])
    .filter((task) => isDoingStatus(task.status))
    .map((task) => summarizeTask(task));

  const head = queue[0] || null;
  const next = head && head.ready ? summarizeTask(head) : null;
  const blockedHead = head && !head.ready ? head : null;

  return {
    queue,
    queueLength: queue.length,
    doing,
    doingCount: doing.length,
    next,
    blockedHead,
    readyCount: queue.filter((item) => item.ready).length,
  };
}

function findTaskById(tasks, taskId) {
  const needle = String(taskId || '').trim().toLowerCase();
  if (!needle) return null;
  return (tasks || []).find((task) => String(task.id).toLowerCase() === needle) || null;
}

module.exports = {
  isQueuedStatus,
  isDoingStatus,
  sortQueued,
  summarizeTask,
  blockersFromGate,
  computeSwarmStatus,
  findTaskById,
};
