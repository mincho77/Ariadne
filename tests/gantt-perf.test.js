const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProjectGanttFromTasks } = require('../lib/gantt/scheduler');

test('buildProjectGanttFromTasks schedules 1000 tasks under performance budget', { timeout: 30000 }, () => {
  const tasks = Array.from({ length: 1000 }, (_, index) => {
    const id = `GT-P-${index}`;
    return {
      id,
      title: `Perf ${index}`,
      status: 'To Do',
      priority: 'Medium',
      type: 'task',
      source: `---\nid: ${id}\ntitle: Perf ${index}\nstatus: To Do\npriority: Medium\ntype: task\nestimate_ia_hours: 1\n---\n`,
    };
  });

  const started = Date.now();
  const plan = buildProjectGanttFromTasks(tasks, { slug: 'perf', name: 'perf' }, {
    capacity: 8,
    includeDone: false,
    startDate: '2026-08-04',
  });
  const elapsed = Date.now() - started;

  assert.equal(plan.tasks.length, 1000);
  assert.ok(elapsed < 15000, `scheduling 1000 tasks took ${elapsed}ms`);
  assert.equal(plan.summary.cycleDetected, false);
});
