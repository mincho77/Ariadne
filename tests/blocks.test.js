'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  parseBlockFields,
  buildBlockConstraint,
  isBlockedStatus,
} = require('../lib/gantt/blocks');
const { buildWorkingCalendar } = require('../lib/gantt/calendar');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');
const { normalizeTaskPatch, applyTaskPatchToSource } = require('../lib/task-temporal');

test('isBlockedStatus detects Blocked kanban lane', () => {
  assert.equal(isBlockedStatus('Blocked'), true);
  assert.equal(isBlockedStatus('To Do'), false);
});

test('parseBlockFields reads blocked metadata and confidence levels', () => {
  const withDate = {
    status: 'Blocked',
    source: `---
blocked: true
blocked_since: '2026-08-01'
blocked_reason: Esperando API
blocked_by: vendor
expected_unblock_date: '2026-08-12'
---`,
  };
  const open = {
    status: 'To Do',
    source: '---\nblocked: true\nblocked_reason: Sin ETA\n---\n',
  };
  const dated = parseBlockFields(withDate);
  assert.equal(dated.isBlocked, true);
  assert.equal(dated.blockedSinceIso, '2026-08-01');
  assert.equal(dated.blockedReason, 'Esperando API');
  assert.equal(dated.blockedBy, 'vendor');
  assert.equal(dated.expectedUnblockIso, '2026-08-12');
  assert.equal(dated.forecastConfidence, 'medium');

  const openBlock = parseBlockFields(open);
  assert.equal(openBlock.isBlocked, true);
  assert.equal(openBlock.expectedUnblockIso, null);
  assert.equal(openBlock.forecastConfidence, 'low');
});

test('buildBlockConstraint delays start when expected unblock date exists', () => {
  const calendar = buildWorkingCalendar({ startDate: '2026-08-04', iaHoursPerDay: 8 });
  const task = {
    isBlocked: true,
    blockedReason: 'Review',
    blockedBy: 'legal',
    blockedSinceIso: '2026-08-04',
    expectedUnblockIso: '2026-08-11',
    forecastConfidence: 'medium',
  };
  const constraint = buildBlockConstraint(task, calendar);
  assert.ok(constraint.earliestStartIaHour > 0);
  assert.equal(constraint.forecastConfidence, 'medium');
  assert.ok(constraint.drivers.some((item) => item.code === 'blocked_until'));
});

test('normalizeTaskPatch accepts blocked temporal fields', () => {
  const patch = normalizeTaskPatch({
    blocked: true,
    blockedSince: '2026-08-04',
    blockedBy: 'qa',
    blockedReason: 'Env',
    expectedUnblockDate: '2026-08-20',
  });
  assert.equal(patch.blocked, true);
  assert.equal(patch.blocked_since, '2026-08-04');
  assert.equal(patch.blocked_by, 'qa');
  assert.equal(patch.expected_unblock_date, '2026-08-20');
  const source = applyTaskPatchToSource('---\nid: X\n---\n', patch);
  assert.match(source, /blocked: (true|'true')/);
  assert.match(source, /expected_unblock_date: '2026-08-20'/);
});

test('gantt delays blocked task with expected unblock and marks open blocks low confidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-blocks-gantt-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'gt-e-1 - Free.md'), '---\nid: GT-E-1\ntitle: Free\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'gt-e-2 - Dated.md'), `---
id: GT-E-2
title: Dated block
status: Blocked
priority: Medium
type: feature
estimate_days: 1
blocked_reason: Vendor
expected_unblock_date: '2026-08-11'
---`);
  fs.writeFileSync(path.join(tasksDir, 'gt-e-3 - Open.md'), `---
id: GT-E-3
title: Open block
status: To Do
priority: Medium
type: feature
estimate_days: 1
blocked: true
blocked_reason: Unknown ETA
---`);
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
  const dated = plan.tasks.find((task) => task.id === 'GT-E-2');
  const open = plan.tasks.find((task) => task.id === 'GT-E-3');
  assert.ok(dated.startDate >= '2026-08-11');
  assert.equal(dated.forecastConfidence, 'medium');
  assert.equal(open.forecastConfidence, 'low');
  assert.equal(plan.summary.blockedTasks, 2);
  assert.equal(plan.summary.lowConfidenceForecasts, 1);
});
