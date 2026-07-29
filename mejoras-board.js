const { isBugTask } = require('./bugs-board');
const {
  QUEUE_BOARD_CSS,
  QUEUE_COLUMN,
  queuePositionHtml,
  queueTaskClassName,
  queueColumnTitle,
} = require('./board-queue');
const {
  statsPanelStyles,
  renderCollapsibleStatsPanel,
  statsPanelInitScript,
} = require('./board-stats');

function isImprovementTask(task) {
  return !isBugTask(task);
}

function inferImprovementArea(task) {
  const haystack = `${task.title} ${task.type || ''} ${(task.labels || []).join(' ')}`.toLowerCase();
  if (/aicost|costo ia|cost-control/.test(haystack)) return 'Costo IA';
  if (/plantilla|informe|matriz/.test(haystack)) return 'Informes';
  if (/validaci|e2e|confirmar/.test(haystack)) return 'Validación';
  if (/novedad|feature|producto/.test(haystack)) return 'Producto';
  if (/hub|ariadne|backlog|kanban/.test(haystack)) return 'Ariadne / Hub';
  if (/test|cobertura/.test(haystack)) return 'Tests';
  const type = String(task.type || 'task');
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildImprovementStats(items) {
  const byArea = new Map();
  const byType = new Map();
  for (const task of items) {
    const area = inferImprovementArea(task);
    if (!byArea.has(area)) byArea.set(area, { area, total: 0, open: 0, done: 0 });
    const row = byArea.get(area);
    row.total += 1;
    if (/^done$/i.test(task.status)) row.done += 1;
    else row.open += 1;
    const type = String(task.type || 'task');
    byType.set(type, (byType.get(type) || 0) + 1);
  }
  const done = items.filter((task) => /^done$/i.test(task.status)).length;
  return {
    total: items.length,
    open: items.length - done,
    done,
    closeRate: items.length ? Math.round((done / items.length) * 100) : 0,
    byArea: [...byArea.values()].sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, 'es')),
    byType: Object.fromEntries(byType),
  };
}

function renderImprovementStatsSummary(stats) {
  return `<section class="stats-grid stats-grid-compact" aria-label="Resumen de mejoras">
      <article class="kpi"><span>Total</span><strong>${stats.total}</strong></article>
      <article class="kpi warn"><span>Abiertas</span><strong>${stats.open}</strong></article>
      <article class="kpi good"><span>Hechas</span><strong>${stats.done}</strong></article>
      <article class="kpi"><span>Avance</span><strong>${stats.closeRate}%</strong></article>
    </section>`;
}

