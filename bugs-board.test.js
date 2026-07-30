const test = require('node:test');
const assert = require('node:assert/strict');
const { isBugTask, inferBugTheme, buildBugStats, bugsBoardPage } = require('./bugs-board');
const { isImprovementTask } = require('./mejoras-board');
const { boardCounts, boardNavHtml, boardNavStyles } = require('./board-chrome');
const { taskDetailHtml, priorityRank, sortTasksByPriority, sortQueuedTasks, projectTasks } = require('./server');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

test('isBugTask detects type, label and title patterns', () => {
  assert.equal(isBugTask({ type: 'bug', title: 'Algo' }), true);
  assert.equal(isBugTask({ type: 'task', labels: ['bug'], title: 'Algo' }), true);
  assert.equal(isBugTask({ type: 'task', title: 'BUG producción · Upload' }), true);
  assert.equal(isBugTask({ type: 'feature', title: 'Nueva pantalla' }), false);
});

test('inferBugTheme groups bugs by dominant area', () => {
  assert.equal(inferBugTheme({ title: 'BUG producción · Justo no extrae pretensiones', labels: ['bug'] }), 'Justo / IA');
  assert.equal(inferBugTheme({ title: 'BUG producción · ZIP pending', labels: ['upload'] }), 'Carga y uploads');
  assert.equal(inferBugTheme({ title: 'BUG Ariadne · Kanban', labels: ['bug'] }), 'Ariadne / Hub');
});

test('buildBugStats aggregates themes and close rate', () => {
  const stats = buildBugStats([
    { title: 'BUG Justo', status: 'Done', priority: 'High', labels: ['bug'] },
    { title: 'BUG upload', status: 'To Do', priority: 'Ultra High', labels: ['bug', 'upload'] },
    { title: 'BUG upload 2', status: 'In Progress', priority: 'High', labels: ['bug', 'upload'] },
  ]);
  assert.equal(stats.total, 3);
  assert.equal(stats.open, 2);
  assert.equal(stats.done, 1);
  assert.ok(stats.byTheme.some((row) => row.theme === 'Carga y uploads' && row.total === 2));
});

test('bugs board renders analytics and filtered kanban', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-bugs-board-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Bug.md'), '---\nid: JM-1\ntitle: BUG producción · Upload congela\nstatus: To Do\npriority: Ultra High\ntype: bug\nlabels:\n  - bug\n  - upload\n---\n\n## Description\n\nFalla');
  fs.writeFileSync(path.join(dir, 'jm-2 - Feature.md'), '---\nid: JM-2\ntitle: Feature normal\nstatus: To Do\npriority: Low\ntype: feature\n---\n');
  const html = bugsBoardPage({ name: 'Demo', slug: 'demo', path: root }, {
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
  assert.match(html, /id="create-task"/);
  assert.match(html, /id="delete-task"/);
  assert.match(html, /\+ New bug/);
  assert.match(html, /queue-column/);
  assert.match(html, />Queue</);
  assert.match(html, />To Do</);
  assert.match(html, />Doing</);
  assert.match(html, />Done</);
  assert.doesNotMatch(html, /Por hacer|En curso|Resueltos|Hechas/);
  assert.doesNotMatch(html, /JM-2/);
  assert.match(html, /id="substatus-panel"/);
  assert.match(html, /\/api\/tasks\/substatus/);
  assert.match(html, /check-toggle/);
});
