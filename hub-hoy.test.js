'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProjectHoy, buildHoySnapshot } = require('./hub-hoy');

function makeTasks() {
  return [
    {
      id: 'AH-E-1',
      title: 'Doing now',
      status: 'In Progress',
      ordinal: 5,
      priority: 'High',
      source: '---\nid: AH-E-1\nstatus: In Progress\n---\n',
    },
    {
      id: 'AH-E-2',
      title: 'Next queued',
      status: 'Queued',
      ordinal: 10,
      priority: 'Ultra High',
      source: '---\nid: AH-E-2\nstatus: Queued\nordinal: 10\n---\n',
    },
    {
      id: 'AH-E-3',
      title: 'Blocked queue',
      status: 'Queued',
      ordinal: 5,
      priority: 'High',
      source: '---\nid: AH-E-3\nstatus: Queued\nordinal: 5\ndependencies:\n  - AH-E-99\n---\n',
    },
  ];
}

test('buildProjectHoy surfaces doing, blocked head and next when ready', () => {
  const project = { slug: 'ariadne', name: 'Ariadne', path: '/tmp/x' };
  const tasks = makeTasks();
  const hoy = buildProjectHoy(project, {
    projectTasks: () => tasks,
    buildProjectGanttMetrics: () => ({ deadlineAtRisk: 1, blockedTasks: 0 }),
  });
  assert.equal(hoy.doingCount, 1);
  assert.equal(hoy.doing[0].id, 'AH-E-1');
  assert.equal(hoy.blockedHead.id, 'AH-E-3');
  assert.equal(hoy.next, null);
  assert.ok(hoy.risks.some((item) => item.kind === 'queue-blocked'));
  assert.ok(hoy.risks.some((item) => item.kind === 'deadline'));
  assert.match(hoy.actions.runSwarm, /\/swarm\/run$/);
  assert.match(hoy.actions.swarmObserve, /\/swarm\/observe$/);
});

test('buildHoySnapshot filters by project slug', () => {
  const projects = [
    { slug: 'ariadne', name: 'Ariadne', path: '/a' },
    { slug: 'project-demo', name: 'Proyecto Demo', path: '/j' },
  ];
  const snap = buildHoySnapshot(projects, {
    projectTasks: (project) => (project.slug === 'ariadne' ? makeTasks() : []),
  }, { project: 'ariadne' });
  assert.equal(snap.projectCount, 1);
  assert.equal(snap.projects[0].project, 'ariadne');
  assert.equal(snap.focus[0].doingCount, 1);
});
