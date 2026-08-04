const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMessage } = require('../scripts/ariadne-route-hint');

test('classifyMessage routes queue moves to lite', () => {
  const row = classifyMessage('mueve JM-E-3 a la cola con ordinal 10');
  assert.equal(row.mode, 'lite');
  assert.equal(row.skill, 'ariadne-lite');
});

test('classifyMessage routes Pharos deploy to full', () => {
  const row = classifyMessage('audita con Pharos y despliega a producción');
  assert.equal(row.mode, 'full');
  assert.equal(row.skill, 'ariadne');
});

test('classifyMessage routes Gantt work to full', () => {
  const row = classifyMessage('integrar lib/gantt scheduler');
  assert.equal(row.mode, 'full');
});

test('classifyMessage defaults unknown text to full for safety', () => {
  const row = classifyMessage('haz algo raro con el repo');
  assert.equal(row.mode, 'full');
});
