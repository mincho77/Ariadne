'use strict';

const crypto = require('node:crypto');
const {
  splitTaskDocument,
  composeTaskDocument,
  getFrontmatterField,
  upsertFrontmatterScalar,
  upsertFrontmatterList,
} = require('./task-markdown');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PATCH_ALIASES = {
  estimateIaHours: 'estimate_ia_hours',
  estimate_ia_hours: 'estimate_ia_hours',
  estimate_hours: 'estimate_ia_hours',
  estimateDays: 'estimate_days',
  estimate_days: 'estimate_days',
  startedDate: 'started_date',
  started_date: 'started_date',
  dueDate: 'due_date',
  due_date: 'due_date',
  actualStart: 'actual_start',
  actual_start: 'actual_start',
  actualFinish: 'actual_finish',
  actual_finish: 'actual_finish',
  plannedStart: 'planned_start',
  planned_start: 'planned_start',
  plannedFinish: 'planned_finish',
  planned_finish: 'planned_finish',
  targetStart: 'target_start',
  target_start: 'target_start',
  targetFinish: 'target_finish',
  target_finish: 'target_finish',
  deadline: 'deadline',
  notBefore: 'not_before',
  not_before: 'not_before',
  remainingHours: 'remaining_ia_hours',
  remaining_ia_hours: 'remaining_ia_hours',
  remaining_hours: 'remaining_ia_hours',
  blockedReason: 'blocked_reason',
  blocked_reason: 'blocked_reason',
  blockedUntil: 'blocked_until',
  blocked_until: 'blocked_until',
  assignees: 'assignee',
  assignee: 'assignee',
  progress: 'progress',
  fixed: 'fixed',
  blocked: 'blocked',
  epic: 'epic',
};

const DATE_FIELDS = new Set([
  'started_date',
  'due_date',
  'actual_start',
  'actual_finish',
  'planned_start',
  'planned_finish',
  'target_start',
  'target_finish',
  'deadline',
  'not_before',
  'blocked_until',
]);

const INTEGER_FIELDS = new Set(['estimate_ia_hours', 'estimate_days', 'remaining_ia_hours', 'progress']);
const BOOLEAN_FIELDS = new Set(['fixed', 'blocked']);
const LIST_FIELDS = new Set(['assignee']);

function todayDateStamp(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeSourceHash(source) {
  return crypto.createHash('sha256').update(String(source || ''), 'utf8').digest('hex').slice(0, 16);
}

function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeDateField(field, raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return { clear: true };
  const value = String(raw).trim();
  if (!DATE_RE.test(value)) throw new Error(`${field} debe tener formato YYYY-MM-DD`);
  return { value };
}

function normalizeIntegerField(field, raw, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return { clear: true };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${field} debe ser un número`);
  const rounded = Math.round(parsed);
  if (rounded < min || rounded > max) throw new Error(`${field} debe estar entre ${min} y ${max}`);
  return { value: rounded };
}

function normalizeBooleanField(field, raw) {
  if (raw === null || raw === undefined || raw === '') return { clear: true };
  if (typeof raw === 'boolean') return { value: raw };
  const key = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'si', 'sí'].includes(key)) return { value: true };
  if (['0', 'false', 'no'].includes(key)) return { value: false };
  throw new Error(`${field} debe ser booleano`);
}

function normalizeTaskPatch(input) {
  const updates = input && typeof input === 'object' ? input : {};
  const patch = {};
  const seenCanonical = new Set();

  for (const [rawKey, rawValue] of Object.entries(updates)) {
    const canonical = PATCH_ALIASES[rawKey];
    if (!canonical) continue;
    if (seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);

    if (LIST_FIELDS.has(canonical)) {
      patch[canonical] = parseListValue(rawValue);
      continue;
    }

    if (DATE_FIELDS.has(canonical)) {
      const normalized = normalizeDateField(canonical, rawValue);
      patch[canonical] = normalized.clear ? null : normalized.value;
      continue;
    }

    if (INTEGER_FIELDS.has(canonical)) {
      const bounds = canonical === 'progress' ? { min: 0, max: 100 } : { min: 1, max: Number.MAX_SAFE_INTEGER };
      const normalized = normalizeIntegerField(canonical, rawValue, bounds);
      patch[canonical] = normalized.clear ? null : normalized.value;
      continue;
    }

    if (BOOLEAN_FIELDS.has(canonical)) {
      const normalized = normalizeBooleanField(canonical, rawValue);
      patch[canonical] = normalized.clear ? null : normalized.value;
      continue;
    }

    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
      patch[canonical] = null;
    } else {
      patch[canonical] = String(rawValue).trim();
    }
  }

  return patch;
}

function applyTaskPatchToSource(source, patch) {
  let next = String(source || '');
  for (const [field, value] of Object.entries(patch || {})) {
    if (LIST_FIELDS.has(field)) {
      next = upsertFrontmatterList(next, field, Array.isArray(value) ? value : []);
      continue;
    }
    if (value === null) {
      const { frontmatter, body } = splitTaskDocument(next);
      delete frontmatter[field];
      next = composeTaskDocument(frontmatter, body);
      continue;
    }
    if (typeof value === 'boolean') {
      next = upsertFrontmatterScalar(next, field, value ? 'true' : 'false');
      continue;
    }
    next = upsertFrontmatterScalar(next, field, value);
  }
  return next;
}

function isInProgressStatus(status) {
  return /^in progress$/i.test(String(status || ''));
}

function isDoneStatus(status) {
  return /done|complete/i.test(String(status || ''));
}

function buildKanbanTemporalPatch(source, { fromStatus, toStatus, now = new Date() } = {}) {
  const patch = {};
  const today = todayDateStamp(now);
  const actualStart = getFrontmatterField(source, 'actual_start');
  const actualFinish = getFrontmatterField(source, 'actual_finish');

  if (isInProgressStatus(toStatus) && !isInProgressStatus(fromStatus) && !actualStart) {
    patch.actual_start = today;
  }

  if (isDoneStatus(toStatus) && !isDoneStatus(fromStatus)) {
    if (!actualStart) patch.actual_start = today;
    if (!actualFinish) patch.actual_finish = today;
    patch.progress = 100;
  }

  return patch;
}

function resolveEffectiveStartField(source) {
  return getFrontmatterField(source, 'actual_start')
    || getFrontmatterField(source, 'started_date')
    || getFrontmatterField(source, 'planned_start')
    || getFrontmatterField(source, 'created_date');
}

function resolveEffectiveDeadlineField(source) {
  return getFrontmatterField(source, 'deadline')
    || getFrontmatterField(source, 'due_date')
    || getFrontmatterField(source, 'target_finish');
}

module.exports = {
  PATCH_ALIASES,
  DATE_FIELDS,
  todayDateStamp,
  computeSourceHash,
  normalizeTaskPatch,
  applyTaskPatchToSource,
  buildKanbanTemporalPatch,
  resolveEffectiveStartField,
  resolveEffectiveDeadlineField,
  isInProgressStatus,
  isDoneStatus,
};
