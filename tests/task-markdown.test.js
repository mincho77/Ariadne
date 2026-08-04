const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  splitTaskDocument,
  composeTaskDocument,
  getFrontmatterList,
  getFrontmatterNumber,
  upsertFrontmatterScalar,
  upsertFrontmatterList,
} = require('../lib/task-markdown');

const SAMPLE = `---
id: JM-E-1
title: 'API · Export PDF'
status: To Do
priority: High
type: feature
estimate_days: 3
estimate_ia_hours: 24
dependencies:
  - JM-E-10:FS
  - JM-E-12:SS+1d
labels:
  - gantt
  - export
custom_field: keep-me
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Export cases to PDF without losing formatting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Works on large cases
<!-- AC:END -->
`;

test('splitTaskDocument parses YAML lists and scalars', () => {
  const doc = splitTaskDocument(SAMPLE);
  assert.equal(doc.frontmatter.id, 'JM-E-1');
  assert.equal(doc.frontmatter.custom_field, 'keep-me');
  assert.deepEqual(doc.frontmatter.dependencies, ['JM-E-10:FS', 'JM-E-12:SS+1d']);
  assert.match(doc.body, /Export cases to PDF/);
});

test('round-trip preserves body and unknown frontmatter fields', () => {
  const doc = splitTaskDocument(SAMPLE);
  const roundTrip = composeTaskDocument(doc.frontmatter, doc.body);
  const again = splitTaskDocument(roundTrip);
  assert.equal(again.frontmatter.id, 'JM-E-1');
  assert.equal(again.frontmatter.custom_field, 'keep-me');
  assert.match(again.body, /Acceptance Criteria/);
  assert.match(again.body, /Works on large cases/);
});

test('upsertFrontmatterScalar and list mutate without dropping body', () => {
  let next = upsertFrontmatterScalar(SAMPLE, 'priority', 'Ultra High');
  next = upsertFrontmatterList(next, 'dependencies', ['JM-E-1:FS', 'JM-E-2:FF+2h']);
  const doc = splitTaskDocument(next);
  assert.equal(doc.frontmatter.priority, 'Ultra High');
  assert.deepEqual(doc.frontmatter.dependencies, ['JM-E-1:FS', 'JM-E-2:FF+2h']);
  assert.match(doc.body, /Export cases to PDF/);
});

test('getFrontmatterNumber reads numeric estimates', () => {
  assert.equal(getFrontmatterNumber(SAMPLE, 'estimate_days'), 3);
  assert.equal(getFrontmatterNumber(SAMPLE, 'estimate_ia_hours'), 24);
});

test('getFrontmatterList reads dependency tokens', () => {
  assert.deepEqual(getFrontmatterList(SAMPLE, 'dependencies'), ['JM-E-10:FS', 'JM-E-12:SS+1d']);
});

test('parseTask reads YAML frontmatter from disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-yaml-task-'));
  const dir = path.join(root, 'backlog', 'tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'jm-e-1 - api-export.md');
  fs.writeFileSync(file, SAMPLE);
  const { parseTask } = require('../server');
  const task = parseTask(file);
  assert.equal(task.id, 'JM-E-1');
  assert.equal(task.priority, 'High');
  assert.match(task.title, /Export PDF/);
});
