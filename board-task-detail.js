'use strict';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

function inlineTaskMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function sectionProgressHtml(done, total) {
  if (!total) return '';
  const pct = Math.round((done / total) * 100);
  return `<span class="section-progress" style="--pct:${pct}%">${done}/${total}</span>`;
}

function taskDetailHtml(source) {
  const clean = String(source || '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (!clean) return '<p class="detail-empty">Esta tarea todavía no tiene detalle.</p>';

  const sections = [];
  let current = { title: 'Detalle', lines: [] };
  for (const line of clean.split('\n')) {
    const heading = line.match(/^##\s+(.+)\s*$/);
    if (heading) {
      if (current.lines.some((item) => item.trim())) sections.push(current);
      current = { title: heading[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((item) => item.trim())) sections.push(current);

  let checkIndex = -1;
  return sections.map((section) => {
    const blocks = [];
    let list = [];
    let listKind = '';
    let done = 0;
    let total = 0;
    const flushList = () => {
      if (!list.length) return;
      const cls = listKind === 'check' ? 'detail-list checklist' : 'detail-list';
      blocks.push(`<ul class="${cls}">${list.join('')}</ul>`);
      list = [];
      listKind = '';
    };
    for (const rawLine of section.lines) {
      const line = rawLine.trim();
      if (!line) { flushList(); continue; }
      const checklist = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
      const bullet = line.match(/^-\s+(.*)$/);
      if (checklist) {
        checkIndex += 1;
        total += 1;
        const checked = checklist[1].toLowerCase() === 'x';
        if (checked) done += 1;
        listKind = 'check';
        const label = inlineTaskMarkdown(checklist[2]);
        list.push(`<li class="check-item${checked ? ' checked' : ''}" data-check-index="${checkIndex}">
          <button type="button" class="check-toggle" aria-pressed="${checked ? 'true' : 'false'}" aria-label="${checked ? 'Desmarcar' : 'Marcar'}: ${escapeHtml(checklist[2].replace(/[#*`]/g, '').slice(0, 80))}">
            <span class="check-box" aria-hidden="true"></span>
          </button>
          <span class="check-label">${label}</span>
        </li>`);
      } else if (bullet) {
        list.push(`<li class="bullet-item"><span class="bullet-dot" aria-hidden="true"></span><span>${inlineTaskMarkdown(bullet[1])}</span></li>`);
      } else {
        flushList();
        blocks.push(`<p class="detail-paragraph">${inlineTaskMarkdown(line)}</p>`);
      }
    }
    flushList();
    const collapsible = total > 0 || blocks.length > 1;
    const head = `<button type="button" class="section-head" aria-expanded="true">
      <span class="section-chevron" aria-hidden="true"></span>
      <span class="section-title">${escapeHtml(section.title)}</span>
      ${sectionProgressHtml(done, total)}
    </button>`;
    return `<section class="detail-section${collapsible ? ' is-collapsible' : ''}${total && done === total ? ' is-complete' : ''}">
      ${collapsible ? head : `<h3 class="section-title-static">${escapeHtml(section.title)}</h3>`}
      <div class="section-body">${blocks.join('')}</div>
    </section>`;
  }).join('');
}

function toggleChecklistInSource(source, checkIndex, checked) {
  let current = -1;
  const lines = String(source || '').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*-\s+\[)([ xX])(\]\s+.*)$/);
    if (!match) continue;
    current += 1;
    if (current === checkIndex) {
      lines[i] = `${match[1]}${checked ? 'x' : ' '}${match[3]}`;
      return lines.join('\n');
    }
  }
  throw new Error('ítem de checklist no encontrado');
}

function boardTaskDetailStyles(theme = 'default') {
  const accent = theme === 'bugs' ? '#ff8da8' : theme === 'mejoras' ? '#73d8ff' : '#73d8c6';
  const accentSoft = theme === 'bugs' ? '#ffb4c533' : theme === 'mejoras' ? '#73d8ff33' : '#73d8c633';
  const done = theme === 'bugs' ? '#8de1b8' : '#62d3be';
  return `.detail{display:grid;gap:14px;color:#c9d4e4;line-height:1.55;font-size:14px}
.detail-empty{color:#8da0b9;padding:12px 14px;border:1px dashed #344a67;border-radius:12px;text-align:center}
.detail-section{background:linear-gradient(180deg,#121f31,#101927);border:1px solid #293d58;border-radius:14px;overflow:hidden;box-shadow:0 10px 24px #00000024}
.detail-section.is-complete{border-color:#2f6f5d}
.detail-section.is-collapsed .section-body{display:none}
.detail-section.is-collapsed .section-chevron{transform:rotate(-90deg)}
.section-head,.section-title-static{display:flex;align-items:center;gap:10px;width:100%;margin:0;padding:14px 16px;background:#0f1a28;border:0;border-bottom:1px solid #243246;color:#e8eef8;font:inherit;text-align:left;cursor:pointer}
.section-title-static{cursor:default;border-bottom:1px solid #243246;font-size:12px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;color:#8be1d2}
.section-head:hover{background:#152338}
.section-chevron{width:10px;height:10px;border-right:2px solid ${accent};border-bottom:2px solid ${accent};transform:rotate(45deg) translateY(-2px);transition:transform .15s;flex:0 0 auto}
.section-title{flex:1;font-size:12px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;color:#8be1d2}
.section-progress{position:relative;flex:0 0 auto;min-width:52px;padding:4px 10px 4px 28px;border-radius:999px;background:#182638;color:#b8c5d6;font-size:11px;font-weight:800;overflow:hidden}
.section-progress:before{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--pct,0);background:${accentSoft};border-radius:999px}
.section-body{padding:12px 14px 16px}
.detail-paragraph{margin:0 0 10px}
.detail-list{display:grid;gap:8px;list-style:none;padding:0;margin:0}
.checklist{gap:6px}
.check-item,.bullet-item{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:10px 12px;border-radius:12px;background:#0c1522;border:1px solid #223044;transition:border-color .15s,background .15s,transform .15s}
.check-item:hover,.bullet-item:hover{border-color:#365171;background:#101d2d}
.check-item.checked{border-color:#2f6f5d;background:#0f1f1c}
.check-item.checked .check-label{color:#9db0a8;text-decoration:line-through;text-decoration-color:#5f756d}
.check-toggle{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;transition:background .15s,transform .08s}
.check-toggle:hover{background:#1a2a3d}
.check-toggle:active{transform:scale(.94)}
.check-box{display:block;width:18px;height:18px;border-radius:6px;border:2px solid #4b6280;background:#0b1524;box-shadow:inset 0 0 0 1px #00000033;transition:background .15s,border-color .15s,box-shadow .15s}
.check-item.checked .check-box{border-color:${done};background:${done};box-shadow:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23092421' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.2 6.6 11.3 12.5 5.4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;background-size:14px 14px}
.check-label{padding-top:4px;line-height:1.45}
.bullet-item{grid-template-columns:16px 1fr;padding-left:14px}
.bullet-dot{width:8px;height:8px;margin-top:7px;border-radius:999px;background:${accent}}
.detail code{padding:2px 6px;border-radius:6px;background:#24344c;color:#b7f2e7;font-size:.92em}`;
}

function boardTaskDetailInitScript() {
  return `
function updateDetailSectionMeta(root){
  if(!root)return;
  root.querySelectorAll('.detail-section').forEach((section)=>{
    const items=[...section.querySelectorAll('.check-item')];
    const done=items.filter((item)=>item.classList.contains('checked')).length;
    const total=items.length;
    const progress=section.querySelector('.section-progress');
    if(progress&&total){
      progress.textContent=done+'/'+total;
      progress.style.setProperty('--pct',Math.round((done/total)*100)+'%');
    }
    section.classList.toggle('is-complete',total>0&&done===total);
  });
}
function applyTaskDetailHtml(task){
  const el=document.querySelector('#detail-body');
  if(!el||!task)return;
  el.innerHTML=task.detailHtml||'';
  updateDetailSectionMeta(el);
}
async function toggleCheckItem(button){
  if(!selectedTask||button.disabled)return;
  const item=button.closest('.check-item');
  if(!item)return;
  const index=Number(item.dataset.checkIndex);
  const nextChecked=!item.classList.contains('checked');
  const prevPressed=button.getAttribute('aria-pressed');
  button.disabled=true;
  item.classList.toggle('checked',nextChecked);
  button.setAttribute('aria-pressed',nextChecked?'true':'false');
  updateDetailSectionMeta(item.closest('#detail-body'));
  try{
    const response=await fetch('/api/tasks/checklist?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id,index,checked:nextChecked})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'No se pudo actualizar el checklist');
    selectedTask.source=result.source;
    selectedTask.detailHtml=result.detailHtml;
    if(typeof actionError!=='undefined')actionError.textContent='';
  }catch(error){
    item.classList.toggle('checked',!nextChecked);
    button.setAttribute('aria-pressed',prevPressed);
    updateDetailSectionMeta(item.closest('#detail-body'));
    if(typeof actionError!=='undefined')actionError.textContent=error.message;
  }finally{
    button.disabled=false;
  }
}
(function bindTaskDetailInteractivity(){
  const detailBody=document.querySelector('#detail-body');
  if(!detailBody||detailBody.dataset.detailBound==='1')return;
  detailBody.dataset.detailBound='1';
  detailBody.addEventListener('click',(event)=>{
    const toggle=event.target.closest('.check-toggle');
    if(toggle){event.preventDefault();toggleCheckItem(toggle);return}
    const head=event.target.closest('.section-head');
    if(!head)return;
    const section=head.closest('.detail-section');
    if(!section)return;
    section.classList.toggle('is-collapsed');
    head.setAttribute('aria-expanded',section.classList.contains('is-collapsed')?'false':'true');
  });
})();
`;
}

module.exports = {
  escapeHtml,
  inlineTaskMarkdown,
  taskDetailHtml,
  toggleChecklistInSource,
  boardTaskDetailStyles,
  boardTaskDetailInitScript,
};
