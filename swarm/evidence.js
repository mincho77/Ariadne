'use strict';

function stampNow(date = new Date()) {
  const iso = date.toISOString();
  return iso.slice(0, 19).replace('T', ' ');
}

function ensureTrailingNewline(text) {
  const value = String(text || '');
  return value.endsWith('\n') ? value : `${value}\n`;
}

/**
 * Append a bullet under an H2 section; create the section if missing.
 */
function appendSectionBullet(source, heading, bullet) {
  const text = ensureTrailingNewline(source);
  const line = String(bullet || '').trim();
  if (!line) throw new Error('evidence/handoff line is required');

  const headingRe = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'mi');
  const match = text.match(headingRe);
  const item = line.startsWith('- ') ? line : `- ${line}`;

  if (!match) {
    return `${text.trimEnd()}\n\n## ${heading}\n\n${item}\n`;
  }

  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.search(/\n##\s+/);
  const sectionBody = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const after = nextHeading === -1 ? '' : rest.slice(nextHeading);
  const body = sectionBody.trimEnd();
  const rebuilt = body
    ? `${text.slice(0, start)}${body}\n${item}\n${after}`
    : `${text.slice(0, start)}\n\n${item}\n${after}`;
  return ensureTrailingNewline(rebuilt);
}

function formatHandoffLine({ fromRole, toRole, summary, commit, at } = {}) {
  const from = String(fromRole || '').trim();
  const to = String(toRole || '').trim();
  const note = String(summary || '').trim();
  if (!from || !to || !note) {
    throw new Error('handoff requires --from, --to and --summary');
  }
  const when = at || stampNow();
  const commitPart = commit ? ` · commit ${String(commit).trim()}` : '';
  return `${when} · ${from} → ${to} · ${note}${commitPart}`;
}

function formatEvidenceLine({ evidence, notes, at } = {}) {
  const proof = String(evidence || '').trim();
  if (!proof) throw new Error('complete requires --evidence');
  const when = at || stampNow();
  const extra = notes ? ` · ${String(notes).trim()}` : '';
  return `${when} · ${proof}${extra}`;
}

function appendHandoff(source, payload) {
  return appendSectionBullet(source, 'Swarm handoffs', formatHandoffLine(payload));
}

function appendEvidence(source, payload) {
  return appendSectionBullet(source, 'Evidence', formatEvidenceLine(payload));
}

module.exports = {
  stampNow,
  ensureTrailingNewline,
  appendSectionBullet,
  formatHandoffLine,
  formatEvidenceLine,
  appendHandoff,
  appendEvidence,
};
