'use strict';

const {
  isQueuedStatus,
  isDoingStatus,
  findTaskById,
  computeSwarmStatus,
  summarizeTask,
  blockersFromGate,
} = require('./status');
const { appendHandoff, appendEvidence } = require('./evidence');
const { applyCloseoutToTaskSource, checkpointLedger } = require('./closeout');
const {
  assertSpecifierBeforeCoder,
  resolveStartingRole,
  packRequiresSpecifier,
} = require('./specifier-gate');
const { recommendPackPolicy, getPack } = require('./packs');
const {
  runQaGate,
  shouldEnforceQaGate,
  formatQaHandoffSummary,
  packRequiresQa,
} = require('./qa-gate');
const { appendHandoffLog } = require('./observability');

const DOING_STATUS = 'In Progress';
const DONE_STATUS = 'Done';

function assertRunnable(task, tasks, { allowResume = true } = {}) {
  if (!task) throw new Error('tarea no encontrada');

  if (isDoingStatus(task.status) && allowResume) {
    return { ok: true, resumed: true, blockers: [] };
  }

  if (!isQueuedStatus(task.status)) {
    const error = new Error(
      `solo tareas en Queue pueden entrar al swarm (got ${task.id} status=${task.status})`,
    );
    error.code = 'NOT_QUEUED';
    throw error;
  }

  const blockers = blockersFromGate(task, tasks);
  if (blockers.length) {
    const labels = blockers.map((item) => item.id).join(', ');
    const error = new Error(`dependencias FS pendientes: ${labels}`);
    error.code = 'FS_BLOCKED';
    error.blockers = blockers;
    throw error;
  }

  return { ok: true, resumed: false, blockers: [] };
}

function resolveRunTarget(tasks, taskId) {
  if (taskId) {
    const task = findTaskById(tasks, taskId);
    if (!task) throw new Error(`tarea no encontrada: ${taskId}`);
    return task;
  }

  const status = computeSwarmStatus(tasks);
  if (status.blockedHead) {
    const labels = status.blockedHead.blockers.map((item) => item.id).join(', ');
    const error = new Error(
      `cabeza de Queue ${status.blockedHead.id} bloqueada por deps: ${labels}`,
    );
    error.code = 'FS_BLOCKED';
    error.blockers = status.blockedHead.blockers;
    throw error;
  }
  if (!status.next) {
    const error = new Error('Queue vacía: nada que ejecutar');
    error.code = 'QUEUE_EMPTY';
    throw error;
  }
  return findTaskById(tasks, status.next.id);
}

/**
 * Authorize and start a queued task (→ In Progress / Doing).
 * `deps` must provide listTasks + setStatus (+ optional writeSource for handoff/complete).
 */
async function runSwarmTask(project, options = {}, deps = {}) {
  const listTasks = deps.listTasks;
  const setStatus = deps.setStatus;
  if (typeof listTasks !== 'function' || typeof setStatus !== 'function') {
    throw new Error('runSwarmTask requires deps.listTasks and deps.setStatus');
  }

  const tasks = listTasks(project);
  const target = resolveRunTarget(tasks, options.taskId);
  const check = assertRunnable(target, tasks);

  const pack = options.pack
    ? getPack(options.pack)
    : recommendPackPolicy(target).pack;
  const start = resolveStartingRole(target, { pack, role: options.role });

  let updated = target;
  if (!check.resumed) {
    updated = await setStatus(project, target.id, DOING_STATUS);
  }

  return {
    action: 'run',
    resumed: check.resumed === true,
    role: start.role,
    pack: pack.id,
    specifierRequired: packRequiresSpecifier(pack),
    task: summarizeTask(updated),
  };
}

