'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { stampNow, appendEvidence, ensureTrailingNewline } = require('./evidence');

const DEFAULT_LEDGER = path.join('docs', 'plans', 'ariadne-e2e.md');

function markAcceptanceCriteriaDone(source) {
  const text = String(source || '');
  return text.replace(
    /(##\s+Acceptance Criteria[\s\S]*?)(?=\n##\s+|\n---\s*$|$)/i,
    (section) => section.replace(/^\s*-\s*\[\s\]\s*/gm, '- [x] '),
  );
}

function appendCloseoutBlock(source, { evidence, notes, command, at } = {}) {
  const when = at || stampNow();
  const lines = [
    `## Closeout`,
    '',
    `- ${when} · structured close`,
    `- proof: ${String(evidence || '').trim()}`,
  ];
  if (notes) lines.push(`- notes: ${String(notes).trim()}`);
  if (command) lines.push(`- command: ${String(command).trim()}`);
  lines.push('');

  const text = ensureTrailingNewline(source);
  if (/^##\s+Closeout\s*$/mi.test(text)) {
    // Append under existing Closeout
    return text.replace(
      /(##\s+Closeout\s*\n)([\s\S]*?)(?=\n##\s+|$)/i,
      (_, heading, body) => {
        const extra = lines.slice(2).join('\n');
        return `${heading}${String(body).trimEnd()}\n${extra}\n`;
      },
    );
  }
  return `${text.trimEnd()}\n\n${lines.join('\n')}`;
}

function applyCloseoutToTaskSource(source, options = {}) {
  let next = appendEvidence(source, {
    evidence: options.evidence,
    notes: options.notes,
    at: options.at,
  });
  if (options.checkAc !== false) {
    next = markAcceptanceCriteriaDone(next);
  }
  next = appendCloseoutBlock(next, options);
  return ensureTrailingNewline(next);
}

function formatLedgerCheckpoint({ taskId, title, evidence, notes, at } = {}) {
  const when = (at || stampNow()).slice(0, 10);
  const proof = String(evidence || '').trim();
  const extra = notes ? ` · ${String(notes).trim()}` : '';
  const label = title ? `${taskId} (${title})` : taskId;
  return `- ${when}: ${label} Done — ${proof}${extra}`;
}

function appendLedgerHistorial(ledgerSource, checkpointLine) {
  const text = String(ledgerSource || '');
  let line = String(checkpointLine || '').trim();
  if (!line) throw new Error('ledger checkpoint line required');
  if (!line.startsWith('- ')) line = `- ${line}`;

  if (/^##\s+Historial\s*$/mi.test(text)) {
    return text.replace(
      /(##\s+Historial\s*\n)([\s\S]*?)(?=\n##\s+|$)/i,
      (_, heading, body) => `${heading}${String(body).trimEnd()}\n${line}\n`,
    );
  }
  return `${text.trimEnd()}\n\n## Historial\n\n${line}\n`;
}

function resolveLedgerPath(project, options = {}) {
  if (options.ledgerPath) {
    return path.isAbsolute(options.ledgerPath)
      ? options.ledgerPath
      : path.join(project?.path || process.cwd(), options.ledgerPath);
  }
  if (!project?.path) return null;
  return path.join(project.path, DEFAULT_LEDGER);
}

function checkpointLedger(project, payload = {}, options = {}) {
  const file = resolveLedgerPath(project, options);
  if (!file) {
    return { written: false, reason: 'no-project-path', path: null };
  }
  if (!fs.existsSync(file)) {
    return { written: false, reason: 'missing', path: file };
  }
  const before = fs.readFileSync(file, 'utf8');
  const line = formatLedgerCheckpoint(payload);
  const next = appendLedgerHistorial(before, line);
  fs.writeFileSync(file, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { written: true, path: file, line };
}

module.exports = {
  DEFAULT_LEDGER,
  markAcceptanceCriteriaDone,
  appendCloseoutBlock,
  applyCloseoutToTaskSource,
  formatLedgerCheckpoint,
  appendLedgerHistorial,
  resolveLedgerPath,
  checkpointLedger,
};
