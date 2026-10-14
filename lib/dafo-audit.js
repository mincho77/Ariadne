'use strict';

const fs = require('node:fs');
const readline = require('node:readline/promises');

const QUADRANTS = [
  { key: 'fortalezas', title: 'Fortalezas', aliases: ['fortaleza', 'fortalezas'] },
  { key: 'debilidades', title: 'Debilidades', aliases: ['debilidad', 'debilidades'] },
  { key: 'oportunidades', title: 'Oportunidades', aliases: ['oportunidad', 'oportunidades'] },
  { key: 'amenazas', title: 'Amenazas', aliases: ['amenaza', 'amenazas'] },
];

const VIABILITY = new Map([
  ['viable', 'viable'],
  ['viable con condiciones', 'viable_con_condiciones'],
  ['no viable', 'no_viable'],
  ['evidencia insuficiente', 'evidencia_insuficiente'],
]);

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isPlaceholder(value) {
  return /^(?:pendiente|por definir|tbd|todo|n\/?a|xxx|sin datos|sin informacion|no definido|—|-|)$/i.test(normalize(value));
}

function linesUnderHeading(text, headingPattern, stopPattern = /^#{1,2}\s/) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return [];
  const result = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (stopPattern.test(lines[i])) break;
    result.push(lines[i]);
  }
  return result;
}

function bulletItems(lines) {
  return lines.map((line) => line.match(/^\s*(?:[-*+] |\d+[.)] )(.*)$/)?.[1]?.trim())
    .filter((item) => item && !/^[-—–]$/.test(item));
}

function parseDafo(text) {
  const dafoLines = linesUnderHeading(text, /^##\s+DAFO\b/i);
  const dafoText = dafoLines.join('\n');
  const factors = {};
  for (const quadrant of QUADRANTS) {
    const heading = new RegExp(`^###\\s+(?:${quadrant.aliases.join('|')})\\s*$`, 'i');
    factors[quadrant.key] = bulletItems(linesUnderHeading(dafoText, heading, /^#{1,3}\s/));
  }

  const verdictLines = linesUnderHeading(dafoText, /^###\s+(?:Dictamen de )?viabilidad\s*$/i, /^#{1,3}\s/);
  const verdictText = verdictLines.join('\n');
  const stateLine = verdictText.split(/\r?\n/).find((line) => /^\s*(?:[-*+]\s*)?(?:estado|dictamen)\s*:/i.test(line));
  const rawState = stateLine?.split(':').slice(1).join(':').trim() || '';
  const viability = VIABILITY.get(normalize(rawState)) || null;
  const fieldValue = (label) => verdictText.split(/\r?\n/)
    .find((line) => new RegExp(`^\\s*(?:[-*+]\\s*)?${label}\\s*:`, 'i').test(line))
    ?.split(':').slice(1).join(':').trim() || '';

  const contextMatch = text.match(/^\s*(?:[-*+]\s*)?(?:contexto|alcance del desarrollo)\s*:\s*(.+)$/im);
  const context = contextMatch?.[1]?.trim() || '';
  return {
    present: dafoLines.length > 0,
    context,
    factors,
    viability,
    rawViability: rawState,
    reasons: fieldValue('razones'),
    conditions: fieldValue('condiciones'),
    evidence: fieldValue('evidencia'),
  };
}

async function askQuestions(prompts) {
  const interface_ = readline.createInterface({ input: process.stdin, output: process.stderr });
  const answers = {};
  try {
    for (const item of prompts) {
      answers[item.key] = (await interface_.question(`${item.prompt}\n> `)).trim();
    }
  } finally {
    interface_.close();
  }
  return answers;
}

function viabilityPrompt(value) {
  const choices = ['viable', 'viable con condiciones', 'no viable', 'evidencia insuficiente'];
  const normalized = normalize(value);
  return choices.find((choice) => normalize(choice) === normalized) || null;
}

async function auditDafoFile(filePath, { interactive = false } = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed = parseDafo(source);
  const prompts = [];
  if (interactive) {
    if (!parsed.context || isPlaceholder(parsed.context)) {
      prompts.push({ key: 'context', prompt: '¿Qué se desarrollará en este ledger y qué resultado concreto se espera?' });
    }
    for (const quadrant of QUADRANTS) {
      const items = parsed.factors[quadrant.key];
      if (!items.length || items.every(isPlaceholder)) {
        prompts.push({ key: quadrant.key, prompt: `${quadrant.title}: ¿qué factor aplica? Indica evidencia o supuestos; deja vacío si no hay información.` });
      }
    }
    if (!parsed.viability || isPlaceholder(parsed.rawViability)) {
      prompts.push({ key: 'viability', prompt: '¿Cuál es el dictamen provisional? (viable / viable con condiciones / no viable / evidencia insuficiente)' });
    }
    if (!parsed.reasons || isPlaceholder(parsed.reasons)) {
      prompts.push({ key: 'reasons', prompt: '¿Qué evidencia o factores justifican ese dictamen?' });
    }
    if (parsed.viability === 'viable_con_condiciones' && (!parsed.conditions || isPlaceholder(parsed.conditions))) {
      prompts.push({ key: 'conditions', prompt: 'Si aplica, ¿qué condiciones deben cumplirse para que sea viable? Deja vacío si no aplica.' });
    }
  }

  const answers = prompts.length ? await askQuestions(prompts) : {};
  if (viabilityPrompt(answers.viability) === 'viable_con_condiciones'
      && !parsed.conditions && !Object.hasOwn(answers, 'conditions')) {
    Object.assign(answers, await askQuestions([{
      key: 'conditions',
      prompt: '¿Qué condiciones deben cumplirse para que sea viable?',
    }]));
  }
  if (answers.context) parsed.context = answers.context;
  for (const quadrant of QUADRANTS) {
    if (answers[quadrant.key]) parsed.factors[quadrant.key] = [answers[quadrant.key]];
  }
  if (answers.viability) parsed.viability = viabilityPrompt(answers.viability);
  if (answers.reasons) parsed.reasons = answers.reasons;
  if (answers.conditions) parsed.conditions = answers.conditions;

  const missing = QUADRANTS.filter((quadrant) => !parsed.factors[quadrant.key].length
    || parsed.factors[quadrant.key].every(isPlaceholder)).map((quadrant) => quadrant.key);
  if (!parsed.context || isPlaceholder(parsed.context)) missing.unshift('context');
  if (!parsed.viability) missing.push('viability');
  if (!parsed.reasons || isPlaceholder(parsed.reasons)) missing.push('reasons');
  if (parsed.viability === 'viable_con_condiciones' && (!parsed.conditions || isPlaceholder(parsed.conditions))) missing.push('conditions');
  const evidenceInsufficient = missing.length > 0 || parsed.viability === 'evidencia_insuficiente';
  return {
    ledger: filePath,
    context: parsed.context || null,
    factors: parsed.factors,
    reasons: parsed.reasons || null,
    conditions: parsed.conditions || null,
    evidence: parsed.evidence || null,
    viability: evidenceInsufficient ? 'evidencia_insuficiente' : parsed.viability,
    missing,
    questionsAsked: prompts.length,
    answersUsed: Object.keys(answers).filter((key) => answers[key]).length,
    persisted: false,
    ok: true,
  };
}

module.exports = { auditDafoFile, parseDafo };
