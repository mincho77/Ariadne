'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  gateVerdict,
  parseAgentJson,
  runEnhancementCycle,
  validVisualEvidence,
} = require('../swarm/enhancement-cycle');

const task = { id: 'JM-E-12', title: 'Revisar consistencia del servicio', source: '- [ ] El servicio conserva el resultado esperado.' };
const project = { name: 'Jurismate', path: '/tmp/jurismate' };
const agents = {
  planner: { identity: 'planner:model-a' },
  cheap: { identity: 'worker:cheap' },
  strong: { identity: 'worker:strong' },
  arbiter: { identity: 'reviewer:model-b' },
};

function setup({ reviews, questions = [], checkResults = [{ name: 'tests', ok: true }] }) {
  const calls = [];
  const persisted = [];
  let reviewIndex = 0;
  return {
    calls,
    persisted,
    options: {
      task,
      project,
      tier: 'cheap',
      maxCycles: 3,
      agents,
      checks: [{ name: 'tests' }],
      executeAgent: async (input) => {
        calls.push(input);
        if (input.role === 'planner') return JSON.stringify({ questions, plan: ['Actualizar el servicio'], checks: ['tests'], scope: ['servicio'] });
        if (input.role === 'implementer') return JSON.stringify({ summary: 'Servicio actualizado', criteriaVerified: true, notes: [] });
        return JSON.stringify(reviews[reviewIndex++]);
      },
      runChecks: async () => checkResults,
      getDiff: async () => 'diff --git a/panel.js b/panel.js',
      persist: async (value) => persisted.push(value),
    },
  };
}

test('persists plan before edits and repeats correction until adversarial PASS', async () => {
  const state = setup({ reviews: [
    { verdict: 'BLOCK', criteriaVerified: false, findings: [{ severity: 'HIGH', criterion: '#1', finding: 'Falta cubrir estado vacío' }] },
    { verdict: 'PASS', criteriaVerified: true, findings: [] },
  ] });
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'PASS');
  assert.equal(result.cycles.length, 2);
  assert.equal(result.routing.tier, 'strong');
  assert.equal(result.cycles[0].worker, 'worker:cheap');
  assert.equal(result.cycles[1].worker, 'worker:strong');
  assert.equal(state.persisted[0].status, 'READY');
  assert.equal(state.calls.findIndex((call) => call.role === 'implementer') > 0, true);
  assert.match(state.calls.filter((call) => call.role === 'implementer')[1].prompt, /Falta cubrir estado vacío/);
});

test('manual tier override remains fixed through later cycles', async () => {
  const state = setup({ reviews: [
    { verdict: 'BLOCK', criteriaVerified: false, findings: [{ severity: 'HIGH', finding: 'Fix needed' }] },
    { verdict: 'PASS', criteriaVerified: true, findings: [] },
  ] });
  state.options.tierOverride = true;
  const result = await runEnhancementCycle(state.options);
  const workers = state.calls.filter((call) => call.role === 'implementer').map((call) => call.agent.identity);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(workers, ['worker:cheap', 'worker:cheap']);
});

test('asks for material missing context before any implementation', async () => {
  const state = setup({ reviews: [], questions: ['¿Qué usuarios pueden editar el panel?'] });
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'NEEDS_INPUT');
  assert.equal(state.calls.filter((call) => call.role === 'implementer').length, 0);
  assert.equal(state.persisted[0].questions.length, 1);
});

test('cannot pass when any configured verification fails', async () => {
  const state = setup({ reviews: [{ verdict: 'PASS', criteriaVerified: true, findings: [] }], checkResults: [{ name: 'tests', ok: false }] });
  state.options.maxCycles = 1;
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.cycles[0].review.failedChecks, ['tests']);
});

test('iteration limit produces BLOCKED when the arbiter keeps findings open', async () => {
  const state = setup({ reviews: [
    { verdict: 'BLOCK', criteriaVerified: false, findings: [{ severity: 'BLOCK', finding: 'Open issue' }] },
  ] });
  state.options.maxCycles = 1;
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.cycles.length, 1);
});

test('gate requires criteria coverage, successful checks, and zero blocking findings', () => {
  assert.equal(gateVerdict({ verdict: 'PASS', criteriaVerified: true, checks: [{ ok: true }] }).verdict, 'PASS');
  assert.equal(gateVerdict({ verdict: 'PASS', criteriaVerified: false, checks: [{ ok: true }] }).verdict, 'BLOCK');
  assert.equal(gateVerdict({ verdict: 'PASS', criteriaVerified: true, checks: [{ ok: false }] }).verdict, 'BLOCK');
});

test('agent output parser accepts fenced JSON and rejects free-form approval', () => {
  assert.deepEqual(parseAgentJson('```json\n{"verdict":"PASS"}\n```', 'arbiter'), { verdict: 'PASS' });
  assert.throws(() => parseAgentJson('Looks good, PASS', 'arbiter'), { code: 'INVALID_AGENT_OUTPUT' });
});

test('worker or arbiter execution errors persist BLOCKED and never imply approval', async () => {
  const state = setup({ reviews: [] });
  state.options.executeAgent = async ({ role }) => {
    if (role === 'planner') return JSON.stringify({ questions: [], plan: ['step'], checks: ['tests'] });
    throw new Error('local agent unavailable');
  };
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.stage, 'implementer');
  assert.equal(state.persisted.at(-1).status, 'BLOCKED');
});

test('UI enhancement cannot PASS without a valid screenshot supplied to the arbiter', async () => {
  const state = setup({ reviews: [{ verdict: 'PASS', criteriaVerified: true, findings: [] }] });
  state.options.task = { id: 'JM-E-13', title: 'Ajustar interfaz responsive', source: '- [ ] La interfaz responde en móvil.' };
  state.options.maxCycles = 1;
  state.options.executeAgent = async ({ role }) => {
    if (role === 'planner') return JSON.stringify({ questions: [], plan: ['Ajustar interfaz'], checks: ['tests', 'visual responsive review'], scope: ['UI'] });
    if (role === 'implementer') return JSON.stringify({ summary: 'UI actualizada', criteriaVerified: true, visualEvidence: { files: ['missing.png'] } });
    return JSON.stringify({ verdict: 'PASS', criteriaVerified: true, findings: [] });
  };
  const result = await runEnhancementCycle(state.options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.findings.some((item) => /captura visual válida/.test(item.finding)), true);
  assert.equal(validVisualEvidence('/tmp', { files: ['../secret.png'] }), false);
});
