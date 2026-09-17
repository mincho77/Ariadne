const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');

function createSandboxCatalog() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-sync-test-'));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - smoke.md'), `---
id: AH-E-1
title: Smoke task
status: To Do
priority: Medium
type: task
estimate_days: 1
---
`);
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'sync-demo', name: 'Sync Demo', path: projectRoot, port: 6523 },
  ], null, 2)}\n`);
  return catalogPath;
}

function createSandboxLedger() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-sync-ledger-'));
  const ledgerPath = path.join(sandbox, 'plan.md');
  fs.writeFileSync(ledgerPath, `# Plan: Demo

## Control
- Estado: activo
- Última actualización: 2026-09-17
- Objetivo: validar sincronización
- Gate actual: pruebas
- Próxima acción: ejecutar suite

## Alcance
### Incluye
### No incluye
### Restricciones

## Métricas de éxito

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| DEMO-001 | 1 | Validar | hecho | - | Suite pasa | node --test | — |

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |

## Historial
`);
  return ledgerPath;
}

test('ariadne-sync passes on repository ledgers', () => {
  const catalogPath = createSandboxCatalog();
  const result = spawnSync(process.execPath, ['scripts/ariadne-sync.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARIADNE_CATALOG_PATH: catalogPath,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.audit.ok, true);
  assert.ok(body.ledgers.every((row) => row.ok));
});

test('ariadne-sync --ledger targets one file', () => {
  const catalogPath = createSandboxCatalog();
  const ledgerPath = createSandboxLedger();
  const result = spawnSync(process.execPath, [
    'scripts/ariadne-sync.js',
    '--json',
    '--ledger',
    ledgerPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARIADNE_CATALOG_PATH: catalogPath,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ledgers.length, 1);
  assert.equal(body.ledgers[0].ledger, path.relative(ROOT, ledgerPath));
});