function renderImprovementStatsDetail(stats, escapeHtml) {
  const maxArea = Math.max(1, ...stats.byArea.map((row) => row.total));
  const bars = stats.byArea.map((row) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(row.area)}</span>
      <div class="bar-track"><i style="width:${Math.round((row.total / maxArea) * 100)}%"></i></div>
      <span class="bar-value">${row.total}</span>
    </div>`).join('');
  const tableRows = stats.byArea.map((row) => `
    <tr>
      <td>${escapeHtml(row.area)}</td>
      <td>${row.total}</td>
      <td>${row.open}</td>
      <td>${row.done}</td>
      <td>${row.total ? Math.round((row.done / row.total) * 100) : 0}%</td>
    </tr>`).join('');
  const typeRows = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `<span class="pill type-chip">${escapeHtml(type)} · ${count}</span>`)
    .join('');
  return `<section class="analytics">
      <article class="panel-card">
        <h2>Mejoras por área</h2>
        <p class="hint">Áreas inferidas por título, tipo y etiquetas.</p>
        ${bars || '<p class="empty">Sin mejoras registradas.</p>'}
      </article>
      <article class="panel-card">
        <h2>Comparativo por área</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Área</th><th>Total</th><th>Abiertas</th><th>Hechas</th><th>Avance</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="5">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
      </article>
      <article class="panel-card compact">
        <h2>Por tipo</h2>
        <div class="pill-row">${typeRows || '<span class="empty">—</span>'}</div>
      </article>
    </section>`;
}

function renderImprovementStatsHtml(stats, escapeHtml) {
  const hint = `${stats.byArea.length} área${stats.byArea.length === 1 ? '' : 's'}`;
  return renderCollapsibleStatsPanel(
    renderImprovementStatsSummary(stats),
    renderImprovementStatsDetail(stats, escapeHtml),
    hint,
  );
}

function mejorasBoardPage(project, helpers) {
  const {
    escapeHtml,
    projectTasks,
    sortTasksByPriority,
    sortQueuedTasks,
    taskDetailHtml,
    priorityRank,
    boardCounts,
    boardNavHtml,
    boardNavStyles,
    isImprovementTask,
  } = helpers;
  const items = projectTasks(project).filter(isImprovementTask);
  const stats = buildImprovementStats(items);
  const counts = boardCounts(project, projectTasks, isBugTask, isImprovementTask);
  const navHtml = boardNavHtml(project, 'mejoras', counts, helpers);
  const columns = [
    { status: 'To Do', label: 'Por hacer', hint: 'Mejoras pendientes' },
    QUEUE_COLUMN,
    { status: 'In Progress', label: 'En curso', hint: 'Trabajo activo' },
    { status: 'Done', label: 'Hechas', hint: 'Completadas' },
  ];
  const cards = columns.map(({ status, label, hint, queue }) => {
    const sorter = queue ? sortQueuedTasks : sortTasksByPriority;
    const colItems = sorter(items.filter((task) => task.status.toLowerCase() === status.toLowerCase()));
    const content = colItems.map((task, position) => {
      const index = items.indexOf(task);
      const area = inferImprovementArea(task);
      const searchable = `${task.id} ${task.title} ${task.priority} ${area} ${task.type}`.toLowerCase();
      const queuePosition = queue ? queuePositionHtml(position) : '';
      const dragHint = queue ? '⋮⋮ Drag to reorder queue' : '⋮⋮ Drag to change status';
      return `<button class="${queueTaskClassName('task', queue, position)}" draggable="true" data-task="${index}" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-search="${escapeHtml(searchable)}">
        ${queuePosition}
        <span class="task-heading"><strong class="task-id">${escapeHtml(task.id)}</strong><strong class="task-title">${escapeHtml(task.title)}</strong></span>
        <span class="task-meta"><span class="area-badge">${escapeHtml(area)}</span><span class="type-badge">${escapeHtml(task.type || 'task')}</span><span class="priority priority-${priorityRank(task.priority)}">${escapeHtml(task.priority)}</span></span>
        <span class="drag-hint">${dragHint}</span>
      </button>`;
    }).join('') || `<p class="empty">${queue ? 'Drag here to authorize the next improvement.' : 'Sin mejoras en esta columna'}</p>`;
    return `<section class="column${queue ? ' queue-column' : ''}" data-column="${escapeHtml(status)}">
      <header class="column-head"><div><span class="column-kicker">${escapeHtml(hint)}</span><h2>${queueColumnTitle(escapeHtml(label), queue)}</h2></div><span class="column-count">${colItems.length}</span></header>
      ${queue ? '<p class="queue-rule">Drag within the queue to reorder. Turn 1 runs first.</p>' : ''}
      <div class="task-list">${content}</div>
    </section>`;
  }).join('');
  const taskData = JSON.stringify(items.map(({ id, title, status, priority, type, file, source, labels }) => ({
    id, title, status, priority, type, file,
    area: inferImprovementArea({ id, title, status, priority, type, file, labels }),
    detailHtml: taskDetailHtml(source),
    source,
  }))).replace(/</g, '\\u003c');
  const statsHtml = renderImprovementStatsHtml(stats, escapeHtml);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project.name)} · Mejoras · Ariadne</title>
<style>
:root{color-scheme:dark;--text-primary:#e8f4ff;--text-muted:#9db3c7;font:15px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;background:#08131a;color:var(--text-primary)}
*{box-sizing:border-box}body{margin:0;padding:24px 28px 40px;max-width:1680px;margin:auto;background:radial-gradient(circle at 80% -10%,#12344a 0,transparent 35%),#08131a}
a{color:#73d8ff}.muted{color:#9db3c7}
${boardNavStyles()}
.toolbar{display:flex;gap:12px;align-items:center;margin:18px 0;flex-wrap:wrap}.search{flex:1;min-width:240px;max-width:680px;background:#0f2433;border:1px solid #2f6b8f;border-radius:12px;color:#fff;padding:13px 15px;font:inherit}
.refresh-button{flex:0 0 auto;border:1px solid #2f6b8f;background:#123044;color:#9fe0ff;border-radius:12px;padding:12px 15px;font-weight:700;cursor:pointer;font:inherit}.refresh-button:hover{background:#1a4560}.refresh-button:disabled{opacity:.6;cursor:wait}
${statsPanelStyles('mejoras')}
.kpi{background:#0f2433;border:1px solid #2f6b8f;border-radius:14px;padding:16px}.kpi span{display:block;color:#9db3c7;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.kpi strong{font-size:28px}.kpi.warn strong{color:#ffd59a}.kpi.good strong{color:#8de1b8}
.analytics{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel-card{background:#0f2433;border:1px solid #2f6b8f;border-radius:15px;padding:16px}.panel-card.compact{grid-column:1/-1}.panel-card h2{margin:0 0 8px;font-size:17px}.hint{color:#7fa5bd;font-size:12px;margin:0 0 12px}
.pill-row{display:flex;gap:8px;flex-wrap:wrap}.pill{background:#1a4560;color:#b8dff7;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}
.bar-row{display:grid;grid-template-columns:150px 1fr 36px;gap:10px;align-items:center;margin:8px 0}.bar-label{font-size:12px}.bar-track{height:10px;background:#123044;border-radius:999px;overflow:hidden}.bar-track i{display:block;height:100%;background:linear-gradient(90deg,#2f8cff,#73d8ff);border-radius:999px}.bar-value{font-weight:800;color:#9fe0ff}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px 8px;border-bottom:1px solid #1b3950;text-align:left}th{color:#73d8ff;font-size:11px;text-transform:uppercase}
.board{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:14px;align-items:stretch}
.column{display:flex;flex-direction:column;background:#0f2433;border:1px solid #2f6b8f;border-radius:15px;padding:13px;min-height:360px}.column-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #2f6b8f}.column-kicker{display:block;color:#7fa5bd;font-size:10px;text-transform:uppercase;font-weight:800}.column-count{background:#123044;color:#9fe0ff;border-radius:9px;min-width:28px;height:28px;display:grid;place-items:center;font-weight:900}
.task-list{flex:1 1 auto;display:flex;flex-direction:column;min-height:240px;padding-top:6px}.task{display:block;width:100%;text-align:left;color:#fff;background:#123044;border:1px solid #2f6b8f;border-radius:11px;padding:13px;margin:8px 0;cursor:grab}.task[hidden]{display:none!important}.task:hover{border-color:#73d8ff}.task.dragging{opacity:.35}
.task-heading{display:grid;gap:4px}.task-id{color:#73d8ff;font-size:12px}.task-title{font-size:13px}.task-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.area-badge,.type-badge{background:#1a4560;color:#b8dff7;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800}
.priority{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:800;font-size:11px}.priority-0{background:#991b1b;color:#fee2e2}.priority-1{background:#92400e;color:#ffedd5}.priority-2{background:#164e63;color:#a5f3fc}.priority-3{background:#334155;color:#cbd5e1}
${QUEUE_BOARD_CSS}
.empty{color:#9db3c7;text-align:center;padding:18px 8px;font-size:12px}.drag-hint{display:block;color:#7fa5bd;font-size:10px;margin-top:8px}
.modal{display:none;position:fixed;inset:0;background:#000c;align-items:center;justify-content:center;padding:20px;z-index:10}.modal.open{display:flex}.panel{background:#0f2433;border:1px solid #2f6b8f;border-radius:18px;max-width:880px;width:100%;max-height:90vh;overflow:auto;padding:24px}.close{float:right;background:#123044;border:0;color:#9fe0ff;width:36px;height:36px;border-radius:10px;font-size:22px;cursor:pointer}
.detail{display:grid;gap:12px}.source-editor{width:100%;min-height:320px;background:#08131a;border:1px solid #2f6b8f;border-radius:12px;color:#fff;font:13px/1.5 ui-monospace,Menlo,monospace;padding:14px}
.actions,.edit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.primary,.secondary{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary{background:#2f8cff;color:#fff}.secondary{background:#123044;color:#9fe0ff}
@media(max-width:1100px){.analytics{grid-template-columns:1fr}.stats-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}.board{grid-template-columns:repeat(2,minmax(220px,1fr))}}@media(max-width:700px){.stats-grid,.analytics,.board{grid-template-columns:1fr}}
</style>
</head>
<body>
${navHtml}
${statsHtml}
<div class="toolbar">
  <input id="task-search" class="search" type="search" placeholder="Buscar mejora por ID, área, título…">
  <span id="search-count" class="muted"></span>
  <button id="refresh-board" class="refresh-button" type="button">↻ Refrescar</button>
  <span id="last-refresh" class="muted" aria-live="polite">Actualizado ahora</span>
</div>
<main class="board">${cards}</main>
<div id="modal" class="modal"><div class="panel"><button class="close">×</button><h2 id="detail-title"></h2><p id="detail-area" class="muted"></p><div id="detail-view"><div id="detail-body" class="detail"></div></div><div id="detail-edit" hidden><textarea id="source-editor" class="source-editor"></textarea><div class="edit-actions"><button id="save-task" class="primary">Guardar</button><button id="cancel-edit" class="secondary">Cancelar</button></div></div><p id="action-error" class="muted"></p><div class="actions"><button id="edit-task" class="secondary">Editar texto</button><button id="copy-action" class="secondary">Copiar instrucción</button></div></div></div>
<script>
const tasks=${taskData};
const project=${JSON.stringify(project.slug)};
const modal=document.querySelector('#modal');
const cards=[...document.querySelectorAll('.task')];
const columns=[...document.querySelectorAll('.column')];
const search=document.querySelector('#task-search');
const searchCount=document.querySelector('#search-count');
const refreshButton=document.querySelector('#refresh-board');
${statsPanelInitScript('ariadne-mejoras-stats-open')}
let selectedTask=null;
refreshButton.onclick=()=>{refreshButton.disabled=true;refreshButton.textContent='↻ Actualizando…';window.location.reload()};
function openTask(task){selectedTask=task;document.querySelector('#detail-title').textContent=(task.id?task.id+' · ':'')+task.title;document.querySelector('#detail-area').textContent='Área: '+task.area;document.querySelector('#detail-body').innerHTML=task.detailHtml;document.querySelector('#detail-edit').hidden=true;document.querySelector('#detail-view').hidden=false;modal.classList.add('open')}
function filterTasks(){const q=search.value.trim().toLowerCase();let visible=0;cards.forEach((card)=>{const match=!q||card.dataset.search.includes(q);card.hidden=!match;if(match)visible++});columns.forEach((col)=>{const count=[...col.querySelectorAll('.task')].filter((c)=>!c.hidden).length;const el=col.querySelector('.column-count');if(el)el.textContent=count});searchCount.textContent=q?visible+' resultado'+(visible===1?'':'s'):''}
async function moveTask(id,status){const r=await fetch('/api/tasks/status?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Error');location.reload()}
search.addEventListener('input',filterTasks);
cards.forEach((c)=>c.onclick=()=>openTask(tasks[c.dataset.task]));
cards.forEach((card)=>{card.addEventListener('dragstart',(e)=>{card.classList.add('dragging');e.dataTransfer.setData('text/plain',card.dataset.taskId)});card.addEventListener('dragend',()=>card.classList.remove('dragging'))});
columns.forEach((column)=>{column.addEventListener('dragover',(e)=>{e.preventDefault()});column.addEventListener('drop',async(e)=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');const task=tasks.find((t)=>t.id===id);const status=column.dataset.column;if(!task||task.status===status)return;try{await moveTask(id,status)}catch(err){document.querySelector('#action-error').textContent=err.message;modal.classList.add('open')}})});
document.querySelector('#edit-task').onclick=()=>{document.querySelector('#source-editor').value=selectedTask.source||'';document.querySelector('#detail-view').hidden=true;document.querySelector('#detail-edit').hidden=false};
document.querySelector('#cancel-edit').onclick=()=>{document.querySelector('#detail-edit').hidden=true;document.querySelector('#detail-view').hidden=false};
document.querySelector('#save-task').onclick=async()=>{const r=await fetch('/api/tasks/content?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id,source:document.querySelector('#source-editor').value})});const j=await r.json();if(!r.ok){document.querySelector('#action-error').textContent=j.error;return}location.reload()};
document.querySelector('#copy-action').onclick=async()=>{if(!selectedTask)return;await navigator.clipboard.writeText('Atiende '+selectedTask.id+': implementa la mejora, prueba y documenta evidencia. Solo si no hay bugs abiertos con mayor prioridad.');document.querySelector('#copy-action').textContent='Copiado';setTimeout(()=>document.querySelector('#copy-action').textContent='Copiar instrucción',1500)};
document.querySelector('.close').onclick=()=>modal.classList.remove('open');modal.onclick=(e)=>{if(e.target===modal)modal.classList.remove('open')};
</script>
</body>
</html>`;
}

module.exports = {
  isImprovementTask,
  inferImprovementArea,
  buildImprovementStats,
  renderImprovementStatsSummary,
  renderImprovementStatsDetail,
  renderImprovementStatsHtml,
  mejorasBoardPage,
};
