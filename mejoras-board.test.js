const test = require('node:test');
const assert = require('node:assert/strict');
const { isImprovementTask, inferImprovementArea, buildImprovementStats, mejorasBoardPage } = require('./mejoras-board');
const { isBugTask } = require('./bugs-board');
const { boardCounts, boardNavHtml, boardNavStyles } = require('./board-chrome');
const { taskDetailHtml, priorityRank, sortTasksByPriority, sortQueuedTasks, projectTasks } = require('./server');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

test('isImprovementTask excludes bugs only', () => {
  assert.equal(isImprovementTask({ type: 'feature', title: 'Nueva pantalla' }), true);
  assert.equal(isImprovementTask({ type: 'bug', title: 'Algo' }), false);
  assert.equal(isBugTask({ type: 'bug', title: 'Algo' }), true);
});

test('inferImprovementArea groups by product signals', () => {
  assert.equal(inferImprovementArea({ title: 'Validar flujo E2E', type: 'task' }), 'Validación');
  assert.equal(inferImprovementArea({ title: 'Control AICost routing', type: 'enhancement' }), 'Costo IA');
});

test('buildImprovementStats aggregates open and done counts', () => {
  const stats = buildImprovementStats([
    { title: 'Feature A', status: 'Done', type: 'feature' },
    { title: 'Feature B', status: 'To Do', type: 'feature' },
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.open, 1);
  assert.equal(stats.done, 1);
});

test('mejoras board renders filtered kanban without bugs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-mejoras-board-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Bug.md'), '---\nid: JM-1\ntitle: BUG producción · Upload\nstatus: To Do\npriority: Ultra High\ntype: bug\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-2 - Feature.md'), '---\nid: JM-2\ntitle: Feature normal\nstatus: To Do\npriority: Low\ntype: feature\n---\n');
  const html = mejorasBoardPage({ name: 'Demo', slug: 'demo', path: root }, {
    escapeHtml,
    projectTasks,
    sortTasksByPriority,
    sortQueuedTasks,
    taskDetailHtml,
    priorityRank,
    boardCounts,
    boardNavHtml,
    boardNavStyles,
    isBugTask,
    isImprovementTask,
    HOST: '127.0.0.1',
    PORT: 4177,
    BOARD_PORT: 6421,
  });
  assert.match(html, /class="segmented"/);
  assert.match(html, /id="stats-toggle"/);
  assert.match(html, /id="stats-detail" class="stats-detail is-collapsed"/);
  assert.match(html, /id="refresh-board"/);
  assert.match(html, /Mejoras por área/);
  assert.match(html, /JM-2/);
  assert.doesNotMatch(html, /JM-1/);
  assert.match(html, /view=bugs/);
});
