const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  isBugTask,
  buildBugStats,
  bugsBoardPage,
} = require('./bugs-board');
const {
  isImprovementTask,
  buildImprovementStats,
  mejorasBoardPage,
} = require('./mejoras-board');
const {
  boardCounts,
  boardNavHtml,
  boardNavStyles,
} = require('./board-chrome');
const { boardColumns, STATUS_DISPLAY } = require('./board-columns');
const { createTaskFile, projectTaskCode, formatTaskId, parseTypedTaskId } = require('./task-ids');
const { normalizeProjectTaskIds } = require('./task-id-normalize');

const ROOT = __dirname;
const PORT = Number(process.env.ARIADNE_HUB_PORT || 4177);
const BOARD_PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const HOST = '127.0.0.1';
const CATALOG = path.join(ROOT, 'projects.json');
const BACKLOG = path.join(ROOT, 'node_modules', '.bin', 'backlog');
const WEB = path.join(ROOT, 'public');
const browserProcesses = new Map();

function readCatalog() {
  try { return JSON.parse(fs.readFileSync(CATALOG, 'utf8')); } catch { return []; }
}

function writeCatalog(projects) {
  fs.writeFileSync(CATALOG, `${JSON.stringify(projects, null, 2)}\n`);
}

function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'proyecto';
}

function uniqueSlug(name, projects) {
  const base = slugify(name);
  let slug = base; let n = 2;
  while (projects.some((project) => project.slug === slug)) slug = `${base}-${n++}`;
  return slug;
}

function parseTask(file) {
  const source = fs.readFileSync(file, 'utf8');
  const idMatch = source.match(/^id:\s*["']?([^"'\n]+)["']?\s*$/mi);
  const match = source.match(/^status:\s*["']?([^"'\n]+)["']?\s*$/mi);
  const priorityMatch = source.match(/^priority:\s*["']?([^"'\n]+)["']?\s*$/mi);
  const typeMatch = source.match(/^type:\s*["']?([^"'\n]+)["']?\s*$/mi);
  const ordinalMatch = source.match(/^ordinal:\s*(\d+)\s*$/mi);
  const titleMatch = source.match(/^title:\s*(?:(?:["'])(.*?)["']|(.+))\s*$/mi);
  let title = titleMatch ? (titleMatch[1] ?? titleMatch[2] ?? '').trim() : '';
  if (/^(?:>-|>\-|\||\|-)$/.test(title)) {
    const titleLine = source.slice(titleMatch.index + titleMatch[0].length);
    const continuation = titleLine.split('\n').slice(0, 8)
      .filter((line) => /^\s{2,}\S/.test(line))
      .map((line) => line.trim())
      .join(title === '|' || title === '|-' ? '\n' : ' ')
      .trim();
    title = continuation;
  }
  if (!title) title = path.basename(file).replace(/^[^-]+-\d+\s*-\s*/, '').replace(/\.md$/, '').replace(/-/g, ' ');
  const labels = [];
  const labelsBlock = source.match(/^labels:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (labelsBlock) {
    for (const match of labelsBlock[1].matchAll(/^\s+-\s+(.+)$/gm)) labels.push(match[1].trim());
  }
  const createdMatch = source.match(/^created_date:\s*['"]?([^'"\n]+)['"]?\s*$/mi);
  return {
    id: idMatch ? idMatch[1].trim() : '',
    title,
    status: match ? match[1].trim() : 'To Do',
    priority: priorityLabel(priorityMatch ? priorityMatch[1].trim() : 'Medium'),
    type: typeMatch ? typeMatch[1].trim() : 'task',
    ordinal: Number(ordinalMatch?.[1] || Number.MAX_SAFE_INTEGER),
    labels,
    createdDate: createdMatch ? createdMatch[1].trim() : '',
  };
}

const PRIORITY_ORDER = new Map([['ultra high', 0], ['high', 1], ['medium', 2], ['low', 3]]);
function priorityLabel(priority) {
  const normalized = String(priority || '').trim().toLowerCase();
  return normalized === 'ultra high' ? 'Ultra High' : normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : 'Medium';
}
function priorityRank(priority) { return PRIORITY_ORDER.get(String(priority || '').trim().toLowerCase()) ?? 99; }
function sortTasksByPriority(tasks) {
  return [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title, 'es'));
}

function sortQueuedTasks(tasks) {
  return [...tasks].sort((a, b) => (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title, 'es'));
}

function nextQueuedTask(tasks) {
  return sortQueuedTasks(tasks.filter((task) => task.status.toLowerCase() === 'queued'))[0] || null;
}

function pickNextBug(tasks) {
  const sorted = sortTasksByPriority(tasks.filter(isBugTask));
  const task = sorted.find((item) => /^in progress$/i.test(item.status))
    || sorted.find((item) => /^queued$/i.test(item.status))
    || sorted.find((item) => /^to do$/i.test(item.status));
  return task ? { id: task.id, title: task.title } : null;
}

function pickNextImprovement(tasks) {
  const sorted = sortTasksByPriority(tasks.filter(isImprovementTask));
  const task = sorted.find((item) => /^in progress$/i.test(item.status))
    || sorted.find((item) => /^queued$/i.test(item.status))
    || sorted.find((item) => /^to do$/i.test(item.status));
  return task ? { id: task.id, title: task.title } : null;
}

function taskDetail(source) {
  return String(source || '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/<!--\s*SECTION:[^>]+-->/g, '')
    .replace(/<!--\s*AC:[^>]+-->/g, '')
    .replace(/^## /gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inlineTaskMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
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

  return sections.map((section) => {
    const blocks = [];
    let list = [];
    const flushList = () => {
      if (!list.length) return;
      blocks.push(`<ul class="detail-list">${list.join('')}</ul>`);
      list = [];
    };
    for (const rawLine of section.lines) {
      const line = rawLine.trim();
      if (!line) { flushList(); continue; }
      const checklist = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
      const bullet = line.match(/^-\s+(.*)$/);
      if (checklist) {
        const checked = checklist[1].toLowerCase() === 'x';
        list.push(`<li class="check-item${checked ? ' checked' : ''}"><span aria-hidden="true">${checked ? '✓' : '○'}</span><span>${inlineTaskMarkdown(checklist[2])}</span></li>`);
      } else if (bullet) {
        list.push(`<li><span aria-hidden="true">•</span><span>${inlineTaskMarkdown(bullet[1])}</span></li>`);
      } else {
        flushList();
        blocks.push(`<p>${inlineTaskMarkdown(line)}</p>`);
      }
    }
    flushList();
    return `<section class="detail-section"><h3>${escapeHtml(section.title)}</h3>${blocks.join('')}</section>`;
  }).join('');
}

function projectTasks(project) {
  const tasks = [];
  for (const dir of ['tasks', 'completed', 'archive']) {
    const full = path.join(project.path, 'backlog', dir);
    if (!fs.existsSync(full)) continue;
    for (const file of fs.readdirSync(full).filter((name) => name.endsWith('.md'))) {
      try {
        const taskFile = path.join(full, file);
        tasks.push({ ...parseTask(taskFile), file: path.join(dir, file), source: fs.readFileSync(taskFile, 'utf8') });
      } catch { /* ignore malformed task */ }
    }
  }
  return tasks;
}

function summarize(project) {
  const tasks = projectTasks(project);
  const bugs = tasks.filter(isBugTask);
  const improvements = tasks.filter(isImprovementTask);
  const bugsDone = bugs.filter((task) => /done|complete/i.test(task.status)).length;
  const impDone = improvements.filter((task) => /done|complete/i.test(task.status)).length;
  const nextBug = pickNextBug(tasks);
  const nextImprovement = pickNextImprovement(tasks);
  return {
    ...project,
    exists: fs.existsSync(project.path),
    bugs: bugs.length,
    bugsOpen: bugs.length - bugsDone,
    bugsActive: bugs.filter((task) => /in progress|doing/i.test(task.status)).length,
    bugProgress: bugs.length ? Math.round((bugsDone / bugs.length) * 100) : 0,
    nextBug: nextBug ? `${nextBug.id ? `${nextBug.id} · ` : ''}${nextBug.title}` : null,
    improvements: improvements.length,
    improvementsOpen: improvements.length - impDone,
    improvementsActive: improvements.filter((task) => /in progress|doing/i.test(task.status)).length,
    progress: improvements.length ? Math.round((impDone / improvements.length) * 100) : 0,
    done: impDone,
    tasks: improvements.length,
    active: improvements.filter((task) => /in progress|doing/i.test(task.status)).length,
    blocked: improvements.filter((task) => /blocked/i.test(task.status)).length,
    next: nextImprovement ? `${nextImprovement.id ? `${nextImprovement.id} · ` : ''}${nextImprovement.title}` : null,
    focus: bugs.length - bugsDone > 0 ? 'bugs' : 'mejoras',
    boardRunning: project.port === BOARD_PORT,
  };
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (error) { reject(error); } }); req.on('error', reject); });
}

function initProject(project) {
  fs.mkdirSync(project.path, { recursive: true });
  const args = ['init', project.name, '--defaults', '--no-git', '--integration-mode', 'none', '--backlog-dir', 'backlog', '--config-location', 'root', '--task-prefix', project.slug.replace(/-/g, '').slice(0, 12)];
  return new Promise((resolve, reject) => {
    const child = spawn(BACKLOG, args, { cwd: project.path, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output || `backlog init failed (${code})`)));
  });
}

function runBacklog(project, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BACKLOG, ...args], { cwd: project.path, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output || `backlog failed (${code})`)));
  });
}

