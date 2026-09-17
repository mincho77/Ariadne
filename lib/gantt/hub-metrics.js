'use strict';

const { parseStartDate } = require('./calendar');

function maxEndDateIso(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return null;
  return tasks.reduce((max, task) => {
    const end = task?.endDate;
    if (!end) return max;
    return !max || end > max ? end : max;
  }, null);
}

function dayDiffIso(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = parseStartDate(startIso);
  const end = parseStartDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/**
 * Aggregate forecast confidence for Hub cards.
 *
 * Rules (documented in docs/gantt-hub-metrics.md):
 * - low: cycle in plan, any low-confidence task, or blocked task without unblock date
 * - medium: deadline violations, other blocked tasks, or medium-confidence tasks
 * - high: otherwise
 */
function resolveAggregateForecastConfidence(summary, tasks = []) {
  const s = summary || {};
  if (s.cycleDetected) return 'low';
  if ((s.lowConfidenceForecasts || 0) > 0) return 'low';
  if ((s.blockedWithoutUnblockDate || 0) > 0) return 'low';
  if ((s.deadlineViolations || 0) > 0) return 'medium';
  if ((s.blockedTasks || 0) > 0) return 'medium';
  if (tasks.some((task) => task.forecastConfidence === 'medium')) return 'medium';
  return 'high';
}

function buildHubGanttMetrics(plan, options = {}) {
  const summary = plan?.summary || {};
  const tasks = plan?.tasks || [];
  const forecastFinishDate = maxEndDateIso(tasks);
  const baseline = options.baseline || null;
  const baselineCompare = options.baselineCompare || null;

  const baselineFinishDate = baseline?.tasks ? maxEndDateIso(baseline.tasks) : null;
  const finishVarianceDays = (
    forecastFinishDate && baselineFinishDate
  ) ? dayDiffIso(baselineFinishDate, forecastFinishDate) : null;

  const pendingDaysDelta = baselineCompare?.summary?.pendingDaysDelta ?? null;
  const slippedTasks = baselineCompare?.summary?.slippedTasks ?? null;

  return {
    forecastFinishDate,
    forecastPendingDays: summary.estimatedPendingDays ?? null,
    forecastPendingIaHours: summary.estimatedPendingIaHours ?? null,
    completionRate: summary.completionRate ?? null,
    baselineId: baseline?.id || baselineCompare?.baselineId || null,
    baselineName: baseline?.name || baselineCompare?.baselineName || null,
    baselineFinishDate,
    finishVarianceDays,
    pendingDaysDelta,
    slippedTasks,
    deadlineAtRisk: summary.deadlineViolations ?? 0,
    restrictionViolations: summary.restrictionViolations ?? 0,
    blockedTasks: summary.blockedTasks ?? 0,
    blockedWithoutUnblockDate: summary.blockedWithoutUnblockDate ?? 0,
    lowConfidenceTasks: summary.lowConfidenceForecasts ?? 0,
    milestoneCount: summary.milestoneCount ?? 0,
    cycleDetected: Boolean(summary.cycleDetected),
    unresolvedDependencies: summary.unresolvedDependencies ?? 0,
    forecastConfidence: resolveAggregateForecastConfidence(summary, tasks),
    planStartDate: plan?.parameters?.startDate || null,
    generatedAt: plan?.generatedAt || null,
  };
}

module.exports = {
  maxEndDateIso,
  dayDiffIso,
  resolveAggregateForecastConfidence,
  buildHubGanttMetrics,
};
