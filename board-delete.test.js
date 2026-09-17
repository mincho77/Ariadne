const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isTaskDeletable } = require('./board-delete');
const { deleteTask } = require('./server');

test('isTaskDeletable allows active lanes only', () => {
  assert.equal(isTaskDeletable('To Do'), true);
  assert.equal(isTaskDeletable('Queued'), true);
  assert.equal(isTaskDeletable('In Progress'), true);
  assert.equal(isTaskDeletable('Blocked'), true);
  assert.equal(isTaskDeletable('Done'), false);
});

test('deleteTask removes active tasks but blocks Done', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-delete-task-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const project = { slug: 'demo', path: root };
  const improvementFile = path.join(dir, 'xp-e-1 - mejora.md');
  const bugFile = path.join(dir, 'xp-b-1 - bug.md');
  const doneFile = path.join(dir, 'xp-e-2 - done.md');
  fs.writeFileSync(improvementFile, '---\nid: XP-E-1\ntitle: Mejora activa\nstatus: To Do\ntype: enhancement\n---\n');
  fs.writeFileSync(bugFile, '---\nid: XP-B-1\ntitle: BUG activo\nstatus: To Do\ntype: bug\nlabels:\n  - bug\n---\n');
  fs.writeFileSync(doneFile, '---\nid: XP-E-2\ntitle: Mejora done\nstatus: Done\ntype: enhancement\n---\n');

  assert.equal(deleteTask(project, 'XP-E-1').deleted, true);
  assert.equal(fs.existsSync(improvementFile), false);

  assert.equal(deleteTask(project, 'XP-B-1').deleted, true);
  assert.equal(fs.existsSync(bugFile), false);

  assert.throws(() => deleteTask(project, 'XP-E-2'), /solo se pueden eliminar tareas/);
});