function findTask(project, taskId) {
  return projectTasks(project).find((item) => item.id.toLowerCase() === String(taskId).toLowerCase()) || null;
}

function resolveTaskFilePath(project, task) {
  const full = path.resolve(project.path, 'backlog', task.file);
  const backlogRoot = path.resolve(project.path, 'backlog');
  if (!full.startsWith(`${backlogRoot}${path.sep}`)) throw new Error('ruta de tarea inválida');
  return full;
}

function touchUpdatedDate(source) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (/^updated_date:/m.test(source)) return source.replace(/^updated_date:.*$/m, `updated_date: '${stamp}'`);
  return source.replace(/^(---\n[\s\S]*?)(\n---)/m, `$1\nupdated_date: '${stamp}'$2`);
}

function validateTaskSource(taskId, source) {
  const text = String(source ?? '');
  if (!text.trim()) throw new Error('el contenido no puede estar vacío');
  if (!/^---\n[\s\S]*?\n---/m.test(text)) throw new Error('el archivo debe conservar el frontmatter YAML (--- ... ---)');
  const idMatch = text.match(/^id:\s*["']?([^"'\n]+)["']?\s*$/mi);
  if (idMatch && idMatch[1].trim().toLowerCase() !== String(taskId).toLowerCase()) {
    throw new Error('no cambies el id de la tarea en el frontmatter');
  }
  return text;
}

async function applyQueueOrdinals(project, orderedIds) {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await runBacklog(project, ['task', 'edit', orderedIds[i], '--ordinal', String((i + 1) * 10), '--plain']);
  }
}

async function updateQueueOrder(project, orderedIds) {
  const normalized = orderedIds.map((id) => String(id).trim()).filter(Boolean);
  if (!normalized.length) throw new Error('la cola necesita al menos una tarea');
  const seen = new Set();
  for (const id of normalized) {
    const key = id.toLowerCase();
    if (seen.has(key)) throw new Error('hay tareas duplicadas en la cola');
    seen.add(key);
    const task = findTask(project, id);
    if (!task) throw new Error(`tarea no encontrada: ${id}`);
    if (task.status.toLowerCase() !== 'queued') {
      await runBacklog(project, ['task', 'edit', task.id, '--status', 'Queued', '--plain']);
    }
  }
  const queued = sortQueuedTasks(projectTasks(project).filter((task) => task.status.toLowerCase() === 'queued'));
  const fullOrder = [...normalized];
  const included = new Set(normalized.map((id) => id.toLowerCase()));
  for (const task of queued) {
    if (!included.has(task.id.toLowerCase())) fullOrder.push(task.id);
  }
  await applyQueueOrdinals(project, fullOrder);
  return fullOrder;
}

