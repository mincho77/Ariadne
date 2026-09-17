'use strict';

const PACKS = {
  two: {
    id: 'two',
    label: 'two-pack',
    roles: ['coder', 'cleaner'],
    use: 'Tareas pequeñas backend / fixes acotados',
    modelHint: 'cheap',
  },
  four: {
    id: 'four',
    label: 'four-pack',
    roles: ['specifier', 'coder', 'cleaner', 'architect'],
    use: 'Spec + implementación con revisión de límites',
    modelHint: 'strong',
  },
  six: {
    id: 'six',
    label: 'six-pack',
    roles: ['specifier', 'coder', 'cleaner', 'architect', 'hardender', 'qa'],
    use: 'MVP / cambios mayores con endurecimiento y QA',
    modelHint: 'strong',
  },
};

function listPacks() {
  return Object.values(PACKS).map((pack) => ({
    id: pack.id,
    label: pack.label,
    roles: [...pack.roles],
    use: pack.use,
    modelHint: pack.modelHint,
  }));
}

function getPack(name) {
  const key = String(name || '').trim().toLowerCase().replace(/-pack$/, '');
  const pack = PACKS[key];
  if (!pack) {
    const error = new Error(`pack desconocido: ${name} (usa two|four|six)`);
    error.code = 'UNKNOWN_PACK';
    throw error;
  }
  return {
    id: pack.id,
    label: pack.label,
    roles: [...pack.roles],
    use: pack.use,
    modelHint: pack.modelHint,
  };
}

function modelHintForPack(packOrId) {
  if (packOrId && typeof packOrId === 'object' && packOrId.modelHint) {
    return packOrId.modelHint;
  }
  const pack = getPack(packOrId);
  return pack.modelHint;
}

/** Map route-hint modelTier → swarm modelHint (cheap|strong). */
function modelHintFromTier(tier) {
  const value = String(tier || '').toLowerCase();
  if (value === 'economy' || value === 'cheap' || value === 'lite') return 'cheap';
  return 'strong';
}

function haystack(task = {}) {
  const labels = (task.labels || []).map((item) => String(item).toLowerCase()).join(' ');
  return `${task.type || ''} ${task.title || ''} ${labels} ${task.priority || ''}`.toLowerCase();
}

function isBugTask(task = {}) {
  const text = haystack(task);
  return /\bbug\b/.test(text) || String(task.type || '').toLowerCase() === 'bug';
}

function isMvpSignal(task = {}) {
  return /\bmvp\b/.test(haystack(task));
}

function isEnhancementLike(task = {}) {
  const type = String(task.type || '').toLowerCase();
  if (type === 'enhancement' || type === 'feature' || type === 'task') return true;
  return /\b(mejora|enhancement|feature)\b/.test(haystack(task));
}

function priorityRank(priority) {
  const p = String(priority || '').toLowerCase();
  if (p.includes('ultra')) return 4;
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  if (p === 'low') return 1;
  return 0;
}

/**
 * Automatic pack policy (AH-E-45):
 * bug → two; mejora High → four; Ultra / MVP → six; else two (cheap).
 */
function recommendPackPolicy(task = {}) {
  if (isBugTask(task)) {
    return {
      pack: getPack('two'),
      modelHint: 'cheap',
      reason: 'bug → two-pack (cheap)',
    };
  }
  if (isMvpSignal(task) || priorityRank(task.priority) >= 4) {
    return {
      pack: getPack('six'),
      modelHint: 'strong',
      reason: isMvpSignal(task) ? 'MVP signal → six-pack (strong)' : 'Ultra priority → six-pack (strong)',
    };
  }
  if (isEnhancementLike(task) && priorityRank(task.priority) >= 3) {
    return {
      pack: getPack('four'),
      modelHint: 'strong',
      reason: 'mejora/feature High → four-pack (strong)',
    };
  }
  if (priorityRank(task.priority) >= 3) {
    return {
      pack: getPack('four'),
      modelHint: 'strong',
      reason: 'High priority → four-pack (strong)',
    };
  }
  return {
    pack: getPack('two'),
    modelHint: 'cheap',
    reason: 'default small task → two-pack (cheap)',
  };
}

function suggestPack(task = {}) {
  return recommendPackPolicy(task).pack;
}

module.exports = {
  PACKS,
  listPacks,
  getPack,
  suggestPack,
  recommendPackPolicy,
  modelHintForPack,
  modelHintFromTier,
};
