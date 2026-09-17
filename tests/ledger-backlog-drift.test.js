'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  extractBacklogIds,
  findLedgerBacklogDrift,
  auditLedgerBacklogDrift,
  indexBacklog,
} = require('../lib/ledger-backlog-drift');

test('extractBacklogIds finds AH-E / PD-B style ids', () => {
  assert.deepEqual(
    extractBacklogIds('LaunchAgent único (AH-E-40) y también PD-B-3'),
    ['AH-E-40', 'PD-B-3'],
  );
});

test('findLedgerBacklogDrift flags plan work missing from Kanban', () => {
  const ledger = `# Plan

## Control
- Próxima acción: AH-E-99 missing card.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ASE2E-099 | 1 | LaunchAgent (AH-E-99) | pendiente | - | docs | — | — |
| ASE2E-100 | 1 | Something (AH-E-100) | hecho | - | ok | — | — |
`;

  const index = new Map([
    ['AH-E-100', { id: 'AH-E-100', status: 'Done', lane: 'tasks' }],
  ]);
  const issues = findLedgerBacklogDrift(ledger, index);
  assert.ok(issues.some((issue) => issue.code === 'LEDGER_WITHOUT_KANBAN' && issue.taskId === 'AH-E-99'));
  assert.ok(issues.some((issue) => issue.code === 'CONTROL_NEXT_WITHOUT_KANBAN' && issue.taskId === 'AH-E-99'));
  assert.equal(issues.some((issue) => issue.taskId === 'AH-E-100' && issue.code === 'LEDGER_WITHOUT_KANBAN'), false);
});

test('auditLedgerBacklogDrift reads real backlog tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-drift-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  const plansDir = path.join(root, 'docs', 'plans');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(plansDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-40.md'), `---
id: AH-E-40
title: LaunchAgent
status: Queued
---
`);
  const ledgerPath = path.join(plansDir, 'demo.md');
  fs.writeFileSync(ledgerPath, `# Demo

## Control
- Próxima acción: AH-E-40 LaunchAgent.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ASE-001 | 1 | LaunchAgent (AH-E-40) | pendiente | - | ok | — | — |
| ASE-002 | 1 | Fantasma (AH-E-41) | pendiente | - | ok | — | — |
`);

  const report = auditLedgerBacklogDrift(ledgerPath, { backlogRoot: root });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.taskId === 'AH-E-41' && issue.code === 'LEDGER_WITHOUT_KANBAN'));
  assert.equal(report.issues.some((issue) => issue.taskId === 'AH-E-40' && issue.code === 'LEDGER_WITHOUT_KANBAN'), false);
  assert.equal(indexBacklog(root).get('AH-E-40').status, 'Queued');
});
