const {
  QUEUE_BOARD_CSS,
  queuePositionHtml,
  queueTaskClassName,
  queueColumnTitle,
} = require('./board-queue');
const {
  statsPanelStyles,
  renderCollapsibleStatsPanel,
  statsPanelInitScript,
} = require('./board-stats');
const { boardColumns } = require('./board-columns');
const {
  boardCreateStyles,
  boardCreateButton,
  boardCreateInitScript,
} = require('./board-create');

const BUG_THEME_RULES = [
  ['Justo / IA', /justo|pretension|rag|ocr|presupuesto|cuant/i],
  ['Carga y uploads', /upload|zip|archivo|documento|onfile|onzip|subir|procesando|audio|video/i],
  ['Informes', /informe|plantilla|report|truncad/i],
  ['Usuarios y permisos', /usuario|permiso|admin|firma|ranking|superadmin|suscrip/i],
  ['Despachos / juzgados', /despacho|juzgado/i],
  ['Infra / secretos', /database_url|secreto|credencial|function|internal|deploy/i],
  ['Ariadne / Hub', /ariadne|kanban|hub|backlog/i],
  ['UI / frontend', /modal|congela|banner|cache|hosting|firebase\.html|transcrip/i],
  ['Seguridad', /seguridad|security/i],
  ['Radicados', /radicado|temporal|definitivo/i],
];

function isBugTask(task) {
  if (String(task.type || '').toLowerCase() === 'bug') return true;
  if ((task.labels || []).some((label) => String(label).toLowerCase() === 'bug')) return true;
  if (/^(bug|historico-bug|seguridad)\b/i.test(String(task.title || ''))) return true;
  return false;
}

function inferBugTheme(task) {
  const haystack = `${task.title} ${(task.labels || []).join(' ')}`.toLowerCase();
  for (const [theme, pattern] of BUG_THEME_RULES) {
    if (pattern.test(haystack)) return theme;
  }
  const custom = (task.labels || []).filter((label) => !['bug', 'production', 'regression'].includes(String(label).toLowerCase()));
  if (custom.length) return custom[0].replace(/^\w/, (char) => char.toUpperCase());
  return 'General';
}