async function updateTaskStatus(project, taskId, status) {
  const allowed = new Set(['To Do', 'Queued', 'In Progress', 'Done']);
  if (!allowed.has(status)) throw new Error('estado de tarea inválido');
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const wasQueued = task.status.toLowerCase() === 'queued';
  await runBacklog(project, ['task', 'edit', task.id, '--status', status, '--plain']);
  if (status === 'Queued' && !wasQueued) {
    const queued = sortQueuedTasks(projectTasks(project).filter((item) => item.status.toLowerCase() === 'queued'));
    await applyQueueOrdinals(project, [...queued.map((item) => item.id).filter((id) => id.toLowerCase() !== task.id.toLowerCase()), task.id]);
  }
  return parseTask(path.join(project.path, 'backlog', task.file));
}

function updateTaskSource(project, taskId, source) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  const next = touchUpdatedDate(validateTaskSource(task.id, source));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { ...parseTask(filePath), file: task.file, source: next };
}

function createTask(project, options = {}) {
  const created = createTaskFile(project, options, {
    isBugTask,
    projectTasks,
    slugify,
    findTask,
  });
  const parsed = parseTask(created.path);
  return { ...parsed, file: created.file, source: created.source };
}

function ensureProjectTaskIds(project) {
  const preview = normalizeProjectTaskIds(project, { parseTask, apply: false });
  if (!preview.needsFix) return null;
  return normalizeProjectTaskIds(project, { parseTask, apply: true });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, HOST);
  });
}

async function openBoard(project, view) {
  project.port = BOARD_PORT;
  const params = new URLSearchParams({ project: project.slug });
  if (view) params.set('view', view);
  return `http://${HOST}:${BOARD_PORT}/?${params}`;
}

function boardHelpers() {
  return {
    escapeHtml,
    projectTasks,
    sortTasksByPriority,
    sortQueuedTasks,
    taskDetailHtml,
    priorityRank,
    HOST,
    PORT,
    BOARD_PORT,
    boardCounts,
    boardNavHtml,
    boardNavStyles,
    isBugTask,
    isImprovementTask,
  };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }

function boardPage(project) {
  const tasks = projectTasks(project);
  const columns = [
    ['To Do', 'To Do'],
    ['Queued', 'Queue'],
    ['In Progress', 'Doing'],
    ['Done', 'Done'],
  ];
  const cards = columns.map(([status, label]) => {
    const items = sortTasksByPriority(tasks.filter((task) => task.status.toLowerCase() === status.toLowerCase()));
    return `<section class="column"><h2>${label}<span>${items.length}</span></h2>${items.map((task) => `<button class="task" data-task="${tasks.indexOf(task)}" data-search="${escapeHtml(`${task.id} ${task.title} ${task.priority} ${task.type} ${task.file}`.toLowerCase())}"><b><span class="task-id">${escapeHtml(task.id || 'SIN JM')}</span> ${escapeHtml(task.title)}</b><div class="task-meta"><span class="priority priority-${priorityRank(task.priority)}">${escapeHtml(task.priority)}</span><span class="type type-${escapeHtml(task.type)}">${escapeHtml(task.type)}</span></div><small>${escapeHtml(task.file)}</small></button>`).join('') || '<p class="empty">Sin tareas</p>'}</section>`;
  }).join('');
  const taskData = JSON.stringify(tasks.map(({ id, title, status, priority, type, file, source }) => ({ id, title, status, priority, type, file, detail: taskDetail(source) }))).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.name)} · Ariadne</title><style>:root{color-scheme:dark;font:15px system-ui,sans-serif;background:#0d172a;color:#e8eef8}body{margin:0;padding:36px;max-width:1400px;margin:auto}a{color:#73d8c6}.eyebrow{color:#73d8c6;letter-spacing:.14em;font-size:11px;font-weight:700}h1{margin:6px 0 4px;font-size:32px}.muted{color:#9aaac0}.toolbar{display:flex;gap:12px;align-items:center;margin-top:22px}.search{flex:1;max-width:560px;background:#19283c;border:1px solid #405674;border-radius:10px;color:#e8eef8;padding:12px 14px;font:inherit}.search:focus{outline:2px solid #73d8c6;outline-offset:2px}.board{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px}.column{background:#19283c;border:1px solid #344963;border-radius:12px;padding:16px;min-height:300px}.column h2{font-size:16px;margin:0 0 14px;border-bottom:1px solid #344963;padding-bottom:12px}.column h2 span{float:right;color:#73d8c6}.task{display:block;width:100%;text-align:left;color:#e8eef8;background:#263950;border:1px solid #405674;border-radius:8px;padding:13px;margin:9px 0;cursor:pointer}.task:hover{border-color:#73d8c6;transform:translateY(-1px)}.task b{display:block;line-height:1.35}.task-id{color:#73d8c6;font-size:12px;font-weight:800;letter-spacing:.04em}.task small{display:block;color:#91a3b9;font-size:11px;margin-top:8px;word-break:break-all}.priority{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:800}.priority-0{background:#7f1d1d;color:#fecaca}.priority-1{background:#78350f;color:#fed7aa}.priority-2{background:#164e63;color:#a5f3fc}.priority-3{background:#334155;color:#cbd5e1}.empty{color:#75869b}.modal{display:none;position:fixed;inset:0;background:#0009;align-items:center;justify-content:center;padding:20px}.modal.open{display:flex}.panel{background:#19283c;border:1px solid #405674;border-radius:14px;max-width:760px;width:100%;max-height:85vh;overflow:auto;padding:26px}.panel h2{margin:8px 0 14px}.close{float:right;background:none;border:0;color:#9aaac0;font-size:24px;cursor:pointer}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.detail{white-space:pre-wrap;color:#c9d4e4;line-height:1.5;font-size:14px}.badge{display:inline-block;background:#183d42;color:#80e2d0;border-radius:20px;padding:4px 9px;font-size:12px}.badge.priority-0{background:#991b1b;color:#fee2e2}.badge.priority-1{background:#92400e;color:#ffedd5}.badge.type-bug{background:#be123c;color:#ffe4e6}@media(max-width:800px){.board{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column}.search{max-width:none}}</style></head><body><p class="eyebrow">ARIADNE · KANBAN LOCAL</p><h1>${escapeHtml(project.name)}</h1><p class="muted">${tasks.length} tareas · prioridad de atención: Ultra High → High → Medium → Low · <a href="http://${HOST}:${PORT}">Volver al Hub</a></p><div class="toolbar"><input id="task-search" class="search" type="search" placeholder="Buscar por JM-19, título, tipo o prioridad…" aria-label="Buscar tareas"><span id="search-count" class="muted"></span></div><main class="board">${cards}</main><div id="modal" class="modal" role="dialog" aria-modal="true"><div class="panel"><button class="close" aria-label="Cerrar">×</button><div class="meta"><span id="detail-priority" class="badge"></span><span id="detail-type" class="badge"></span><span id="detail-status" class="badge"></span></div><h2 id="detail-title"></h2><div id="detail-file" class="muted"></div><div id="detail-body" class="detail"></div></div></div><script>const tasks=${taskData};const modal=document.querySelector('#modal');const title=document.querySelector('#detail-title');const priority=document.querySelector('#detail-priority');const type=document.querySelector('#detail-type');const status=document.querySelector('#detail-status');const file=document.querySelector('#detail-file');const detail=document.querySelector('#detail-body');const search=document.querySelector('#task-search');const searchCount=document.querySelector('#search-count');const cards=[...document.querySelectorAll('.task')];function filterTasks(){const query=search.value.trim().toLowerCase();let visible=0;cards.forEach((card)=>{const match=!query||card.dataset.search.includes(query);card.hidden=!match;if(match)visible+=1});searchCount.textContent=query?visible+' resultado'+(visible===1?'':'s'):''}search.addEventListener('input',filterTasks);cards.forEach((button)=>button.onclick=()=>{const task=tasks[button.dataset.task];title.textContent=(task.id?task.id+' · ':'')+task.title;priority.textContent=task.priority;priority.className='badge priority-'+({"Ultra High":0,High:1,Medium:2,Low:3}[task.priority]??3);type.textContent=task.type;type.className='badge type-'+task.type;status.textContent=({"To Do":"To Do","Queued":"Queue","In Progress":"Doing","Done":"Done"}[task.status]||task.status);file.textContent=task.file;detail.textContent=task.detail;modal.classList.add('open')});document.querySelector('.close').onclick=()=>modal.classList.remove('open');modal.onclick=(event)=>{if(event.target===modal)modal.classList.remove('open')};</script></body></html>`;
}

