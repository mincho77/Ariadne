'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTaskPatch,
  applyTaskPatchToSource,
  buildKanbanTemporalPatch,
  computeSourceHash,
  resolveEffectiveStartField,
  todayDateStamp,
} = require('../lib/task-temporal');

const BASE = `---
id: AH-E-1
title: Demo
status: To Do
priority: Medium
type: task
estimate_days: 2
started_date: '2026-07-01'
due_date: '2026-08-01'
---

## Description

Texto
`;

test('normalizeTaskPatch accepts camelCase and snake_case aliases', () => {
  const patch = normalizeTaskPatch({
    estimateIaHours: 4,
    actualStart: '2026-08-04',
    progress: 25,
  });
  assert.equal(patch.estimate_ia_hours, 4);
  assert.equal(patch.actual_start, '2026-08-04');
  assert.equal(patch.progress, 25);
});

test('applyTaskPatchToSource preserves markdown body and unknown frontmatter keys', () => {
  const next = applyTaskPatchToSource(BASE, {
    actual_start: '2026-08-04',
    progress: 10,
  });
  assert.match(next, /actual_start: '2026-08-04'/);
  assert.match(next, /progress: 10/);
  assert.match(next, /## Description/);
  assert.match(next, /Texto/);
  assert.match(next, /estimate_days: 2/);
});

test('buildKanbanTemporalPatch sets actual_start on In Progress', () => {
  const patch = buildKanbanTemporalPatch(BASE, {
    fromStatus: 'To Do',
    toStatus: 'In Progress',
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.equal(patch.actual_start, '2026-08-04');
  assert.equal(patch.progress, undefined);
});

test('buildKanbanTemporalPatch sets finish and progress on Done', () => {
  const inProgress = applyTaskPatchToSource(BASE, { actual_start: '2026-08-01' });
  const patch = buildKanbanTemporalPatch(inProgress, {
    fromStatus: 'In Progress',
    toStatus: 'Done',
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.equal(patch.actual_finish, '2026-08-04');
  assert.equal(patch.progress, 100);
  assert.equal(patch.actual_start, undefined);
});

test('buildKanbanTemporalPatch does not overwrite historical dates on reopen', () => {
  const done = applyTaskPatchToSource(BASE, {
    actual_start: '2026-07-10',
    actual_finish: '2026-07-20',
    progress: 100,
  });
  const reopen = buildKanbanTemporalPatch(done, {
    fromStatus: 'Done',
    toStatus: 'In Progress',
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.deepEqual(reopen, {});
});

test('resolveEffectiveStartField prefers actual_start over started_date', () => {
  const source = applyTaskPatchToSource(BASE, { actual_start: '2026-08-02' });
  assert.equal(resolveEffectiveStartField(source), '2026-08-02');
  assert.equal(resolveEffectiveStartField(BASE), '2026-07-01');
});

test('computeSourceHash is stable for identical content', () => {
  const a = computeSourceHash(BASE);
  const b = computeSourceHash(BASE);
  assert.equal(a, b);
  assert.equal(a.length, 16);
});

test('normalizeTaskPatch rejects invalid dates', () => {
  assert.throws(
    () => normalizeTaskPatch({ deadline: '04-08-2026' }),
    /YYYY-MM-DD/,
  );
});

test('todayDateStamp returns UTC calendar date from Date', () => {
  assert.equal(todayDateStamp(new Date('2026-08-04T23:00:00Z')), '2026-08-04');
});
