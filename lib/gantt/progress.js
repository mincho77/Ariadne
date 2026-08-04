'use strict';

const { getFrontmatterNumber } = require('../task-markdown');
const { isDoneStatus } = require('../task-temporal');

function stripFrontmatter(source) {
  return String(source || '').replace(/^---[\s\S]*?---\s*/m, '');
}

function countChecklistItems(source) {
  const body = stripFrontmatter(source);
  let done = 0;
  let total = 0;
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*-\s+\[([ xX])\]\s+/);
    if (!match) continue;
    total += 1;
    if (match[1].toLowerCase() === 'x') done += 1;
  }
  return { done, total };
}

function suggestProgressFromChecklist(source) {
  const { done, total } = countChecklistItems(source);
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

function resolveEffectiveProgress(task) {
  if (isDoneStatus(task.status)) return 100;
  const explicit = getFrontmatterNumber(task.source, 'progress');
  if (explicit != null && Number.isFinite(explicit)) {
    return Math.min(100, Math.max(0, Math.round(explicit)));
  }
  return null;
}

function resolveProgressForForecast(task) {
  const explicit = resolveEffectiveProgress(task);
  if (explicit != null) return explicit;
  return suggestProgressFromChecklist(task.source);
}

function resolveEffectiveDurationIaHours(task, iaHoursPerDay, baselineEstimateIaHours) {
  if (isDoneStatus(task.status)) return 0;
  if (!Number.isFinite(baselineEstimateIaHours) || baselineEstimateIaHours <= 0) {
    throw new Error('baselineEstimateIaHours es requerido');
  }

  const remainingExplicit = getFrontmatterNumber(task.source, 'remaining_ia_hours');
  if (remainingExplicit != null && Number.isFinite(remainingExplicit)) {
    if (remainingExplicit <= 0) return 0;
    return Math.max(1, Math.round(remainingExplicit));
  }

  const progress = resolveProgressForForecast(task);
  if (progress != null && progress > 0 && progress < 100) {
    return Math.max(1, Math.round(baselineEstimateIaHours * (1 - progress / 100)));
  }

  return baselineEstimateIaHours;
}

function buildProgressSnapshot(task, iaHoursPerDay, baselineEstimateIaHours) {
  const remainingIaHours = resolveEffectiveDurationIaHours(task, iaHoursPerDay, baselineEstimateIaHours);
  const progressSuggestedFromChecklist = suggestProgressFromChecklist(task.source);
  const progressDeclared = getFrontmatterNumber(task.source, 'progress');
  const remainingDeclared = getFrontmatterNumber(task.source, 'remaining_ia_hours');

  return {
    baselineEstimateIaHours,
    remainingIaHours,
    executedIaHours: Math.max(0, baselineEstimateIaHours - remainingIaHours),
    progress: resolveEffectiveProgress(task),
    progressDeclared: progressDeclared != null ? Math.round(progressDeclared) : null,
    progressSuggestedFromChecklist,
    remainingDeclared: remainingDeclared != null ? Math.round(remainingDeclared) : null,
    durationSource: remainingDeclared != null && remainingDeclared >= 0
      ? 'remaining_ia_hours'
      : (progressDeclared != null || resolveEffectiveProgress(task) != null)
        ? 'progress'
        : (progressSuggestedFromChecklist != null ? 'checklist_suggestion' : 'estimate'),
  };
}

module.exports = {
  countChecklistItems,
  suggestProgressFromChecklist,
  resolveEffectiveProgress,
  resolveProgressForForecast,
  resolveEffectiveDurationIaHours,
  buildProgressSnapshot,
};
