'use strict';

/**
 * Named Acceptance Criteria templates for task creation.
 */

const AC_TEMPLATES = {
  bug: {
    id: 'bug',
    label: 'Bug',
    description: 'Repro → fix → verify',
    acceptanceCriteria: [
      'Se reproduce el fallo (pasos o evidencia)',
      'Causa raíz identificada o acotada',
      'Fix verificado (test o prueba manual)',
      'Sin regresión obvia en el camino feliz',
    ],
  },
  enhancement: {
    id: 'enhancement',
    label: 'Mejora',
    description: 'Comportamiento + prueba + evidencia',
    acceptanceCriteria: [
      'Comportamiento observable documentado',
      'Criterios binarios (pass/fail) listados',
      'Prueba o smoke que demuestre el cambio',
      'Evidencia en ## Evidence / ## Closeout al Done',
    ],
  },
  feature: {
    id: 'feature',
    label: 'Feature',
    description: 'Entrega usable + tests',
    acceptanceCriteria: [
      'Usuario puede completar el flujo principal',
      'Casos borde / error manejados',
      'Tests o smoke automatizado donde aplique',
      'Docs o nota operativa actualizada si cambia el uso',
    ],
  },
  swarm: {
    id: 'swarm',
    label: 'Swarm / Hub',
    description: 'AC orientados a queue → evidencia',
    acceptanceCriteria: [
      'API o CLI documentada y ejecutable',
      'Tests unitarios o smoke del cambio',
      'Evidencia mínima al complete (comando + resultado)',
    ],
  },
  minimal: {
    id: 'minimal',
    label: 'Mínima',
    description: 'Un solo criterio de cierre',
    acceptanceCriteria: [
      'Criterio de done explícito y verificable',
    ],
  },
  none: {
    id: 'none',
    label: 'Sin plantilla',
    description: 'Sin AC (solo Description)',
    acceptanceCriteria: [],
  },
};

function listAcTemplates() {
  return Object.values(AC_TEMPLATES).map(({ id, label, description, acceptanceCriteria }) => ({
    id,
    label,
    description,
    count: acceptanceCriteria.length,
    acceptanceCriteria: [...acceptanceCriteria],
  }));
}

function resolveAcTemplate(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'mejora') return AC_TEMPLATES.enhancement;
  if (key === 'empty') return AC_TEMPLATES.none;
  return AC_TEMPLATES[key] || null;
}

function defaultTemplateForDraft({ type, labels, title } = {}) {
  const haystack = `${type || ''} ${(labels || []).join(' ')} ${title || ''}`.toLowerCase();
  if (/\bbug\b/.test(haystack) || type === 'bug') return 'bug';
  if (/swarm|hub|ariadne/.test(haystack)) return 'swarm';
  if (type === 'feature') return 'feature';
  if (type === 'enhancement' || type === 'task') return 'enhancement';
  return 'minimal';
}

/**
 * Resolve final AC list for createTask options.
 * Priority: explicit acceptanceCriteria > template > default by type.
 */
function resolveAcceptanceCriteria(options = {}) {
  if (Array.isArray(options.acceptanceCriteria) && options.acceptanceCriteria.length) {
    return {
      template: options.template || 'custom',
      acceptanceCriteria: options.acceptanceCriteria.map((item) => String(item).trim()).filter(Boolean),
    };
  }

  const explicit = options.template != null && String(options.template).trim() !== '';
  const templateId = explicit
    ? String(options.template).trim().toLowerCase()
    : (options.skipDefaultTemplate ? 'none' : defaultTemplateForDraft(options));

  const resolved = resolveAcTemplate(templateId);
  if (!resolved) {
    throw new Error(`plantilla AC desconocida: ${templateId} (usa: ${Object.keys(AC_TEMPLATES).join(', ')})`);
  }
  return {
    template: resolved.id,
    acceptanceCriteria: [...resolved.acceptanceCriteria],
  };
}

module.exports = {
  AC_TEMPLATES,
  listAcTemplates,
  resolveAcTemplate,
  defaultTemplateForDraft,
  resolveAcceptanceCriteria,
};
