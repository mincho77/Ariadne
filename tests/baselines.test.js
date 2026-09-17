'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  buildBaselineFromPlan,
  writeBaselineAtomic,
  readBaselineFile,
  listBaselines,
  compareBaselineToPlan,
  generateBaselineId,
} = require('../lib/gantt/baselines');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');

function createBaselineSandbox(prefix = 'ariadne-baseline-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(
    path.join(tasksDir, 'ah-e-1 - One.md'),
    '---\nid: AH-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: task\nestimate_days: 2\n---\n',
  );
  fs.writeFileSync(
    path.join(tasksDir, 'ah-e-2 - Two.md'),
    '---\nid: AH-E-2\ntitle: Two\nstatus: To Do\npriority: Medium\ntype: task\nestimate_days: 3\n---\n',
  );
  const project = { slug: 'demo', name: 'Demo', path: root };
  const tasks = fs.readdirSync(tasksDir)
    .filter((name) => name.endsWith('.md'))
    .map((file) => {
      const filePath = path.join(tasksDir, file);
      return { ...parseTask(filePath), file: path.join('tasks', file), source: fs.readFileSync(filePath, 'utf8') };
    });
  const plan = buildProjectGanttFromTasks(tasks, project, {
    capacity: 1,
    includeDone: false,
    iaHoursPerDay: 8,
    startDate: '2026-08-04',
  });
  return { project, plan, tasksDir };
}

test('buildBaselineFromPlan requires name and captures author metadata', () => {
  const { plan } = createBaselineSandbox('ariadne-baseline-meta-');
  assert.throws(() => buildBaselineFromPlan(plan, {}), /name es requerido/);
  const baseline = buildBaselineFromPlan(plan, { name: 'Sprint 1', author: 'qa-bot' });
  assert.equal(baseline.name, 'Sprint 1');
  assert.equal(baseline.author, 'qa-bot');
  assert.match(baseline.id, /^bl-\d{8}-sprint-1-[a-f0-9]{6}$/);
  assert.match(baseline.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(baseline.project.slug, 'demo');
  assert.ok(Array.isArray(baseline.tasks));
  assert.ok(baseline.tasks.length >= 2);
  assert.ok(baseline.summary.estimatedPendingDays > 0);
});

test('writeBaselineAtomic persists immutable snapshot and rejects duplicates', () => {
  const { project, plan } = createBaselineSandbox('ariadne-baseline-immutable-');
  const id = generateBaselineId('freeze');
  const baseline = buildBaselineFromPlan(plan, { name: 'Freeze', author: 'test', id });
  writeBaselineAtomic(project, baseline);
  const dir = path.join(project.path, 'backlog', 'docs', 'gantt', 'baselines');
  assert.equal(fs.existsSync(path.join(dir, `${id}.json`)), true);
  const loaded = readBaselineFile(project, id);
  assert.deepEqual(loaded.id, id);
  assert.throws(
    () => writeBaselineAtomic(project, baseline),
    /ya existe.*inmutable/i,
  );
});

test('listBaselines returns newest first with summary fields', () => {
  const { project, plan } = createBaselineSandbox('ariadne-baseline-list-');
  const older = buildBaselineFromPlan(plan, {
    name: 'Older',
    author: 'a',
    id: 'bl-20260801-older-aaaaaa',
  });
  older.createdAt = '2026-08-01T10:00:00.000Z';
  const newer = buildBaselineFromPlan(plan, {
    name: 'Newer',
    author: 'b',
    id: 'bl-20260804-newer-bbbbbb',
  });
  newer.createdAt = '2026-08-04T10:00:00.000Z';
  writeBaselineAtomic(project, older);
  writeBaselineAtomic(project, newer);
  const rows = listBaselines(project);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, newer.id);
  assert.equal(rows[0].name, 'Newer');
  assert.equal(rows[0].author, 'b');
  assert.ok(rows[0].taskCount >= 2);
});

test('compareBaselineToPlan reports slip, add and remove deltas', () => {
  const { project, plan } = createBaselineSandbox('ariadne-baseline-compare-');
  const baseline = buildBaselineFromPlan(plan, {
    name: 'Compare',
    author: 'test',
    id: 'bl-20260804-compare-cccccc',
  });
  writeBaselineAtomic(project, baseline);

  const forecastPlan = JSON.parse(JSON.stringify(plan));
  const taskOne = forecastPlan.tasks.find((task) => task.id === 'AH-E-1');
  assert.ok(taskOne);
  taskOne.endDate = '2026-08-20';
  forecastPlan.tasks.push({
    id: 'AH-E-3',
    title: 'Three',
    status: 'To Do',
    lane: 'mejoras',
    startDate: '2026-08-18',
    endDate: '2026-08-19',
    startIaHour: 100,
    endIaHour: 108,
    durationIaHours: 8,
  });
  forecastPlan.tasks = forecastPlan.tasks.filter((task) => task.id !== 'AH-E-2');

  const report = compareBaselineToPlan(baseline, forecastPlan);
  assert.equal(report.baselineId, baseline.id);
  assert.ok(report.summary.slippedTasks >= 1 || report.tasks.some((row) => row.change === 'slipped'));
  assert.deepEqual(report.summary.addedTasks, ['AH-E-3']);
  assert.deepEqual(report.summary.removedTasks, ['AH-E-2']);
  const oneRow = report.tasks.find((row) => row.id === 'AH-E-1');
  assert.ok(oneRow);
  assert.equal(oneRow.change, 'slipped');
});
