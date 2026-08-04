const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const {
  readResourceConfig,
  resolveTaskPool,
  canAcceptTaskWithResources,
  defaultResourceConfig,
} = require('../lib/gantt/resources');
const { runWhatIfScenario, compareWhatIfPlans } = require('../lib/gantt/what-if');
const { parseTask } = require('../server');
const { normalizeTaskPatch, applyTaskPatchToSource } = require('../lib/task-temporal');

function loadFixtureTasks(relativeDir) {
  const tasksDir = path.join(__dirname, 'fixtures', 'gantt', 'scenarios', relativeDir, 'tasks');
  return fs.readdirSync(tasksDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const filePath = path.join(tasksDir, name);
      const source = fs.readFileSync(filePath, 'utf8');
      return { ...parseTask(filePath), file: path.join('tasks', name), source };
    });
}

test('readResourceConfig falls back to general pool when file missing', () => {
  const config = readResourceConfig({ path: path.join(os.tmpdir(), 'missing-project') }, 3);
  assert.equal(config.pools[0].id, 'general');
  assert.equal(config.pools[0].maxParallel, 3);
});

test('resolveTaskPool matches required skills', () => {
  const config = defaultResourceConfig(2);
  config.pools.unshift({
    id: 'backend',
    skills: ['backend'],
    resourceTypes: ['human'],
    maxParallel: 1,
  });
  const task = { requiredSkills: ['backend'], resourceType: 'human' };
  assert.equal(resolveTaskPool(task, config).id, 'backend');
});

test('canAcceptTaskWithResources enforces pool maxParallel', () => {
  const config = defaultResourceConfig(2);
  config.pools = [{
    id: 'solo',
    skills: ['*'],
    resourceTypes: ['human'],
    maxParallel: 1,
  }];
  const lanePolicy = { total: 2, bugs: 2, enhancements: 2 };
  const running = [{ id: 'A', endIaHour: 8, lane: 'mejoras', poolId: 'solo' }];
  const task = {
    id: 'B',
    type: 'feature',
    requiredSkills: [],
    resourceType: 'human',
    assignees: [],
  };
  assert.equal(canAcceptTaskWithResources(running, task, lanePolicy, config), false);
});

test('resourceAware plan exposes pool metadata on tasks', () => {
  const tasks = loadFixtureTasks('resource-pool-capacity');
  const plan = buildProjectGanttFromTasks(tasks, { slug: 'demo', name: 'demo' }, {
    capacity: 2,
    resourceAware: true,
    resourceConfig: {
      pools: [{
        id: 'solo-backend',
        skills: ['backend'],
        resourceTypes: ['human'],
        maxParallel: 1,
      }],
    },
    startDate: '2026-08-04',
    includeDone: false,
  });
  assert.equal(plan.parameters.resourceAware, true);
  assert.equal(plan.tasks[0].resourcePoolId, 'solo-backend');
  assert.ok(plan.tasks.every((row) => Array.isArray(row.requiredSkills)));
});

test('buildSlackAnalysis exposes logical and resource critical paths', () => {
  const tasks = loadFixtureTasks('fs-chain');
  const plan = buildProjectGanttFromTasks(tasks, { slug: 'fs', name: 'fs' }, {
    capacity: 1,
    startDate: '2026-08-04',
    includeDone: false,
  });
  assert.ok(plan.slack.logicalCriticalPath.route.length >= 1);
  assert.ok(plan.slack.resourceCriticalPath.route.length >= 1);
  assert.ok(plan.tasks.some((row) => row.isCriticalSlack));
});

test('runWhatIfScenario compares capacity overrides without persisting', () => {
  const tasks = loadFixtureTasks('capacity-parallel');
  const result = runWhatIfScenario(
    tasks,
    { slug: 'cap', name: 'cap' },
    { capacity: 1, startDate: '2026-08-04', includeDone: false },
    { label: 'double capacity', overrides: { capacity: 2 } },
  );
  assert.equal(result.persisted, false);
  assert.ok(result.comparison.summary.pendingDaysDelta != null);
  assert.ok(result.metrics.current);
  assert.ok(result.metrics.scenario);
});

test('compareWhatIfPlans flags slipped tasks', () => {
  const current = {
    tasks: [{ id: 'A', title: 'A', endDate: '2026-08-04' }],
    summary: { estimatedPendingDays: 2 },
  };
  const scenario = {
    tasks: [{ id: 'A', title: 'A', endDate: '2026-08-08' }],
    summary: { estimatedPendingDays: 4 },
  };
  const report = compareWhatIfPlans(current, scenario);
  assert.equal(report.tasks[0].change, 'slipped');
  assert.equal(report.summary.slippedTasks, 1);
});

test('normalizeTaskPatch accepts required_skills and resource_type', () => {
  const patch = normalizeTaskPatch({
    required_skills: ['backend', 'api'],
    resource_type: 'ai',
  });
  assert.deepEqual(patch.required_skills, ['backend', 'api']);
  assert.equal(patch.resource_type, 'ai');
  const source = applyTaskPatchToSource('---\nid: X\n---\n', patch);
  assert.match(source, /required_skills:/);
  assert.match(source, /resource_type: ['"]?ai['"]?/);
});