function buildBugStats(bugs) {
  const byTheme = new Map();
  const byStatus = new Map();
  const byPriority = new Map();
  for (const bug of bugs) {
    const theme = inferBugTheme(bug);
    if (!byTheme.has(theme)) {
      byTheme.set(theme, { theme, total: 0, open: 0, done: 0, queued: 0, active: 0 });
    }
    const row = byTheme.get(theme);
    row.total += 1;
    const status = String(bug.status || '').toLowerCase();
    if (status === 'done') row.done += 1;
    else if (status === 'queued') row.queued += 1;
    else if (status === 'in progress') row.active += 1;
    else row.open += 1;
    byStatus.set(bug.status, (byStatus.get(bug.status) || 0) + 1);
    byPriority.set(bug.priority, (byPriority.get(bug.priority) || 0) + 1);
  }
  const themes = [...byTheme.values()]
    .map((row) => ({ ...row, closeRate: row.total ? Math.round((row.done / row.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total || a.theme.localeCompare(b.theme, 'es'));
  const done = bugs.filter((bug) => String(bug.status).toLowerCase() === 'done').length;
  return {
    total: bugs.length,
    open: bugs.length - done,
    done,
    closeRate: bugs.length ? Math.round((done / bugs.length) * 100) : 0,
    byTheme: themes,
    byStatus: Object.fromEntries(byStatus),
    byPriority: Object.fromEntries(byPriority),
  };
}

function renderBugStatsSummary(stats) {
  return `<section class="stats-grid stats-grid-compact" aria-label="Resumen de bugs">
      <article class="kpi"><span>Total</span><strong>${stats.total}</strong></article>
      <article class="kpi warn"><span>Open</span><strong>${stats.open}</strong></article>
      <article class="kpi good"><span>Done</span><strong>${stats.done}</strong></article>
      <article class="kpi"><span>Cierre</span><strong>${stats.closeRate}%</strong></article>
    </section>`;
}

function renderBugStatsDetail(stats, escapeHtml) {
  const maxTheme = Math.max(1, ...stats.byTheme.map((row) => row.total));
  const themeBars = stats.byTheme.map((row) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(row.theme)}</span>
      <div class="bar-track"><i style="width:${Math.round((row.total / maxTheme) * 100)}%"></i></div>
      <span class="bar-value">${row.total}</span>
    </div>`).join('');
  const tableRows = stats.byTheme.map((row) => `
    <tr>
      <td>${escapeHtml(row.theme)}</td>
      <td>${row.total}</td>
      <td>${row.open}</td>
      <td>${row.queued}</td>
      <td>${row.active}</td>
      <td>${row.done}</td>
      <td><span class="rate ${row.closeRate >= 70 ? 'good' : row.closeRate >= 40 ? 'mid' : 'low'}">${row.closeRate}%</span></td>
    </tr>`).join('');
  const priorityRows = Object.entries(stats.byPriority)
    .sort((a, b) => b[1] - a[1])
    .map(([priority, count]) => `<span class="pill priority-chip">${escapeHtml(priority)} · ${count}</span>`)
    .join('');
  return `<section class="analytics">
      <article class="panel-card">
        <h2>Bugs por tema</h2>
        <p class="hint">Temas inferidos por título y etiquetas. Los más altos concentran más incidencias.</p>
        ${themeBars || '<p class="empty">Sin bugs clasificados.</p>'}
      </article>
      <article class="panel-card">
        <h2>Comparativo por tema</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tema</th><th>Total</th><th>To Do</th><th>Queue</th><th>Doing</th><th>Done</th><th>Close</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="7">Sin datos</td></tr>'}</tbody>
          </table>
        </div>
      </article>
      <article class="panel-card compact">
        <h2>Prioridad</h2>
        <div class="pill-row">${priorityRows || '<span class="empty">—</span>'}</div>
      </article>
    </section>`;
}

function renderBugStatsHtml(stats, escapeHtml) {
  const hint = `${stats.byTheme.length} tema${stats.byTheme.length === 1 ? '' : 's'}`;
  return renderCollapsibleStatsPanel(
    renderBugStatsSummary(stats),
    renderBugStatsDetail(stats, escapeHtml),
    hint,
  );
}

function bugsBoardPage(project, helpers) {
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
  const allTasks = projectTasks(project);
  const bugs = allTasks.filter(isBugTask);
  const stats = buildBugStats(bugs);
  const counts = boardCounts(project, projectTasks, isBugTask, isImprovementTask);
  const navHtml = boardNavHtml(project, 'bugs', counts, helpers);
  const columns = boardColumns({
    todo: 'Pending bugs',
    doing: 'Active fixes',
    done: 'Closed with evidence',
  });
  const cards = columns.map(({ status, label, hint, queue }) => {
    const sorter = queue ? sortQueuedTasks : sortTasksByPriority;
    const items = sorter(bugs.filter((task) => task.status.toLowerCase() === status.toLowerCase()));
    const content = items.map((task, position) => {
      const index = bugs.indexOf(task);
      const theme = inferBugTheme(task);
      const searchable = `${task.id} ${task.title} ${task.priority} ${theme} ${task.file}`.toLowerCase();
      const queuePosition = queue ? queuePositionHtml(position) : '';
      const dragHint = queue ? '⋮⋮ Drag to reorder queue' : '⋮⋮ Drag to change status';
      return `<button class="${queueTaskClassName('task type-bug-card', queue, position)}" draggable="true" data-task="${index}" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-search="${escapeHtml(searchable)}">
        ${queuePosition}
        <span class="task-heading"><strong class="task-id">${escapeHtml(task.id)}</strong><strong class="task-title">${escapeHtml(task.title)}</strong></span>
        <span class="task-meta"><span class="theme-badge">${escapeHtml(theme)}</span><span class="priority priority-${priorityRank(task.priority)}">${escapeHtml(task.priority)}</span></span>
        <span class="drag-hint">${dragHint}</span>
      </button>`;
    }).join('') || `<p class="empty">${queue ? 'Drag here to authorize the next bug.' : 'Sin bugs en esta columna'}</p>`;
    return `<section class="column${queue ? ' queue-column' : ''}" data-column="${escapeHtml(status)}">
      <header class="column-head"><div><span class="column-kicker">${escapeHtml(hint)}</span><h2>${queueColumnTitle(escapeHtml(label), queue)}</h2></div><span class="column-count">${items.length}</span></header>
      ${queue ? '<p class="queue-rule">Drag within the queue to reorder. Turn 1 runs first.</p>' : ''}
      <div class="task-list">${content}</div>
    </section>`;
  }).join('');
  const taskData = JSON.stringify(bugs.map(({ id, title, status, priority, type, file, source, labels }) => ({
    id, title, status, priority, type, file,
    theme: inferBugTheme({ id, title, status, priority, type, file, labels }),
    detailHtml: taskDetailHtml(source),
    source,
  }))).replace(/</g, '\\u003c');
  const statsHtml = renderBugStatsHtml(stats, escapeHtml);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project.name)} · Bugs · Ariadne</title>
<style>
:root{color-scheme:dark;--text-primary:#f8eef0;--text-muted:#c4a9b0;font:15px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;background:#120b0d;color:var(--text-primary)}
*{box-sizing:border-box}body{margin:0;padding:24px 28px 40px;max-width:1680px;margin:auto;background:radial-gradient(circle at 20% -10%,#3b1820 0,transparent 32%),#120b0d}
a{color:#ff9eb3}.muted{color:#c4a9b0}
${boardNavStyles()}
.toolbar{display:flex;gap:12px;align-items:center;margin:18px 0;flex-wrap:wrap}.search{flex:1;min-width:240px;max-width:680px;background:#24161a;border:1px solid #5a3540;border-radius:12px;color:#fff;padding:13px 15px;font:inherit}
.refresh-button{flex:0 0 auto;border:1px solid #6c3a48;background:#2a151c;color:#ffc2cf;border-radius:12px;padding:12px 15px;font-weight:700;cursor:pointer;font:inherit}.refresh-button:hover{background:#3a1a24}.refresh-button:disabled{opacity:.6;cursor:wait}
${boardCreateStyles('bugs')}
${statsPanelStyles('bugs')}
.kpi{background:#24161a;border:1px solid #5a3540;border-radius:14px;padding:16px}.kpi span{display:block;color:#c4a9b0;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.kpi strong{font-size:28px}.kpi.warn strong{color:#ffb4b4}.kpi.good strong{color:#8de1b8}
.analytics{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}.panel-card{background:#1a1114;border:1px solid #4f2f39;border-radius:15px;padding:16px}.panel-card.compact{grid-column:1/-1}.panel-card h2{margin:0 0 8px;font-size:17px}.hint{color:#b697a0;font-size:12px;margin:0 0 12px}
.bar-row{display:grid;grid-template-columns:150px 1fr 36px;gap:10px;align-items:center;margin:8px 0}.bar-label{font-size:12px;color:#f0d8de}.bar-track{height:10px;background:#2a151c;border-radius:999px;overflow:hidden}.bar-track i{display:block;height:100%;background:linear-gradient(90deg,#ff5d7d,#ff9eb3);border-radius:999px}.bar-value{font-weight:800;color:#ffc2cf}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px 8px;border-bottom:1px solid #3a222a;text-align:left}th{color:#ff9eb3;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.rate.good{color:#8de1b8}.rate.mid{color:#ffd59a}.rate.low{color:#ffb4b4}.pill-row{display:flex;gap:8px;flex-wrap:wrap}.pill{background:#311820;color:#ffc2cf;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}
.board{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:14px;align-items:stretch}
.column{display:flex;flex-direction:column;background:#1a1114;border:1px solid #4f2f39;border-radius:15px;padding:13px;min-height:360px}.column-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #4f2f39}.column-kicker{display:block;color:#b697a0;font-size:10px;text-transform:uppercase;letter-spacing:.11em;font-weight:800}.column-count{background:#4a1f2a;color:#ffb4c5;border-radius:9px;min-width:28px;height:28px;display:grid;place-items:center;font-weight:900}
.task-list{flex:1 1 auto;display:flex;flex-direction:column;min-height:240px;padding-top:6px}.task{display:block;width:100%;text-align:left;color:#fff;background:#27161b;border:1px solid #613242;border-radius:11px;padding:13px;margin:8px 0;cursor:grab}.task[hidden]{display:none!important}.task:hover{border-color:#ff8da8}.task.dragging{opacity:.35}
.task-heading{display:grid;gap:4px}.task-id{color:#ff9eb3;font-size:12px}.task-title{font-size:13px}.task-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.theme-badge{background:#4a1f2a;color:#ffc2cf;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800}
.priority{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:800;font-size:11px}.priority-0{background:#991b1b;color:#fee2e2}.priority-1{background:#92400e;color:#ffedd5}.priority-2{background:#164e63;color:#a5f3fc}.priority-3{background:#334155;color:#cbd5e1}
${QUEUE_BOARD_CSS}
.empty{color:#b697a0;text-align:center;padding:18px 8px;font-size:12px}.drag-hint{display:block;color:#93747c;font-size:10px;margin-top:8px}
.modal{display:none;position:fixed;inset:0;background:#000c;align-items:center;justify-content:center;padding:20px;z-index:10}.modal.open{display:flex}.panel{background:#1a1114;border:1px solid #613242;border-radius:18px;max-width:880px;width:100%;max-height:90vh;overflow:auto;padding:24px}.close{float:right;background:#311820;border:0;color:#ffc2cf;width:36px;height:36px;border-radius:10px;font-size:22px;cursor:pointer}
.detail{display:grid;gap:12px}.source-editor{width:100%;min-height:320px;background:#120b0d;border:1px solid #5a3540;border-radius:12px;color:#fff;font:13px/1.5 ui-monospace,Menlo,monospace;padding:14px}
.actions,.edit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.primary,.secondary{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary{background:#ff5d7d;color:#fff}.secondary{background:#311820;color:#ffc2cf}
@media(max-width:1100px){.analytics{grid-template-columns:1fr}.stats-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}.board{grid-template-columns:repeat(2,minmax(220px,1fr))}}
@media(max-width:700px){.stats-grid,.board{grid-template-columns:1fr}}
</style>
</head>
<body>
${navHtml}
${statsHtml}
<div class="toolbar">
  <input id="task-search" class="search" type="search" placeholder="Buscar bug por ID, tema, título o prioridad…">
  <span id="search-count" class="muted"></span>
  ${boardCreateButton('+ New bug')}
  <button id="refresh-board" class="refresh-button" type="button">↻ Refrescar</button>
  <span id="last-refresh" class="muted" aria-live="polite">Actualizado ahora</span>
</div>
<main class="board">${cards}</main>
<div id="modal" class="modal"><div class="panel"><button class="close">×</button><h2 id="detail-title"></h2><p id="detail-theme" class="muted"></p><div id="detail-view"><div id="detail-body" class="detail"></div></div><div id="detail-edit" hidden><textarea id="source-editor" class="source-editor"></textarea><div class="edit-actions"><button id="save-task" class="primary">Guardar</button><button id="cancel-edit" class="secondary">Cancelar</button></div></div><p id="action-error" class="muted"></p><div class="actions"><button id="edit-task" class="secondary">Editar texto</button><button id="copy-action" class="secondary">Copiar instrucción</button></div></div></div>
<script>
const tasks=${taskData};
const project=${JSON.stringify(project.slug)};
const modal=document.querySelector('#modal');
const cards=[...document.querySelectorAll('.task')];
const columns=[...document.querySelectorAll('.column')];
const search=document.querySelector('#task-search');
const searchCount=document.querySelector('#search-count');
const refreshButton=document.querySelector('#refresh-board');
${statsPanelInitScript('ariadne-bugs-stats-open')}
${boardCreateInitScript({ type: 'bug', priority: 'High', labels: ['bug'], promptText: 'New bug title (creates CODE-B-n):', buttonLabel: '+ New bug' })}
let selectedTask=null;
refreshButton.onclick=()=>{refreshButton.disabled=true;refreshButton.textContent='↻ Actualizando…';window.location.reload()};
function openTask(task){selectedTask=task;document.querySelector('#detail-title').textContent=(task.id?task.id+' · ':'')+task.title;document.querySelector('#detail-theme').textContent='Tema: '+task.theme;document.querySelector('#detail-body').innerHTML=task.detailHtml;document.querySelector('#detail-edit').hidden=true;document.querySelector('#detail-view').hidden=false;modal.classList.add('open')}
function filterTasks(){const q=search.value.trim().toLowerCase();let visible=0;cards.forEach((card)=>{const match=!q||card.dataset.search.includes(q);card.hidden=!match;if(match)visible++});columns.forEach((col)=>{const count=[...col.querySelectorAll('.task')].filter((c)=>!c.hidden).length;const el=col.querySelector('.column-count');if(el)el.textContent=count});searchCount.textContent=q?visible+' resultado'+(visible===1?'':'s'):''}
async function moveTask(id,status){const r=await fetch('/api/tasks/status?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Error');location.reload()}
search.addEventListener('input',filterTasks);
cards.forEach((c)=>c.onclick=()=>openTask(tasks[c.dataset.task]));
cards.forEach((card)=>{card.addEventListener('dragstart',(e)=>{card.classList.add('dragging');e.dataTransfer.setData('text/plain',card.dataset.taskId)});card.addEventListener('dragend',()=>card.classList.remove('dragging'))});
columns.forEach((column)=>{column.addEventListener('dragover',(e)=>{e.preventDefault()});column.addEventListener('drop',async(e)=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');const task=tasks.find((t)=>t.id===id);const status=column.dataset.column;if(!task||task.status===status)return;try{await moveTask(id,status)}catch(err){document.querySelector('#action-error').textContent=err.message;modal.classList.add('open')}})});
document.querySelector('#edit-task').onclick=()=>{document.querySelector('#source-editor').value=selectedTask.source||'';document.querySelector('#detail-view').hidden=true;document.querySelector('#detail-edit').hidden=false};
document.querySelector('#cancel-edit').onclick=()=>{document.querySelector('#detail-edit').hidden=true;document.querySelector('#detail-view').hidden=false};
document.querySelector('#save-task').onclick=async()=>{const r=await fetch('/api/tasks/content?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id,source:document.querySelector('#source-editor').value})});const j=await r.json();if(!r.ok){document.querySelector('#action-error').textContent=j.error;return}location.reload()};
document.querySelector('#copy-action').onclick=async()=>{if(!selectedTask)return;await navigator.clipboard.writeText('Atiende '+selectedTask.id+': corrige el bug, prueba, audita con Pharos y despliega si pasa.');document.querySelector('#copy-action').textContent='Copiado';setTimeout(()=>document.querySelector('#copy-action').textContent='Copiar instrucción',1500)};
document.querySelector('.close').onclick=()=>modal.classList.remove('open');modal.onclick=(e)=>{if(e.target===modal)modal.classList.remove('open')};
</script>
</body>
</html>`;
}

module.exports = {
  BUG_THEME_RULES,
  isBugTask,
  inferBugTheme,
  buildBugStats,
  renderBugStatsSummary,
  renderBugStatsDetail,
  renderBugStatsHtml,
  bugsBoardPage,
};