function queueBoardPage(project) {
  const tasks = projectTasks(project);
  const queuedNext = nextQueuedTask(tasks);
  const columns = boardColumns();
  const cards = columns.map(({ status, label, hint, queue }) => {
    const items = (queue ? sortQueuedTasks : sortTasksByPriority)(tasks.filter((task) => task.status.toLowerCase() === status.toLowerCase()));
    const content = items.map((task, position) => {
      const index = tasks.indexOf(task);
      const searchable = `${task.id} ${task.title} ${task.priority} ${task.type} ${task.file}`.toLowerCase();
      const queuePosition = queue ? `<span class="queue-position" title="Posición en la cola"><small>Turno</small>${position + 1}</span>` : '';
      const dragHint = queue ? '⋮⋮ Arrastrar para reordenar la cola' : '⋮⋮ Arrastrar para cambiar de estado';
      return `<button class="task${queue ? ' queue-task' : ''}${queue && position === 0 ? ' queue-next' : ''}" draggable="true" data-task="${index}" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-search="${escapeHtml(searchable)}">
        ${queuePosition}
        <span class="task-heading"><strong class="task-id">${escapeHtml(task.id || 'SIN JM')}</strong><strong class="task-title">${escapeHtml(task.title)}</strong></span>
        <span class="task-meta"><span class="priority priority-${priorityRank(task.priority)}">${escapeHtml(task.priority)}</span><span class="type type-${escapeHtml(task.type)}">${escapeHtml(task.type)}</span></span>
        <span class="drag-hint">${dragHint}</span>
      </button>`;
    }).join('') || `<p class="empty">${queue ? 'Arrastra aquí lo próximo que quieres ejecutar.' : 'Sin tareas'}</p>`;
    return `<section class="column${queue ? ' queue-column' : ''}" data-column="${escapeHtml(status)}">
      <header class="column-head"><div><span class="column-kicker">${escapeHtml(hint)}</span><h2>${queue ? '<span class="queue-icon">≡</span>' : ''}${escapeHtml(label)}</h2></div><span class="column-count">${items.length}</span></header>
      ${queue ? '<p class="queue-rule">Arrastra dentro de la cola para cambiar el turno. El 1 se ejecuta primero.</p>' : ''}
      <div class="task-list" data-drop-status="${escapeHtml(status)}">${content}<p class="search-empty">Sin coincidencias en esta columna.</p></div>
    </section>`;
  }).join('');
  const taskData = JSON.stringify(tasks.map(({ id, title, status, priority, type, file, source }) => ({ id, title, status, priority, type, file, detailHtml: taskDetailHtml(source), source }))).replace(/</g, '\\u003c');
  const nextBanner = queuedNext
    ? `<section class="next-up"><span class="next-number">01</span><div class="next-copy"><span class="eyebrow">SIGUIENTE A EJECUTAR</span><h2>${escapeHtml(queuedNext.id)} · ${escapeHtml(queuedNext.title)}</h2><p><span class="priority priority-${priorityRank(queuedNext.priority)}">${escapeHtml(queuedNext.priority)}</span> Está primero en la cola operativa.</p></div><button class="primary" data-open-id="${escapeHtml(queuedNext.id)}">Ver detalle</button></section>`
    : '<section class="next-up empty-next"><span class="next-number">00</span><div class="next-copy"><span class="eyebrow">COLA DE EJECUCIÓN</span><h2>La cola está vacía</h2><p>Arrastra aquí la próxima tarea que quieres autorizar.</p></div></section>';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project.name)} · Ariadne</title>
