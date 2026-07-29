const fs = require('node:fs');
const path = require('node:path');

const TASK_ID_PATTERN = /^([A-Z]{2})-([BE])-(\d+)$/i;

const DEFAULT_PROJECT_CODES = {
  ariadne: 'AH',
  jurismate: 'JM',
};

function projectTaskCode(project) {
  if (project?.taskCode) {
    return String(project.taskCode).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  }
  if (DEFAULT_PROJECT_CODES[project?.slug]) return DEFAULT_PROJECT_CODES[project.slug];
  const words = String(project?.name || project?.slug || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  const compact = String(project?.slug || project?.name || 'PR').replace(/[^a-zA-Z]/g, '');
  return compact.slice(0, 2).toUpperCase() || 'PR';
}

function taskKindForId({ type, labels, title }, isBugTask) {
  return isBugTask({ type, labels, title }) ? 'B' : 'E';
}

function formatTaskId(code, kind, number) {
  return `${String(code).toUpperCase()}-${String(kind).toUpperCase()}-${number}`;
}

function parseTypedTaskId(id) {
  const match = String(id || '').trim().match(TASK_ID_PATTERN);
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    kind: match[2].toUpperCase(),
    number: Number(match[3]),
  };
}

function nextTaskNumber(tasks, code, kind) {
  const normalizedCode = String(code).toUpperCase();
  const normalizedKind = String(kind).toUpperCase();
  let max = 0;
  for (const task of tasks) {
    const parsed = parseTypedTaskId(task.id);
    if (!parsed) continue;
    if (parsed.code === normalizedCode && parsed.kind === normalizedKind) {
      max = Math.max(max, parsed.number);
    }
  }
  return max + 1;
}

function allocateTaskId(project, draft, isBugTask, listTasks) {
  const code = projectTaskCode(project);
  const kind = taskKindForId(draft, isBugTask);
  const number = nextTaskNumber(listTasks(project), code, kind);
  return formatTaskId(code, kind, number);
}

function taskFileName(taskId, title, slugify) {
  const slug = slugify(title);
  return `${String(taskId).toLowerCase()} - ${slug}.md`;
}

function stampNow() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

function buildTaskSource({
  id,
  title,
  status = 'To Do',
  priority = 'Medium',
  type = 'task',
  labels = [],
  description = '',
  acceptanceCriteria = [],
}) {
  const stamp = stampNow();
  const labelBlock = labels.length
    ? `labels:\n${labels.map((label) => `  - ${label}`).join('\n')}\n`
    : '';
  const acBlock = acceptanceCriteria.length
    ? `\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n${acceptanceCriteria.map((item, index) => `- [ ] #${index + 1} ${item}`).join('\n')}\n<!-- AC:END -->\n`
    : '';
  const descriptionBlock = description.trim()
    ? `\n## Description\n\n${description.trim()}\n`
    : '\n## Description\n\n';
  return `---
id: ${id}
title: ${title}
status: ${status}
assignee: []
created_date: '${stamp}'
updated_date: '${stamp}'
${labelBlock}priority: ${priority}
type: ${type}
ordinal: 1000
---
${descriptionBlock}${acBlock}`;
}

function createTaskFile(project, options, helpers) {
  const { isBugTask, projectTasks, slugify, findTask } = helpers;
  const title = String(options.title || '').trim();
  if (!title) throw new Error('title is required');

  const draft = {
    type: options.type || (options.kind === 'B' ? 'bug' : 'enhancement'),
    labels: Array.isArray(options.labels) ? options.labels : [],
    title,
  };
  if (draft.type === 'bug' && !draft.labels.some((label) => String(label).toLowerCase() === 'bug')) {
    draft.labels.push('bug');
  }

  const id = options.id
    ? String(options.id).trim().toUpperCase()
    : allocateTaskId(project, draft, isBugTask, projectTasks);

  const parsed = parseTypedTaskId(id);
  if (!parsed) {
    throw new Error('task id must match XX-B-1 or XX-E-1');
  }

  const expectedKind = taskKindForId(draft, isBugTask);
  if (parsed.kind !== expectedKind) {
    throw new Error(`task kind mismatch: expected ${expectedKind}, got ${parsed.kind}`);
  }

  if (findTask(project, id)) throw new Error(`task already exists: ${id}`);

  const relativeFile = taskFileName(id, title, slugify);
  const tasksDir = path.join(project.path, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const filePath = path.join(tasksDir, relativeFile);
  if (fs.existsSync(filePath)) throw new Error(`task file already exists: ${relativeFile}`);

  const source = buildTaskSource({
    id,
    title,
    status: options.status || 'To Do',
    priority: options.priority || 'Medium',
    type: draft.type,
    labels: draft.labels,
    description: options.description || '',
    acceptanceCriteria: Array.isArray(options.acceptanceCriteria) ? options.acceptanceCriteria : [],
  });

  fs.writeFileSync(filePath, source.endsWith('\n') ? source : `${source}\n`, 'utf8');
  return {
    id,
    file: path.join('tasks', relativeFile).split(path.sep).join('/'),
    path: filePath,
    source,
  };
}

module.exports = {
  TASK_ID_PATTERN,
  DEFAULT_PROJECT_CODES,
  projectTaskCode,
  taskKindForId,
  formatTaskId,
  parseTypedTaskId,
  nextTaskNumber,
  allocateTaskId,
  taskFileName,
  buildTaskSource,
  createTaskFile,
};
