const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { buildLaunchPlan } = require('../scripts/ariadne-launcher');

const ROOT = path.join(__dirname, '..');

function createSandboxCatalog() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-launcher-test-'));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - smoke.md'), `---
id: AH-E-1
title: Launcher smoke task
status: To Do
priority: Medium
type: task
estimate_days: 1
---
`);
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'launcher-demo', name: 'Launcher Demo', path: projectRoot, port: 6525 },
  ], null, 2)}\n`);
  return catalogPath;
}

function createSandboxLedger() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-launcher-ledger-'));
  const ledgerPath = path.join(sandbox, 'plan.md');
  fs.writeFileSync(ledgerPath, `# Plan: Demo

## Control
- Estado: activo
- Última actualización: 2026-09-17
- Objetivo: validar launcher
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

test('buildLaunchPlan resolves lite skill file for queue moves', () => {
  const plan = buildLaunchPlan('mueve la tarea a cola');
  assert.equal(plan.mode, 'lite');
  assert.equal(plan.skillName, 'ariadne-lite');
  assert.match(plan.skillFile, /skills[/\\]ariadne-lite[/\\]SKILL\.md$/);
  assert.equal(plan.env.ARIADNE_SKILL, 'ariadne-lite');
});

test('buildLaunchPlan resolves full skill for deploy requests', () => {
  const plan = buildLaunchPlan('audita con Pharos y despliega');
  assert.equal(plan.mode, 'full');
  assert.equal(plan.skillName, 'ariadne');
  assert.match(plan.skillFile, /skills[/\\]ariadne[/\\]SKILL\.md$/);
});

test('ariadne-launcher CLI emits JSON on stdout', () => {
  const result = spawnSync(process.execPath, ['scripts/ariadne-launcher.js', 'Ariadne audita corrige'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.skill, 'ariadne-lite');
  assert.ok(body.instructions);
});

test('ARIM-004 lite path: launcher + audit fix + check_plan', () => {
  const plan = buildLaunchPlan('Ariadne audita corrige');
  assert.equal(plan.skill, 'ariadne-lite');
  const catalogPath = createSandboxCatalog();
  const ledgerPath = createSandboxLedger();

  const audit = spawnSync(process.execPath, ['scripts/ariadne-audit-all.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARIADNE_CATALOG_PATH: catalogPath,
    },
  });
  assert.equal(audit.status, 0, audit.stderr || audit.stdout);

  const sync = spawnSync(process.execPath, ['scripts/ariadne-sync.js', '--json', '--ledger', ledgerPath], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARIADNE_CATALOG_PATH: catalogPath,
    },
  });
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
});