async function handoffSwarmTask(project, options = {}, deps = {}) {
  const listTasks = deps.listTasks;
  const writeSource = deps.writeSource;
  if (typeof listTasks !== 'function' || typeof writeSource !== 'function') {
    throw new Error('handoffSwarmTask requires deps.listTasks and deps.writeSource');
  }

  const tasks = listTasks(project);
  const taskId = options.taskId;
  if (!taskId) throw new Error('handoff requires --task');
  const task = findTaskById(tasks, taskId);
  if (!task) throw new Error(`tarea no encontrada: ${taskId}`);
  if (!isDoingStatus(task.status) && !isQueuedStatus(task.status)) {
    throw new Error(`handoff solo en Queue/Doing (got ${task.status})`);
  }

  const pack = options.pack
    ? getPack(options.pack)
    : recommendPackPolicy(task).pack;

  assertSpecifierBeforeCoder({
    pack,
    fromRole: options.fromRole,
    toRole: options.toRole,
    source: task.source || '',
    summary: options.summary,
    approved: options.approved === true,
    skip: options.skipSpecifierGate === true,
  });

  const nextSource = appendHandoff(task.source || '', {
    fromRole: options.fromRole,
    toRole: options.toRole,
    summary: options.summary,
    commit: options.commit,
  });
  const updated = await writeSource(project, task.id, nextSource);

  let handoffLog = { written: false };
  if (project?.path) {
    handoffLog = appendHandoffLog(project.path, {
      project: project.slug,
      taskId: task.id,
      fromRole: options.fromRole,
      toRole: options.toRole,
      summary: options.summary,
      commit: options.commit || null,
      pack: pack.id,
    });
  }

  return {
    action: 'handoff',
    task: summarizeTask(updated),
    fromRole: options.fromRole,
    toRole: options.toRole,
    summary: options.summary,
    pack: pack.id,
    specifierRequired: packRequiresSpecifier(pack),
    handoffLog,
  };
}

async function completeSwarmTask(project, options = {}, deps = {}) {
  const listTasks = deps.listTasks;
  const setStatus = deps.setStatus;
  const writeSource = deps.writeSource;
  if (typeof listTasks !== 'function' || typeof setStatus !== 'function' || typeof writeSource !== 'function') {
    throw new Error('completeSwarmTask requires deps.listTasks, deps.setStatus and deps.writeSource');
  }

  const taskId = options.taskId;
  if (!taskId) throw new Error('complete requires --task');

  const tasks = listTasks(project);
  const task = findTaskById(tasks, taskId);
  if (!task) throw new Error(`tarea no encontrada: ${taskId}`);

  let evidence = String(options.evidence || '').trim();
  if (!evidence) throw new Error('complete requires --evidence');

  const pack = options.pack
    ? getPack(options.pack)
    : recommendPackPolicy(task).pack;

  let qaResult = null;
  if (shouldEnforceQaGate(task, {
    pack,
    qa: options.qa === true,
    requireQa: options.requireQa === true,
    skipQa: options.skipQa === true,
  })) {
    qaResult = runQaGate({
      cwd: options.cwd || project.path || process.cwd(),
      runCommand: deps.runCommand,
      steps: options.qaSteps,
    });
    evidence = `${evidence} · ${qaResult.evidence}`;
  }

  let source = task.source || '';
  if (qaResult) {
    source = appendHandoff(source, {
      fromRole: 'hardender',
      toRole: 'qa',
      summary: formatQaHandoffSummary(qaResult),
    });
  }

  const withEvidence = applyCloseoutToTaskSource(source, {
    evidence,
    notes: options.notes,
    command: options.command || (qaResult ? 'npm run lint && npm test' : undefined),
    checkAc: options.checkAc !== false,
  });
  await writeSource(project, task.id, withEvidence);
  const updated = await setStatus(project, task.id, DONE_STATUS);

  let ledger = { written: false, skipped: true };
  if (options.ledger !== false) {
    const checkpoint = typeof deps.checkpointLedger === 'function'
      ? deps.checkpointLedger
      : checkpointLedger;
    ledger = checkpoint(project, {
      taskId: task.id,
      title: task.title,
      evidence,
      notes: options.notes,
    }, {
      ledgerPath: options.ledgerPath,
    });
  }

  return {
    action: 'complete',
    task: summarizeTask(updated),
    evidence,
    qa: qaResult,
    pack: pack.id,
    qaRequired: packRequiresQa(pack) || options.qa === true,
    ledger,
  };
}

module.exports = {
  DOING_STATUS,
  DONE_STATUS,
  assertRunnable,
  resolveRunTarget,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
};
