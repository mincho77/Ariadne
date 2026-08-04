'use strict';

const { getFrontmatterList, getFrontmatterNumber, getFrontmatterField } = require('../task-markdown');
const { parseDependencySpec } = require('./dependencies');

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

function toPlanningTask(task, iaHoursPerDay) {
  const dependencyLinks = getFrontmatterList(task.source, 'dependencies')
    .map((item) => parseDependencySpec(item, iaHoursPerDay))
    .filter((item) => item && item.id);
  const dependencies = dependencyLinks.map((item) => item.id);
  const createdDate = parseDateStamp(getFrontmatterField(task.source, 'created_date')) || parseDateStamp(task.createdDate);
  const updatedDate = parseDateStamp(getFrontmatterField(task.source, 'updated_date'));
  const startedDate = parseDateStamp(getFrontmatterField(task.source, 'started_date')) || createdDate;
  const dueDate = parseDateStamp(getFrontmatterField(task.source, 'due_date'));
  const durationIaHours = estimateTaskIaHours(task, iaHoursPerDay);
  return {
    ...task,
    durationDays: Math.max(1, Math.round(durationIaHours / iaHoursPerDay)),
    durationIaHours,
    dependencies,
    dependencyLinks,
    createdDate,
    startedDate,
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
