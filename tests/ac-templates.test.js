'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  listAcTemplates,
  resolveAcceptanceCriteria,
  defaultTemplateForDraft,
} = require('../lib/ac-templates');
const { createTaskFile, buildTaskSource } = require('../task-ids');
const { isBugTask } = require('../bugs-board');

test('listAcTemplates exposes selectable templates', () => {
  const templates = listAcTemplates();
  assert.ok(templates.some((item) => item.id === 'bug' && item.count >= 3));
  assert.ok(templates.some((item) => item.id === 'none' && item.count === 0));
});

test('resolveAcceptanceCriteria uses template or explicit list', () => {
  const fromTemplate = resolveAcceptanceCriteria({ template: 'bug', type: 'bug' });
  assert.equal(fromTemplate.template, 'bug');
  assert.match(fromTemplate.acceptanceCriteria[0], /reproduce|fallo/i);

  const custom = resolveAcceptanceCriteria({ acceptanceCriteria: ['Uno', 'Dos'] });
  assert.equal(custom.template, 'custom');
  assert.deepEqual(custom.acceptanceCriteria, ['Uno', 'Dos']);
});

test('defaultTemplateForDraft picks bug vs enhancement', () => {
  assert.equal(defaultTemplateForDraft({ type: 'bug' }), 'bug');
  assert.equal(defaultTemplateForDraft({ type: 'enhancement' }), 'enhancement');
  assert.equal(defaultTemplateForDraft({ title: 'HUB · something', type: 'task' }), 'swarm');
});

test('createTaskFile writes AC body from template', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-ac-tpl-'));
  const project = { slug: 'fixture', name: 'Fixture', path: root, taskCode: 'FX' };
  fs.mkdirSync(path.join(root, 'backlog', 'tasks'), { recursive: true });
  const created = createTaskFile(project, {
    title: 'Demo enhance',
    type: 'enhancement',
    template: 'minimal',
  }, {
    isBugTask,
    projectTasks: () => [],
    slugify: (title) => String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    findTask: () => null,
  });
  assert.equal(created.acTemplate, 'minimal');
  assert.match(created.source, /## Acceptance Criteria/);
  assert.match(created.source, /Criterio de done/);
  assert.match(buildTaskSource({
    id: 'FX-E-1',
    title: 'X',
    acceptanceCriteria: ['A'],
  }), /#1 A/);
});
