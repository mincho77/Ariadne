'use strict';

function clampCapacity(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(12, Math.round(parsed)));
}

function normalizeAiOperators(operators) {
  if (!Array.isArray(operators)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of operators) {
    const id = String(raw?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      name: String(raw?.name || id).trim(),
      active: raw?.active !== false,
      maxParallel: clampCapacity(raw?.maxParallel, 1),
      hoursPerDay: Math.max(1, Math.min(24, Number(raw?.hoursPerDay) || 8)),
    });
  }
  return normalized;
}

function effectiveCapacityFromConfig(config, fallbackCapacity = 2) {
  const fallback = clampCapacity(fallbackCapacity, 2);
  if (!config || typeof config !== 'object') return fallback;

  const rawCapacity = config.capacity;
  if (rawCapacity && typeof rawCapacity === 'object') {
    return clampCapacity(rawCapacity.total, fallback);
  }

  const humanCapacity = clampCapacity(rawCapacity, fallback);
  const models = Array.isArray(config.aiModels) ? config.aiModels : [];
  const enabledModels = models.filter((model) => model?.enabled !== false);
  const modelSlots = Math.max(
    1,
    enabledModels.reduce((sum, model) => sum + clampCapacity(model.maxParallel, 1), 0),
  );

  const modelsNeedingOperator = enabledModels.filter((model) => Boolean(model.requiresOperator));
  const operators = normalizeAiOperators(config.operators);
  const activeOperatorSlots = operators
    .filter((operator) => operator.active)
    .reduce((sum, operator) => sum + clampCapacity(operator.maxParallel, 1), 0);
  const operatorBound = modelsNeedingOperator.length > 0
    ? Math.max(1, activeOperatorSlots || 1)
    : modelSlots;

  return Math.max(1, Math.min(humanCapacity, modelSlots, operatorBound));
}

function normalizeCapacityShape(raw, fallbackTotal = 2) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const total = clampCapacity(raw.total ?? raw.max ?? fallbackTotal, fallbackTotal);
    return {
      total,
      bugs: clampCapacity(raw.bugs ?? total, total),
      enhancements: clampCapacity(raw.enhancements ?? raw.mejoras ?? total, total),
    };
  }
  const total = clampCapacity(raw ?? fallbackTotal, fallbackTotal);
  return { total, bugs: total, enhancements: total };
}

function parseCapacityPolicy(config, options = {}) {
  const fallbackTotal = clampCapacity(options.fallbackCapacity ?? 2, 2);
  const queryOverride = options.capacity != null ? clampCapacity(options.capacity, fallbackTotal) : null;

  let total = queryOverride ?? effectiveCapacityFromConfig(config, fallbackTotal);
  let bugs = total;
  let enhancements = total;

  if (config && typeof config === 'object') {
    if (config.capacity && typeof config.capacity === 'object') {
      const shaped = normalizeCapacityShape(config.capacity, total);
      total = queryOverride ?? shaped.total;
      bugs = clampCapacity(shaped.bugs, total);
      enhancements = clampCapacity(shaped.enhancements, total);
    } else if (config.capacityBugs != null || config.capacityEnhancements != null) {
      bugs = clampCapacity(config.capacityBugs ?? total, total);
      enhancements = clampCapacity(config.capacityEnhancements ?? total, total);
    }
  }

  if (options.capacityBugs != null) bugs = clampCapacity(options.capacityBugs, total);
  if (options.capacityEnhancements != null) enhancements = clampCapacity(options.capacityEnhancements, total);

  bugs = Math.min(bugs, total);
  enhancements = Math.min(enhancements, total);

  return { total, bugs, enhancements };
}

function taskScheduleLane(task) {
  return String(task.type || '').toLowerCase() === 'bug' ? 'bugs' : 'mejoras';
}

function operationalTier(task) {
  const status = String(task.status || '').trim().toLowerCase();
  if (/^in progress$/.test(status)) return 0;
  if (status === 'queued') return 1;
  return 2;
}

function compareOperationalOrder(a, b, priorityRank) {
  const tierDiff = operationalTier(a) - operationalTier(b);
  if (tierDiff !== 0) return tierDiff;

  if (operationalTier(a) === 1) {
    const byOrdinal = (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER);
    if (byOrdinal !== 0) return byOrdinal;
    return String(a.title || '').localeCompare(String(b.title || ''), 'es');
  }

  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;
  const byOrdinal = (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER);
  if (byOrdinal !== 0) return byOrdinal;
  return String(a.title || '').localeCompare(String(b.title || ''), 'es');
}

function laneRunningCount(running, lane) {
  return running.filter((item) => item.lane === lane).length;
}

function canAcceptTask(running, lane, policy) {
  if (running.length >= policy.total) return false;
  const laneLimit = lane === 'bugs' ? policy.bugs : policy.enhancements;
  return laneRunningCount(running, lane) < laneLimit;
}

function normalizeCapacityConfigField(data, fallback = 2) {
  if (data?.capacity && typeof data.capacity === 'object') {
    return normalizeCapacityShape(data.capacity, fallback);
  }
  return clampCapacity(data?.capacity, fallback);
}

module.exports = {
  clampCapacity,
  normalizeAiOperators,
  effectiveCapacityFromConfig,
  parseCapacityPolicy,
  taskScheduleLane,
  operationalTier,
  compareOperationalOrder,
  laneRunningCount,
  canAcceptTask,
  normalizeCapacityConfigField,
};
