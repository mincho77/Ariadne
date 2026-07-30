const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveEffectiveSubstatus,
  patchTaskSubstatus,
  isLawyerValidationTask,
} = require('./board-substatus');

test('infers Pendiente Resultado Prueba for validation tasks in Doing', () => {
  const task = {
    status: 'In Progress',
    title: 'VALIDACIÓN E2E · Guardar datos desde Justo',
    type: 'task',
    labels: ['validation', 'e2e'],
  };
  assert.equal(isLawyerValidationTask(task), true);
  assert.equal(resolveEffectiveSubstatus(task), 'Pendiente Resultado Prueba');
});

test('explicit substatus wins over inference', () => {
  const task = {
    status: 'In Progress',
    title: 'VALIDACIÓN E2E',
    substatus: 'En Curso',
  };
  assert.equal(resolveEffectiveSubstatus(task), 'En Curso');
});

test('patchTaskSubstatus writes substatus and next_action in frontmatter', () => {
  const source = '---\nid: JM-E-21\nstatus: In Progress\n---\n\n## Notes\n\nPendiente.';
  const next = patchTaskSubstatus(source, {
    substatus: 'Pendiente Resultado Prueba',
    next_action: 'El abogado debe validar tomador/asegurado y regenerar informe.',
  });
  assert.match(next, /substatus: "Pendiente Resultado Prueba"/);
  assert.ok(next.includes('next_action: "El abogado debe validar tomador'));
});
