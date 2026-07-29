const test = require('node:test');
const assert = require('node:assert/strict');
const { boardCounts, boardNavHtml } = require('./board-chrome');
const { isBugTask } = require('./bugs-board');
const { isImprovementTask } = require('./mejoras-board');
const { projectTasks } = require('./server');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

test('boardCounts separates bugs and improvements', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-chrome-counts-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jm-1 - Bug.md'), '---\nid: JM-1\ntitle: BUG upload\nstatus: To Do\ntype: bug\n---\n');
  fs.writeFileSync(path.join(dir, 'jm-2 - Feature.md'), '---\nid: JM-2\ntitle: Feature\nstatus: Done\ntype: feature\n---\n');
  const project = { slug: 'demo', path: root };
  const counts = boardCounts(project, projectTasks, isBugTask, isImprovementTask);
  assert.equal(counts.bugsOpen, 1);
  assert.equal(counts.improvementsOpen, 0);
});

test('boardNavHtml renders segmented control with active bugs tab', () => {
  const html = boardNavHtml({ name: 'Demo', slug: 'demo' }, 'bugs', { bugsOpen: 2, improvementsOpen: 5 }, {
    escapeHtml,
    HOST: '127.0.0.1',
    PORT: 4177,
    BOARD_PORT: 6421,
  });
  assert.match(html, /class="seg-item active"/);
  assert.match(html, /view=bugs/);
  assert.match(html, /view=mejoras/);
  assert.match(html, /2/);
});
