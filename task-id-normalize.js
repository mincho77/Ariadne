const fs = require('node:fs');
const path = require('node:path');
const { isBugTask } = require('./bugs-board');
const {
  projectTaskCode,
  formatTaskId,
  parseTypedTaskId,
  taskFileName,
} = require('./task-ids');

function slugifyTitle(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'task';
}

function legacySortKey(task) {
  const typed = parseTypedTaskId(task.id);
  if (typed) return typed.number;
  const match = String(task.id).match(/^[A-Z]{2}-(\d+)$/i);
  if (match) return Number(match[1]);
  return Number.MAX_SAFE_INTEGER;
}

function loadProjectTaskEntries(project, parseTask) {
  const entries = [];
  for (const dir of ['tasks', 'completed', 'archive']) {
    const full = path.join(project.path, 'backlog', dir);
    if (!fs.existsSync(full)) continue;
    for (const file of fs.readdirSync(full).filter((name) => name.endsWith('.md'))) {
      const filePath = path.join(full, file);
      const source = fs.readFileSync(filePath, 'utf8');
      entries.push({
        dir,
        file,
        filePath,
        source,
        task: parseTask(filePath),
      });
    }
  }
  return entries;
}

function replaceIds(text, mapping) {
  let next = text;
  const ids = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const oldId of ids) {
    const newId = mapping[oldId];
    if (oldId === newId) continue;
    next = next.replace(new RegExp(`\\b${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), newId);
  }
  return next;
}

function expectedKind(task) {
  return isBugTask(task) ? 'B' : 'E';
}

function analyzeTaskIds(project, entries) {
  const code = projectTaskCode(project);
  const issues = [];
  const seen = new Map();

  for (const entry of entries) {
    const { task } = entry;
    const parsed = parseTypedTaskId(task.id);
    const kind = expectedKind(task);

    if (!parsed) {
      issues.push({ type: 'legacy', id: task.id, title: task.title });
      continue;
    }
    if (parsed.code !== code) {
      issues.push({ type: 'wrong_code', id: task.id, have: parsed.code, want: code, title: task.title });
    }
    if (parsed.kind !== kind) {
      issues.push({ type: 'wrong_kind', id: task.id, have: parsed.kind, want: kind, title: task.title });
    }
    const slot = `${parsed.code}-${parsed.kind}-${parsed.number}`;
    if (seen.has(slot)) {
      issues.push({ type: 'duplicate_number', id: task.id, collidesWith: seen.get(slot), title: task.title });
    }
    seen.set(slot, task.id);
  }

  const bugs = entries.filter((entry) => isBugTask(entry.task));
  const improvements = entries.filter((entry) => !isBugTask(entry.task));
  for (const lane of [
    { kind: 'B', items: bugs },
    { kind: 'E', items: improvements },
  ]) {
    const numbers = lane.items
      .map((entry) => parseTypedTaskId(entry.task.id))
      .filter(Boolean)
      .filter((parsed) => parsed.code === code && parsed.kind === lane.kind)
      .map((parsed) => parsed.number)
      .sort((a, b) => a - b);
    for (let index = 0; index < numbers.length; index += 1) {
      if (numbers[index] !== index + 1) {
        issues.push({ type: 'number_gap', kind: lane.kind, expected: index + 1, found: numbers[index] });
        break;
      }
    }
  }

  return { code, issues, needsFix: issues.length > 0 };
}

function buildNormalizationPlan(project, entries) {
  const code = projectTaskCode(project);
  const sortEntries = (list) => list.sort((a, b) => {
    const diff = legacySortKey(a.task) - legacySortKey(b.task);
    if (diff !== 0) return diff;
    const createdDiff = String(a.task.createdDate || '').localeCompare(String(b.task.createdDate || ''));
    if (createdDiff !== 0) return createdDiff;
    return a.task.id.localeCompare(b.task.id);
  });

  const bugs = sortEntries(entries.filter((entry) => isBugTask(entry.task)));
  const improvements = sortEntries(entries.filter((entry) => !isBugTask(entry.task)));
  const mapping = {};

  bugs.forEach((entry, index) => {
    mapping[entry.task.id] = formatTaskId(code, 'B', index + 1);
  });
  improvements.forEach((entry, index) => {
    mapping[entry.task.id] = formatTaskId(code, 'E', index + 1);
  });

  const analysis = analyzeTaskIds(project, entries);
  const changes = entries.map((entry) => {
    const newId = mapping[entry.task.id];
    const newSource = replaceIds(entry.source, mapping);
    const newFile = taskFileName(newId, entry.task.title, slugifyTitle);
    const newPath = path.join(project.path, 'backlog', entry.dir, newFile);
    return {
      oldId: entry.task.id,
      newId,
      oldPath: entry.filePath,
      newPath,
      dir: entry.dir,
      changed: entry.task.id !== newId || entry.filePath !== newPath || entry.source !== newSource,
      source: newSource,
    };
  }).filter((change) => change.changed);

  return {
    code,
    mapping,
    analysis,
    bugs: bugs.length,
    improvements: improvements.length,
    changes,
    needsFix: analysis.needsFix || changes.length > 0,
  };
}

function applyNormalizationPlan(project, plan) {
  if (!plan.changes.length) {
    return { applied: 0, mapFile: null };
  }

  const finalFiles = new Map();
  for (const change of plan.changes) {
    if (finalFiles.has(change.newPath)) {
      throw new Error(`duplicate target path: ${change.newPath}`);
    }
    finalFiles.set(change.newPath, change.source);
  }

  const oldPaths = new Set(plan.changes.map((change) => change.oldPath));
  for (const oldPath of oldPaths) {
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  for (const [filePath, source] of finalFiles) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source.endsWith('\n') ? source : `${source}\n`, 'utf8');
  }

  const mapFile = path.join(project.path, 'backlog', 'task-id-migration.json');
  fs.writeFileSync(mapFile, `${JSON.stringify({
    migratedAt: new Date().toISOString(),
    code: plan.code,
    mapping: plan.mapping,
    issues: plan.analysis.issues,
  }, null, 2)}\n`, 'utf8');

  return { applied: plan.changes.length, mapFile };
}

function normalizeProjectTaskIds(project, { parseTask, apply = false } = {}) {
  if (!parseTask) throw new Error('parseTask is required');
  const entries = loadProjectTaskEntries(project, parseTask);
  const plan = buildNormalizationPlan(project, entries);
  if (!apply) {
    return { ...plan, applied: 0, mapFile: null };
  }
  const result = applyNormalizationPlan(project, plan);
  return { ...plan, ...result };
}

module.exports = {
  legacySortKey,
  loadProjectTaskEntries,
  replaceIds,
  analyzeTaskIds,
  buildNormalizationPlan,
  applyNormalizationPlan,
  normalizeProjectTaskIds,
};
