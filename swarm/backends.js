'use strict';

/**
 * Suggested execution backends per swarm role (AH-E-51).
 * Ariadne always owns Queue / Doing / Done / evidence — backends only execute slices.
 */

const BACKENDS = {
  cursor: {
    id: 'cursor',
    label: 'Cursor Agent',
    invoke: 'Cursor chat / Agent con skills ariadne + ariadne-swarm',
  },
  claude: {
    id: 'claude',
    label: 'Claude CLI',
    invoke: 'claude (Anthropic CLI) en worktree del rol',
  },
  codex: {
    id: 'codex',
    label: 'Codex CLI',
    invoke: 'codex exec / IDE agent en worktree del rol',
  },
};

/**
 * Default recommendations: strong model for spec/arch/qa; cheaper OK for cleaner.
 * `primary` is the preferred backend; `also` are acceptable alternatives.
 */
const ROLE_BACKENDS = {
  specifier: {
    role: 'specifier',
    primary: 'cursor',
    also: ['claude', 'codex'],
    modelHint: 'strong',
    notes: 'AC binarios + aprobación humana antes de coder',
  },
  coder: {
    role: 'coder',
    primary: 'cursor',
    also: ['claude', 'codex'],
    modelHint: 'strong',
    notes: 'Implementación + tests en worktree; no Done',
  },
  cleaner: {
    role: 'cleaner',
    primary: 'codex',
    also: ['cursor', 'claude'],
    modelHint: 'cheap',
    notes: 'Refactor behavior-preserving; tests verdes',
  },
  architect: {
    role: 'architect',
    primary: 'claude',
    also: ['cursor', 'codex'],
    modelHint: 'strong',
    notes: 'Límites de módulos; puede pedir rework al coder',
  },
  hardender: {
    role: 'hardender',
    primary: 'codex',
    also: ['cursor', 'claude'],
    modelHint: 'strong',
    notes: 'Endurecimiento; prepara gate lint+test',
  },
  qa: {
    role: 'qa',
    primary: 'cursor',
    also: ['codex', 'claude'],
    modelHint: 'cheap',
    notes: 'Corre lint/test; solo Ariadne marca Done con evidencia',
  },
};

function listBackends() {
  return Object.values(BACKENDS).map((item) => ({ ...item }));
}

function listRoleBackends() {
  return Object.values(ROLE_BACKENDS).map((row) => ({
    ...row,
    primaryLabel: BACKENDS[row.primary]?.label || row.primary,
    alsoLabels: row.also.map((id) => BACKENDS[id]?.label || id),
  }));
}

function backendForRole(role) {
  const key = String(role || '').trim().toLowerCase();
  const row = ROLE_BACKENDS[key];
  if (!row) {
    const error = new Error(`rol desconocido para backend: ${role}`);
    error.code = 'UNKNOWN_ROLE';
    throw error;
  }
  return {
    ...row,
    backend: BACKENDS[row.primary],
    alternatives: row.also.map((id) => BACKENDS[id]).filter(Boolean),
  };
}

/**
 * Invariant: only Ariadne CLI/Hub may authorize Done.
 */
function governanceNote() {
  return {
    owner: 'ariadne',
    controls: ['Queue', 'Doing', 'Done', 'evidence', 'ledger checkpoint'],
    backendsMustNot: [
      'marcar Done sin npm run swarm -- complete --evidence',
      'saltar Queue / deps FS',
      'escribir forecast_* ni inventar estados Kanban',
    ],
    completeCommand: 'npm run swarm -- complete --task <id> --evidence "…" [--qa]',
  };
}

function renderBackendsMarkdown() {
  const lines = [
    '# Backends por rol',
    '',
    'Ariadne **gobierna** Queue → Doing → evidencia → Done.',
    'Los backends (Cursor / Claude / Codex) solo **ejecutan** el slice del rol en un worktree.',
    '',
    '## Tabla',
    '',
    '| Rol | Backend primario | Alternativas | modelHint | Notas |',
    '|-----|------------------|--------------|-----------|-------|',
  ];
  for (const row of listRoleBackends()) {
    lines.push(
      `| ${row.role} | ${row.primary} | ${row.also.join(', ')} | ${row.modelHint} | ${row.notes} |`,
    );
  }
  const gov = governanceNote();
  lines.push(
    '',
    '## Gobierno (invariante)',
    '',
    `- Dueño: **${gov.owner}** — ${gov.controls.join(', ')}.`,
    `- Cierre: \`${gov.completeCommand}\``,
    `- Backends no deben: ${gov.backendsMustNot.map((item) => `\`${item}\``).join('; ')}.`,
    '',
  );
  return `${lines.join('\n')}\n`;
}

module.exports = {
  BACKENDS,
  ROLE_BACKENDS,
  listBackends,
  listRoleBackends,
  backendForRole,
  governanceNote,
  renderBackendsMarkdown,
};
