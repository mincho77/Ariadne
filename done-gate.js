'use strict';

/**
 * Done gate: require Evidence or Closeout before moving a task to Done.
 */

function hasEvidenceSection(source) {
  const text = String(source || '');
  if (/^##\s+Evidence\s*$/mi.test(text) && /##\s+Evidence[\s\S]*?^\s*-\s+\S+/mi.test(text)) {
    return true;
  }
  if (/^##\s+Closeout\s*$/mi.test(text) && /##\s+Closeout[\s\S]*?^\s*-\s+\S+/mi.test(text)) {
    return true;
  }
  // Loose fallback: explicit evidence bullet anywhere after a known heading
  if (/evidencia\s*:/i.test(text) && /^\s*-\s+.+/m.test(text)) {
    return /##\s+(Evidence|Closeout|Evidencia)\b/i.test(text);
  }
  return false;
}

function assertDoneEvidenceAllowed(task, options = {}) {
  if (options.force === true) return { allowed: true, forced: true };
  const source = task?.source || '';
  if (hasEvidenceSection(source)) {
    return { allowed: true, forced: false };
  }
  const error = new Error(
    'No se puede marcar Done sin evidencia. Añade ## Evidence o ## Closeout (o envía evidence en el POST).',
  );
  error.code = 'MISSING_EVIDENCE';
  throw error;
}

function boardDoneGateScript() {
  return `
function taskHasEvidence(task){
  const source=String(task&&task.source||'');
  const hasBullets=/-\\s+\\S+/.test(source);
  return ( /##\\s+Evidence\\b/i.test(source) || /##\\s+Closeout\\b/i.test(source) ) && hasBullets;
}
function assertClientDoneEvidence(id,status){
  if(String(status)!=='Done') return;
  const task=(typeof tasks!=='undefined'?tasks:[]).find((item)=>item.id===id);
  if(task&&!taskHasEvidence(task)){
    throw new Error('Falta ## Evidence o ## Closeout. Añádela (Editar texto) antes de marcar Done.');
  }
}
`;
}

module.exports = {
  hasEvidenceSection,
  assertDoneEvidenceAllowed,
  boardDoneGateScript,
};
