#!/usr/bin/env node
'use strict';

const FULL_PATTERNS = [
  /\bpharos\b/i,
  /\baudit(a|ar)?\s+(c[oó]digo|code|repo|security|seguridad)\b/i,
  /\bdesplieg(u|ue|a)\b/i,
  /\bdeploy(ment)?\b/i,
  /\bmigr(a|á)(cion|tion)\b/i,
  /\brefactor\b/i,
  /\bgantt\b/i,
  /\bproducci[oó]n\b/i,
  /\bproduction\b/i,
  /\bsecurity\b/i,
  /\bseguridad\b/i,
  /\barquitectura\b/i,
  /\bimplement(a|ar)\b/i,
  /\bnpm test\b/i,
  /\blib\/gantt\b/i,
];

const LITE_PATTERNS = [
  /\b(audita|audit)\s*(y\s*)?(corrige|fix|arregla)\b/i,
  /\b(npm run )?ariadne:audit(:fix)?\b/i,
  /\b(cola|queue|ordinal|turno)\b/i,
  /\b(mover|mueve|move)\s+(a\s+)?(queue|cola|doing|done|to do)\b/i,
  /\b(crear|create|nueva)\s+tarea\b/i,
  /\b(check_plan|ledger|plan)\b/i,
  /\b(pr[oó]xima acci[oó]n|status|estado)\b/i,
  /\bmarca(r)?\s+done\b/i,
  /\bactualiza(r)?\s+(el\s+)?(ledger|backlog|frontmatter)\b/i,
  /\bregistrar\s+(decisi[oó]n|riesgo)\b/i,
];

function classifyMessage(text) {
  const input = String(text || '').trim();
  if (!input) {
    return {
      mode: 'lite',
      skill: 'ariadne-lite',
      modelTier: 'economy',
      reason: 'empty input defaults to lite',
    };
  }

  for (const pattern of FULL_PATTERNS) {
    if (pattern.test(input)) {
      return {
        mode: 'full',
        skill: 'ariadne',
        modelTier: 'standard',
        reason: `matched full-scope pattern: ${pattern}`,
      };
    }
  }

  for (const pattern of LITE_PATTERNS) {
    if (pattern.test(input)) {
      return {
        mode: 'lite',
        skill: 'ariadne-lite',
        modelTier: 'economy',
        reason: `matched lite pattern: ${pattern}`,
      };
    }
  }

  return {
    mode: 'full',
    skill: 'ariadne',
    modelTier: 'standard',
    reason: 'no lite pattern matched; default to full Ariadne for safety',
  };
}

function main() {
  const message = process.argv.slice(2).join(' ').trim();
  const result = {
    ...classifyMessage(message),
    message,
    docs: 'docs/ariadne-lite.md',
  };
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = { classifyMessage, FULL_PATTERNS, LITE_PATTERNS };
