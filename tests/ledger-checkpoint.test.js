'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyCheckpoint, checkpointLedgerFile, kanbanToLedgerState } = require('../lib/ledger-checkpoint');

test('kanbanToLedgerState maps board statuses', () => {
  assert.equal(kanbanToLedgerState('Done'), 'hecho');
  assert.equal(kanbanToLedgerState('In Progress'), 'en_progreso');
  assert.equal(kanbanToLedgerState('Queued'), 'pendiente');
});

test('applyCheckpoint syncs hecho and Control próxima acción', () => {
  const ledger = `# Plan

## Control
- Estado: en_progreso
- Última actualización: 2026-01-01
- Gate actual: demo
- Próxima acción: AH-E-1 viejo

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ASE-1 | 1 | Launch (AH-E-1) | pendiente | - | ok | — | ASE-2 |
| ASE-2 | 1 | Next (AH-E-2) | pendiente | - | ok | — | — |
`;

  const index = new Map([
    ['AH-E-1', { id: 'AH-E-1', status: 'Done', lane: 'tasks', ordinal: 10 }],
    ['AH-E-2', { id: 'AH-E-2', status: 'Queued', lane: 'tasks', ordinal: 20 }],
  ]);
  const result = applyCheckpoint(ledger, index, { now: '2026-08-10' });
  assert.match(result.text, /ASE-1 \| 1 \| Launch \(AH-E-1\) \| hecho \|/);
  assert.match(result.text, /- Próxima acción: AH-E-2 \(Queued\)/);
  assert.match(result.text, /- Última actualización: 2026-08-10/);
  assert.ok(result.changes.some((change) => change.programId === 'ASE-1' && change.to === 'hecho'));
});

test('checkpointLedgerFile writes aligned ledger', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-checkpoint-'));
  const tasksDir = path.join(root, 'backlog', 'tasks');
  const plansDir = path.join(root, 'docs', 'plans');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(plansDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-9.md'), `---
id: AH-E-9
title: Done one
status: Done
ordinal: 10
---
`);
  fs.writeFileSync(path.join(tasksDir, 'ah-e-10.md'), `---
id: AH-E-10
title: Queued one
status: Queued
ordinal: 20
---
`);
  const ledgerPath = path.join(plansDir, 'demo.md');
  fs.writeFileSync(ledgerPath, `# Demo

## Control
- Última actualización: 2020-01-01
- Próxima acción: stale

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| X-001 | 1 | First (AH-E-9) | pendiente | - | ok | — | — |
| X-002 | 1 | Second (AH-E-10) | pendiente | - | ok | — | — |
`);

  const report = checkpointLedgerFile(ledgerPath, { backlogRoot: root });
  assert.equal(report.written, true);
  const text = fs.readFileSync(ledgerPath, 'utf8');
  assert.match(text, /AH-E-9\) \| hecho \|/);
  assert.match(text, /Próxima acción: AH-E-10 \(Queued\)/);
});
