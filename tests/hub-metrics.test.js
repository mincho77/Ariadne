'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  buildHubGanttMetrics,
  resolveAggregateForecastConfidence,
} = require('../lib/gantt/hub-metrics');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');
const { buildBaselineFromPlan, writeBaselineAtomic } = require('../lib/gantt/baselines');
const { parseTask, summarize, buildProjectGanttMetrics } = require('../server');

test('resolveAggregateForecastConfidence marks low when open blocks exist', () => {
  assert.equal(resolveAggregateForecastConfidence({
    blockedWithoutUnblockDate: 1,
  }, []), 'low');
  assert.equal(resolveAggregateForecastConfidence({
    deadlineViolations: 2,
    blockedTasks: 0,
  }, []), 'medium');
  assert.equal(resolveAggregateForecastConfidence({
    blockedTasks: 1,
    blockedWithoutUnblockDate: 0,
  }, []), 'medium');
  assert.equal(resolveAggregateForecastConfidence({}, []), 'high');
});

test('buildHubGanttMetrics includes forecast finish and baseline variance', () => {
  const plan = {
    parameters: { startDate: '2026-08-04' },
    generatedAt: '2026-08-04T12:00:00.000Z',
    summary: {
      estimatedPendingDays: 5,
      estimatedPendingIaHours: 40,
      completionRate: 60,
      deadlineViolations: 1,
      blockedTasks: 2,
      blockedWithoutUnblockDate: 1,
      lowConfidenceForecasts: 1,
      cycleDetected: false,
    },
    tasks: [
      { id: 'A', endDate: '2026-08-10', forecastConfidence: 'low' },
      { id: 'B', endDate: '2026-08-12', forecastConfidence: 'high' },
    ],
  };
  const baseline = {
    id: 'bl-test',
    name: 'Sprint 1',
    tasks: [{ id: 'A', endDate: '2026-08-08' }, { id: 'B', endDate: '2026-08-09' }],
  };
  const metrics = buildHubGanttMetrics(plan, {
    baseline,
    baselineCompare: {
      baselineId: 'bl-test',
      baselineName: 'Sprint 1',
      summary: { pendingDaysDelta: 2, slippedTasks: 1 },
    },
  });
  assert.equal(metrics.forecastFinishDate, '2026-08-12');
  assert.equal(metrics.baselineFinishDate, '2026-08-09');
  assert.equal(metrics.finishVarianceDays, 3);
  assert.equal(metrics.pendingDaysDelta, 2);
  assert.equal(metrics.slippedTasks, 1);
  assert.equal(metrics.forecastConfidence, 'low');
});

test('summarize attaches ganttMetrics for hub cards', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-hub-metrics-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gt-e-1 - One.md'), '---\nid: GT-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\n---\n');
  const summary = summarize({ name: 'Demo', slug: 'demo', path: root, port: 6421 });
  assert.ok(summary.ganttMetrics);
  assert.ok(summary.ganttMetrics.forecastFinishDate);
  assert.equal(typeof summary.ganttMetrics.completionRate, 'number');
  assert.ok(['high', 'medium', 'low'].includes(summary.ganttMetrics.forecastConfidence));
});

test('buildProjectGanttMetrics compares against latest baseline when present', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-hub-metrics-bl-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'gt-e-1 - One.md'), '---\nid: GT-E-1\ntitle: One\nstatus: To Do\npriority: Medium\ntype: feature\nestimate_days: 2\n---\n');
  const project = { slug: 'demo', name: 'Demo', path: root };
  const tasks = fs.readdirSync(dir).map((name) => {
    const filePath = path.join(dir, name);
    return { ...parseTask(filePath), file: path.join('tasks', name), source: fs.readFileSync(filePath, 'utf8') };
  });
  const plan = buildProjectGanttFromTasks(tasks, project, { capacity: 1, includeDone: false, startDate: '2026-08-04' });
  const baseline = buildBaselineFromPlan(plan, { name: 'Freeze', author: 'test', id: 'bl-20260804-freeze-abc123' });
  writeBaselineAtomic(project, baseline);

  const metrics = buildProjectGanttMetrics(project, { includeDone: false, startDate: '2026-08-04', capacity: 1 });
  assert.equal(metrics.baselineId, 'bl-20260804-freeze-abc123');
  assert.equal(metrics.pendingDaysDelta, 0);
});
