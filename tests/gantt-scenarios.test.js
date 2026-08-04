const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { parseTask } = require('../server');

const FIXTURES_ROOT = path.join(__dirname, 'fixtures', 'gantt', 'scenarios');

function loadScenarioTasks(scenarioDir) {
  const tasksDir = path.join(scenarioDir, 'tasks');
  return fs.readdirSync(tasksDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const filePath = path.join(tasksDir, name);
      const source = fs.readFileSync(filePath, 'utf8');
      return { ...parseTask(filePath), file: path.join('tasks', name), source };
    });
}

function assertContract(plan) {
  assert.ok(plan.project?.slug);
  assert.ok(plan.summary);
  assert.ok(Array.isArray(plan.tasks));
  assert.ok(Array.isArray(plan.dependencyEdges));
  assert.equal(typeof plan.summary.cycleDetected, 'boolean');
  assert.equal(typeof plan.summary.unresolvedDependencies, 'number');
  assert.ok(plan.criticalPath?.route);
  for (const task of plan.tasks) {
    assert.ok(task.id);
    assert.ok(task.startDate);
    assert.ok(task.endDate);
    assert.ok(['bugs', 'mejoras'].includes(task.lane));
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'gantt', 'manifest.json'), 'utf8'));

for (const entry of manifest.scenarios) {
  test(`gantt scenario: ${entry.id}`, () => {
    const scenarioDir = path.join(FIXTURES_ROOT, entry.dir);
    const spec = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'scenario.json'), 'utf8'));
    const tasks = loadScenarioTasks(scenarioDir);
    const plan = buildProjectGanttFromTasks(tasks, { slug: entry.id, name: entry.id }, spec.options);
    assertContract(plan);

    const expect = spec.expect || {};
    if (expect.pendingTasks != null) assert.equal(plan.summary.pendingTasks, expect.pendingTasks);
    if (expect.cycleDetected != null) assert.equal(plan.summary.cycleDetected, expect.cycleDetected);
    if (expect.unresolvedDependencies != null) {
      assert.equal(plan.summary.unresolvedDependencies, expect.unresolvedDependencies);
    }
    if (expect.order) {
      const byId = new Map(plan.tasks.map((task) => [task.id, task]));
      for (let i = 1; i < expect.order.length; i += 1) {
        const prev = byId.get(expect.order[i - 1]);
        const next = byId.get(expect.order[i]);
        assert.ok(prev && next, `missing task in order ${expect.order[i - 1]} -> ${expect.order[i]}`);
        assert.ok(prev.startDay <= next.startDay);
      }
    }
    if (expect.minEdges != null) assert.ok(plan.dependencyEdges.length >= expect.minEdges);
    if (expect.relations) {
      for (const relation of expect.relations) {
        assert.ok(plan.dependencyEdges.some((edge) => edge.relation === relation));
      }
    }
    if (expect.lanes) {
      const byId = new Map(plan.tasks.map((task) => [task.id, task]));
      for (const [id, lane] of Object.entries(expect.lanes)) {
        assert.equal(byId.get(id)?.lane, lane);
      }
    }
    if (expect.firstStartId) {
      const first = [...plan.tasks].sort((a, b) => a.startIaHour - b.startIaHour)[0];
      assert.equal(first.id, expect.firstStartId);
    }
    if (expect.serialDaysMin != null || expect.parallelDaysMax != null) {
      const serial = buildProjectGanttFromTasks(tasks, { slug: entry.id, name: entry.id }, { ...spec.options, capacity: 1 });
      const parallel = buildProjectGanttFromTasks(tasks, { slug: entry.id, name: entry.id }, { ...spec.options, capacity: 2 });
      if (expect.serialDaysMin != null) {
        assert.ok(serial.summary.estimatedPendingDays >= expect.serialDaysMin);
      }
      if (expect.parallelDaysMax != null) {
        assert.ok(parallel.summary.estimatedPendingDays <= expect.parallelDaysMax);
      }
      if (expect.parallelGroupsMin != null) {
        assert.ok(parallel.parallelGroups.length >= expect.parallelGroupsMin);
      }
    }
    if (expect.firstWorkingStartNot) {
      const first = plan.tasks[0];
      assert.notEqual(first.startDate, expect.firstWorkingStartNot);
    }
    if (expect.deadlineViolations != null) {
      assert.equal(plan.summary.deadlineViolations, expect.deadlineViolations);
    }
    if (expect.violationCodes) {
      assert.ok(plan.tasks.some((task) => (task.violations || []).some((item) => expect.violationCodes.includes(item.code))));
    }
    if (expect.diagnosticCodes) {
      for (const [id, codes] of Object.entries(expect.diagnosticCodes)) {
        const task = plan.tasks.find((item) => item.id === id);
        assert.ok(task, `missing task ${id}`);
        for (const code of codes) {
          assert.ok((task.diagnostics || []).some((item) => item.code === code), `${id} missing diagnostic ${code}`);
        }
      }
    }
    if (expect.startOnOrAfter) {
      for (const [id, date] of Object.entries(expect.startOnOrAfter)) {
        const task = plan.tasks.find((item) => item.id === id);
        assert.ok(task, `missing task ${id}`);
        assert.ok(task.startDate >= date, `${id} starts ${task.startDate} before ${date}`);
      }
    }
    if (expect.parallelAtStart) {
      const atZero = plan.tasks.filter((task) => task.startIaHour === 0).map((task) => task.id).sort();
      assert.deepEqual(atZero, [...expect.parallelAtStart].sort());
    }
    if (expect.capacityPolicy) {
      assert.deepEqual(plan.parameters.capacityPolicy, expect.capacityPolicy);
    }
    if (expect.forecastConfidence) {
      for (const [id, level] of Object.entries(expect.forecastConfidence)) {
        const task = plan.tasks.find((item) => item.id === id);
        assert.ok(task, `missing task ${id}`);
        assert.equal(task.forecastConfidence, level, `${id} confidence`);
      }
    }
    if (expect.summaryBlockedTasks != null) {
      assert.equal(plan.summary.blockedTasks, expect.summaryBlockedTasks);
    }
    if (expect.lowConfidenceForecasts != null) {
      assert.equal(plan.summary.lowConfidenceForecasts, expect.lowConfidenceForecasts);
    }
  });
}

test('gantt contract documents required summary keys', () => {
  const contractPath = path.join(__dirname, '..', 'docs', 'gantt-planner-contract.md');
  const text = fs.readFileSync(contractPath, 'utf8');
  for (const key of ['cycleDetected', 'unresolvedDependencies', 'dependencyEdges', 'criticalPath']) {
    assert.match(text, new RegExp(key));
  }
});
