const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateDafoReadiness,
  getJevStatus,
  sanitizeJevState,
  JevError,
  QUESTIONS,
  evaluateTaskStartOptions,
} = require('../lib/jev');

const configuredEnv = {
  ARIADNE_JEV_ENABLED: 'true',
  TYPESAFE_API_KEY: 'test-key',
};

function validState() {
  return {
    objective: 'Help teams review a project plan.',
    successCriteria: ['A review gives verifiable conditions.'],
    evidence: ['Existing project ledger.'],
  };
}

function providerResponse() {
  return {
    ok: true,
    json: async () => ({
      model: 'jev-test',
      answers: Object.fromEntries(Object.keys(QUESTIONS).map((id) => [id, {
        type: 'score', score: 1, confidence: 0.1, probabilities: { low: 0.8, medium: 0.1, high: 0.1 },
      }])),
    }),
  };
}

test('JEV is disabled by default and reports config without exposing the key', async () => {
  let called = false;
  const env = { TYPESAFE_API_KEY: 'must-not-leak' };
  assert.deepEqual(getJevStatus(env), { enabled: false, configured: true, model: 'jev-latest' });
  const result = await evaluateDafoReadiness(validState(), {
    env,
    fetchImpl: async () => { called = true; },
  });
  assert.equal(result.reason, 'provider_disabled');
  assert.equal(called, false);
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false);
});

test('JEV asks for missing objective, success criteria, and evidence without calling provider', async () => {
  let called = false;
  const result = await evaluateDafoReadiness({ objective: 'Objective only' }, {
    env: configuredEnv,
    fetchImpl: async () => { called = true; },
  });
  assert.deepEqual(result.missingContext, ['successCriteria', 'evidence']);
  assert.equal(result.reason, 'insufficient_context');
  assert.equal(called, false);
});

test('JEV sends only sanitized allowlisted state and returns signals without a viability verdict', async () => {
  let request;
  const result = await evaluateDafoReadiness({ ...validState(), projectName: 'Ariadne sk-12345678901234567890' }, {
    env: configuredEnv,
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return providerResponse();
    },
  });
  assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
  assert.deepEqual(Object.keys(request.body.state).sort(), ['evidence', 'objective', 'projectName', 'successCriteria'].sort());
  assert.equal(request.body.state.projectName, 'Ariadne [REDACTED]');
  assert.equal(request.options.headers.authorization, 'Bearer test-key');
  assert.equal(result.decisionPolicy, 'signals_only_human_decision_required');
  assert.equal(result.answers.objective_clarity.confidence, 0.1);
  assert.equal(Object.hasOwn(result, 'viability'), false);
});

test('JEV rejects extra fields and missing credentials without exposing secrets', async () => {
  assert.throws(() => sanitizeJevState({ ...validState(), repositoryPath: '/private/repo' }),
    (error) => error instanceof JevError && error.code === 'INVALID_STATE_FIELDS');
  await assert.rejects(evaluateDafoReadiness(validState(), {
    env: { ARIADNE_JEV_ENABLED: 'true' },
    fetchImpl: async () => assert.fail('provider must not be called without credentials'),
  }), (error) => error.code === 'MISSING_API_KEY' && !error.message.includes('test-key'));
});

test('JEV provider failures expose neither credentials nor submitted project context', async () => {
  await assert.rejects(evaluateDafoReadiness({
    ...validState(),
    projectName: 'private-project-name',
  }, {
    env: configuredEnv,
    fetchImpl: async () => ({ ok: false, status: 500 }),
  }), (error) => error.code === 'PROVIDER_REJECTED'
    && !error.message.includes('test-key')
    && !error.message.includes('private-project-name'));
});

test('JEV timeout covers a stalled provider response', async () => {
  await assert.rejects(evaluateDafoReadiness(validState(), {
    env: configuredEnv,
    timeoutMs: 100,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  }), (error) => error.code === 'PROVIDER_TIMEOUT');
});

function taskCandidates() {
  return [
    {
      id: 'AH-E-10', title: 'Clarify project objective', status: 'To Do', priority: 'High', type: 'enhancement',
      description: 'Set a measurable objective for the active project. sk-12345678901234567890',
      acceptanceCriteria: ['Objective has a measurable result.'], dependencies: [],
    },
    {
      id: 'AH-E-11', title: 'Add validation report', status: 'Queued', priority: 'Medium', type: 'enhancement',
      description: 'Show evidence and gaps in the project audit.',
      acceptanceCriteria: ['Report names source evidence.', 'Report lists missing evidence.'], dependencies: ['AH-E-10'],
    },
  ];
}

test('JEV compares up to five task options with per-task signals and a separate choice signal', async () => {
  let request;
  const result = await evaluateTaskStartOptions({ projectName: 'Ariadne', options: taskCandidates() }, {
    env: configuredEnv,
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      const answers = {};
      for (const [id, question] of Object.entries(request.body.questions)) {
        answers[id] = question.type === 'choice'
          ? { type: 'choice', choice: 'option_1', confidence: 0.8, probabilities: { option_1: 0.8, option_2: 0.2 } }
          : { type: 'score', score: 1.6, confidence: 0.75, probabilities: { 0: 0.1, 1: 0.2, 2: 0.7 } };
      }
      return { ok: true, json: async () => ({ model: 'jev-test', usage: { input_tokens: 420, output_tokens: 32 }, answers }) };
    },
  });
  assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(Object.keys(request.body.questions).length, 9);
  assert.equal(request.body.questions.best_start.type, 'choice');
  assert.equal(request.body.questions.option_1_implementation_readiness.type, 'score');
  assert.equal(request.body.state.options[0].description.includes('[REDACTED]'), true);
  assert.equal(JSON.stringify(request.body).includes('sk-12345678901234567890'), false);
  assert.equal(result.rubricVersion, 'task-start-v1');
  assert.equal(result.preferred.id, 'AH-E-10');
  assert.equal(result.options[1].scores.dependency_readiness.score, 1.6);
  assert.deepEqual(result.usage, { inputTokens: 420, outputTokens: 32 });
  assert.equal(result.decisionPolicy, 'signals_only_human_decision_required');
  assert.equal(JSON.stringify(result).includes('test-key'), false);
});

test('JEV asks for missing candidate context before contacting TypeSafe', async () => {
  let called = false;
  const candidates = taskCandidates();
  candidates[1].description = '';
  candidates[1].acceptanceCriteria = [];
  const result = await evaluateTaskStartOptions({ projectName: 'Ariadne', options: candidates }, {
    env: configuredEnv,
    fetchImpl: async () => { called = true; },
  });
  assert.equal(result.reason, 'insufficient_context');
  assert.deepEqual(result.missingContext, ['AH-E-11']);
  assert.equal(called, false);
});

test('JEV rejects invalid or blocked task candidates and stays optional', async () => {
  let called = false;
  await assert.rejects(evaluateTaskStartOptions({ projectName: 'Ariadne', options: taskCandidates().slice(0, 1) }, {
    env: configuredEnv,
    fetchImpl: async () => { called = true; },
  }), (error) => error.code === 'INVALID_OPTIONS');
  const blocked = taskCandidates();
  blocked[0].status = 'In Progress';
  await assert.rejects(evaluateTaskStartOptions({ projectName: 'Ariadne', options: blocked }, {
    env: configuredEnv,
    fetchImpl: async () => { called = true; },
  }), (error) => error.code === 'INVALID_OPTIONS');
  const disabled = await evaluateTaskStartOptions({}, { env: {}, fetchImpl: async () => { called = true; } });
  assert.equal(disabled.reason, 'provider_disabled');
  assert.equal(called, false);
});
