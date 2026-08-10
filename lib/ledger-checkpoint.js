'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  cells,
  parseMasterRows,
  findStaleNextActionRefs,
  applyLedgerFixes,
} = require('./ledger-hygiene');
const {
  extractBacklogIds,
  indexBacklog,
  parseControlNextAction,
} = require('./ledger-backlog-drift');

function kanbanToLedgerState(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'done') return 'hecho';
  if (value === 'in progress') return 'en_progreso';
  if (value === 'queued' || value === 'to do') return 'pendiente';
  return null;
}

function stampToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rebuildRow(parts) {
  return `| ${parts.join(' | ')} |`;
}

function suggestControlNextAction(backlogIndex) {
  const open = [...backlogIndex.values()].filter((card) => {
    if (card.lane !== 'tasks') return false;
    return !/^done$/i.test(card.status);
  });
  const queued = open
    .filter((card) => /^queued$/i.test(card.status))
    .sort((a, b) => (a.ordinal ?? 1e9) - (b.ordinal ?? 1e9));
  const head = queued[0] || open.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (!head) return 'Cola vacía — sembrar o cerrar programa.';
  return `${head.id} (${head.status})`;
}

function applyCheckpoint(ledgerText, backlogIndex, { now = stampToday() } = {}) {
  const changes = [];
  let next = ledgerText;
  const { rows } = parseMasterRows(next);

  for (const { line, cells: row } of rows) {
    if (row.length < 4) continue;
    const cited = extractBacklogIds(row[2] || '');
    if (!cited.length) continue;
    const taskId = cited[0];
    const card = backlogIndex.get(taskId);
    if (!card) continue;
    const desired = kanbanToLedgerState(card.status);
    if (!desired) continue;
    const parts = [...row];
    let changed = false;
    if (String(parts[3]).toLowerCase() !== desired) {
      parts[3] = desired;
      changed = true;
    }
    if (desired === 'hecho' && parts.length >= 8 && parts[7] !== '—') {
      parts[7] = '—';
      changed = true;
    }
    if (desired === 'hecho' && parts.length >= 7) {
      const evidence = String(parts[6] || '').trim();
      if (!evidence || evidence === '—' || evidence.toLowerCase() === 'ok') {
        parts[6] = `Kanban ${taskId} Done · checkpoint`;
        changed = true;
      }
    }
    if (changed) {
      const replacement = rebuildRow(parts);
      if (next.includes(line)) {
        next = next.replace(line, replacement);
        changes.push({
          programId: parts[0],
          taskId,
          from: row[3],
          to: desired,
          kanbanStatus: card.status,
        });
      }
    }
  }

  const stale = findStaleNextActionRefs(next);
  if (stale.length) {
    next = applyLedgerFixes(next, stale);
    changes.push({ hygiene: stale.length });
  }

  const suggestedNext = suggestControlNextAction(backlogIndex);
  const currentNext = parseControlNextAction(next);
  if (suggestedNext && currentNext !== suggestedNext) {
    if (/^-\s*Próxima acción:/mi.test(next)) {
      next = next.replace(/^-\s*Próxima acción:\s*.+$/mi, `- Próxima acción: ${suggestedNext}`);
    } else if (/^-\s*Gate actual:/mi.test(next)) {
      next = next.replace(
        /^(-\s*Gate actual:\s*.+)$/mi,
        `$1\n- Próxima acción: ${suggestedNext}`,
      );
    }
    changes.push({ controlNextAction: suggestedNext, previous: currentNext || null });
  }

  if (/^-\s*Última actualización:/mi.test(next)) {
    next = next.replace(/^-\s*Última actualización:\s*.+$/mi, `- Última actualización: ${now}`);
  }

  return { text: next, changes, suggestedNext };
}

function checkpointLedgerFile(ledgerPath, { backlogRoot, dryRun = false } = {}) {
  let root = backlogRoot;
  if (!root) {
    let cursor = path.dirname(ledgerPath);
    for (let i = 0; i < 5; i += 1) {
      if (fs.existsSync(path.join(cursor, 'backlog', 'tasks'))) {
        root = cursor;
        break;
      }
      cursor = path.dirname(cursor);
    }
  }
  if (!root) throw new Error('backlog root not found');

  const original = fs.readFileSync(ledgerPath, 'utf8');
  const index = indexBacklog(root);
  // attach ordinals if present in files
  for (const [id, card] of index) {
    try {
      const text = fs.readFileSync(card.file, 'utf8');
      const ord = text.match(/^ordinal:\s*['"]?(\d+)/mi);
      if (ord) card.ordinal = Number(ord[1]);
    } catch {
      /* ignore */
    }
  }

  const result = applyCheckpoint(original, index);
  if (!dryRun && result.text !== original) {
    fs.writeFileSync(ledgerPath, result.text.endsWith('\n') ? result.text : `${result.text}\n`, 'utf8');
  }
  return {
    ledger: ledgerPath,
    backlogRoot: root,
    dryRun,
    written: !dryRun && result.text !== original,
    changes: result.changes,
    suggestedNext: result.suggestedNext,
  };
}

module.exports = {
  kanbanToLedgerState,
  suggestControlNextAction,
  applyCheckpoint,
  checkpointLedgerFile,
  stampToday,
};
