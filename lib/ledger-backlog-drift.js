'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseMasterRows } = require('./ledger-hygiene');

/** Backlog.md-style execution IDs (AH-E-40, PD-B-12, …). */
const BACKLOG_TASK_ID_RE = /\b([A-Z]{2,}-[BE]-\d+)\b/g;
const OPEN_LEDGER_STATES = new Set(['pendiente', 'en_progreso', 'bloqueado']);

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((part) => part.trim());
}

function extractBacklogIds(text) {
  const ids = new Set();
  const source = String(text || '');
  for (const match of source.matchAll(BACKLOG_TASK_ID_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}

function readTaskIdAndStatus(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const idMatch = text.match(/^id:\s*['"]?([A-Z]{2,}-[BE]-\d+)['"]?\s*$/mi);
  const statusMatch = text.match(/^status:\s*['"]?([^'"\n]+)['"]?\s*$/mi);
  if (!idMatch) return null;
  return {
    id: idMatch[1],
    status: (statusMatch ? statusMatch[1] : '').trim(),
    file: filePath,
  };
}

function indexBacklog(backlogRoot) {
  const byId = new Map();
  for (const dir of ['tasks', 'completed', 'archive']) {
    const full = path.join(backlogRoot, 'backlog', dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).filter((item) => item.endsWith('.md'))) {
      try {
        const parsed = readTaskIdAndStatus(path.join(full, name));
        if (!parsed) continue;
        byId.set(parsed.id, { ...parsed, lane: dir });
      } catch {
        /* ignore malformed */
      }
    }
  }
  return byId;
}

function parseControlNextAction(text) {
  const match = text.match(/^-+\s*Próxima acción:\s*(.+)$/mi)
    || text.match(/^-\s*Próxima acción:\s*(.+)$/mi);
  return match ? match[1].trim() : '';
}

/**
 * Invariant: the ledger must not invent open work that is absent from Kanban.
 * Every Backlog task ID cited by an open Registro row (or Control próxima acción)
 * must exist as a Kanban card.
 */
function findLedgerBacklogDrift(ledgerText, backlogIndex) {
  const issues = [];
  const { rows } = parseMasterRows(ledgerText);

  for (const { cells: row } of rows) {
    if (row.length < 4) continue;
    const programId = row[0];
    const tarea = row[2] || '';
    const state = String(row[3] || '').toLowerCase();
    if (!OPEN_LEDGER_STATES.has(state)) continue;

    const cited = extractBacklogIds(tarea);
    if (!cited.length) continue;

    for (const taskId of cited) {
      const card = backlogIndex.get(taskId);
      if (!card) {
        issues.push({
          code: 'LEDGER_WITHOUT_KANBAN',
          severity: 'error',
          programId,
          taskId,
          state,
          message: `${programId} (${state}) cita ${taskId} pero no hay tarjeta en backlog/`,
        });
        continue;
      }
      if (/^done$/i.test(card.status) || card.lane !== 'tasks') {
        issues.push({
          code: 'LEDGER_OPEN_KANBAN_DONE',
          severity: 'error',
          programId,
          taskId,
          state,
          kanbanStatus: card.status,
          kanbanLane: card.lane,
          message: `${programId} sigue ${state} pero ${taskId} está ${card.status} (${card.lane})`,
        });
      }
    }
  }

  const nextAction = parseControlNextAction(ledgerText);
  for (const taskId of extractBacklogIds(nextAction)) {
    const card = backlogIndex.get(taskId);
    if (!card) {
      issues.push({
        code: 'CONTROL_NEXT_WITHOUT_KANBAN',
        severity: 'error',
        taskId,
        message: `Control «Próxima acción» cita ${taskId} sin tarjeta en backlog/`,
      });
      continue;
    }
    if (/^done$/i.test(card.status) || card.lane !== 'tasks') {
      issues.push({
        code: 'CONTROL_NEXT_KANBAN_DONE',
        severity: 'warning',
        taskId,
        kanbanStatus: card.status,
        message: `Control «Próxima acción» cita ${taskId} que ya está ${card.status}`,
      });
    }
  }

  return issues;
}

function auditLedgerBacklogDrift(ledgerPath, { backlogRoot } = {}) {
  const root = backlogRoot || path.dirname(path.dirname(path.dirname(ledgerPath)));
  // docs/plans/foo.md → prefer explicit backlogRoot; default walk up to repo with backlog/
  let resolved = backlogRoot;
  if (!resolved) {
    let cursor = path.dirname(ledgerPath);
    for (let i = 0; i < 5; i += 1) {
      if (fs.existsSync(path.join(cursor, 'backlog', 'tasks'))) {
        resolved = cursor;
        break;
      }
      cursor = path.dirname(cursor);
    }
  }
  if (!resolved) {
    return {
      ledger: ledgerPath,
      backlogRoot: null,
      issues: [{
        code: 'NO_BACKLOG_ROOT',
        severity: 'error',
        message: 'No se encontró backlog/tasks relativo al ledger',
      }],
      ok: false,
    };
  }

  const text = fs.readFileSync(ledgerPath, 'utf8');
  const index = indexBacklog(resolved);
  const issues = findLedgerBacklogDrift(text, index);
  const errors = issues.filter((issue) => issue.severity === 'error');
  return {
    ledger: ledgerPath,
    backlogRoot: resolved,
    issues,
    ok: errors.length === 0,
  };
}

module.exports = {
  BACKLOG_TASK_ID_RE,
  extractBacklogIds,
  indexBacklog,
  findLedgerBacklogDrift,
  auditLedgerBacklogDrift,
  parseControlNextAction,
  cells,
};
