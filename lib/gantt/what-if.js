'use strict';

const { buildProjectGanttFromTasks } = require('./scheduler');
const { buildHubGanttMetrics } = require('./hub-metrics');

function cloneTasks(tasks) {
  return tasks.map((task) => ({ ...task, source: String(task.source || '') }));
}

function applyWhatIfTaskPatches(tasks, patches = []) {
  const { applyTaskPatchToSource, normalizeTaskPatch } = require('../task-temporal');
  const byId = new Map((patches || []).map((patch) => [String(patch.id).toUpperCase(), patch]));
  return tasks.map((task) => {
    const patch = byId.get(String(task.id).toUpperCase());
    if (!patch) return { ...task };
    const normalized = normalizeTaskPatch(patch);
    delete normalized.id;
    const source = applyTaskPatchToSource(task.source, normalized);
    return { ...task, source };
  });
}

function summarizePlan(plan) {
  return {
    summary: plan.summary,
    forecastFinishDate: (plan.tasks || []).reduce((max, task) => (
      !max || (task.endDate && task.endDate > max) ? task.endDate : max
    ), null),
    taskCount: plan.tasks?.length || 0,
    generatedAt: plan.generatedAt,
  };
}

function compareWhatIfPlans(currentPlan, scenarioPlan) {
  const currentMap = new Map((currentPlan.tasks || []).map((task) => [task.id, task]));
  const scenarioMap = new Map((scenarioPlan.tasks || []).map((task) => [task.id, task]));
  const allIds = [...new Set([...currentMap.keys(), ...scenarioMap.keys()])].sort();

  const rows = allIds.map((id) => {
    const base = currentMap.get(id) || null;
    const next = scenarioMap.get(id) || null;
    const endDeltaDays = (base?.endDate && next?.endDate)
      ? Math.round((new Date(next.endDate) - new Date(base.endDate)) / 86400000)
      : null;
    return {
      id,
      title: next?.title || base?.title || id,
      current: base,
      scenario: next,
      endDeltaDays,
      change: !base ? 'added' : !next ? 'removed' : (endDeltaDays > 0 ? 'slipped' : endDeltaDays < 0 ? 'pulled_forward' : 'unchanged'),
    };
  });

  return {
    comparedAt: new Date().toISOString(),
    summary: {
      currentPendingDays: currentPlan.summary?.estimatedPendingDays ?? null,
      scenarioPendingDays: scenarioPlan.summary?.estimatedPendingDays ?? null,
      pendingDaysDelta: (
        scenarioPlan.summary?.estimatedPendingDays != null && currentPlan.summary?.estimatedPendingDays != null
      )
        ? scenarioPlan.summary.estimatedPendingDays - currentPlan.summary.estimatedPendingDays
        : null,
      slippedTasks: rows.filter((row) => row.change === 'slipped').length,
      pulledForwardTasks: rows.filter((row) => row.change === 'pulled_forward').length,
      addedTasks: rows.filter((row) => row.change === 'added').map((row) => row.id),
      removedTasks: rows.filter((row) => row.change === 'removed').map((row) => row.id),
    },
    tasks: rows,
  };
}

function runWhatIfScenario(tasks, projectMeta, baseOptions = {}, scenario = {}) {
  const overrides = scenario.overrides && typeof scenario.overrides === 'object' ? scenario.overrides : {};
  const patchedTasks = applyWhatIfTaskPatches(cloneTasks(tasks), scenario.taskPatches || scenario.tasks || []);
  const scenarioOptions = {
    ...baseOptions,
    ...overrides,
    simulate: true,
  };
  const currentPlan = buildProjectGanttFromTasks(tasks, projectMeta, baseOptions);
  const scenarioPlan = buildProjectGanttFromTasks(patchedTasks, projectMeta, scenarioOptions);
  const comparison = compareWhatIfPlans(currentPlan, scenarioPlan);

  return {
    label: String(scenario.label || 'what-if').trim() || 'what-if',
    overrides,
    taskPatches: scenario.taskPatches || scenario.tasks || [],
    current: summarizePlan(currentPlan),
    scenario: summarizePlan(scenarioPlan),
    currentPlan,
    scenarioPlan,
    comparison,
    metrics: {
      current: buildHubGanttMetrics(currentPlan),
      scenario: buildHubGanttMetrics(scenarioPlan),
    },
    persisted: false,
  };
}

module.exports = {
  applyWhatIfTaskPatches,
  compareWhatIfPlans,
  runWhatIfScenario,
};
