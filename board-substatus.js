'use strict';

const SUBSTATUS_OPTIONS = {
  'To Do': ['Por priorizar', 'Bloqueado', 'En Análisis'],
  Queued: ['Listo para ejecutar'],
  'In Progress': ['En Curso', 'En Análisis', 'Pendiente Resultado Prueba'],
  Done: ['Verificado', 'Sin verificar'],
};

const SUBSTATUS_DEFAULTS = {
  'To Do': 'Por priorizar',
  Queued: 'Listo para ejecutar',
  'In Progress': 'En Curso',
  Done: 'Verificado',
};

function parseFrontmatterField(source, field) {
  const quoted = source.match(new RegExp(`^${field}:\\s*["']([^"']*)["']\\s*$`, 'mi'));
  if (quoted) return quoted[1].trim();
  const plain = source.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'mi'));
  return plain ? plain[1].trim() : '';
}

function isLawyerValidationTask(task) {
  const haystack = `${task.title || ''} ${task.type || ''} ${(task.labels || []).join(' ')}`.toLowerCase();
  return /validaci|e2e|confirmar|prueba del abogado|resultado prueba/.test(haystack);
}

function resolveEffectiveSubstatus(task) {
  const explicit = String(task.substatus || '').trim();
  if (explicit) return explicit;
  const status = String(task.status || 'To Do');
  if (/^in progress$/i.test(status) && isLawyerValidationTask(task)) {
    return 'Pendiente Resultado Prueba';
  }
  return SUBSTATUS_DEFAULTS[status] || '';
}

function substatusClassName(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function taskCardSubstatusHtml(task, escapeHtml) {
  const substatus = resolveEffectiveSubstatus(task);
  if (!substatus) return '';
  const nextAction = String(task.nextAction || '').trim();
  const hint = nextAction
    ? `<span class="substatus-hint">${escapeHtml(nextAction)}</span>`
    : '';
  return `<span class="substatus substatus-${escapeHtml(substatusClassName(substatus))}" title="${escapeHtml(substatus)}">${escapeHtml(substatus)}</span>${hint}`;
}

function boardSubstatusStyles() {
  return `.substatus{display:inline-block;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;letter-spacing:.02em}
.substatus-hint{display:block;color:#9db0c9;font-size:10px;line-height:1.35;margin-top:8px}
.substatus-en-curso{background:#1e3a5f;color:#93c5fd}
.substatus-en-analisis{background:#3b2f04;color:#fde68a}
.substatus-pendiente-resultado-prueba{background:#4a1d3d;color:#f9a8d4}
.substatus-por-priorizar{background:#334155;color:#cbd5e1}
.substatus-bloqueado{background:#450a0a;color:#fecaca}
.substatus-listo-para-ejecutar{background:#134e4a;color:#99f6e4}
.substatus-verificado{background:#14532d;color:#bbf7d0}
.substatus-sin-verificar{background:#3f3f46;color:#e4e4e7}
.substatus-panel{margin:0 0 16px;padding:14px;background:#101d30;border:1px solid #293d58;border-radius:12px}
.substatus-kicker{margin:0 0 12px;color:#8be1d2;font-size:10px;text-transform:uppercase;letter-spacing:.09em;font-weight:800}
.substatus-panel label{display:block;color:#8be1d2;font-size:10px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;margin-bottom:6px}
.substatus-panel select,.substatus-panel textarea{width:100%;background:#0b1524;border:1px solid #344a67;border-radius:10px;color:#e8eef8;font:inherit;padding:10px 12px}
.substatus-panel textarea{min-height:72px;resize:vertical;margin-top:10px}
.substatus-save{margin-top:10px}`;
}

function boardSubstatusPanelHtml() {
  return `<div id="substatus-panel" class="substatus-panel" hidden>
  <p class="substatus-kicker">Estado operativo</p>
  <label for="substatus-select">Subestado</label>
  <select id="substatus-select" aria-label="Subestado de la tarea"></select>
  <label for="next-action-input">Qué se debe hacer ahora</label>
  <textarea id="next-action-input" placeholder="Ej.: El abogado debe validar en EXT-8522026339404 y enviar captura."></textarea>
  <button id="save-substatus" class="primary substatus-save" type="button">Guardar subestado</button>
</div>`;
}

function boardSubstatusInitScript() {
  return `
const substatusOptions=${JSON.stringify(SUBSTATUS_OPTIONS)};
const substatusPanel=document.querySelector('#substatus-panel');
const substatusSelect=document.querySelector('#substatus-select');
const nextActionInput=document.querySelector('#next-action-input');
const saveSubstatus=document.querySelector('#save-substatus');
function fillSubstatusOptions(task){
  if(!substatusPanel||!substatusSelect)return;
  const options=substatusOptions[task.status]||[];
  substatusPanel.hidden=!options.length;
  substatusSelect.innerHTML=options.map((item)=>'<option value="'+item.replace(/"/g,'&quot;')+'">'+item+'</option>').join('');
  const current=task.substatus||task.effectiveSubstatus||options[0]||'';
  if(current&&![...substatusSelect.options].some((opt)=>opt.value===current)){
    const extra=document.createElement('option');
    extra.value=current;extra.textContent=current;substatusSelect.appendChild(extra);
  }
  substatusSelect.value=current||options[0]||'';
  if(nextActionInput)nextActionInput.value=task.nextAction||'';
}
async function saveSubstatusFields(){
  if(!selectedTask||!saveSubstatus)return;
  actionError.textContent='';saveSubstatus.disabled=true;saveSubstatus.textContent='Guardando…';
  const response=await fetch('/api/tasks/substatus?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id,substatus:substatusSelect.value,next_action:nextActionInput.value})});
  const result=await response.json();
  if(!response.ok){actionError.textContent=result.error||'No se pudo guardar el subestado';saveSubstatus.disabled=false;saveSubstatus.textContent='Guardar subestado';return}
  location.reload();
}
if(saveSubstatus)saveSubstatus.onclick=()=>saveSubstatusFields().catch((error)=>{actionError.textContent=error.message;saveSubstatus.disabled=false;saveSubstatus.textContent='Guardar subestado'});
`;
}

function patchTaskSubstatus(source, { substatus = '', next_action = '' } = {}) {
  const body = String(source || '');
  const match = body.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('frontmatter requerido');
  let fm = match[1];
  const setField = (field, value) => {
    const line = `${field}: "${String(value || '').replace(/"/g, '\\"')}"`;
    const re = new RegExp(`^${field}:.*$`, 'm');
    fm = re.test(fm) ? fm.replace(re, line) : `${fm}\n${line}`;
  };
  setField('substatus', substatus);
  setField('next_action', next_action);
  const rest = body.slice(match[0].length);
  return `---\n${fm.trim()}\n---${rest.startsWith('\n') ? rest : `\n${rest}`}`;
}

function enrichTask(task) {
  const effectiveSubstatus = resolveEffectiveSubstatus(task);
  return { ...task, effectiveSubstatus };
}

module.exports = {
  SUBSTATUS_OPTIONS,
  SUBSTATUS_DEFAULTS,
  parseFrontmatterField,
  resolveEffectiveSubstatus,
  taskCardSubstatusHtml,
  boardSubstatusStyles,
  boardSubstatusPanelHtml,
  boardSubstatusInitScript,
  patchTaskSubstatus,
  enrichTask,
  isLawyerValidationTask,
};
