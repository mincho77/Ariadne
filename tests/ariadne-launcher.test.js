const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { buildLaunchPlan } = require('../scripts/ariadne-launcher');

const ROOT = path.join(__dirname, '..');

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

  const audit = spawnSync(process.execPath, ['scripts/ariadne-audit-all.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(audit.status, 0, audit.stderr || audit.stdout);

  const check = spawnSync('python3', ['skills/ariadne/scripts/check_plan.py', 'docs/plans/ariadne-mejoras.md'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stdout || check.stderr);
});
