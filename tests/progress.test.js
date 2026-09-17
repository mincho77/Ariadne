'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  suggestProgressFromChecklist,
  resolveEffectiveDurationIaHours,
  resolveEffectiveProgress,
  buildProgressSnapshot,
} = require('../lib/gantt/progress');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');

const CHECKLIST_SOURCE = `---
id: AH-E-1
title: Demo
status: In Progress
priority: Medium
type: task
estimate_ia_hours: 8
---

## Acceptance Criteria
- [x] #1 Hecho
- [ ] #2 Pendiente
`;

test('suggestProgressFromChecklist returns checklist completion ratio', () => {
  assert.equal(suggestProgressFromChecklist(CHECKLIST_SOURCE), 50);
});

test('resolveEffectiveProgress forces 100 for Done and respects declared progress for Doing', () => {
  const doing = { status: 'In Progress', source: '---\nprogress: 40\n---\n' };
  const done = { status: 'Done', source: '---\nprogress: 10\n---\n' };
  assert.equal(resolveEffectiveProgress(doing), 40);
  assert.equal(resolveEffectiveProgress(done), 100);
});

test('resolveEffectiveDurationIaHours prioritizes remaining_ia_hours over progress', () => {
  const task = {
    status: 'In Progress',
    source: '---\nprogress: 50\nremaining_ia_hours: 3\nestimate_ia_hours: 8\n---\n',
  };
  assert.equal(resolveEffectiveDurationIaHours(task, 8, 8), 3);
});

test('resolveEffectiveDurationIaHours derives remaining from progress when remaining is absent', () => {
  const task = {
    status: 'In Progress',
    source: '---\nprogress: 50\nestimate_ia_hours: 8\n---\n',
  };
  assert.equal(resolveEffectiveDurationIaHours(task, 8, 8), 4);
});

test('buildProgressSnapshot uses checklist suggestion for forecast when progress is absent', () => {
  const task = { status: 'In Progress', source: CHECKLIST_SOURCE };
  const snapshot = buildProgressSnapshot(task, 8, 8);
  assert.equal(snapshot.progressSuggestedFromChecklist, 50);
  assert.equal(snapshot.remainingIaHours, 4);
  assert.equal(snapshot.durationSource, 'checklist_suggestion');
  assert.equal(snapshot.executedIaHours, 4);
});

test('gantt plan shortens schedule when remaining_ia_hours is set', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-progress-gantt-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - One.md'), '---\nid: AH-E-1\ntitle: One\nstatus: In Progress\npriority: Medium\ntype: task\nestimate_ia_hours: 16\nremaining_ia_hours: 4\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'ah-e-2 - Two.md'), '---\nid: AH-E-2\ntitle: Two\nstatus: To Do\npriority: Medium\ntype: task\nestimate_ia_hours: 8\n---\n');
  const tasks = fs.readdirSync(tasksDir).map((name) => {
    const filePath = path.join(tasksDir, name);
    return { ...parseTask(filePath), file: path.join('tasks', name), source: fs.readFileSync(filePath, 'utf8') };
  });
  const plan = buildProjectGanttFromTasks(tasks, { slug: 'demo', name: 'Demo' }, {
    capacity: 1,
    includeDone: false,
    iaHoursPerDay: 8,
    startDate: '2026-08-04',
  });
  const one = plan.tasks.find((task) => task.id === 'AH-E-1');
  assert.equal(one.durationIaHours, 4);
  assert.equal(one.remainingIaHours, 4);
  assert.equal(one.durationSource, 'remaining_ia_hours');
});
