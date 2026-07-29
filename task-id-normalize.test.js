const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseTask } = require('./server');
const {
  analyzeTaskIds,
  buildNormalizationPlan,
  normalizeProjectTaskIds,
} = require('./task-id-normalize');

function writeTask(root, dir, fileName, frontmatter) {
  const fullDir = path.join(root, 'backlog', dir);
  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(path.join(fullDir, fileName), `---\n${frontmatter}\n---\n\n## Description\n\n`);
}

test('analyzeTaskIds detects legacy, wrong kind and wrong code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-normalize-analyze-'));
  writeTask(root, 'tasks', 'a.md', 'id: XP-1\ntitle: Legacy bug\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  writeTask(root, 'tasks', 'b.md', 'id: XP-E-1\ntitle: Bug in E lane\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  writeTask(root, 'tasks', 'c.md', 'id: JM-B-1\ntitle: Wrong code\nstatus: To Do\ntype: feature');
  const project = { slug: 'demo', name: 'Demo Project', taskCode: 'XP', path: root };
  const entries = [
    { task: parseTask(path.join(root, 'backlog/tasks/a.md')), source: '', filePath: '', dir: 'tasks' },
    { task: parseTask(path.join(root, 'backlog/tasks/b.md')), source: '', filePath: '', dir: 'tasks' },
    { task: parseTask(path.join(root, 'backlog/tasks/c.md')), source: '', filePath: '', dir: 'tasks' },
  ];
  const analysis = analyzeTaskIds(project, entries);
  assert.ok(analysis.issues.some((issue) => issue.type === 'legacy'));
  assert.ok(analysis.issues.some((issue) => issue.type === 'wrong_kind'));
  assert.ok(analysis.issues.some((issue) => issue.type === 'wrong_code'));
});

test('normalizeProjectTaskIds fixes mixed legacy and typed ids', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-normalize-apply-'));
  writeTask(root, 'tasks', 'legacy.md', 'id: XP-10\ntitle: BUG legacy\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  writeTask(root, 'tasks', 'typed-b.md', 'id: XP-B-5\ntitle: BUG typed\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  writeTask(root, 'tasks', 'typed-e.md', 'id: XP-E-2\ntitle: Feature typed\nstatus: To Do\ntype: feature');
  writeTask(root, 'tasks', 'wrong-lane.md', 'id: XP-E-1\ntitle: BUG wrong lane\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  const project = { slug: 'demo', name: 'Demo Project', taskCode: 'XP', path: root };

  const result = normalizeProjectTaskIds(project, { parseTask, apply: true });
  assert.equal(result.applied, 4);

  const ids = fs.readdirSync(path.join(root, 'backlog/tasks')).map((file) => parseTask(path.join(root, 'backlog/tasks', file)).id);
  assert.deepEqual(ids.sort(), ['XP-B-1', 'XP-B-2', 'XP-B-3', 'XP-E-1']);
});

test('buildNormalizationPlan keeps stable order for partially migrated project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-normalize-plan-'));
  writeTask(root, 'tasks', 'one.md', 'id: AB-B-2\ntitle: BUG newer\nstatus: To Do\ntype: bug');
  writeTask(root, 'tasks', 'two.md', 'id: AB-1\ntitle: BUG legacy\nstatus: To Do\ntype: bug\nlabels:\n  - bug');
  const project = { slug: 'alpha', name: 'Alpha Beta', path: root };
  const entries = fs.readdirSync(path.join(root, 'backlog/tasks')).map((file) => {
    const filePath = path.join(root, 'backlog/tasks', file);
    return { task: parseTask(filePath), source: fs.readFileSync(filePath, 'utf8'), filePath, dir: 'tasks' };
  });
  const plan = buildNormalizationPlan(project, entries);
  assert.equal(plan.mapping['AB-1'], 'AB-B-1');
  assert.equal(plan.mapping['AB-B-2'], 'AB-B-2');
});
