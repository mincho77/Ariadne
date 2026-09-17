'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasEvidenceSection, assertDoneEvidenceAllowed } = require('./done-gate');
const { updateTaskStatus, projectTasks } = require('./server');

test('hasEvidenceSection detects Evidence and Closeout bullets', () => {
  assert.equal(hasEvidenceSection('## Evidence\n\n- tests ok\n'), true);
  assert.equal(hasEvidenceSection('## Closeout\n\n- proof: npm test\n'), true);
  assert.equal(hasEvidenceSection('## Evidence\n\n'), false);
  assert.equal(hasEvidenceSection('## Description\n\nok\n'), false);
});

test('assertDoneEvidenceAllowed throws MISSING_EVIDENCE', () => {
  assert.throws(
    () => assertDoneEvidenceAllowed({ source: '---\nid: X\n---\n' }),
    (error) => error.code === 'MISSING_EVIDENCE',
  );
  assert.equal(
    assertDoneEvidenceAllowed({ source: '## Evidence\n\n- ok\n' }).allowed,
    true,
  );
});

test('updateTaskStatus rejects Done without evidence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-done-gate-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const file = path.join(tasksDir, 'fx-e-1 - gate.md');
  fs.writeFileSync(file, `---
id: FX-E-1
title: Gate
status: In Progress
type: feature
---

## Description

no evidence yet
`, 'utf8');
  const project = { slug: 'fixture', name: 'Fixture', path: root, taskCode: 'FX' };

  await assert.rejects(
    () => updateTaskStatus(project, 'FX-E-1', 'Done'),
    (error) => error.code === 'MISSING_EVIDENCE',
  );

  const { appendEvidence } = require('./swarm/evidence');
  const next = appendEvidence(fs.readFileSync(file, 'utf8'), { evidence: 'manual proof' });
  fs.writeFileSync(file, next, 'utf8');
  const task = projectTasks(project)[0];
  assert.equal(assertDoneEvidenceAllowed(task).allowed, true);
});
