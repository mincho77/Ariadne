const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  findStaleNextActionRefs,
  applyLedgerFixes,
  fixLedgerFile,
} = require('../lib/ledger-hygiene');

const SAMPLE = `# Demo

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ARLOCAL-009 | 4 | Audit | hecho | - | ok | scripts/audit.js | ARLOCAL-010 |
| ARLOCAL-010 | 5 | Lifecycle | hecho | ARLOCAL-009 | ok | tests/lifecycle.test.js | Integrar route-hint |
| ARLOCAL-011 | 5 | Docs | pendiente | ARLOCAL-010 | ok | - | ARLOCAL-010 |
`;

test('findStaleNextActionRefs flags done dependency IDs in next-action column', () => {
  const issues = findStaleNextActionRefs(SAMPLE);
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((row) => row.taskId).sort(),
    ['ARLOCAL-009', 'ARLOCAL-011'],
  );
});

test('applyLedgerFixes rewrites stale cells to em dash', () => {
  const issues = findStaleNextActionRefs(SAMPLE);
  const fixed = applyLedgerFixes(SAMPLE, issues);
  assert.match(fixed, /\| ARLOCAL-009 \| 4 \| Audit \| hecho \| - \| ok \| scripts\/audit.js \| — \|/);
  assert.match(fixed, /\| ARLOCAL-011 \| 5 \| Docs \| pendiente \| ARLOCAL-010 \| ok \| - \| — \|/);
  assert.match(fixed, /\| Integrar route-hint \|/);
});

test('fixLedgerFile writes corrections to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-hygiene-'));
  const file = path.join(dir, 'demo.md');
  fs.writeFileSync(file, SAMPLE);
  const result = fixLedgerFile(file, { dryRun: false });
  assert.equal(result.fixed, 2);
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /\| ARLOCAL-011 \|[^\\n]*\| ARLOCAL-010 \|/);
});
