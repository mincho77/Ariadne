'use strict';

const { getFrontmatterList, getFrontmatterNumber, getFrontmatterField } = require('../task-markdown');
const { resolveEffectiveStartField, resolveEffectiveDeadlineField } = require('../task-temporal');
const { parseBooleanField, toDateOnlyIso } = require('./restrictions');
const { parseDependencySpec } = require('./dependencies');
const { buildProgressSnapshot, resolveEffectiveDurationIaHours } = require('./progress');
const { parseBlockFields } = require('./blocks');

function isDoneStatus(status) {
  return /done|complete/i.test(String(status || ''));
}

function defaultDurationByPriority(priority) {
  const key = String(priority || '').toLowerCase();
  if (key === 'ultra high') return 4;
  if (key === 'high') return 3;
  if (key === 'low') return 1;
  return 2;
}

function estimateTaskDurationDays(task) {
  const fromEstimate = getFrontmatterNumber(task.source, 'estimate_days')
    ?? getFrontmatterNumber(task.source, 'effort_days')
    ?? getFrontmatterNumber(task.source, 'duration_days');
  if (fromEstimate && fromEstimate > 0) return Math.max(1, Math.round(fromEstimate));
  return defaultDurationByPriority(task.priority);
}

function estimateTaskIaHours(task, iaHoursPerDay) {
  const fromHours = getFrontmatterNumber(task.source, 'estimate_ia_hours')
    ?? getFrontmatterNumber(task.source, 'estimate_hours')
    ?? getFrontmatterNumber(task.source, 'effort_hours')
    ?? getFrontmatterNumber(task.source, 'duration_hours');
  if (fromHours && fromHours > 0) return Math.max(1, Math.round(fromHours));
  return estimateTaskDurationDays(task) * iaHoursPerDay;
}

function parseDateStamp(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  const normalized = input.includes('T') ? input : input.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(value) {
  if (!value) return null;
  return toDateOnlyIso(value);
}

function toPlanningTask(task, iaHoursPerDay) {
  const dependencyLinks = getFrontmatterList(task.source, 'dependencies')
    .map((item) => parseDependencySpec(item, iaHoursPerDay))
    .filter((item) => item && item.id);
  const dependencies = dependencyLinks.map((item) => item.id);
  const createdDate = parseDateStamp(getFrontmatterField(task.source, 'created_date')) || parseDateStamp(task.createdDate);
  const updatedDate = parseDateStamp(getFrontmatterField(task.source, 'updated_date'));
  const startedDate = parseDateStamp(resolveEffectiveStartField(task.source)) || createdDate;
  const dueDate = parseDateStamp(resolveEffectiveDeadlineField(task.source));
  const actualStart = parseDateStamp(getFrontmatterField(task.source, 'actual_start'));
  const actualFinish = parseDateStamp(getFrontmatterField(task.source, 'actual_finish'));
  const notBeforeIso = toIsoDate(parseDateStamp(getFrontmatterField(task.source, 'not_before')));
  const deadlineIso = toIsoDate(parseDateStamp(resolveEffectiveDeadlineField(task.source)));
  const targetFinishIso = toIsoDate(parseDateStamp(getFrontmatterField(task.source, 'target_finish')));
  const plannedStartIso = toIsoDate(parseDateStamp(getFrontmatterField(task.source, 'planned_start')));
  const plannedFinishIso = toIsoDate(parseDateStamp(getFrontmatterField(task.source, 'planned_finish')
    || parseDateStamp(getFrontmatterField(task.source, 'target_finish'))));
  const fixed = parseBooleanField(getFrontmatterField(task.source, 'fixed'));
  const blockMeta = parseBlockFields(task);
  const baselineEstimateIaHours = estimateTaskIaHours(task, iaHoursPerDay);
  const progressMeta = buildProgressSnapshot(task, iaHoursPerDay, baselineEstimateIaHours);
  const durationIaHours = resolveEffectiveDurationIaHours(task, iaHoursPerDay, baselineEstimateIaHours);
  return {
    ...task,
    durationDays: durationIaHours <= 0 ? 0 : Math.max(1, Math.round(durationIaHours / iaHoursPerDay)),
    durationIaHours: Math.max(0, durationIaHours),
    baselineEstimateIaHours: progressMeta.baselineEstimateIaHours,
    remainingIaHours: progressMeta.remainingIaHours,
    executedIaHours: progressMeta.executedIaHours,
    progress: progressMeta.progress,
    progressDeclared: progressMeta.progressDeclared,
    progressSuggestedFromChecklist: progressMeta.progressSuggestedFromChecklist,
    remainingDeclared: progressMeta.remainingDeclared,
    durationSource: progressMeta.durationSource,
    dependencies,
    dependencyLinks,
    createdDate,
    startedDate,
    actualStart,
    actualFinish,
    notBeforeIso,
    deadlineIso,
    targetFinishIso,
    plannedStartIso,
    plannedFinishIso,
    fixed,
    ...blockMeta,
    updatedDate,
    dueDate,
  };
}

module.exports = {
  isDoneStatus,
  defaultDurationByPriority,
  estimateTaskDurationDays,
  estimateTaskIaHours,
  toPlanningTask,
  parseDateStamp,
};
