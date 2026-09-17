'use strict';

const { extractAcceptanceCriteria } = require('./brief');
const { recommendPackPolicy, getPack } = require('./packs');

function packRequiresSpecifier(packOrId) {
  const pack = packOrId && typeof packOrId === 'object' && packOrId.roles
    ? packOrId
    : getPack(packOrId);
  return Array.isArray(pack.roles) && pack.roles[0] === 'specifier';
}

function hasApprovableAcceptanceCriteria(source, { min = 1 } = {}) {
  const items = extractAcceptanceCriteria(source);
  const usable = items.filter((item) => String(item.text || '').trim().length >= 4);
  return usable.length >= min;
}

function listHandoffLines(source) {
  const text = String(source || '');
  const heading = text.search(/^##\s+Swarm handoffs\s*$/im);
  if (heading < 0) return [];
  const afterHeading = text.slice(heading).split(/\n/).slice(1);
  const body = [];
  for (const line of afterHeading) {
    if (/^##\s+/.test(line)) break;
    body.push(line);
  }
  return body
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

function hasSpecifierToCoderHandoff(source) {
  return listHandoffLines(source).some((line) => /specifier\s*→\s*coder/i.test(line));
}

function summaryLooksApproved(summary) {
  return /\b(approved|aprobad[oa]|ac\s*ok|ac\s*listos?)\b/i.test(String(summary || ''));
}

/**
 * Gate AH-E-46: four/six cannot hand off to coder without specifier + approvable AC.
 */
function assertSpecifierBeforeCoder(options = {}) {
  const {
    pack,
    fromRole,
    toRole,
    source = '',
    approved = false,
    skip = false,
  } = options;

  if (skip) return { ok: true, skipped: true };
  if (!packRequiresSpecifier(pack)) {
    return { ok: true, required: false };
  }

  const to = String(toRole || '').trim().toLowerCase();
  if (to !== 'coder') {
    return { ok: true, required: true, gated: false };
  }

  const from = String(fromRole || '').trim().toLowerCase();
  if (from !== 'specifier' && !hasSpecifierToCoderHandoff(source)) {
    const error = new Error(
      'pack four/six: handoff a coder requiere from=specifier (AC binarios antes de implementar)',
    );
    error.code = 'SPECIFIER_REQUIRED';
    throw error;
  }

  if (!hasApprovableAcceptanceCriteria(source)) {
    const error = new Error(
      'pack four/six: AC aprobables ausentes — specifier debe dejar ## Acceptance Criteria binarios antes del handoff a coder',
    );
    error.code = 'MISSING_APPROVABLE_AC';
    throw error;
  }

  const okApproved = approved === true || summaryLooksApproved(options.summary);
  if (!okApproved) {
    const error = new Error(
      'pack four/six: handoff specifier→coder requiere --approved o summary con "approved"/"AC ok"',
    );
    error.code = 'SPECIFIER_NOT_APPROVED';
    throw error;
  }

  return {
    ok: true,
    required: true,
    gated: true,
    approved: true,
  };
}

/**
 * When starting a role on four/six, prefer specifier first unless already handed off.
 */
function resolveStartingRole(task, options = {}) {
  const pack = options.pack
    || recommendPackPolicy(task).pack;
  const requested = options.role ? String(options.role).trim().toLowerCase() : null;

  if (!packRequiresSpecifier(pack)) {
    return { role: requested, pack, forced: false };
  }

  if (!requested || requested === 'specifier') {
    return { role: requested || 'specifier', pack, forced: !requested };
  }

  if (requested === 'coder' && !hasSpecifierToCoderHandoff(task.source || '')) {
    const error = new Error(
      'pack four/six: no iniciar coder sin handoff specifier→coder previo (usa --role specifier)',
    );
    error.code = 'SPECIFIER_REQUIRED';
    throw error;
  }

  return { role: requested, pack, forced: false };
}

/**
 * Replace or seed ## Acceptance Criteria with binary checklist (+ optional Gherkin).
 */
function applySpecifierAcceptance(source, { criteria = [], gherkin = '' } = {}) {
  const items = (Array.isArray(criteria) ? criteria : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  if (!items.length) throw new Error('specifier AC requires at least one criterion');

  const acBlock = [
    '## Acceptance Criteria',
    '<!-- AC:BEGIN -->',
    ...items.map((text, index) => `- [ ] #${index + 1} ${text}`),
    '<!-- AC:END -->',
  ].join('\n');

  const gherkinBlock = String(gherkin || '').trim()
    ? `\n\n## Specifier Gherkin\n\n${String(gherkin).trim()}\n`
    : '';

  let text = String(source || '');
  if (/^##\s+Acceptance Criteria\s*$/mi.test(text)) {
    text = text.replace(
      /##\s+Acceptance Criteria[\s\S]*?(?=\n##\s+(?!Acceptance Criteria)|\n---\s*$|$)/i,
      `${acBlock}\n`,
    );
  } else {
    text = `${text.trimEnd()}\n\n${acBlock}\n`;
  }

  if (gherkinBlock) {
    if (/^##\s+Specifier Gherkin\s*$/mi.test(text)) {
      text = text.replace(
        /##\s+Specifier Gherkin[\s\S]*?(?=\n##\s+|\n---\s*$|$)/i,
        `## Specifier Gherkin\n\n${String(gherkin).trim()}\n`,
      );
    } else {
      text = `${text.trimEnd()}${gherkinBlock}`;
    }
  }

  return text.endsWith('\n') ? text : `${text}\n`;
}

module.exports = {
  packRequiresSpecifier,
  hasApprovableAcceptanceCriteria,
  listHandoffLines,
  hasSpecifierToCoderHandoff,
  summaryLooksApproved,
  assertSpecifierBeforeCoder,
  resolveStartingRole,
  applySpecifierAcceptance,
};
