'use strict';

/** Prompt copied by Hub/Kanban “generate plan / instruction” buttons (test autopilot). */
const KANOA_TEST_PLAN_AUTOPILOT_PROMPT =
  'Ejecutar skill kanoa-parity-autopilot con config backlog/docs/plans/kanoa-parity.test-plan.json. No pedir “continua”. Entregar PASS/FAIL, bugs y plan de correcciones. No iniciar fixes hasta que yo confirme.';

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsString(value) {
  return JSON.stringify(String(value ?? ''));
}

/** Button markup for boards that copy the test-plan autopilot prompt. */
function copyPlanInstructionButtonHtml({
  id = 'copy-action',
  label = 'Copiar instrucción para Codex',
} = {}) {
  return `<button id="${id}" class="secondary" type="button" title="${escapeHtmlAttr(KANOA_TEST_PLAN_AUTOPILOT_PROMPT)}">${label}</button>`;
}

/** Inline onclick binder for board pages (expects #copy-action). */
function copyPlanInstructionScript({
  buttonId = 'copy-action',
  idleLabel = 'Copiar instrucción para Codex',
  doneLabel = 'Instrucción copiada',
} = {}) {
  return `document.querySelector(${JSON.stringify('#' + buttonId)}).onclick=async()=>{const btn=document.querySelector(${JSON.stringify('#' + buttonId)});if(!btn)return;const prompt=${escapeJsString(KANOA_TEST_PLAN_AUTOPILOT_PROMPT)};await navigator.clipboard.writeText(prompt);btn.textContent=${JSON.stringify(doneLabel)};setTimeout(()=>btn.textContent=${JSON.stringify(idleLabel)},1600)};`;
}

module.exports = {
  KANOA_TEST_PLAN_AUTOPILOT_PROMPT,
  copyPlanInstructionButtonHtml,
  copyPlanInstructionScript,
  escapeHtmlAttr,
};
