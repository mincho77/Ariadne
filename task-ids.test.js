const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isBugTask } = require('./bugs-board');
const {
  projectTaskCode,
  formatTaskId,
  parseTypedTaskId,
  nextTaskNumber,
  allocateTaskId,
  createTaskFile,
} = require('./task-ids');

function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'proyecto';
}

test('projectTaskCode resolves configured and default codes', () => {
  assert.equal(projectTaskCode({ slug: 'jurismate', name: 'JurisMate' }), 'JM');
  assert.equal(projectTaskCode({ slug: 'ariadne', name: 'Ariadne' }), 'AH');
  assert.equal(projectTaskCode({ slug: 'demo', name: 'Demo App', taskCode: 'DA' }), 'DA');
});

test('formatTaskId and parseTypedTaskId round-trip bug and enhancement ids', () => {
  assert.equal(formatTaskId('jm', 'b', 12), 'JM-B-12');
  assert.equal(formatTaskId('AH', 'E', 3), 'AH-E-3');
  assert.deepEqual(parseTypedTaskId('JM-B-12'), { code: 'JM', kind: 'B', number: 12 });
  assert.deepEqual(parseTypedTaskId('ah-e-7'), { code: 'AH', kind: 'E', number: 7 });
  assert.equal(parseTypedTaskId('JM-12'), null);
});

test('nextTaskNumber counts only matching project kind lane', () => {
  const tasks = [
    { id: 'JM-B-2' },
    { id: 'JM-B-7' },
    { id: 'JM-E-4' },
    { id: 'JM-46' },
  ];
  assert.equal(nextTaskNumber(tasks, 'JM', 'B'), 8);
  assert.equal(nextTaskNumber(tasks, 'JM', 'E'), 5);
});

test('allocateTaskId picks B for bugs and E for mejoras', () => {
  const project = { slug: 'jurismate', name: 'JurisMate' };
  const listTasks = () => [{ id: 'JM-B-3' }, { id: 'JM-E-1' }];
  assert.equal(
    allocateTaskId(project, { title: 'BUG upload', type: 'bug', labels: ['bug'] }, isBugTask, listTasks),
    'JM-B-4',
  );
  assert.equal(
    allocateTaskId(project, { title: 'Nueva mejora', type: 'feature', labels: [] }, isBugTask, listTasks),
    'JM-E-2',
  );
});

test('createTaskFile writes backlog markdown with typed id', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-task-id-'));
  const project = { slug: 'jurismate', name: 'JurisMate', path: root };
  fs.mkdirSync(path.join(root, 'backlog', 'tasks'), { recursive: true });
  const helpers = {
    isBugTask,
    projectTasks: () => [],
    slugify,
    findTask: () => null,
  };
  const created = createTaskFile(project, {
    title: 'BUG producción · Upload congela',
    type: 'bug',
    priority: 'Ultra High',
    description: 'Falla al subir ZIP.',
  }, helpers);
  assert.equal(created.id, 'JM-B-1');
  assert.match(created.source, /^id: JM-B-1$/m);
  assert.match(created.source, /type: bug/);
  assert.ok(fs.existsSync(created.path));

  const enhancement = createTaskFile(project, {
    title: 'Mejora de ranking',
    type: 'feature',
    priority: 'High',
  }, {
    ...helpers,
    projectTasks: () => [{ id: created.id, file: created.file }],
  });
  assert.equal(enhancement.id, 'JM-E-1');
});
