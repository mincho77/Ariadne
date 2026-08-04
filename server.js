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
const { bugQueueState, bugRunPacket, buildBugRunInstruction } = require('./bug-queue');
const {
  isTaskDeletable,
  boardDeleteButton,
  boardDeleteInitScript,
  boardDeleteStyles,
} = require('./board-delete');
const {
  boardCardInteractionStyles,
  boardDragHintHtml,
  boardCardInteractionScript,
} = require('./board-card-interaction');
const { taskMatchesColumn } = require('./board-column-filter');
const {
  parseFrontmatterField,
  enrichTask,
  taskCardSubstatusHtml,
  boardSubstatusStyles,
  boardSubstatusPanelHtml,
  boardSubstatusInitScript,
  patchTaskSubstatus,
} = require('./board-substatus');
const {
  taskDetailHtml,
  toggleChecklistInSource,
  boardTaskDetailStyles,
  boardTaskDetailInitScript,
} = require('./board-task-detail');

const ROOT = __dirname;
const PORT = Number(process.env.ARIADNE_HUB_PORT || 4177);
const BOARD_PORT = Number(process.env.ARIADNE_BOARD_PORT || 6421);
const GANTT_BASE_URL = String(process.env.ARIADNE_GANTT_BASE_URL || 'http://localhost:63447/');
const HOST = '127.0.0.1';
const CATALOG = path.resolve(process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json'));
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
  let status = match ? match[1].trim() : 'To Do';
  if (status.toLowerCase() === 'to do' && labels.some((label) => String(label).toLowerCase() === 'queued')) {
    status = 'Queued';
  }
  const createdMatch = source.match(/^created_date:\s*['"]?([^'"\n]+)['"]?\s*$/mi);
  return enrichTask({
    id: idMatch ? idMatch[1].trim() : '',
    title,
    status,
    priority: priorityLabel(priorityMatch ? priorityMatch[1].trim() : 'Medium'),
    type: typeMatch ? typeMatch[1].trim() : 'task',
    ordinal: Number(ordinalMatch?.[1] || Number.MAX_SAFE_INTEGER),
    labels,
    createdDate: createdMatch ? createdMatch[1].trim() : '',
    substatus: parseFrontmatterField(source, 'substatus'),
    nextAction: parseFrontmatterField(source, 'next_action'),
  });
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

function parseDateStamp(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  const normalized = input.includes('T') ? input : input.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseFrontmatterList(source, field) {
  const input = String(source || '');
  const block = input.match(new RegExp(`^${field}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'mi'));
  if (block) {
    return [...block[1].matchAll(/^\s+-\s+(.+)$/gm)]
      .map((item) => item[1].trim())
      .filter(Boolean);
  }
  const inline = input.match(new RegExp(`^${field}:\\s*\\[(.*?)\\]\\s*$`, 'mi'));
  if (inline) {
    return inline[1].split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseFrontmatterNumber(source, field) {
  const input = String(source || '');
  const match = input.match(new RegExp(`^${field}:\\s*([0-9]+(?:\\.[0-9]+)?)\\s*$`, 'mi'));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function dependencyAnchors(relation) {
  const normalized = String(relation || 'FS').toUpperCase();
  if (normalized === 'SS') return { relation: 'SS', fromAnchor: 'start', toAnchor: 'start', sequential: false };
  if (normalized === 'FF') return { relation: 'FF', fromAnchor: 'end', toAnchor: 'end', sequential: false };
  if (normalized === 'SF') return { relation: 'SF', fromAnchor: 'start', toAnchor: 'end', sequential: true };
  return { relation: 'FS', fromAnchor: 'end', toAnchor: 'start', sequential: true };
}

function parseDependencySpec(raw, iaHoursPerDay) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const compact = value.replace(/\s+/g, '');
  const match = compact.match(/^([A-Za-z0-9][A-Za-z0-9-]*)(?:[:|@](FS|SS|FF|SF)([+-]\d+(?:[dh])?)?)?$/i)
    || compact.match(/^([A-Za-z0-9][A-Za-z0-9-]*)$/);
  if (!match) return null;

  const id = String(match[1] || '').trim();
  if (!id) return null;

  const anchors = dependencyAnchors(match[2] || 'FS');
  const lagToken = String(match[3] || '').trim();
  let lagBusinessDays = 0;
  let lagIaHours = 0;

  if (lagToken) {
    const lagMatch = lagToken.match(/^([+-]\d+)([dh])?$/i);
    if (lagMatch) {
      const amount = Number(lagMatch[1]);
      const unit = String(lagMatch[2] || 'd').toLowerCase();
      if (Number.isFinite(amount)) {
        if (unit === 'h') {
          lagIaHours = amount;
          lagBusinessDays = iaHoursPerDay > 0 ? Math.trunc(amount / iaHoursPerDay) : 0;
        } else {
          lagBusinessDays = amount;
          lagIaHours = amount * iaHoursPerDay;
        }
      }
    }
  }

  return {
    raw: value,
    id,
    relation: anchors.relation,
    fromAnchor: anchors.fromAnchor,
    toAnchor: anchors.toAnchor,
    lagBusinessDays,
    lagIaHours,
    sequential: anchors.sequential,
  };
}

function parseHolidayList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date, deltaDays) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + deltaDays);
  return shifted;
}

function moveToMondayDate(date) {
  const moved = new Date(date);
  while (moved.getDay() !== 1) moved.setDate(moved.getDate() + 1);
  return moved;
}

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function colombiaHolidaysByYear(year) {
  const fixed = [
    new Date(year, 0, 1),
    new Date(year, 4, 1),
    new Date(year, 6, 20),
    new Date(year, 7, 7),
    new Date(year, 11, 8),
    new Date(year, 11, 25),
  ];

  const emiliani = [
    moveToMondayDate(new Date(year, 0, 6)),
    moveToMondayDate(new Date(year, 2, 19)),
    moveToMondayDate(new Date(year, 5, 29)),
    moveToMondayDate(new Date(year, 7, 15)),
    moveToMondayDate(new Date(year, 9, 12)),
    moveToMondayDate(new Date(year, 10, 1)),
    moveToMondayDate(new Date(year, 10, 11)),
  ];

  const easter = easterDate(year);
  const easterBased = [
    shiftDate(easter, -3),
    shiftDate(easter, -2),
    moveToMondayDate(shiftDate(easter, 43)),
    moveToMondayDate(shiftDate(easter, 64)),
    moveToMondayDate(shiftDate(easter, 71)),
  ];

  return [...fixed, ...emiliani, ...easterBased].map((date) => formatIsoDate(date));
}

function colombiaHolidaysAround(startDate) {
  const year = startDate.getFullYear();
  return [...new Set([...colombiaHolidaysByYear(year), ...colombiaHolidaysByYear(year + 1)])];
}

function toDateOnlyIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseStartDate(value) {
  const input = String(value || '').trim();
  if (!input) return new Date();
  const date = new Date(`${input}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildWorkingCalendar(options = {}) {
  const today = parseStartDate(options.startDate);
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const iaHoursPerDay = Math.max(1, Math.min(24, Number(options.iaHoursPerDay) || 8));
  const workOnSaturday = options.workOnSaturday === true;
  const holidaySet = new Set([
    ...colombiaHolidaysAround(startDate),
    ...parseHolidayList(options.holidays),
  ]);

  const dayDiff = (from, to) => {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  };

  const isWorkingDay = (date) => {
    const day = date.getDay();
    const sunday = day === 0;
    const saturday = day === 6;
    if (sunday) return false;
    if (!workOnSaturday && saturday) return false;
    return !holidaySet.has(toDateOnlyIso(date));
  };

  const toCalendarMarker = (hourOffset) => {
    const safeOffset = Math.max(0, Number(hourOffset) || 0);
    let remaining = safeOffset;
    let businessDayIndex = 0;
    const cursor = new Date(startDate);

    while (!isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);

    while (remaining >= iaHoursPerDay) {
      remaining -= iaHoursPerDay;
      do {
        cursor.setDate(cursor.getDate() + 1);
      } while (!isWorkingDay(cursor));
      businessDayIndex += 1;
    }

    return {
      date: new Date(cursor),
      dateIso: toDateOnlyIso(cursor),
      monthKey: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: cursor.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      businessDayIndex,
      hourInDay: remaining,
      calendarDayOfWeek: cursor.getDay(),
    };
  };

  return {
    startDateIso: toDateOnlyIso(startDate),
    startDate,
    iaHoursPerDay,
    workOnSaturday,
    holidays: [...holidaySet],
    isWorkingDay,
    dayDiff,
    toCalendarMarker,
  };
}

function isDoneStatus(status) {
  return /done|complete/i.test(String(status || ''));
}

function defaultDurationByPriority(priority) {
  const key = String(priority || '').toLowerCase();
  if (key === 'ultra high') return 4;
  if (key === 'high') return 3;
  if (key === 'low') return 1;
  return 2;
}

function estimateTaskDurationDays(task) {
  const fromEstimate = parseFrontmatterNumber(task.source, 'estimate_days')
    ?? parseFrontmatterNumber(task.source, 'effort_days')
    ?? parseFrontmatterNumber(task.source, 'duration_days');
  if (fromEstimate && fromEstimate > 0) return Math.max(1, Math.round(fromEstimate));
  return defaultDurationByPriority(task.priority);
}

function estimateTaskIaHours(task, iaHoursPerDay) {
  const fromHours = parseFrontmatterNumber(task.source, 'estimate_ia_hours')
    ?? parseFrontmatterNumber(task.source, 'estimate_hours')
    ?? parseFrontmatterNumber(task.source, 'effort_hours')
    ?? parseFrontmatterNumber(task.source, 'duration_hours');
  if (fromHours && fromHours > 0) return Math.max(1, Math.round(fromHours));
  return estimateTaskDurationDays(task) * iaHoursPerDay;
}

function toPlanningTask(task, iaHoursPerDay) {
  const dependencyLinks = parseFrontmatterList(task.source, 'dependencies')
    .map((item) => parseDependencySpec(item, iaHoursPerDay))
    .filter((item) => item && item.id);
  const dependencies = dependencyLinks.map((item) => item.id);
  const createdDate = parseDateStamp(parseFrontmatterField(task.source, 'created_date')) || parseDateStamp(task.createdDate);
  const updatedDate = parseDateStamp(parseFrontmatterField(task.source, 'updated_date'));
  const startedDate = parseDateStamp(parseFrontmatterField(task.source, 'started_date')) || createdDate;
  const dueDate = parseDateStamp(parseFrontmatterField(task.source, 'due_date'));
  const durationIaHours = estimateTaskIaHours(task, iaHoursPerDay);
  return {
    ...task,
    durationDays: Math.max(1, Math.round(durationIaHours / iaHoursPerDay)),
    durationIaHours,
    dependencies,
    dependencyLinks,
    createdDate,
    startedDate,
    updatedDate,
    dueDate,
  };
}

function criticalPath(nodes, dependents, pendingMap) {
  const memo = new Map();
  const pathMemo = new Map();

  const score = (id, stack = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return pendingMap.get(id)?.durationIaHours || 1;
    stack.add(id);
    const node = pendingMap.get(id);
    const children = dependents.get(id) || [];
    let bestChild = null;
    let bestScore = 0;
    for (const childId of children) {
      const childScore = score(childId, stack);
      if (childScore > bestScore) {
        bestScore = childScore;
        bestChild = childId;
      }
    }
    stack.delete(id);
    const own = (node?.durationIaHours || 1) + bestScore;
    memo.set(id, own);
    pathMemo.set(id, bestChild);
    return own;
  };

  let bestRoot = null;
  let best = 0;
  for (const node of nodes) {
    const value = score(node.id);
    if (value > best) {
      best = value;
      bestRoot = node.id;
    }
  }

  const route = [];
  const visited = new Set();
  let cursor = bestRoot;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = pendingMap.get(cursor);
    if (!node) break;
    route.push({
      id: node.id,
      title: node.title,
      durationDays: node.durationDays,
      durationIaHours: node.durationIaHours,
      priority: node.priority,
    });
    cursor = pathMemo.get(cursor);
  }
  return { route, estimatedIaHours: best };
}

function buildProjectGantt(project, options = {}) {
  const capacity = Math.max(1, Math.min(12, Number(options.capacity) || 1));
  const includeDone = options.includeDone !== false;
  const calendar = buildWorkingCalendar(options);
  const iaHoursPerDay = calendar.iaHoursPerDay;
  const tasks = projectTasks(project).map((task) => toPlanningTask(task, iaHoursPerDay));
  const doneTasks = tasks.filter((task) => isDoneStatus(task.status));
  const pendingTasks = tasks.filter((task) => !isDoneStatus(task.status));
  const pendingMap = new Map(pendingTasks.map((task) => [task.id, task]));
  const doneIds = new Set(doneTasks.map((task) => task.id));
  const dependents = new Map();
  const indegree = new Map();

  for (const task of pendingTasks) {
    indegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  for (const task of pendingTasks) {
    const pendingLinks = (task.dependencyLinks || []).filter((dep) => pendingMap.has(dep.id));
    const pendingDeps = [...new Set(pendingLinks.map((dep) => dep.id))];
    task.pendingDependencyLinks = pendingLinks;
    task.pendingDependencies = pendingDeps;
    for (const depId of pendingDeps) {
      indegree.set(task.id, (indegree.get(task.id) || 0) + 1);
      dependents.get(depId).push(task.id);
    }
  }

  const prioritySort = (a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
    if (byPriority !== 0) return byPriority;
    const byOrdinal = (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER);
    if (byOrdinal !== 0) return byOrdinal;
    return a.title.localeCompare(b.title, 'es');
  };

  const running = [];
  const schedule = new Map();
  const completed = new Set();
  let timelineHour = 0;

  const planTask = (task, startIaHour) => {
    const endIaHour = startIaHour + task.durationIaHours;
    const startCalendar = calendar.toCalendarMarker(startIaHour);
    const endCalendar = calendar.toCalendarMarker(Math.max(0, endIaHour - 1));
    const startCalendarDay = calendar.dayDiff(calendar.startDate, startCalendar.date);
    const endCalendarDay = calendar.dayDiff(calendar.startDate, endCalendar.date);
    schedule.set(task.id, {
      id: task.id,
      title: task.title,
      status: task.status,
      type: task.type,
      priority: task.priority,
      dependencies: task.dependencies,
      dependencyLinks: task.dependencyLinks,
      pendingDependencies: task.pendingDependencies,
      pendingDependencyLinks: task.pendingDependencyLinks,
      durationDays: task.durationDays,
      durationIaHours: task.durationIaHours,
      startDay: startCalendar.businessDayIndex,
      endDay: endCalendar.businessDayIndex + 1,
      startIaHour,
      endIaHour,
      startDate: startCalendar.dateIso,
      endDate: endCalendar.dateIso,
      startCalendarDay,
      endCalendarDay,
      startMonth: startCalendar.monthLabel,
      endMonth: endCalendar.monthLabel,
      startHourInDay: startCalendar.hourInDay,
      endHourInDay: endCalendar.hourInDay,
      lane: String(task.type || '').toLowerCase() === 'bug' ? 'bugs' : 'mejoras',
      canRunInParallel: task.pendingDependencies.length === 0
        || (task.pendingDependencyLinks || []).some((dep) => dep.relation === 'SS' || dep.relation === 'FF'),
    });
  };

  const dependencyStartConstraint = (task) => {
    let earliestStartIaHour = 0;
    let waitingForPredecessor = false;

    for (const dep of task.pendingDependencyLinks || []) {
      const predecessor = pendingMap.get(dep.id);
      if (!predecessor) continue;
      const predecessorSchedule = schedule.get(dep.id);
      if (!predecessorSchedule) {
        waitingForPredecessor = true;
        continue;
      }

      const relation = String(dep.relation || 'FS').toUpperCase();
      const lagIaHours = Number(dep.lagIaHours || 0);
      let relationBound = predecessorSchedule.endIaHour;

      if (relation === 'SS') {
        relationBound = predecessorSchedule.startIaHour + lagIaHours;
      } else if (relation === 'FF') {
        relationBound = predecessorSchedule.endIaHour + lagIaHours - task.durationIaHours;
      } else if (relation === 'SF') {
        relationBound = predecessorSchedule.startIaHour + lagIaHours - task.durationIaHours;
      } else {
        relationBound = predecessorSchedule.endIaHour + lagIaHours;
      }

      earliestStartIaHour = Math.max(earliestStartIaHour, relationBound);
    }

    return {
      earliestStartIaHour: Math.max(0, Math.round(earliestStartIaHour)),
      waitingForPredecessor,
    };
  };

  while (completed.size < pendingTasks.length) {
    const finishedNow = running.filter((item) => item.endIaHour <= timelineHour);
    for (const item of finishedNow) {
      completed.add(item.id);
      const index = running.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) running.splice(index, 1);
    }

    let startedThisTick = false;
    let canStartMore = true;

    while (running.length < capacity && canStartMore) {
      canStartMore = false;
      const unscheduled = pendingTasks
        .filter((task) => !schedule.has(task.id))
        .sort(prioritySort);

      for (const task of unscheduled) {
        const constraint = dependencyStartConstraint(task);
        if (constraint.waitingForPredecessor) continue;
        if (timelineHour < constraint.earliestStartIaHour) continue;

        planTask(task, Math.max(timelineHour, constraint.earliestStartIaHour));
        const plannedTask = schedule.get(task.id);
        running.push({ id: task.id, endIaHour: plannedTask.endIaHour });
        startedThisTick = true;
        canStartMore = true;
        break;
      }
    }

    if (completed.size >= pendingTasks.length) break;

    if (running.length === 0 && !startedThisTick) {
      let nextHour = Number.POSITIVE_INFINITY;
      for (const task of pendingTasks) {
        if (schedule.has(task.id)) continue;
        const constraint = dependencyStartConstraint(task);
        if (constraint.waitingForPredecessor) continue;
        if (constraint.earliestStartIaHour > timelineHour) {
          nextHour = Math.min(nextHour, constraint.earliestStartIaHour);
        }
      }

      if (Number.isFinite(nextHour)) {
        timelineHour = nextHour;
        continue;
      }

      break;
    }

    timelineHour += 1;
  }

  const unresolved = pendingTasks.filter((task) => !schedule.has(task.id));
  for (const task of unresolved.sort(prioritySort)) {
    const syntheticStart = timelineHour;
    planTask(task, syntheticStart);
  }

  const planned = [...schedule.values()].sort((a, b) => a.startDay - b.startDay || priorityRank(a.priority) - priorityRank(b.priority));
  const byStartHour = new Map();
  for (const item of planned) {
    if (!byStartHour.has(item.startIaHour)) byStartHour.set(item.startIaHour, []);
    byStartHour.get(item.startIaHour).push(item.id);
  }

  const parallelGroups = [...byStartHour.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([startIaHour, ids]) => {
      const marker = calendar.toCalendarMarker(startIaHour);
      return {
        startIaHour,
        startDay: marker.businessDayIndex,
        startDate: marker.dateIso,
        ids,
      };
    });

  const critical = criticalPath(pendingTasks, dependents, pendingMap);
  const total = tasks.length;
  const done = doneTasks.length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const doneTimeline = includeDone
    ? doneTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      durationDays: task.durationDays,
      durationIaHours: task.durationIaHours,
      startDay: 0,
      endDay: task.durationDays,
      startIaHour: 0,
      endIaHour: task.durationIaHours,
      startDate: calendar.startDateIso,
      endDate: calendar.startDateIso,
      lane: String(task.type || '').toLowerCase() === 'bug' ? 'bugs' : 'mejoras',
      completedAt: task.updatedDate ? task.updatedDate.toISOString() : null,
    }))
    : [];

  const dependencyEdges = pendingTasks.flatMap((task) =>
    (task.pendingDependencyLinks || []).map((dep) => ({
      fromId: dep.id,
      toId: task.id,
      relation: dep.relation,
      fromAnchor: dep.fromAnchor,
      toAnchor: dep.toAnchor,
      lagBusinessDays: dep.lagBusinessDays,
      lagIaHours: dep.lagIaHours,
      sequential: dep.sequential,
    }))
  );

  const monthMarkers = [];
  const maxHour = planned.reduce((max, item) => Math.max(max, item.endIaHour), 0);
  const totalBusinessDays = Math.max(1, Math.ceil(maxHour / iaHoursPerDay));
  const dayMarkers = [];
  const preCalendarPaddingDays = 120;
  const maxCalendarDate = planned.reduce((max, task) => {
    const end = parseStartDate(task.endDate);
    return end > max ? end : max;
  }, parseStartDate(calendar.startDateIso));
  const totalCalendarDays = Math.max(180, calendar.dayDiff(calendar.startDate, maxCalendarDate) + 1 + preCalendarPaddingDays);
  for (let dayIndex = 0; dayIndex < totalCalendarDays; dayIndex += 1) {
    const date = new Date(calendar.startDate);
    date.setDate(calendar.startDate.getDate() + dayIndex - preCalendarPaddingDays);
    const isWorking = calendar.isWorkingDay(date);
    const iso = toDateOnlyIso(date);
    dayMarkers.push({
      dayIndex,
      date: iso,
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      dayLabel: date.toLocaleDateString('es-CO', { weekday: 'short' }),
      dayNumber: date.getDate(),
      isWorking,
      isSaturday: date.getDay() === 6,
      isSunday: date.getDay() === 0,
      isHoliday: calendar.holidays.includes(iso),
    });
  }

  for (const task of planned) {
    task.startCalendarDay += preCalendarPaddingDays;
    task.endCalendarDay += preCalendarPaddingDays;
  }
  const seenMonths = new Set();
  for (const marker of dayMarkers) {
    if (seenMonths.has(marker.monthKey)) continue;
    seenMonths.add(marker.monthKey);
    monthMarkers.push({
      monthKey: marker.monthKey,
      monthLabel: marker.monthLabel,
      atIaHour: marker.dayIndex * iaHoursPerDay,
      atBusinessDay: marker.dayIndex,
      atCalendarDay: marker.dayIndex,
      date: marker.date,
    });
  }

  return {
    project: { slug: project.slug, name: project.name },
    parameters: {
      capacity,
      includeDone,
      iaHoursPerDay,
      startDate: calendar.startDateIso,
      holidays: calendar.holidays,
      workOnSaturday: calendar.workOnSaturday,
    },
    summary: {
      totalTasks: total,
      doneTasks: done,
      pendingTasks: pendingTasks.length,
      completionRate,
      estimatedPendingIaHours: planned.reduce((max, item) => Math.max(max, item.endIaHour), 0),
      estimatedPendingDays: planned.reduce((max, item) => Math.max(max, item.endDay), 0),
      blockedByDependencies: pendingTasks.filter((task) => task.pendingDependencies.length > 0).length,
      unresolvedDependencies: pendingTasks.filter((task) =>
        (task.dependencyLinks || []).some((dep) => !pendingMap.has(dep.id) && !doneIds.has(dep.id))
      ).length,
      cycleDetected: unresolved.length > 0,
    },
    criticalPath: critical,
    parallelGroups,
    dependencyEdges,
    monthMarkers,
    dayMarkers,
    tasks: planned,
    doneTimeline,
    generatedAt: new Date().toISOString(),
  };
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

function aiCapacityConfigPath(project) {
  return path.join(project.path, 'backlog', 'docs', 'ai-capacity.config.json');
}

function readAiCapacityConfig(project) {
  const file = aiCapacityConfigPath(project);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeAiCapacityConfig(project, config) {
  const file = aiCapacityConfigPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}

function normalizeAiOperators(operators) {
  if (!Array.isArray(operators)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of operators) {
    const id = String(raw?.id || '').trim() || slugify(String(raw?.name || '').trim());
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      name: String(raw?.name || id).trim(),
      active: raw?.active !== false,
      maxParallel: Math.max(1, Math.min(6, Number(raw?.maxParallel) || 1)),
      hoursPerDay: Math.max(1, Math.min(24, Number(raw?.hoursPerDay) || 8)),
    });
  }
  return normalized;
}

function normalizeAiCapacityConfigPayload(data) {
  const capacity = Math.max(1, Math.min(12, Number(data?.capacity) || 1));
  const operators = normalizeAiOperators(data?.operators);
  const operatorById = new Map(operators.map((operator) => [operator.id, operator]));
  const operatorIdByName = new Map(
    operators
      .filter((operator) => operator.name)
      .map((operator) => [operator.name.trim().toLowerCase(), operator.id])
  );

  const aiModels = (Array.isArray(data?.aiModels) ? data.aiModels : [])
    .map((model) => {
      let operatorId = String(model?.operatorId || '').trim();
      let operatorName = String(model?.operatorName || '').trim();

      if (!operatorId && operatorName) {
        operatorId = operatorIdByName.get(operatorName.toLowerCase()) || '';
      }

      if (operatorId && operatorById.has(operatorId)) {
        operatorName = operatorById.get(operatorId).name;
      }

      return {
        key: String(model?.key || '').trim(),
        name: String(model?.name || '').trim(),
        initials: String(model?.initials || '').trim(),
        maxParallel: Math.max(1, Math.min(6, Number(model?.maxParallel) || 1)),
        requiresOperator: Boolean(model?.requiresOperator),
        operatorId,
        operatorName,
        enabled: Boolean(model?.enabled),
      };
    })
    .filter((model) => model.key);

  return {
    version: Math.max(1, Number(data?.version) || 1),
    capacity,
    aiModels,
    operators,
    updatedAt: new Date().toISOString(),
  };
}

function effectiveCapacityFromConfig(config, fallbackCapacity) {
  const fallback = Math.max(1, Math.min(12, Number(fallbackCapacity) || 2));
  if (!config || typeof config !== 'object') return fallback;

  const humanCapacity = Math.max(1, Math.min(12, Number(config.capacity) || fallback));
  const models = Array.isArray(config.aiModels) ? config.aiModels : [];
  const enabledModels = models.filter((model) => model?.enabled !== false);
  const modelSlots = Math.max(1, enabledModels.reduce((sum, model) => sum + Math.max(1, Math.min(6, Number(model.maxParallel) || 1)), 0));

  const modelsNeedingOperator = enabledModels.filter((model) => Boolean(model.requiresOperator));
  const operators = normalizeAiOperators(config.operators);
  const activeOperatorSlots = operators
    .filter((operator) => operator.active)
    .reduce((sum, operator) => sum + Math.max(1, Math.min(6, Number(operator.maxParallel) || 1)), 0);
  const operatorBound = modelsNeedingOperator.length > 0 ? Math.max(1, activeOperatorSlots || 1) : modelSlots;

  return Math.max(1, Math.min(humanCapacity, modelSlots, operatorBound));
}

function normalizeTextKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rowLooksLikeBug(row) {
  const type = normalizeTextKey(row.type);
  if (type === 'bug') return true;
  const labels = Array.isArray(row.labels) ? row.labels.map((label) => normalizeTextKey(label)) : [];
  if (labels.includes('bug')) return true;
  return /^bug\b/i.test(String(row.title || '').trim());
}

function normalizeImportRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.tasks)) return data.tasks;
  return [];
}

