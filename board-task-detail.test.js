'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  taskDetailHtml,
  toggleChecklistInSource,
} = require('./board-task-detail');

const sample = `---
title: Demo
---

## Description

Texto **útil**

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Listo
- [ ] #2 <script>alert(1)</script>
<!-- AC:END -->`;

test('taskDetailHtml renders interactive checklist controls', () => {
  const html = taskDetailHtml(sample);
  assert.match(html, /class="check-toggle"/);
  assert.match(html, /data-check-index="0"/);
  assert.match(html, /data-check-index="1"/);
  assert.match(html, /check-item checked/);
  assert.match(html, /section-progress/);
  assert.match(html, /2\/2|1\/2/);
  assert.doesNotMatch(html, /<script>/);
});

test('toggleChecklistInSource updates the nth checklist line', () => {
  const source = '---\nid: X\n---\n\n- [ ] uno\n- [x] dos\n';
  const next = toggleChecklistInSource(source, 0, true);
  assert.match(next, /- \[x\] uno/);
  assert.match(next, /- \[x\] dos/);
  const back = toggleChecklistInSource(next, 1, false);
  assert.match(back, /- \[ \] dos/);
});

test('toggleChecklistInSource rejects missing checklist items', () => {
  assert.throws(() => toggleChecklistInSource('sin checks', 0, true), /no encontrado/);
});
