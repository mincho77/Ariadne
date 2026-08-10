'use strict';

const { computeSwarmStatus, summarizeTask } = require('./swarm/status');
const { evaluateDependencyGate } = require('./lib/dependency-gate');

function isDoingStatus(status) {
  return /^in progress$/i.test(String(status || '').trim());
}

function taskLite(task) {
  if (!task) return null;
  return summarizeTask(task);
}

/**
 * Build "Hoy" command-center snapshot for one project.
 * deps: { projectTasks, buildProjectGanttMetrics? }
 */
function buildProjectHoy(project, deps = {}) {
  const listTasks = deps.projectTasks;
  if (typeof listTasks !== 'function') throw new Error('buildProjectHoy requires deps.projectTasks');

  const tasks = listTasks(project);
  const swarm = computeSwarmStatus(tasks);
  const doing = tasks.filter((task) => isDoingStatus(task.status)).map(taskLite);
  const queued = swarm.queue || [];
  const blockedQueued = queued.filter((item) => item.ready === false);

  const doingWithGates = doing.map((item) => {
    const full = tasks.find((task) => String(task.id).toLowerCase() === String(item.id).toLowerCase());
    const gate = full ? evaluateDependencyGate(full, tasks, { policy: 'strict' }) : null;
    return {
      ...item,
      fsBlocked: gate?.strictBlocked === true,
      blockers: gate?.blocking || [],
    };
  });

  let metrics = null;
  if (typeof deps.buildProjectGanttMetrics === 'function') {
    try {
      metrics = deps.buildProjectGanttMetrics(project, { includeDone: false });
    } catch {
      metrics = null;
    }
  }

  const risks = [];
  if (swarm.blockedHead) {
    risks.push({
      kind: 'queue-blocked',
      message: `Cabeza de Queue ${swarm.blockedHead.id} bloqueada por deps`,
      taskId: swarm.blockedHead.id,
    });
  }
  for (const item of doingWithGates) {
    if (item.fsBlocked) {
      risks.push({
        kind: 'doing-blocked',
        message: `Doing ${item.id} con deps FS pendientes`,
        taskId: item.id,
      });
    }
  }
  if (metrics?.deadlineAtRisk > 0) {
    risks.push({ kind: 'deadline', message: `${metrics.deadlineAtRisk} deadline(s) en riesgo` });
  }
  if (metrics?.blockedTasks > 0) {
    risks.push({ kind: 'gantt-blocked', message: `${metrics.blockedTasks} tarea(s) bloqueadas en plan` });
  }
  if (metrics?.cycleDetected) {
    risks.push({ kind: 'cycle', message: 'Ciclo de dependencias detectado' });
  }

  return {
    project: project.slug,
    name: project.name,
    generatedAt: new Date().toISOString(),
    doing: doingWithGates,
    doingCount: doingWithGates.length,
    queue: queued,
    queueLength: queued.length,
    next: swarm.next,
    blockedHead: swarm.blockedHead,
    blockedQueued,
    swarm: {
      queueLength: swarm.queueLength,
      doingCount: swarm.doingCount,
      readyCount: swarm.readyCount,
      next: swarm.next,
      blockedHead: swarm.blockedHead,
    },
    risks,
    ganttMetrics: metrics
      ? {
        forecastFinishDate: metrics.forecastFinishDate || null,
        forecastConfidence: metrics.forecastConfidence || null,
        deadlineAtRisk: metrics.deadlineAtRisk || 0,
        blockedTasks: metrics.blockedTasks || 0,
      }
      : null,
    actions: {
      runSwarm: `/api/projects/${project.slug}/swarm/run`,
      swarmStatus: `/api/projects/${project.slug}/swarm/status`,
      swarmObserve: `/api/projects/${project.slug}/swarm/observe`,
    },
  };
}

function buildHoySnapshot(projects, deps = {}, options = {}) {
  const needle = String(options.project || '').trim().toLowerCase();
  const selected = needle
    ? projects.filter((item) => String(item.slug).toLowerCase() === needle)
    : [...projects];

  const items = selected.map((project) => buildProjectHoy(project, deps));
  return {
    generatedAt: new Date().toISOString(),
    projectFilter: needle || null,
    projectCount: items.length,
    projects: items,
    focus: items.map((item) => ({
      project: item.project,
      doingCount: item.doingCount,
      next: item.next,
      riskCount: item.risks.length,
    })),
  };
}

module.exports = {
  buildProjectHoy,
  buildHoySnapshot,
  isDoingStatus,
};
