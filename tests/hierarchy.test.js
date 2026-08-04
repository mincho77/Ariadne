'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  parseStructureFields,
  buildTaskHierarchy,
  collectMilestones,
} = require('../lib/gantt/hierarchy');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');
const { normalizeTaskPatch } = require('../lib/task-temporal');

test('parseStructureFields detects milestones and hierarchy metadata', () => {
  const milestone = {
    type: 'milestone',
    source: '---\nid: JM-E-10\nparent_id: JM-E-9\nrelease: r1\nworkstream: api\n---\n',
  };
  const child = {
    type: 'feature',
    source: '---\nid: JM-E-11\nparent_id: JM-E-9\n---\n',
  };
  const ms = parseStructureFields(milestone);
  assert.equal(ms.isMilestone, true);
  assert.equal(ms.nodeKind, 'milestone');
  assert.equal(ms.parentId, 'JM-E-9');
  assert.equal(ms.release, 'r1');
  assert.equal(ms.workstream, 'api');

  const ch = parseStructureFields(child);
  assert.equal(ch.isMilestone, false);
  assert.equal(ch.parentId, 'JM-E-9');
});

test('buildTaskHierarchy builds parent-child tree without altering task ids', () => {
  const tasks = [
    { id: 'JM-E-9', title: 'Phase', parentId: null, release: null, workstream: null, nodeKind: 'phase', isMilestone: false, status: 'To Do' },
    { id: 'JM-E-10', title: 'Child', parentId: 'JM-E-9', release: 'r1', workstream: null, nodeKind: 'task', isMilestone: false, status: 'To Do' },
    { id: 'JM-E-11', title: 'Milestone', parentId: 'JM-E-9', release: 'r1', workstream: null, nodeKind: 'milestone', isMilestone: true, status: 'To Do' },
  ];
  const schedule = new Map([
    ['JM-E-10', { startDate: '2026-08-05', endDate: '2026-08-06' }],
    ['JM-E-11', { startDate: '2026-08-06', endDate: '2026-08-06' }],
  ]);
  const tree = buildTaskHierarchy(tasks, schedule);
  assert.deepEqual(tree.roots, ['JM-E-9']);
  assert.deepEqual(tree.nodes['JM-E-9'].childrenIds, ['JM-E-10', 'JM-E-11']);
  assert.equal(tree.nodes['JM-E-11'].isMilestone, true);
  assert.equal(tree.nodes['JM-E-10'].startDate, '2026-08-05');
});

test('normalizeTaskPatch accepts parent_id release and workstream', () => {
  const patch = normalizeTaskPatch({
    parentId: 'JM-E-9',
    release: '2026-Q3',
    workstream: 'platform',
  });
  assert.equal(patch.parent_id, 'JM-E-9');
  assert.equal(patch.release, '2026-Q3');
  assert.equal(patch.workstream, 'platform');
});

test('gantt API exposes milestones and hierarchy with zero-duration milestone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-hierarchy-gantt-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'jm-e-9 - Phase.md'), '---\nid: JM-E-9\ntitle: Phase API\nstatus: To Do\npriority: Medium\ntype: phase\nestimate_days: 1\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'jm-e-10 - Build.md'), '---\nid: JM-E-10\ntitle: Build API\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 1\nparent_id: JM-E-9\n---\n');
  fs.writeFileSync(path.join(tasksDir, 'jm-e-11 - Ship.md'), '---\nid: JM-E-11\ntitle: Ship milestone\nstatus: To Do\npriority: Medium\ntype: milestone\nparent_id: JM-E-9\ndependencies:\n  - JM-E-10\n---\n');
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

  assert.equal(plan.milestones.length, 1);
  assert.equal(plan.milestones[0].id, 'JM-E-11');
  assert.equal(plan.milestones[0].durationIaHours, 0);
  assert.equal(plan.milestones[0].startDate, plan.milestones[0].endDate);
  assert.deepEqual(plan.hierarchy.roots, ['JM-E-9']);
  assert.deepEqual(plan.hierarchy.nodes['JM-E-9'].childrenIds, ['JM-E-10', 'JM-E-11']);
  assert.ok(collectMilestones(plan.tasks).every((item) => item.isMilestone));
});
