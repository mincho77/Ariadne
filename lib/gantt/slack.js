'use strict';

const { criticalPath } = require('./critical-path');

function computeSlackFromSchedule(pendingTasks, schedule, dependents) {
  const scheduled = [...schedule.values()];
  if (!scheduled.length) {
    return { projectEndIaHour: 0, tasks: [] };
  }

  const projectEndIaHour = scheduled.reduce((max, item) => Math.max(max, item.endIaHour), 0);
  const rows = [];

  for (const task of pendingTasks) {
    const item = schedule.get(task.id);
    if (!item) continue;

    const earlyStart = item.startIaHour;
    const earlyFinish = item.endIaHour;
    const successors = dependents.get(task.id) || [];
    let lateFinish = projectEndIaHour;

    for (const succId of successors) {
      const succ = schedule.get(succId);
      if (!succ) continue;
      lateFinish = Math.min(lateFinish, succ.startIaHour);
    }

    const lateStart = Math.max(0, lateFinish - task.durationIaHours);
    const totalSlackIaHours = lateStart - earlyStart;

    rows.push({
      id: task.id,
      earlyStartIaHour: earlyStart,
      earlyFinishIaHour: earlyFinish,
      lateStartIaHour: lateStart,
      lateFinishIaHour: lateFinish,
      totalSlackIaHours,
      freeSlackIaHours: totalSlackIaHours,
      isCritical: totalSlackIaHours <= 0,
    });
  }

  return { projectEndIaHour, tasks: rows };
}

function criticalPathFromSchedule(planned, dependencyEdges) {
  if (!planned.length) return { route: [], estimatedIaHours: 0 };

  const byId = new Map(planned.map((item) => [item.id, item]));
  const preds = new Map(planned.map((item) => [item.id, []]));
  for (const edge of dependencyEdges || []) {
    if (!byId.has(edge.fromId) || !byId.has(edge.toId)) continue;
    preds.get(edge.toId).push(edge.fromId);
  }

  const memo = new Map();
  const nextMemo = new Map();

  const score = (id, stack = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return byId.get(id)?.endIaHour || 0;
    stack.add(id);
    const item = byId.get(id);
    let bestPred = null;
    let bestEnd = item?.endIaHour || 0;
    for (const predId of preds.get(id) || []) {
      const predEnd = score(predId, stack);
      if (predEnd >= bestEnd) {
        bestEnd = predEnd;
        bestPred = predId;
      }
    }
    stack.delete(id);
    const value = item ? Math.max(item.endIaHour, bestEnd) : bestEnd;
    memo.set(id, value);
    nextMemo.set(id, bestPred);
    return value;
  };

  let bestId = planned[0].id;
  let bestScore = 0;
  for (const item of planned) {
    const value = score(item.id);
    if (value >= bestScore) {
      bestScore = value;
      bestId = item.id;
    }
  }

  const route = [];
  const visited = new Set();
  let cursor = bestId;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const item = byId.get(cursor);
    if (!item) break;
    route.unshift({
      id: item.id,
      title: item.title,
      durationDays: item.durationDays,
      durationIaHours: item.durationIaHours,
      startIaHour: item.startIaHour,
      endIaHour: item.endIaHour,
    });
    cursor = nextMemo.get(cursor);
  }

  return {
    route,
    estimatedIaHours: bestScore,
    kind: 'resource',
  };
}

function buildSlackAnalysis(pendingTasks, schedule, dependents, dependencyEdges) {
  const logical = criticalPath(pendingTasks, dependents, new Map(pendingTasks.map((task) => [task.id, task])));
  const planned = [...schedule.values()];
  const resource = criticalPathFromSchedule(planned, dependencyEdges);
  const slack = computeSlackFromSchedule(pendingTasks, schedule, dependents);

  return {
    logicalCriticalPath: { ...logical, kind: 'logical' },
    resourceCriticalPath: resource,
    projectEndIaHour: slack.projectEndIaHour,
    tasks: slack.tasks,
  };
}

module.exports = {
  computeSlackFromSchedule,
  criticalPathFromSchedule,
  buildSlackAnalysis,
};