<style>
:root{color-scheme:dark;font:15px Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:#091322;color:#e8eef8}
*{box-sizing:border-box}body{margin:0;padding:32px;max-width:1720px;margin:auto;background:radial-gradient(circle at 50% -15%,#182b46 0,transparent 35%)}a{color:#73d8c6}.eyebrow{color:#73d8c6;letter-spacing:.14em;font-size:11px;font-weight:800}
h1{margin:6px 0 4px;font-size:32px}.muted{color:#9aaac0}.toolbar{display:flex;gap:12px;align-items:center;margin-top:22px}
.search{flex:1;max-width:680px;background:#142238;border:1px solid #344a67;border-radius:12px;color:#e8eef8;padding:13px 15px;font:inherit}.refresh-button{border:1px solid #3d6a7a;background:#173b48;color:#8ce1d2;border-radius:12px;padding:12px 15px;font-weight:800;cursor:pointer}.refresh-button:hover{background:#205365}.refresh-button:disabled{opacity:.65;cursor:wait}
.search:focus{outline:2px solid #73d8c6;outline-offset:2px}.next-up{display:flex;align-items:center;gap:18px;margin-top:22px;padding:18px 20px;background:linear-gradient(125deg,#123a3c,#172841 72%);border:1px solid #32706d;border-radius:16px;box-shadow:0 12px 30px #0003}
.next-number{display:grid;place-items:center;flex:0 0 54px;height:54px;border-radius:14px;background:#62d3be;color:#092421;font-size:20px;font-weight:900}.next-copy{min-width:0;flex:1}.next-up h2{margin:4px 0 6px;font-size:18px}.next-up p{margin:0;color:#aebed0}.empty-next{border-style:dashed;opacity:.9}.empty-next .next-number{background:#25374f;color:#8da0b9}.board{display:grid;grid-template-columns:minmax(245px,.92fr) minmax(300px,1.15fr) minmax(245px,.92fr) minmax(245px,.92fr);gap:14px;margin-top:18px;align-items:stretch}
.column{display:flex;flex-direction:column;background:#142238;border:1px solid #2b405c;border-radius:15px;padding:13px;min-height:430px;box-shadow:0 8px 22px #0002;transition:border-color .15s,background .15s}.column-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:3px 4px 12px;border-bottom:1px solid #2b405c}.column-head h2{font-size:17px;margin:3px 0 0}.column-kicker{display:block;color:#7f92aa;font-size:10px;text-transform:uppercase;letter-spacing:.11em;font-weight:800}.column-count{display:grid;place-items:center;min-width:28px;height:28px;border-radius:9px;background:#20344d;color:#8ce1d2;font-weight:900}.task-list{flex:1 1 auto;display:flex;flex-direction:column;min-height:330px;padding:5px 0}.column.drag-over{border-color:#73d8c6;background:#162c3f}.column.drag-over .task-list{outline:2px dashed #73d8c688;outline-offset:3px;border-radius:10px;min-height:100%}
.queue-column{position:relative;background:linear-gradient(180deg,#241d3c,#171f36 70%);border-color:#6956a7;box-shadow:0 12px 34px #10082755}.queue-column:before{content:"";position:absolute;inset:0;border-radius:15px;pointer-events:none;background:linear-gradient(120deg,#8b5cf611,transparent 45%)}.queue-column .column-head{border-color:#56468b}.queue-column .column-kicker{color:#b8a7ef}.queue-column .column-count{background:#6d4bd2;color:#fff}.queue-icon{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:7px;border-radius:8px;background:#7252d6;color:white}.queue-rule{position:relative;margin:11px 4px 6px;color:#b8acd8;font-size:11px}.queue-column.drag-over{background:linear-gradient(180deg,#322454,#1c2740);border-color:#a78bfa}
.task{position:relative;display:block;width:100%;text-align:left;color:#e8eef8;background:#20344d;border:1px solid #38516f;border-radius:11px;padding:13px;margin:9px 0;cursor:grab;transition:transform .15s,border-color .15s,opacity .15s,box-shadow .15s}.task[hidden]{display:none!important}.task:hover{border-color:#73d8c6;transform:translateY(-2px)}.task:active{cursor:grabbing}.task.dragging{opacity:.35;transform:scale(.98)}.task.drop-before{box-shadow:inset 0 3px 0 #73d8c6}.task.search-match{border-color:#73d8c6;box-shadow:0 0 0 2px #73d8c633,0 10px 24px #0004}
.task-heading{display:grid;gap:5px;line-height:1.35}.task-id{color:#78dfcd;font-size:12px;letter-spacing:.06em}.task-title{font-size:13px}.task-meta{display:flex;gap:6px;margin-top:10px}.drag-hint{display:block;color:#71859e;font-size:10px;margin-top:10px}.queue-task{padding-left:52px;background:#292344;border-color:#594a88}.queue-task:hover{border-color:#a78bfa}.queue-next{background:linear-gradient(135deg,#3a2b64,#292344);border-color:#9a7cf0;box-shadow:0 6px 18px #150a3555}.queue-position{position:absolute;left:11px;top:13px;display:grid;place-items:center;width:31px;height:40px;border-radius:9px;background:#6d4bd2;color:#fff;font-size:16px;font-weight:900}.queue-position small{margin:0;color:#ddd6fe;font-size:7px;text-transform:uppercase;letter-spacing:.08em}
.priority,.type,.badge{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:800;font-size:11px}.priority-0{background:#991b1b;color:#fee2e2}.priority-1{background:#92400e;color:#ffedd5}.priority-2{background:#164e63;color:#a5f3fc}.priority-3{background:#334155;color:#cbd5e1}.type{background:#183d42;color:#80e2d0}.type-bug{background:#be123c;color:#ffe4e6}
.empty{color:#75869b;font-size:12px;line-height:1.5;padding:18px 8px;text-align:center;flex:1 1 auto;display:grid;place-items:center}.search-empty{display:none;color:#9aaac0;font-size:12px;line-height:1.5;padding:16px 8px;text-align:center;border:1px dashed #344a67;border-radius:11px;margin:9px 0}.column.search-no-results .search-empty{display:block}.column.search-no-results .empty{display:none}.primary,.secondary,.queue-action,.move-button{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary,.queue-action{background:#73d8c6;color:#102131}.secondary{background:#334155;color:#e8eef8}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.status-actions{display:flex;gap:7px;flex-wrap:wrap;padding:13px;background:#111d30;border:1px solid #2c405b;border-radius:12px;margin-top:18px}.status-actions:before{content:"Mover a";width:100%;color:#7f92aa;font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}.move-button{background:#263a55;color:#dce7f5;padding:8px 11px;font-size:11px}.move-button:hover{background:#365171}.move-button.current{display:none}
.modal{display:none;position:fixed;inset:0;background:#020713d9;align-items:center;justify-content:center;padding:20px;z-index:10;backdrop-filter:blur(5px)}.modal.open{display:flex}.panel{background:#142238;border:1px solid #405674;border-radius:18px;max-width:980px;width:100%;max-height:90vh;overflow:auto;padding:0;box-shadow:0 24px 80px #0009}.panel-header{position:sticky;top:0;z-index:2;padding:24px 28px 20px;background:#142238ee;border-bottom:1px solid #2c405b;backdrop-filter:blur(12px)}.panel-header h2{margin:8px 40px 8px 0;font-size:24px;line-height:1.25}.close{position:absolute;right:20px;top:18px;background:#24364e;border:0;border-radius:10px;color:#b8c5d6;font-size:22px;width:38px;height:38px;cursor:pointer}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:0}.detail-file{color:#7689a2;font-size:11px}.panel-body{padding:24px 28px 30px}.detail{display:grid;gap:13px;color:#c9d4e4;line-height:1.55;font-size:14px}.detail-section{background:#101d30;border:1px solid #293d58;border-radius:13px;padding:17px 18px}.detail-section h3{margin:0 0 11px;color:#8be1d2;font-size:12px;text-transform:uppercase;letter-spacing:.09em}.detail-section p{margin:7px 0}.detail-list{display:grid;gap:8px;list-style:none;padding:0;margin:0}.detail-list li{display:grid;grid-template-columns:20px 1fr;gap:7px;align-items:start}.check-item>span:first-child{color:#f8b84e;font-weight:900}.check-item.checked{color:#8fa3ba}.check-item.checked>span:first-child{color:#62d3be}.detail code{padding:2px 5px;border-radius:5px;background:#24344c;color:#b7f2e7}.detail-empty{color:#8da0b9}.source-editor{width:100%;min-height:360px;background:#0b1524;border:1px solid #344a67;border-radius:12px;color:#e8eef8;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px;resize:vertical}.source-editor:focus{outline:2px solid #73d8c6;outline-offset:2px}.edit-hint{color:#8da0b9;font-size:12px;margin:0 0 10px}.edit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.badge{background:#183d42;color:#80e2d0}.error{color:#fecaca;min-height:18px}
@media(max-width:1250px){.board{grid-template-columns:repeat(2,minmax(280px,1fr))}}@media(max-width:700px){body{padding:18px}.board{grid-template-columns:1fr}.toolbar,.next-up{align-items:stretch;flex-direction:column}.next-number{flex-basis:48px}.search{max-width:none}.panel-header,.panel-body{padding-left:18px;padding-right:18px}}
</style>
</head>
<body>
<p class="eyebrow">ARIADNE · COLA OPERATIVA LOCAL</p>
<h1>${escapeHtml(project.name)}</h1>
<p class="muted">${tasks.length} tareas · orden: Ultra High → High → Medium → Low · <a href="http://${HOST}:${PORT}">Volver al Hub</a></p>
${nextBanner}
<div class="toolbar"><input id="task-search" class="search" type="search" placeholder="Buscar por JM-19, título, tipo o prioridad…" aria-label="Buscar tareas"><span id="search-count" class="muted"></span><button id="refresh-board" class="refresh-button" type="button">↻ Refresh</button><span id="last-refresh" class="muted" aria-live="polite">Actualizado ahora</span></div>
<main class="board">${cards}</main>
<div id="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div class="panel"><header class="panel-header"><button class="close" aria-label="Cerrar">×</button><div class="meta"><span id="detail-priority" class="badge"></span><span id="detail-type" class="badge"></span><span id="detail-status" class="badge"></span></div><h2 id="detail-title"></h2><div id="detail-file" class="detail-file"></div></header><div class="panel-body"><div id="detail-view"><div id="detail-body" class="detail"></div></div><div id="detail-edit" hidden><p class="edit-hint">Edita el Markdown completo de la tarea. Conserva el bloque YAML inicial y no cambies el <code>id</code>.</p><textarea id="source-editor" class="source-editor" spellcheck="false"></textarea><div class="edit-actions"><button id="save-task" class="primary" type="button">Guardar cambios</button><button id="cancel-edit" class="secondary" type="button">Cancelar</button></div></div><div id="status-actions" class="status-actions"><button class="move-button" data-move-status="To Do">To Do</button><button class="move-button" data-move-status="Queued">Queue</button><button class="move-button" data-move-status="In Progress">Doing</button><button class="move-button" data-move-status="Done">Done</button></div><p id="action-error" class="error"></p><div class="actions"><button id="edit-task" class="secondary" type="button">Editar texto</button><button id="queue-action" class="queue-action"></button><button id="copy-action" class="secondary">Copy instruction for Codex</button></div></div></div></div>
<script>
const tasks=${taskData};
const statusLabels=${JSON.stringify(STATUS_DISPLAY)};
const project=${JSON.stringify(project.slug)};
const modal=document.querySelector('#modal');
const title=document.querySelector('#detail-title');
const priority=document.querySelector('#detail-priority');
const type=document.querySelector('#detail-type');
const status=document.querySelector('#detail-status');
const file=document.querySelector('#detail-file');
const detailView=document.querySelector('#detail-view');
const detailEdit=document.querySelector('#detail-edit');
const detail=document.querySelector('#detail-body');
const sourceEditor=document.querySelector('#source-editor');
const editTask=document.querySelector('#edit-task');
const saveTask=document.querySelector('#save-task');
const cancelEdit=document.querySelector('#cancel-edit');
const queueAction=document.querySelector('#queue-action');
const copyAction=document.querySelector('#copy-action');
const actionError=document.querySelector('#action-error');
const search=document.querySelector('#task-search');
const searchCount=document.querySelector('#search-count');
const refreshButton=document.querySelector('#refresh-board');
const lastRefresh=document.querySelector('#last-refresh');
const cards=[...document.querySelectorAll('.task')];
const columns=[...document.querySelectorAll('.column')];
const moveButtons=[...document.querySelectorAll('[data-move-status]')];
let selectedTask=null;
let editMode=false;
refreshButton.onclick=()=>{refreshButton.disabled=true;refreshButton.textContent='↻ Updating…';window.location.reload()};
function setEditMode(on){
  editMode=on;
  detailView.hidden=on;
  detailEdit.hidden=!on;
  statusActions.hidden=on;
  queueAction.hidden=on||!(selectedTask&&(selectedTask.status==='To Do'||selectedTask.status==='Queued'));
  copyAction.hidden=on;
  editTask.hidden=on;
  if(on&&selectedTask)sourceEditor.value=selectedTask.source||'';
}
const statusActions=document.querySelector('#status-actions');
function openTask(task){
  selectedTask=task;actionError.textContent='';setEditMode(false);
  title.textContent=(task.id?task.id+' · ':'')+task.title;
  priority.textContent=task.priority;priority.className='badge priority-'+({"Ultra High":0,High:1,Medium:2,Low:3}[task.priority]??3);
  type.textContent=task.type;type.className='badge type-'+task.type;
  status.textContent=statusLabels[task.status]||task.status;file.textContent='Fuente: '+task.file;detail.innerHTML=task.detailHtml;
  const queueable=task.status==='To Do'||task.status==='Queued';
  queueAction.hidden=!queueable;
  queueAction.textContent=task.status==='Queued'?'Quitar de cola':'Agregar a cola';
  moveButtons.forEach((button)=>button.classList.toggle('current',button.dataset.moveStatus===task.status));
  modal.classList.add('open');
}
function filterTasks(){const query=search.value.trim().toLowerCase();let visible=0;cards.forEach((card)=>{const match=!query||card.dataset.search.includes(query);card.hidden=!match;card.classList.toggle('search-match',!!query&&match);if(match)visible+=1});columns.forEach((column)=>{const count=[...column.querySelectorAll('.task')].filter((card)=>!card.hidden).length;const countEl=column.querySelector('.column-count');if(countEl)countEl.textContent=count;column.classList.toggle('search-no-results',!!query&&count===0)});searchCount.textContent=query?visible+' resultado'+(visible===1?'':'s'):''}
async function moveTask(taskId,nextStatus){actionError.textContent='';const response=await fetch('/api/tasks/status?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:taskId,status:nextStatus})});const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo mover la tarea');location.reload()}
async function saveQueueOrder(order){actionError.textContent='';const response=await fetch('/api/tasks/queue-order?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order})});const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo reordenar la cola');location.reload()}
function queueCards(queueList){return [...queueList.querySelectorAll('.task:not([hidden])')]}
function getDragAfterElement(container,y){const elements=[...container.querySelectorAll('.task:not(.dragging):not([hidden])')];return elements.reduce((closest,child)=>{const box=child.getBoundingClientRect();const offset=y-box.top-box.height/2;if(offset<0&&offset>closest.offset)return{offset,element:child};return closest},{offset:Number.NEGATIVE_INFINITY,element:null}).element}
function buildQueueOrder(queueList,taskId,afterElement){const cards=queueCards(queueList).map((card)=>card.dataset.taskId).filter((id)=>id!==taskId);if(!afterElement){cards.push(taskId)}else{const index=cards.indexOf(afterElement.dataset.taskId);cards.splice(index<0?cards.length:index,0,taskId)}return cards}
function clearQueueDropMarkers(){document.querySelectorAll('.task.drop-before').forEach((card)=>card.classList.remove('drop-before'))}
function refreshQueueTurnNumbers(queueList){queueCards(queueList).forEach((card,index)=>{const badge=card.querySelector('.queue-position');if(badge){badge.lastChild.textContent=String(index+1);card.classList.toggle('queue-next',index===0)}})}
async function saveTaskContent(){if(!selectedTask)return;actionError.textContent='';saveTask.disabled=true;saveTask.textContent='Guardando…';const response=await fetch('/api/tasks/content?project='+encodeURIComponent(project),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selectedTask.id,source:sourceEditor.value})});const result=await response.json();if(!response.ok){actionError.textContent=result.error||'No se pudo guardar la tarea';saveTask.disabled=false;saveTask.textContent='Guardar cambios';return}location.reload()}
editTask.onclick=()=>setEditMode(true);
cancelEdit.onclick=()=>{actionError.textContent='';setEditMode(false)};
saveTask.onclick=()=>saveTaskContent().catch((error)=>{actionError.textContent=error.message;saveTask.disabled=false;saveTask.textContent='Guardar cambios'});
search.addEventListener('input',filterTasks);
cards.forEach((button)=>button.onclick=()=>openTask(tasks[button.dataset.task]));
document.querySelectorAll('[data-open-id]').forEach((button)=>button.onclick=()=>openTask(tasks.find((task)=>task.id===button.dataset.openId)));
queueAction.onclick=async()=>{if(!selectedTask)return;queueAction.disabled=true;const nextStatus=selectedTask.status==='Queued'?'To Do':'Queued';try{await moveTask(selectedTask.id,nextStatus)}catch(error){actionError.textContent=error.message;queueAction.disabled=false}};
moveButtons.forEach((button)=>button.onclick=async()=>{if(!selectedTask)return;button.disabled=true;try{await moveTask(selectedTask.id,button.dataset.moveStatus)}catch(error){actionError.textContent=error.message;button.disabled=false}});
cards.forEach((card)=>{card.addEventListener('dragstart',(event)=>{card.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.dataset.taskId)});card.addEventListener('dragend',()=>{card.classList.remove('dragging');columns.forEach((column)=>column.classList.remove('drag-over'));clearQueueDropMarkers()})});
columns.forEach((column)=>{const queueList=column.querySelector('.task-list');column.addEventListener('dragover',(event)=>{event.preventDefault();event.dataTransfer.dropEffect='move';column.classList.add('drag-over');if(column.dataset.column==='Queued'&&queueList){clearQueueDropMarkers();const afterElement=getDragAfterElement(queueList,event.clientY);if(afterElement)afterElement.classList.add('drop-before')}});column.addEventListener('dragleave',(event)=>{if(!column.contains(event.relatedTarget)){column.classList.remove('drag-over');if(column.dataset.column==='Queued')clearQueueDropMarkers()}});column.addEventListener('drop',async(event)=>{event.preventDefault();column.classList.remove('drag-over');clearQueueDropMarkers();const taskId=event.dataTransfer.getData('text/plain');const task=tasks.find((item)=>item.id===taskId);const nextStatus=column.dataset.column;if(!task)return;if(nextStatus==='Queued'){const afterElement=queueList?getDragAfterElement(queueList,event.clientY):null;const order=buildQueueOrder(queueList||column,taskId,afterElement);if(queueList){const dragged=queueList.querySelector('[data-task-id="'+taskId+'"]');const anchor=afterElement||null;if(dragged){if(anchor&&anchor!==dragged)queueList.insertBefore(dragged,anchor);else if(!anchor)queueList.appendChild(dragged);refreshQueueTurnNumbers(queueList)}}try{await saveQueueOrder(order)}catch(error){actionError.textContent=error.message;modal.classList.add('open')}return}if(task.status===nextStatus)return;try{await moveTask(taskId,nextStatus)}catch(error){actionError.textContent=error.message;modal.classList.add('open')}})});
copyAction.onclick=async()=>{if(!selectedTask)return;const prompt='Atiende '+selectedTask.id+': implementa, prueba, audita con Pharos y despliega si todo pasa.';await navigator.clipboard.writeText(prompt);copyAction.textContent='Instrucción copiada';setTimeout(()=>copyAction.textContent='Copiar instrucción para Codex',1600)};
document.querySelector('.close').onclick=()=>modal.classList.remove('open');modal.onclick=(event)=>{if(event.target===modal)modal.classList.remove('open')};document.addEventListener('keydown',(event)=>{if(event.key==='Escape')modal.classList.remove('open')});
</script>
</body>
</html>`;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/projects') return json(res, 200, readCatalog().map(summarize));
  if (req.method === 'POST' && url.pathname === '/api/projects') {
    try {
      const data = await body(req); const projects = readCatalog(); const name = String(data.name || '').trim();
      if (!name) return json(res, 400, { error: 'name is required' });
      const slug = uniqueSlug(name, projects); const project = { slug, name, path: path.resolve(data.path || path.join(ROOT, 'projects', slug)), port: 6420 + projects.length + 1, createdAt: new Date().toISOString() };
      const alreadyInitialized = fs.existsSync(path.join(project.path, 'backlog.config.yml')) || fs.existsSync(path.join(project.path, 'backlog'));
      if (!alreadyInitialized) await initProject(project);
      projects.push(project); writeCatalog(projects); return json(res, 201, summarize(project));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  const board = url.pathname.match(/^\/api\/projects\/([^/]+)\/browser$/);
  if (req.method === 'POST' && board) {
    const project = readCatalog().find((item) => item.slug === board[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      const pageUrl = await openBoard(project, data.view || null);
      writeCatalog(readCatalog().map((item) => item.slug === project.slug ? project : item));
      return json(res, 200, { url: pageUrl });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'GET') {
    const asset = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.resolve(WEB, asset);
    if (file.startsWith(`${WEB}${path.sep}`) && fs.existsSync(file)) {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'content-type': `${types[path.extname(file)] || 'text/plain'}; charset=utf-8` }); return res.end(fs.readFileSync(file));
    }
  }
  json(res, 404, { error: 'not found' });
}

async function handleBoard(req, res) {
  const url = new URL(req.url, `http://${HOST}:${BOARD_PORT}`);
  const projects = readCatalog();
  const project = projects.find((item) => item.slug === url.searchParams.get('project')) || projects[0];
  if (!project) return res.end('No hay proyectos registrados en Ariadne Hub.');
  if (req.method === 'GET' && url.pathname === '/api/bugs/stats') {
    const project = projects.find((item) => item.slug === url.searchParams.get('project')) || projects[0];
    if (!project) return json(res, 404, { error: 'project not found' });
    const bugs = projectTasks(project).filter(isBugTask);
    return json(res, 200, buildBugStats(bugs));
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/status') {
    try {
      const data = await body(req);
      const updated = await updateTaskStatus(project, data.id, data.status);
      return json(res, 200, updated);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/content') {
    try {
      const data = await body(req);
      const updated = updateTaskSource(project, data.id, data.source);
      return json(res, 200, updated);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/create') {
    try {
      const data = await body(req);
      const created = createTask(project, data);
      return json(res, 201, created);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/normalize') {
    try {
      const preview = normalizeProjectTaskIds(project, { parseTask, apply: false });
      if (req.url.includes('dry=1') || url.searchParams.get('dry') === '1') {
        return json(res, 200, preview);
      }
      const result = preview.needsFix
        ? normalizeProjectTaskIds(project, { parseTask, apply: true })
        : preview;
      return json(res, 200, result);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/queue-order') {
    try {
      const data = await body(req);
      const order = await updateQueueOrder(project, Array.isArray(data.order) ? data.order : []);
      return json(res, 200, { order });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST') {
    return json(res, 404, { error: 'not found' });
  }
  const view = url.searchParams.get('view');
  if (req.method === 'GET' && view) {
    try {
      ensureProjectTaskIds(project);
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  }
  if (!view) {
    const counts = boardCounts(project, projectTasks, isBugTask, isImprovementTask);
    const target = counts.bugsOpen > 0 ? 'bugs' : 'mejoras';
    res.writeHead(302, { Location: `/?project=${encodeURIComponent(project.slug)}&view=${target}` });
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  if (view === 'bugs') return res.end(bugsBoardPage(project, boardHelpers()));
  if (view === 'mejoras') return res.end(mejorasBoardPage(project, boardHelpers()));
  res.end(queueBoardPage(project));
}

if (require.main === module) {
  http.createServer((req, res) => handle(req, res).catch((error) => json(res, 500, { error: error.message }))).listen(PORT, HOST, () => console.log(`Ariadne Hub: http://${HOST}:${PORT}`));
  if (BOARD_PORT !== PORT) http.createServer((req, res) => handleBoard(req, res).catch((error) => json(res, 500, { error: error.message }))).listen(BOARD_PORT, HOST, () => console.log(`Ariadne Kanban: http://${HOST}:${BOARD_PORT}`));
}

module.exports = { parseTask, priorityRank, sortTasksByPriority, sortQueuedTasks, nextQueuedTask, pickNextBug, pickNextImprovement, summarize, slugify, taskDetail, taskDetailHtml, queueBoardPage, validateTaskSource, touchUpdatedDate, updateTaskSource, createTask, ensureProjectTaskIds, findTask, resolveTaskFilePath, projectTasks, updateQueueOrder, isBugTask, buildBugStats, bugsBoardPage, projectTaskCode, formatTaskId, parseTypedTaskId, normalizeProjectTaskIds };
