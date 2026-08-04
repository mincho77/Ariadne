'use strict';

const fs = require('node:fs');

const ID_RE = /^(?:[A-Z]{2,}-[BE]-\d+|[A-Z][A-Z0-9-]*-\d{3}(?:\.\d+)*)$/;
const MASTER_HEADING = '## Registro maestro';

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((part) => part.trim());
}

function parseMasterRows(text) {
  const start = text.indexOf(MASTER_HEADING);
  if (start < 0) return { rows: [], bodyStart: -1, bodyEnd: -1 };
  const after = text.indexOf('\n', start);
  const rest = text.slice(after + 1);
  const nextSection = rest.search(/^## /m);
  const body = nextSection >= 0 ? rest.slice(0, nextSection) : rest;
  const bodyStart = after + 1;
  const bodyEnd = nextSection >= 0 ? bodyStart + nextSection : text.length;

  const rows = [];
  for (const line of body.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (!row.length || row[0] === 'ID' || row.every((value) => /^[-:\s]+$/.test(value))) continue;
    rows.push({ line, cells: row });
  }
  return { rows, bodyStart, bodyEnd };
}

function findStaleNextActionRefs(text) {
  const { rows } = parseMasterRows(text);
  const states = new Map();
  for (const { cells: row } of rows) {
    if (row.length >= 4 && ID_RE.test(row[0])) states.set(row[0], row[3]);
  }

  const issues = [];
  for (const { line, cells: row } of rows) {
    if (row.length < 8 || !ID_RE.test(row[0])) continue;
    const taskId = row[0];
    const nextAction = row[7];
    const match = nextAction.match(/^([A-Z][A-Z0-9-]+-\d+(?:\.\d+)*)$/);
    if (!match) continue;
    const refId = match[1];
    if (refId === taskId) continue;
    const refState = states.get(refId);
    if (refState === 'hecho' || refState === 'cancelado') {
      issues.push({
        taskId,
        column: 'Próxima acción',
        refId,
        refState,
        line,
        suggested: '—',
      });
    }
  }
  return issues;
}

function applyLedgerFixes(text, issues) {
  let next = text;
  for (const issue of issues) {
    const row = issue.line;
    const parts = cells(row);
    if (parts.length < 8) continue;
    parts[7] = issue.suggested;
    const replacement = `| ${parts.join(' | ')} |`;
    if (!next.includes(row)) continue;
    next = next.replace(row, replacement);
  }
  return next;
}

function auditLedgerFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const issues = findStaleNextActionRefs(text);
  return {
    ledger: filePath,
    issues,
    ok: issues.length === 0,
  };
}

function fixLedgerFile(filePath, { dryRun = false } = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  const issues = findStaleNextActionRefs(text);
  if (!issues.length) {
    return { ledger: filePath, fixed: 0, issues: [], dryRun };
  }
  const updated = applyLedgerFixes(text, issues);
  if (!dryRun && updated !== text) {
    fs.writeFileSync(filePath, updated.endsWith('\n') ? updated : `${updated}\n`, 'utf8');
  }
  return { ledger: filePath, fixed: issues.length, issues, dryRun };
}

module.exports = {
  findStaleNextActionRefs,
  applyLedgerFixes,
  auditLedgerFile,
  fixLedgerFile,
};