function normalizePriorityInput(value) {
  const key = normalizeTextKey(value || 'medium');
  if (key === 'ultra high' || key === 'ultrahigh') return 'Ultra High';
  if (key === 'high') return 'High';
  if (key === 'low') return 'Low';
  return 'Medium';
}

function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function upsertFrontmatterScalar(source, field, value) {
  const text = String(source || '');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return text;
  const lines = match[1].split('\n');
  const index = lines.findIndex((line) => new RegExp(`^${field}:\\s*`).test(line));
  const rendered = typeof value === 'number' ? `${field}: ${value}` : `${field}: '${String(value).replace(/'/g, "''")}'`;
  if (index >= 0) lines[index] = rendered;
  else lines.push(rendered);
  const next = `---\n${lines.join('\n')}\n---`;
  return `${next}${text.slice(match[0].length)}`;
}

function upsertFrontmatterList(source, field, values) {
  const text = String(source || '');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return text;
  const list = [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
  const lines = match[1].split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${field}:\\s*$`).test(line));
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && /^\s*-\s+/.test(lines[end])) end += 1;
    const replacement = list.length ? [ `${field}:`, ...list.map((item) => `  - ${item}`) ] : [];
    lines.splice(start, end - start, ...replacement);
  } else if (list.length) {
    lines.push(`${field}:`, ...list.map((item) => `  - ${item}`));
  }
  const next = `---\n${lines.join('\n')}\n---`;
  return `${next}${text.slice(match[0].length)}`;
}

function enrichTaskSource(source, row) {
  let next = String(source || '');
  const estimateIaHours = Number(row.estimateIaHours ?? row.estimate_ia_hours ?? row.estimate_hours);
  const estimateDays = Number(row.estimateDays ?? row.estimate_days);
  const dependencies = parseListValue(row.dependencies);
  const assignees = parseListValue(row.assignees || row.assignee);
  const epic = String(row.epic || '').trim();
  const startedDate = String(row.started_date || '').trim();
  const dueDate = String(row.due_date || '').trim();

  if (Number.isFinite(estimateIaHours) && estimateIaHours > 0) next = upsertFrontmatterScalar(next, 'estimate_ia_hours', Math.round(estimateIaHours));
  if (Number.isFinite(estimateDays) && estimateDays > 0) next = upsertFrontmatterScalar(next, 'estimate_days', Math.round(estimateDays));
  if (dependencies.length) next = upsertFrontmatterList(next, 'dependencies', dependencies);
  if (assignees.length) next = upsertFrontmatterList(next, 'assignee', assignees);
  if (epic) next = upsertFrontmatterScalar(next, 'epic', epic);
  if (startedDate) next = upsertFrontmatterScalar(next, 'started_date', startedDate);
  if (dueDate) next = upsertFrontmatterScalar(next, 'due_date', dueDate);
  return next;
}

function normalizeBulkTaskUpdates(input) {
  const updates = input && typeof input === 'object' ? input : {};
  const patch = {};

  const estimateIaRaw = updates.estimateIaHours ?? updates.estimate_ia_hours ?? updates.estimate_hours;
  if (estimateIaRaw !== undefined && estimateIaRaw !== null && String(estimateIaRaw).trim() !== '') {
    const estimateIaHours = Number(estimateIaRaw);
    if (!Number.isFinite(estimateIaHours) || estimateIaHours <= 0) {
      throw new Error('estimateIaHours debe ser un número mayor que cero');
    }
    patch.estimateIaHours = Math.max(1, Math.round(estimateIaHours));
  }

  const estimateDaysRaw = updates.estimateDays ?? updates.estimate_days;
  if (estimateDaysRaw !== undefined && estimateDaysRaw !== null && String(estimateDaysRaw).trim() !== '') {
    const estimateDays = Number(estimateDaysRaw);
    if (!Number.isFinite(estimateDays) || estimateDays <= 0) {
      throw new Error('estimateDays debe ser un número mayor que cero');
    }
    patch.estimateDays = Math.max(1, Math.round(estimateDays));
  }

  const startedDateRaw = updates.startedDate ?? updates.started_date;
  if (startedDateRaw !== undefined && startedDateRaw !== null && String(startedDateRaw).trim() !== '') {
    const startedDate = String(startedDateRaw).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startedDate)) {
      throw new Error('startedDate debe tener formato YYYY-MM-DD');
    }
    patch.startedDate = startedDate;
  }

  const dueDateRaw = updates.dueDate ?? updates.due_date;
  if (dueDateRaw !== undefined && dueDateRaw !== null && String(dueDateRaw).trim() !== '') {
    const dueDate = String(dueDateRaw).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error('dueDate debe tener formato YYYY-MM-DD');
    }
    patch.dueDate = dueDate;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'assignees') || Object.prototype.hasOwnProperty.call(updates, 'assignee')) {
    patch.assignees = parseListValue(updates.assignees ?? updates.assignee);
  }

  return patch;
}

function applyBulkTaskUpdatesToSource(source, updates) {
  let next = String(source || '');
  if (Number.isFinite(updates.estimateIaHours) && updates.estimateIaHours > 0) {
    next = upsertFrontmatterScalar(next, 'estimate_ia_hours', updates.estimateIaHours);
  }
  if (Number.isFinite(updates.estimateDays) && updates.estimateDays > 0) {
    next = upsertFrontmatterScalar(next, 'estimate_days', updates.estimateDays);
  }
  if (updates.startedDate) next = upsertFrontmatterScalar(next, 'started_date', updates.startedDate);
  if (updates.dueDate) next = upsertFrontmatterScalar(next, 'due_date', updates.dueDate);
  if (Object.prototype.hasOwnProperty.call(updates, 'assignees')) {
    next = upsertFrontmatterList(next, 'assignee', updates.assignees);
  }
  return next;
}

function bulkEditProjectTasks(project, payload = {}) {
  const rawIds = Array.isArray(payload.taskIds) ? payload.taskIds : [];
  const taskIds = [...new Set(rawIds.map((item) => String(item || '').trim()).filter(Boolean))];
  if (!taskIds.length) throw new Error('taskIds es requerido y no puede estar vacío');

  const updates = normalizeBulkTaskUpdates(payload.updates || {});
  const updateKeys = Object.keys(updates);
  if (!updateKeys.length) throw new Error('updates no contiene campos válidos para editar');

  const dryRun = Boolean(payload.dryRun);
  const updated = [];
  const skipped = [];
  const errors = [];

  for (const taskId of taskIds) {
    try {
      const task = findTask(project, taskId);
      if (!task) {
        skipped.push({ id: taskId, reason: 'task_not_found' });
        continue;
      }

      const filePath = resolveTaskFilePath(project, task);
      const original = fs.readFileSync(filePath, 'utf8');
      let next = applyBulkTaskUpdatesToSource(original, updates);
      if (next === original) {
        skipped.push({ id: task.id, reason: 'no_changes' });
        continue;
      }

      next = touchUpdatedDate(validateTaskSource(task.id, next));
      if (!dryRun) fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');

      updated.push({
        id: task.id,
        file: task.file,
        changes: updateKeys,
      });
    } catch (error) {
      errors.push({ id: taskId, reason: error.message });
    }
  }

  return {
    project: project.slug,
    dryRun,
    received: taskIds.length,
    updateKeys,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    updated,
    skipped,
    errors,
  };
}

function importImprovements(project, payload = {}) {
  const rows = normalizeImportRows(payload);
  const dryRun = Boolean(payload?.dryRun);
  const existing = projectTasks(project);
  const existingKeys = new Set(existing.map((task) => normalizeTextKey(task.title)));
  const seenBatch = new Set();
  const created = [];
  const skipped = [];
  const errors = [];

  rows.forEach((raw, index) => {
    const row = raw && typeof raw === 'object' ? raw : {};
    const title = String(row.title || row.titulo || '').trim();
    if (!title) {
      errors.push({ index, reason: 'titulo_requerido' });
      return;
    }
    if (rowLooksLikeBug(row)) {
      errors.push({ index, title, reason: 'fila_detectada_como_bug' });
      return;
    }

    const key = normalizeTextKey(title);
    if (seenBatch.has(key)) {
      skipped.push({ index, title, reason: 'duplicado_en_lote' });
      return;
    }
    if (existingKeys.has(key)) {
      skipped.push({ index, title, reason: 'duplicado_en_backlog' });
      return;
    }
    seenBatch.add(key);

    const createPayload = {
      title,
      type: 'enhancement',
      priority: normalizePriorityInput(row.priority),
      labels: parseListValue(row.labels).filter((label) => normalizeTextKey(label) !== 'bug'),
    };

    if (dryRun) {
      created.push({ index, title, dryRun: true, payload: createPayload });
      return;
    }

    try {
      const task = createTask(project, createPayload);
      const enriched = enrichTaskSource(task.source, row);
      let finalTask = task;
      if (enriched !== task.source) finalTask = updateTaskSource(project, task.id, enriched);
      created.push({ index, id: finalTask.id, title: finalTask.title, file: finalTask.file });
      existingKeys.add(key);
    } catch (error) {
      errors.push({ index, title, reason: error.message });
    }
  });

  return {
    project: project.slug,
    dryRun,
    received: rows.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    created,
    skipped,
    errors,
  };
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

function rewriteTaskLabelsInSource(source, mutator) {
  const text = String(source || '');
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) throw new Error('el archivo debe conservar el frontmatter YAML (--- ... ---)');

  const lines = fm[1].split('\n');
  const labelsStart = lines.findIndex((line) => /^labels:\s*$/.test(line));
  let labelsEnd = labelsStart;
  let labels = [];

  if (labelsStart >= 0) {
    labelsEnd = labelsStart + 1;
    while (labelsEnd < lines.length && /^\s*-\s+/.test(lines[labelsEnd])) labelsEnd += 1;
    labels = lines.slice(labelsStart + 1, labelsEnd)
      .map((line) => line.replace(/^\s*-\s+/, '').trim())
      .filter(Boolean);
  }

  const nextLabels = [...new Set(mutator(labels).map((item) => String(item).trim()).filter(Boolean))];
  let nextLines = [...lines];

  if (labelsStart >= 0) {
    nextLines.splice(labelsStart, labelsEnd - labelsStart, ...(nextLabels.length ? ['labels:', ...nextLabels.map((label) => `  - ${label}`)] : []));
  } else if (nextLabels.length) {
    const insertAt = nextLines.findIndex((line) => /^priority:\s*/.test(line));
    const block = ['labels:', ...nextLabels.map((label) => `  - ${label}`)];
    if (insertAt >= 0) nextLines.splice(insertAt, 0, ...block);
    else nextLines.push(...block);
  }

  const nextFrontmatter = `---\n${nextLines.join('\n')}\n---`;
  return `${nextFrontmatter}${text.slice(fm[0].length)}`;
}

function setQueuedLabel(source, enabled) {
  return rewriteTaskLabelsInSource(source, (labels) => {
    const withoutQueued = labels.filter((label) => String(label).toLowerCase() !== 'queued');
    if (enabled) withoutQueued.push('queued');
    return withoutQueued;
  });
}

function isQueuedUnsupportedError(error) {
  return /invalid status/i.test(String(error?.message || ''));
}

function isTaskNotFoundError(error) {
  return /task\s+.+\s+not found/i.test(String(error?.message || ''));
}

function setStatusInSource(source, status) {
  const text = String(source || '');
  if (/^status:\s*.+$/mi.test(text)) return text.replace(/^status:\s*.+$/mi, `status: ${status}`);
  return text.replace(/^(---\n[\s\S]*?)(\n---)/m, `$1\nstatus: ${status}$2`);
}

function applyTaskStateFallback(project, taskId, status, queuedLabel) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  let next = setStatusInSource(task.source, status);
  next = setQueuedLabel(next, queuedLabel);
  next = touchUpdatedDate(next);
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return parseTask(filePath);
}

function applyQueuedLabel(project, taskId, enabled) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  const next = touchUpdatedDate(setQueuedLabel(task.source, enabled));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return parseTask(filePath);
}

async function ensureTaskQueued(project, task) {
  try {
    await runBacklog(project, ['task', 'edit', task.id, '--status', 'Queued', '--plain']);
    if ((task.labels || []).some((label) => String(label).toLowerCase() === 'queued')) applyQueuedLabel(project, task.id, false);
  } catch (error) {
    if (!isQueuedUnsupportedError(error) && !isTaskNotFoundError(error)) throw error;
    applyTaskStateFallback(project, task.id, 'To Do', true);
  }
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
      await ensureTaskQueued(project, task);
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
  if (status === 'Queued') {
    await ensureTaskQueued(project, task);
  } else {
    try {
      await runBacklog(project, ['task', 'edit', task.id, '--status', status, '--plain']);
      if ((task.labels || []).some((label) => String(label).toLowerCase() === 'queued')) applyQueuedLabel(project, task.id, false);
    } catch (error) {
      if (!isTaskNotFoundError(error)) throw error;
      applyTaskStateFallback(project, task.id, status, false);
    }
  }
  if (status === 'Queued' && !wasQueued) {
    const queued = sortQueuedTasks(projectTasks(project).filter((item) => item.status.toLowerCase() === 'queued'));
    await applyQueueOrdinals(project, [...queued.map((item) => item.id).filter((id) => id.toLowerCase() !== task.id.toLowerCase()), task.id]);
  }
  return parseTask(path.join(project.path, 'backlog', task.file));
}

function updateTaskSubstatus(project, taskId, { substatus = '', next_action = '' } = {}) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  const source = fs.readFileSync(filePath, 'utf8');
  const next = touchUpdatedDate(patchTaskSubstatus(source, { substatus, next_action }));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { ...parseTask(filePath), file: task.file, source: next };
}

function updateTaskSource(project, taskId, source) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  const next = touchUpdatedDate(validateTaskSource(task.id, source));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { ...parseTask(filePath), file: task.file, source: next };
}

function dependencyTokenFromPayloadEntry(entry) {
  if (typeof entry === 'string') return String(entry).trim();
  if (!entry || typeof entry !== 'object') return '';

  const id = String(entry.id || '').trim();
  if (!id) return '';

  const relation = String(entry.relation || 'FS').trim().toUpperCase();
  if (!['FS', 'SS', 'FF', 'SF'].includes(relation)) {
    throw new Error(`relación inválida para dependencia: ${relation}`);
  }

  const lagRaw = entry.lagValue ?? entry.lag ?? 0;
  const lagValue = Math.round(Number(lagRaw || 0));
  const unit = String(entry.lagUnit || entry.unit || 'd').trim().toLowerCase() === 'h' ? 'h' : 'd';
  const lagToken = Number.isFinite(lagValue) && lagValue !== 0
    ? `${lagValue > 0 ? `+${lagValue}` : String(lagValue)}${unit}`
    : '';

  return `${id}:${relation}${lagToken}`;
}

function serializeDependencySpec(spec, iaHoursPerDay = 8) {
  const relation = String(spec.relation || 'FS').toUpperCase();
  const lagHours = Math.round(Number(spec.lagIaHours || 0));
  if (!Number.isFinite(lagHours) || lagHours === 0) return `${spec.id}:${relation}`;

  if (iaHoursPerDay > 0 && lagHours % iaHoursPerDay === 0) {
    const lagDays = lagHours / iaHoursPerDay;
    return `${spec.id}:${relation}${lagDays > 0 ? `+${lagDays}` : String(lagDays)}d`;
  }

  return `${spec.id}:${relation}${lagHours > 0 ? `+${lagHours}` : String(lagHours)}h`;
}

function updateTaskDependencies(project, taskId, dependenciesInput) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);

  const rawList = Array.isArray(dependenciesInput) ? dependenciesInput : [];
  const normalizedTokens = [];
  const seen = new Set();

  for (const raw of rawList) {
    const token = dependencyTokenFromPayloadEntry(raw);
    if (!token) continue;
    const spec = parseDependencySpec(token, 8);
    if (!spec || !spec.id) throw new Error(`dependencia inválida: ${token}`);
    if (spec.id.toLowerCase() === String(taskId).toLowerCase()) {
      throw new Error('una tarea no puede depender de sí misma');
    }
    const rendered = serializeDependencySpec(spec, 8);
    const key = rendered.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedTokens.push(rendered);
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const updated = upsertFrontmatterList(source, 'dependencies', normalizedTokens);
  const next = touchUpdatedDate(validateTaskSource(task.id, updated));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');

  const parsed = parseTask(filePath);
  const planning = toPlanningTask({ ...parsed, source: next }, 8);
  return {
    ...parsed,
    file: task.file,
    source: next,
    dependencies: planning.dependencies,
    dependencyLinks: planning.dependencyLinks,
  };
}

function updateTaskChecklist(project, taskId, checkIndex, checked) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  const filePath = resolveTaskFilePath(project, task);
  const source = fs.readFileSync(filePath, 'utf8');
  const next = touchUpdatedDate(validateTaskSource(task.id, toggleChecklistInSource(source, checkIndex, checked)));
  fs.writeFileSync(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return { ...parseTask(filePath), file: task.file, source: next, detailHtml: taskDetailHtml(next) };
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

function getBugQueueSnapshot(project) {
  const state = bugQueueState(projectTasks(project), isBugTask);
  return {
    project: project.slug,
    queueLength: state.queueLength,
    active: state.active ? {
      id: state.active.id,
      title: state.active.title,
      status: state.active.status,
      priority: state.active.priority,
      file: state.active.file,
    } : null,
    next: state.next ? {
      id: state.next.id,
      title: state.next.title,
      status: state.next.status,
      priority: state.next.priority,
      file: state.next.file,
      instruction: buildBugRunInstruction(state.next, project),
    } : null,
    queued: state.queued.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      ordinal: task.ordinal,
    })),
  };
}

async function enqueueTask(project, taskId) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  if (task.status.toLowerCase() === 'queued') return task;
  return updateTaskStatus(project, task.id, 'Queued');
}

async function createBugTask(project, options = {}) {
  const created = createTask(project, {
    ...options,
    type: options.type || 'bug',
    labels: Array.isArray(options.labels) ? options.labels : ['bug'],
  });
  const shouldQueue = options.queue !== false;
  if (!isBugTask(created)) {
    throw new Error('createBugTask requires a bug task');
  }
  if (shouldQueue) {
    await enqueueTask(project, created.id);
  }
  const refreshed = findTask(project, created.id);
  let run = null;
  let started = false;
  if (shouldQueue && options.start !== false) {
    const state = bugQueueState(projectTasks(project), isBugTask);
    if (!state.active && state.next?.id === refreshed.id) {
      run = await claimNextBug(project);
      writeBugRunPacket(project, run);
      started = true;
    }
  }
  return {
    ...refreshed,
    queued: shouldQueue,
    started,
    run,
    instruction: buildBugRunInstruction(refreshed, project),
  };
}

async function claimNextBug(project) {
  const state = bugQueueState(projectTasks(project), isBugTask);
  if (state.active) {
    const err = new Error('ya hay un bug en ejecución');
    err.code = 'ACTIVE_BUG';
    err.active = state.active;
    throw err;
  }
  if (!state.next) {
    const err = new Error('la cola de bugs está vacía');
    err.code = 'EMPTY_QUEUE';
    throw err;
  }
  await updateTaskStatus(project, state.next.id, 'In Progress');
  const task = findTask(project, state.next.id);
  return bugRunPacket(task, project);
}

function writeBugRunPacket(project, packet) {
  const dir = path.join(project.path, '.ariadne', 'bug-queue');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'current.json');
  fs.writeFileSync(target, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'current.md'), `${packet.instruction}\n`, 'utf8');
  return target;
}

function ensureProjectTaskIds(project) {
  const preview = normalizeProjectTaskIds(project, { parseTask, apply: false });
  if (!preview.needsFix) return null;
  const hasUnsafeMissingIds = (preview.analysis?.issues || []).some((issue) => issue.type === 'missing_id');
  if (hasUnsafeMissingIds) return { ...preview, skipped: true, reason: 'missing_id' };
  return normalizeProjectTaskIds(project, { parseTask, apply: true });
}

function deleteTask(project, taskId) {
  const task = findTask(project, taskId);
  if (!task) throw new Error('tarea no encontrada');
  if (!isTaskDeletable(task.status)) {
    throw new Error('solo se pueden eliminar tareas en To Do, Queue o Doing');
  }
  const filePath = resolveTaskFilePath(project, task);
  fs.unlinkSync(filePath);
  return { id: task.id, deleted: true, file: task.file };
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
    const items = (queue ? sortQueuedTasks : sortTasksByPriority)(tasks.filter((task) => taskMatchesColumn(task, status)));
    const content = items.map((task, position) => {
      const index = tasks.indexOf(task);
      const searchable = `${task.id} ${task.title} ${task.priority} ${task.type} ${task.effectiveSubstatus || ''} ${task.nextAction || ''} ${task.file}`.toLowerCase();
      const queuePosition = queue ? `<span class="queue-position" title="Posición en la cola"><small>Turno</small>${position + 1}</span>` : '';
      const dragHint = queue ? 'Drag to reorder queue' : 'Drag to change status';
      return `<div role="button" tabindex="0" draggable="true" class="task${queue ? ' queue-task' : ''}${queue && position === 0 ? ' queue-next' : ''}" data-task="${index}" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-search="${escapeHtml(searchable)}">
        ${queuePosition}
        <span class="task-heading"><strong class="task-id">${escapeHtml(task.id || 'SIN JM')}</strong><strong class="task-title">${escapeHtml(task.title)}</strong></span>
        <span class="task-meta"><span class="priority priority-${priorityRank(task.priority)}">${escapeHtml(task.priority)}</span><span class="type type-${escapeHtml(task.type)}">${escapeHtml(task.type)}</span></span>
        ${taskCardSubstatusHtml(task, escapeHtml)}
        ${boardDragHintHtml(dragHint)}
      </div>`;
    }).join('') || `<p class="empty">${queue ? 'Arrastra aquí lo próximo que quieres ejecutar.' : 'Sin tareas'}</p>`;
    return `<section class="column${queue ? ' queue-column' : ''}" data-column="${escapeHtml(status)}">
      <header class="column-head"><div><span class="column-kicker">${escapeHtml(hint)}</span><h2>${queue ? '<span class="queue-icon">≡</span>' : ''}${escapeHtml(label)}</h2></div><span class="column-count">${items.length}</span></header>
      ${queue ? '<p class="queue-rule">Arrastra dentro de la cola para cambiar el turno. El 1 se ejecuta primero.</p>' : ''}
      <div class="task-list" data-drop-status="${escapeHtml(status)}">${content}<p class="search-empty">Sin coincidencias en esta columna.</p></div>
    </section>`;
  }).join('');
  const taskData = JSON.stringify(tasks.map(({ id, title, status, priority, type, file, source, substatus, nextAction, effectiveSubstatus }) => ({ id, title, status, priority, type, file, detailHtml: taskDetailHtml(source), source, substatus, nextAction, effectiveSubstatus }))).replace(/</g, '\\u003c');
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
.task{position:relative;display:block;width:100%;text-align:left;color:#e8eef8;background:#20344d;border:1px solid #38516f;border-radius:11px;padding:13px;margin:9px 0;transition:transform .15s,border-color .15s,opacity .15s,box-shadow .15s}.task[hidden]{display:none!important}.task:hover{border-color:#73d8c6;transform:translateY(-2px)}.task.dragging{opacity:.35;transform:scale(.98)}.task.drop-before{box-shadow:inset 0 3px 0 #73d8c6}.task.search-match{border-color:#73d8c6;box-shadow:0 0 0 2px #73d8c633,0 10px 24px #0004}
.task-heading{display:grid;gap:5px;line-height:1.35}.task-id{color:#78dfcd;font-size:12px;letter-spacing:.06em}.task-title{font-size:13px}.task-meta{display:flex;gap:6px;margin-top:10px}.drag-hint{display:block;color:#71859e;font-size:10px;margin-top:10px}.queue-task{padding-left:52px;background:#292344;border-color:#594a88}.queue-task:hover{border-color:#a78bfa}.queue-next{background:linear-gradient(135deg,#3a2b64,#292344);border-color:#9a7cf0;box-shadow:0 6px 18px #150a3555}.queue-position{position:absolute;left:11px;top:13px;display:grid;place-items:center;width:31px;height:40px;border-radius:9px;background:#6d4bd2;color:#fff;font-size:16px;font-weight:900}.queue-position small{margin:0;color:#ddd6fe;font-size:7px;text-transform:uppercase;letter-spacing:.08em}
.priority,.type,.badge{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:800;font-size:11px}.priority-0{background:#991b1b;color:#fee2e2}.priority-1{background:#92400e;color:#ffedd5}.priority-2{background:#164e63;color:#a5f3fc}.priority-3{background:#334155;color:#cbd5e1}.type{background:#183d42;color:#80e2d0}.type-bug{background:#be123c;color:#ffe4e6}
.empty{color:#75869b;font-size:12px;line-height:1.5;padding:18px 8px;text-align:center;flex:1 1 auto;display:grid;place-items:center}.search-empty{display:none;color:#9aaac0;font-size:12px;line-height:1.5;padding:16px 8px;text-align:center;border:1px dashed #344a67;border-radius:11px;margin:9px 0}.column.search-no-results .search-empty{display:block}.column.search-no-results .empty{display:none}.primary,.secondary,.queue-action,.move-button,.delete-button{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary,.queue-action{background:#73d8c6;color:#102131}.secondary{background:#334155;color:#e8eef8}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
${boardDeleteStyles('mejoras')}${boardCardInteractionStyles('default')}${boardSubstatusStyles()}${boardTaskDetailStyles('default')}.status-actions{display:flex;gap:7px;flex-wrap:wrap;padding:13px;background:#111d30;border:1px solid #2c405b;border-radius:12px;margin-top:18px}.status-actions:before{content:"Mover a";width:100%;color:#7f92aa;font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}.move-button{background:#263a55;color:#dce7f5;padding:8px 11px;font-size:11px}.move-button:hover{background:#365171}.move-button.current{display:none}
.modal{display:none;position:fixed;inset:0;background:#020713d9;align-items:center;justify-content:center;padding:20px;z-index:10;backdrop-filter:blur(5px)}.modal.open{display:flex}.panel{background:#142238;border:1px solid #405674;border-radius:18px;max-width:980px;width:100%;max-height:90vh;overflow:auto;padding:0;box-shadow:0 24px 80px #0009}.panel-header{position:sticky;top:0;z-index:2;padding:24px 28px 20px;background:#142238ee;border-bottom:1px solid #2c405b;backdrop-filter:blur(12px)}.panel-header h2{margin:8px 40px 8px 0;font-size:24px;line-height:1.25}.close{position:absolute;right:20px;top:18px;background:#24364e;border:0;border-radius:10px;color:#b8c5d6;font-size:22px;width:38px;height:38px;cursor:pointer}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:0}.detail-file{color:#7689a2;font-size:11px}.panel-body{padding:24px 28px 30px}.source-editor{width:100%;min-height:360px;background:#0b1524;border:1px solid #344a67;border-radius:12px;color:#e8eef8;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px;resize:vertical}.source-editor:focus{outline:2px solid #73d8c6;outline-offset:2px}.edit-hint{color:#8da0b9;font-size:12px;margin:0 0 10px}.edit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.badge{background:#183d42;color:#80e2d0}.error{color:#fecaca;min-height:18px}
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
<div id="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div class="panel"><header class="panel-header"><button class="close" aria-label="Cerrar">×</button><div class="meta"><span id="detail-priority" class="badge"></span><span id="detail-type" class="badge"></span><span id="detail-status" class="badge"></span><span id="detail-substatus" class="badge substatus"></span></div><h2 id="detail-title"></h2><div id="detail-file" class="detail-file"></div></header><div class="panel-body"><div id="detail-view">${boardSubstatusPanelHtml()}<div id="detail-body" class="detail"></div></div><div id="detail-edit" hidden><p class="edit-hint">Edita el Markdown completo de la tarea. Conserva el bloque YAML inicial y no cambies el <code>id</code>.</p><textarea id="source-editor" class="source-editor" spellcheck="false"></textarea><div class="edit-actions"><button id="save-task" class="primary" type="button">Guardar cambios</button><button id="cancel-edit" class="secondary" type="button">Cancelar</button></div></div><div id="status-actions" class="status-actions"><button class="move-button" data-move-status="To Do">To Do</button><button class="move-button" data-move-status="Queued">Queue</button><button class="move-button" data-move-status="In Progress">Doing</button><button class="move-button" data-move-status="Done">Done</button></div><p id="action-error" class="error"></p><div class="actions"><button id="edit-task" class="secondary" type="button">Editar texto</button><button id="queue-action" class="queue-action"></button>${boardDeleteButton('Delete')}<button id="copy-action" class="secondary">Copy instruction for Codex</button></div></div></div></div>
<script>
const tasks=${taskData};
const statusLabels=${JSON.stringify(STATUS_DISPLAY)};
const project=${JSON.stringify(project.slug)};
const modal=document.querySelector('#modal');
const title=document.querySelector('#detail-title');
const priority=document.querySelector('#detail-priority');
const type=document.querySelector('#detail-type');
const status=document.querySelector('#detail-status');
const detailSubstatus=document.querySelector('#detail-substatus');
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
${boardDeleteInitScript({ confirmText: 'Delete {id}? This cannot be undone. Done tasks cannot be deleted.', blockBugs: false })}
${boardCardInteractionScript()}
${boardSubstatusInitScript()}
${boardTaskDetailInitScript()}
refreshButton.onclick=()=>{refreshButton.disabled=true;refreshButton.textContent='↻ Updating…';window.location.reload()};
function setEditMode(on){
  editMode=on;
  detailView.hidden=on;
  detailEdit.hidden=!on;
  statusActions.hidden=on;
  queueAction.hidden=on||!(selectedTask&&(selectedTask.status==='To Do'||selectedTask.status==='Queued'));
  copyAction.hidden=on;
  editTask.hidden=on;
  if(typeof syncDeleteButton==='function')syncDeleteButton(on?null:selectedTask);
  if(on&&selectedTask)sourceEditor.value=selectedTask.source||'';
}
const statusActions=document.querySelector('#status-actions');
function openTask(task){
  selectedTask=task;actionError.textContent='';setEditMode(false);
  title.textContent=(task.id?task.id+' · ':'')+task.title;
  priority.textContent=task.priority;priority.className='badge priority-'+({"Ultra High":0,High:1,Medium:2,Low:3}[task.priority]??3);
  type.textContent=task.type;type.className='badge type-'+task.type;
  status.textContent=statusLabels[task.status]||task.status;file.textContent='Fuente: '+task.file;applyTaskDetailHtml(task);
  if(detailSubstatus){detailSubstatus.textContent=task.effectiveSubstatus||'';detailSubstatus.hidden=!task.effectiveSubstatus}
  fillSubstatusOptions(task);
  const queueable=task.status==='To Do'||task.status==='Queued';
  queueAction.hidden=!queueable;
  queueAction.textContent=task.status==='Queued'?'Quitar de cola':'Agregar a cola';
  moveButtons.forEach((button)=>button.classList.toggle('current',button.dataset.moveStatus===task.status));
  if(typeof syncDeleteButton==='function')syncDeleteButton(task);
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
bindTaskCards(cards,tasks,openTask);
document.querySelectorAll('[data-open-id]').forEach((button)=>button.onclick=()=>openTask(tasks.find((task)=>task.id===button.dataset.openId)));
queueAction.onclick=async()=>{if(!selectedTask)return;queueAction.disabled=true;const nextStatus=selectedTask.status==='Queued'?'To Do':'Queued';try{await moveTask(selectedTask.id,nextStatus)}catch(error){actionError.textContent=error.message;queueAction.disabled=false}};
moveButtons.forEach((button)=>button.onclick=async()=>{if(!selectedTask)return;button.disabled=true;try{await moveTask(selectedTask.id,button.dataset.moveStatus)}catch(error){actionError.textContent=error.message;button.disabled=false}});
columns.forEach((column)=>{const queueList=column.querySelector('.task-list');column.addEventListener('dragover',(event)=>{event.preventDefault();event.dataTransfer.dropEffect='move';column.classList.add('drag-over');if(column.dataset.column==='Queued'&&queueList){clearQueueDropMarkers();const afterElement=getDragAfterElement(queueList,event.clientY);if(afterElement)afterElement.classList.add('drop-before')}});column.addEventListener('dragleave',(event)=>{if(!column.contains(event.relatedTarget)){column.classList.remove('drag-over');if(column.dataset.column==='Queued')clearQueueDropMarkers()}});column.addEventListener('drop',async(event)=>{event.preventDefault();column.classList.remove('drag-over');clearQueueDropMarkers();const taskId=event.dataTransfer.getData('text/plain');const task=tasks.find((item)=>item.id===taskId);const nextStatus=column.dataset.column;if(!task)return;if(nextStatus==='Queued'){const afterElement=queueList?getDragAfterElement(queueList,event.clientY):null;const order=buildQueueOrder(queueList||column,taskId,afterElement);if(queueList){const dragged=queueList.querySelector('[data-task-id="'+taskId+'"]');const anchor=afterElement||null;if(dragged){if(anchor&&anchor!==dragged)queueList.insertBefore(dragged,anchor);else if(!anchor)queueList.appendChild(dragged);refreshQueueTurnNumbers(queueList)}}try{await saveQueueOrder(order)}catch(error){actionError.textContent=error.message;modal.classList.add('open')}return}if(task.status===nextStatus)return;try{await moveTask(taskId,nextStatus)}catch(error){actionError.textContent=error.message;modal.classList.add('open')}})});
copyAction.onclick=async()=>{if(!selectedTask)return;const prompt='Atiende '+selectedTask.id+': implementa, prueba, audita con Pharos y despliega si todo pasa.';await navigator.clipboard.writeText(prompt);copyAction.textContent='Instrucción copiada';setTimeout(()=>copyAction.textContent='Copiar instrucción para Codex',1600)};
document.querySelector('.close').onclick=()=>modal.classList.remove('open');modal.onclick=(event)=>{if(event.target===modal)modal.classList.remove('open')};document.addEventListener('keydown',(event)=>{if(event.key==='Escape')modal.classList.remove('open')});
</script>
</body>
</html>`;
}

async function handle(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/projects') return json(res, 200, readCatalog().map(summarize));
  if (req.method === 'GET' && url.pathname === '/api/hub-config') {
    return json(res, 200, {
      ganttBaseUrl: GANTT_BASE_URL,
      hubPort: PORT,
      boardPort: BOARD_PORT,
    });
  }
  const gantt = url.pathname.match(/^\/api\/projects\/([^/]+)\/gantt$/);
  if (req.method === 'GET' && gantt) {
    const project = readCatalog().find((item) => item.slug === gantt[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    const config = readAiCapacityConfig(project);
    const queryCapacity = url.searchParams.get('capacity');
    const capacity = queryCapacity
      ? Number(queryCapacity || '2')
      : effectiveCapacityFromConfig(config, 2);
    const includeDone = url.searchParams.get('includeDone') !== '0';
    const iaHoursPerDay = Number(url.searchParams.get('iaHoursPerDay') || '8');
    const startDate = url.searchParams.get('startDate') || '';
    const holidays = (url.searchParams.get('holidays') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const workOnSaturday = url.searchParams.get('workOnSaturday') === '1';
    return json(res, 200, buildProjectGantt(project, {
      capacity,
      includeDone,
      iaHoursPerDay,
      startDate,
      holidays,
      workOnSaturday,
    }));
  }
  const aiCapacity = url.pathname.match(/^\/api\/projects\/([^/]+)\/ai-capacity-config$/);
  if (req.method === 'GET' && aiCapacity) {
    const project = readCatalog().find((item) => item.slug === aiCapacity[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    const config = readAiCapacityConfig(project);
    return json(res, 200, { project: project.slug, config });
  }
  if (req.method === 'POST' && aiCapacity) {
    const project = readCatalog().find((item) => item.slug === aiCapacity[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      if (!data || typeof data !== 'object') return json(res, 400, { error: 'invalid payload' });
      const normalized = normalizeAiCapacityConfigPayload(data);
      writeAiCapacityConfig(project, normalized);
      return json(res, 200, { project: project.slug, config: normalized });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  const aiOperators = url.pathname.match(/^\/api\/projects\/([^/]+)\/ai-operators$/);
  if (req.method === 'GET' && aiOperators) {
    const project = readCatalog().find((item) => item.slug === aiOperators[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    const config = readAiCapacityConfig(project) || normalizeAiCapacityConfigPayload({});
    return json(res, 200, { project: project.slug, operators: normalizeAiOperators(config.operators) });
  }
  if (req.method === 'POST' && aiOperators) {
    const project = readCatalog().find((item) => item.slug === aiOperators[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      const current = readAiCapacityConfig(project) || normalizeAiCapacityConfigPayload({});
      const next = {
        ...current,
        operators: normalizeAiOperators(data?.operators),
        version: Math.max(1, Number(current.version) || 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      writeAiCapacityConfig(project, next);
      return json(res, 200, { project: project.slug, operators: next.operators, config: next });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
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
  const importTasks = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/import$/);
  if (req.method === 'POST' && importTasks) {
    const project = readCatalog().find((item) => item.slug === importTasks[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      const report = importImprovements(project, data || {});
      return json(res, 200, report);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  const bulkEditTasks = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/bulk-edit$/);
  if (req.method === 'POST' && bulkEditTasks) {
    const project = readCatalog().find((item) => item.slug === bulkEditTasks[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      const report = bulkEditProjectTasks(project, data || {});
      return json(res, 200, report);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  const taskDependencies = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/dependencies$/);
  if (req.method === 'POST' && taskDependencies) {
    const project = readCatalog().find((item) => item.slug === taskDependencies[1]);
    if (!project) return json(res, 404, { error: 'project not found' });
    try {
      const data = await body(req);
      const taskId = String(data?.id || '').trim();
      if (!taskId) return json(res, 400, { error: 'id is required' });
      const updated = updateTaskDependencies(project, taskId, data?.dependencies);
      return json(res, 200, updated);
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
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
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
  if (req.method === 'POST' && url.pathname === '/api/tasks/substatus') {
    try {
      const data = await body(req);
      const updated = updateTaskSubstatus(project, data.id, {
        substatus: data.substatus,
        next_action: data.next_action,
      });
      return json(res, 200, updated);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/checklist') {
    try {
      const data = await body(req);
      const updated = updateTaskChecklist(project, data.id, Number(data.index), Boolean(data.checked));
      return json(res, 200, updated);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/queue/bugs') {
    return json(res, 200, getBugQueueSnapshot(project));
  }
  if (req.method === 'POST' && url.pathname === '/api/queue/bugs/claim') {
    try {
      const packet = await claimNextBug(project);
      const runFile = writeBugRunPacket(project, packet);
      return json(res, 200, { ...packet, runFile });
    } catch (error) {
      if (error.code === 'ACTIVE_BUG') {
        return json(res, 409, { error: error.message, active: error.active });
      }
      if (error.code === 'EMPTY_QUEUE') {
        return json(res, 404, { error: error.message });
      }
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/create') {
    try {
      const data = await body(req);
      const isBug = data.type === 'bug'
        || (Array.isArray(data.labels) && data.labels.some((label) => String(label).toLowerCase() === 'bug'))
        || /^bug\b/i.test(String(data.title || ''));
      if (isBug && data.queue !== false) {
        const created = await createBugTask(project, data);
        return json(res, 201, created);
      }
      const created = createTask(project, data);
      return json(res, 201, created);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/bugs/create') {
    try {
      const data = await body(req);
      const created = await createBugTask(project, data);
      return json(res, 201, created);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/import') {
    try {
      const data = await body(req);
      const report = importImprovements(project, data || {});
      return json(res, 200, report);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks/delete') {
    try {
      const data = await body(req);
      const deleted = deleteTask(project, data.id);
      return json(res, 200, deleted);
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

module.exports = { parseTask, priorityRank, sortTasksByPriority, sortQueuedTasks, nextQueuedTask, pickNextBug, pickNextImprovement, summarize, slugify, taskDetail, taskDetailHtml, queueBoardPage, validateTaskSource, touchUpdatedDate, updateTaskSource, updateTaskSubstatus, updateTaskChecklist, updateTaskDependencies, createTask, createBugTask, enqueueTask, getBugQueueSnapshot, claimNextBug, writeBugRunPacket, deleteTask, ensureProjectTaskIds, findTask, resolveTaskFilePath, projectTasks, updateQueueOrder, isBugTask, buildBugStats, bugsBoardPage, projectTaskCode, formatTaskId, parseTypedTaskId, normalizeProjectTaskIds, bugQueueState, buildBugRunInstruction, buildProjectGantt, importImprovements };
