const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  parseCrossProjectDependency,
  collectCrossProjectDependencies,
  buildGanttPortfolio,
} = require('../lib/gantt/portfolio');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { buildHubGanttMetrics } = require('../lib/gantt/hub-metrics');
const { parseTask } = require('../server');

test('parseCrossProjectDependency recognizes slug:task tokens', () => {
  const slugs = new Set(['jurismate', 'ariadne']);
  const row = parseCrossProjectDependency('jurismate:JM-E-10:FS+1d', 'ariadne', slugs);
  assert.deepEqual(row, {
    fromProjectSlug: 'jurismate',
    fromTaskId: 'JM-E-10',
    relation: 'FS',
    lagToken: '+1d',
    raw: 'jurismate:JM-E-10:FS+1d',
  });
  assert.equal(parseCrossProjectDependency('JM-E-1', 'ariadne', slugs), null);
});

test('collectCrossProjectDependencies indexes edges from task frontmatter', () => {
  const tasks = [{
    id: 'AH-E-1',
    title: 'Downstream',
    source: '---\nid: AH-E-1\ndependencies:\n  - jurismate:JM-E-2\n---\n',
  }];
  const edges = collectCrossProjectDependencies(tasks, 'ariadne', new Set(['jurismate']));
  assert.equal(edges.length, 1);
  assert.equal(edges[0].fromProjectSlug, 'jurismate');
  assert.equal(edges[0].toTaskId, 'AH-E-1');
});

test('buildGanttPortfolio aggregates metrics and milestones', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-portfolio-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'gt-1 - One.md'), `---
id: GT-1
title: Hito alpha
status: To Do
priority: Medium
type: milestone
is_milestone: true
---`);
  fs.writeFileSync(path.join(tasksDir, 'gt-2 - Two.md'), `---
id: GT-2
title: Work
status: To Do
priority: Medium
type: task
estimate_days: 1
dependencies:
  - other:GT-9
---`);

  const catalog = [{ slug: 'demo', name: 'Demo', path: root }, { slug: 'other', name: 'Other', path: root }];
  const loadTasks = () => fs.readdirSync(tasksDir)
    .filter((n) => n.endsWith('.md'))
    .map((name) => {
      const filePath = path.join(tasksDir, name);
      const source = fs.readFileSync(filePath, 'utf8');
      return { ...parseTask(filePath, source), source };
    });

  const portfolio = buildGanttPortfolio(catalog, {
    capacity: 1,
    startDate: '2026-08-04',
    includeDone: false,
  }, {
    buildProjectGantt: (project, options) => (
      buildProjectGanttFromTasks(loadTasks(), { slug: project.slug, name: project.name }, options)
    ),
    buildProjectGanttMetrics: (project, options) => (
      buildHubGanttMetrics(buildProjectGanttFromTasks(
        loadTasks(),
        { slug: project.slug, name: project.name },
        options,
      ))
    ),
    projectTasks: () => loadTasks(),
    projectExists: () => true,
  });

  assert.equal(portfolio.summary.projectCount, 2);
  assert.ok(portfolio.milestones.length >= 1);
  assert.ok(portfolio.crossProjectDependencies.length >= 1);
  assert.ok(Array.isArray(portfolio.risks));
});
