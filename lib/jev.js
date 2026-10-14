'use strict';

const JEV_RUBRIC_VERSION = 'dafo-readiness-v1';
const JEV_TASK_START_RUBRIC_VERSION = 'task-start-v1';
const API_URL = 'https://api.typesafe.ai/v1/systemone';
const MAX_FIELD_LENGTH = 3000;
const MAX_LIST_ITEMS = 12;
const MAX_TOTAL_LENGTH = 12000;
const MAX_TASK_OPTIONS = 5;

const STATE_FIELDS = new Set([
  'projectName',
  'projectOverview',
  'objective',
  'intendedUsers',
  'successCriteria',
  'scope',
  'constraints',
  'evidence',
  'risks',
  'dependencies',
]);

const QUESTIONS = Object.freeze({
  objective_clarity: {
    type: 'score',
    instructions: 'Using only the supplied project state, how clearly does the documented objective describe an outcome? Do not infer missing goals.',
    criteria: [
      'No objective or only a vague activity is documented.',
      'An objective is present but the expected outcome is partly unclear.',
      'A specific expected outcome is clearly documented.',
    ],
  },
  success_criteria: {
    type: 'score',
    instructions: 'Using only the supplied project state, how well are measurable success or acceptance criteria documented?',
    criteria: [
      'No success or acceptance criteria are documented.',
      'Some criteria are documented but they are incomplete or hard to verify.',
      'Success criteria are concrete and verifiable.',
    ],
  },
  validation_evidence: {
    type: 'score',
    instructions: 'Using only the supplied project state, how strong is the documented plan or evidence for validating the intended outcome?',
    criteria: [
      'No validation approach or supporting evidence is documented.',
      'A partial validation approach or limited supporting evidence is documented.',
      'A concrete validation approach and relevant supporting evidence are documented.',
    ],
  },
  scope_and_constraints: {
    type: 'score',
    instructions: 'Using only the supplied project state, how clearly are scope boundaries and constraints documented?',
    criteria: [
      'Scope boundaries and constraints are absent or unclear.',
      'Some boundaries or constraints are documented, with notable gaps.',
      'Inclusions, exclusions, and important constraints are clearly documented.',
    ],
  },
  risk_and_dependency_readiness: {
    type: 'score',
    instructions: 'Using only the supplied project state, how well are material risks and dependencies identified with mitigations or next steps?',
    criteria: [
      'Material risks/dependencies are not identified or have no next steps.',
      'Some material risks/dependencies and partial mitigations are documented.',
      'Material risks/dependencies have clear mitigations or next actions.',
    ],
  },
});

const TASK_START_DIMENSIONS = Object.freeze({
  value_alignment: {
    instructions: 'Rate the candidate as a first task for the active project. Use its stated impact and alignment only; do not invent benefits.',
    criteria: [
      'Low or unclear contribution to the documented project outcome.',
      'Some contribution is documented, but impact or alignment is indirect or uncertain.',
      'Strong, direct contribution to the documented project outcome is supported by the task context.',
    ],
  },
  implementation_readiness: {
    instructions: 'Rate how ready this candidate is to start based on its scope and acceptance criteria. Do not infer missing implementation details.',
    criteria: [
      'Scope or completion conditions are missing or too vague to begin safely.',
      'Some scope or acceptance criteria exist, with important gaps to clarify.',
      'Scope and verifiable acceptance criteria are clear enough to begin.',
    ],
  },
  dependency_readiness: {
    instructions: 'Rate whether the candidate can be started now based on its dependencies. The server has already excluded candidates with unresolved or unfinished blocking dependencies.',
    criteria: [
      'The task has material dependency uncertainty or little evidence that prerequisites are ready.',
      'Most prerequisites appear ready, but a dependency or sequencing question remains.',
      'Prerequisites are resolved or absent and the task can start without a blocking dependency.',
    ],
  },
  risk_manageability: {
    instructions: 'Rate how manageable the candidate is as a first step given the risks and effort stated in its context. Missing effort or risk information is uncertainty, not proof of low risk.',
    criteria: [
      'Material risks or likely effort are unclear, high, or lack a next step.',
      'Risks or effort are partly understood and may need clarification before or during work.',
      'Risks and effort are bounded, with a clear next step or mitigation.',
    ],
  },
});

class JevError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'JevError';
    this.code = code;
    this.status = status;
  }
}

function isJevEnabled(env = process.env) {
  return String(env.ARIADNE_JEV_ENABLED || '').trim().toLowerCase() === 'true';
}

function getJevStatus(env = process.env) {
  return {
    enabled: isJevEnabled(env),
    configured: Boolean(String(env.TYPESAFE_API_KEY || '').trim()),
    model: String(env.ARIADNE_JEV_MODEL || 'jev-latest').trim() || 'jev-latest',
  };
}

function redactLikelySecrets(text) {
  return String(text)
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED]')
    .replace(/\b(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

function sanitizeJevState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new JevError('INVALID_STATE', 'El contexto debe ser un objeto con campos permitidos.', 400);
  }
  const unknown = Object.keys(input).filter((key) => !STATE_FIELDS.has(key));
  if (unknown.length) {
    throw new JevError('INVALID_STATE_FIELDS', `Campos de contexto no permitidos: ${unknown.join(', ')}`, 400);
  }

  let totalLength = 0;
  const state = {};
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      if (value.length > MAX_LIST_ITEMS || value.some((item) => typeof item !== 'string')) {
        throw new JevError('INVALID_STATE', `El campo ${key} debe ser una lista corta de textos.`, 400);
      }
      state[key] = value.map((item) => {
        if (item.length > MAX_FIELD_LENGTH) {
          throw new JevError('STATE_TOO_LARGE', `El campo ${key} supera el límite permitido.`, 413);
        }
        totalLength += item.length;
        return redactLikelySecrets(item);
      });
      continue;
    }
    if (typeof value !== 'string') {
      throw new JevError('INVALID_STATE', `El campo ${key} debe ser texto o una lista de textos.`, 400);
    }
    if (value.length > MAX_FIELD_LENGTH) {
      throw new JevError('STATE_TOO_LARGE', `El campo ${key} supera el límite permitido.`, 413);
    }
    totalLength += value.length;
    state[key] = redactLikelySecrets(value);
  }

  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new JevError('STATE_TOO_LARGE', 'El contexto total supera el límite permitido.', 413);
  }
  return state;
}

function missingContextFields(state) {
  const hasContent = (value) => Array.isArray(value)
    ? value.some((item) => item.trim())
    : typeof value === 'string' && Boolean(value.trim());
  return ['objective', 'successCriteria', 'evidence'].filter((key) => !hasContent(state[key]));
}

function validateAnswers(payload) {
  if (!payload || typeof payload !== 'object' || !payload.answers || typeof payload.answers !== 'object') {
    throw new JevError('INVALID_PROVIDER_RESPONSE', 'TypeSafe devolvió una respuesta inválida.');
  }
  const answers = {};
  for (const id of Object.keys(QUESTIONS)) {
    const answer = payload.answers[id];
    if (!answer || answer.type !== 'score' || typeof answer.score !== 'number'
      || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 2) {
      throw new JevError('INVALID_PROVIDER_RESPONSE', `TypeSafe no devolvió una señal válida para ${id}.`);
    }
    const normalized = { type: 'score', score: answer.score };
    if (typeof answer.confidence === 'number' && Number.isFinite(answer.confidence)
      && answer.confidence >= 0 && answer.confidence <= 1) normalized.confidence = answer.confidence;
    if (answer.probabilities && typeof answer.probabilities === 'object') {
      normalized.probabilities = Object.fromEntries(
        Object.entries(answer.probabilities)
          .filter(([, probability]) => typeof probability === 'number'
            && Number.isFinite(probability) && probability >= 0 && probability <= 1)
          .map(([key, probability]) => [key, probability]),
      );
    }
    if (answer.legend && typeof answer.legend === 'object') normalized.legend = answer.legend;
    answers[id] = normalized;
  }
  return answers;
}

function normalizeTaskStartInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new JevError('INVALID_OPTIONS', 'Se requiere el proyecto y la lista de tareas candidatas.', 400);
  }
  const projectName = String(input.projectName || '').trim();
  if (!projectName || projectName.length > 200) {
    throw new JevError('INVALID_OPTIONS', 'El nombre del proyecto es obligatorio y debe tener hasta 200 caracteres.', 400);
  }
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > MAX_TASK_OPTIONS) {
    throw new JevError('INVALID_OPTIONS', `La comparación requiere entre 2 y ${MAX_TASK_OPTIONS} tareas candidatas.`, 400);
  }
  const allowedKeys = new Set([
    'id', 'title', 'status', 'priority', 'type', 'description', 'acceptanceCriteria', 'dependencies',
  ]);
  const seen = new Set();
  let totalLength = projectName.length;
  const options = input.options.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new JevError('INVALID_OPTIONS', `La candidata ${index + 1} no es válida.`, 400);
    }
    const unknown = Object.keys(candidate).filter((key) => !allowedKeys.has(key));
    if (unknown.length) throw new JevError('INVALID_OPTIONS', 'La candidata contiene campos no permitidos.', 400);
    const id = String(candidate.id || '').trim();
    const title = String(candidate.title || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id) || seen.has(id.toLowerCase())) {
      throw new JevError('INVALID_OPTIONS', `El identificador de la candidata ${index + 1} no es válido o está repetido.`, 400);
    }
    seen.add(id.toLowerCase());
    if (!title || title.length > 240) throw new JevError('INVALID_OPTIONS', `La candidata ${id} requiere un título de hasta 240 caracteres.`, 400);
    const status = String(candidate.status || '').trim();
    if (!['to do', 'queued'].includes(status.toLowerCase())) {
      throw new JevError('INVALID_OPTIONS', `La candidata ${id} no está en un estado abierto apto para iniciar.`, 409);
    }
    const textField = (value, field, max = 1200) => {
      const text = String(value || '').trim();
      if (text.length > max) throw new JevError('INVALID_OPTIONS', `${field} de ${id} supera el límite permitido.`, 413);
      totalLength += text.length;
      return redactLikelySecrets(text);
    };
    const description = textField(candidate.description, 'La descripción', 1800);
    const rawCriteria = candidate.acceptanceCriteria == null ? [] : candidate.acceptanceCriteria;
    if (!Array.isArray(rawCriteria) || rawCriteria.length > 8) {
      throw new JevError('INVALID_OPTIONS', `Los criterios de aceptación de ${id} deben ser una lista corta.`, 400);
    }
    const acceptanceCriteria = rawCriteria.map((item) => textField(item, 'Un criterio', 300));
    const rawDependencies = candidate.dependencies == null ? [] : candidate.dependencies;
    if (!Array.isArray(rawDependencies) || rawDependencies.length > 10) {
      throw new JevError('INVALID_OPTIONS', `Las dependencias de ${id} deben ser una lista corta.`, 400);
    }
    const dependencies = rawDependencies.map((item) => textField(item, 'Una dependencia', 120));
    const normalized = {
      id,
      title: textField(title, 'El título', 240),
      status: textField(status, 'El estado', 32),
      priority: textField(candidate.priority, 'La prioridad', 32),
      type: textField(candidate.type, 'El tipo', 48),
      description,
      acceptanceCriteria,
      dependencies,
    };
    return normalized;
  });
  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new JevError('STATE_TOO_LARGE', 'El contexto de las tareas supera el límite permitido.', 413);
  }
  const missingContext = options.filter((candidate) => !candidate.description && !candidate.acceptanceCriteria.length)
    .map((candidate) => candidate.id);
  return { projectName: redactLikelySecrets(projectName), options, missingContext };
}

function taskStartQuestions(options) {
  const questions = {};
  options.forEach((candidate, index) => {
    const alias = `option_${index + 1}`;
    for (const [dimension, rubric] of Object.entries(TASK_START_DIMENSIONS)) {
      questions[`${alias}_${dimension}`] = {
        type: 'score',
        instructions: `${rubric.instructions} Candidate ${alias} (ID ${candidate.id}): ${candidate.title}`,
        criteria: rubric.criteria,
      };
    }
  });
  questions.best_start = {
    type: 'choice',
    instructions: 'Choose the strongest first task among the candidates. Consider direct project value, implementation readiness, resolved dependencies, and manageable effort/risk. Do not assume missing details; if options are similarly supported, reflect that with lower confidence and closer probabilities.',
    criteria: Object.fromEntries(options.map((candidate, index) => [
      `option_${index + 1}`,
      `Task ${candidate.id}: ${candidate.title}`,
    ])),
  };
  return questions;
}

function normalizeTaskStartAnswer(answer, id) {
  if (!answer || answer.type !== 'score' || typeof answer.score !== 'number'
    || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 2) {
    throw new JevError('INVALID_PROVIDER_RESPONSE', `TypeSafe no devolvió una señal válida para ${id}.`);
  }
  const normalized = { type: 'score', score: answer.score };
  if (typeof answer.confidence === 'number' && Number.isFinite(answer.confidence)
    && answer.confidence >= 0 && answer.confidence <= 1) normalized.confidence = answer.confidence;
  if (answer.probabilities && typeof answer.probabilities === 'object') normalized.probabilities = answer.probabilities;
  if (answer.legend && typeof answer.legend === 'object') normalized.legend = answer.legend;
  return normalized;
}

function normalizeUsage(payload) {
  const usage = payload?.usage;
  if (!usage || !Number.isInteger(usage.input_tokens) || usage.input_tokens < 0
    || !Number.isInteger(usage.output_tokens) || usage.output_tokens < 0) return undefined;
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

function validateTaskStartResponse(payload, options) {
  if (!payload || typeof payload !== 'object' || !payload.answers || typeof payload.answers !== 'object') {
    throw new JevError('INVALID_PROVIDER_RESPONSE', 'TypeSafe devolvió una respuesta inválida.');
  }
  const optionSignals = options.map((candidate, index) => {
    const alias = `option_${index + 1}`;
    const scores = {};
    for (const dimension of Object.keys(TASK_START_DIMENSIONS)) {
      scores[dimension] = normalizeTaskStartAnswer(payload.answers[`${alias}_${dimension}`], `${alias}_${dimension}`);
    }
    return { id: candidate.id, title: candidate.title, scores };
  });
  const preferred = payload.answers.best_start;
  const preferredIndex = Number(String(preferred?.choice || '').match(/^option_(\d+)$/)?.[1]) - 1;
  if (preferred?.type !== 'choice' || !Number.isInteger(preferredIndex)
    || preferredIndex < 0 || preferredIndex >= options.length
    || typeof preferred.confidence !== 'number' || !Number.isFinite(preferred.confidence)
    || preferred.confidence < 0 || preferred.confidence > 1) {
    throw new JevError('INVALID_PROVIDER_RESPONSE', 'TypeSafe no devolvió una opción inicial válida.');
  }
  const probabilities = {};
  const rawProbabilities = preferred.probabilities && typeof preferred.probabilities === 'object'
    ? preferred.probabilities : {};
  options.forEach((candidate, index) => {
    const probability = rawProbabilities[`option_${index + 1}`];
    if (typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 1) {
      probabilities[candidate.id] = probability;
    }
  });
  return {
    preferred: {
      id: options[preferredIndex].id,
      title: options[preferredIndex].title,
      confidence: preferred.confidence,
      probabilities,
    },
    options: optionSignals,
  };
}

async function requestJev(state, questions, options = {}) {
  const env = options.env || process.env;
  const apiKey = String(env.TYPESAFE_API_KEY || '').trim();
  if (!apiKey) throw new JevError('MISSING_API_KEY', 'JEV está habilitado, pero falta TYPESAFE_API_KEY.', 503);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new JevError('FETCH_UNAVAILABLE', 'Este runtime no tiene fetch disponible.', 503);
  const configuredTimeout = Number(options.timeoutMs || env.ARIADNE_JEV_TIMEOUT_MS || 12000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(60000, Math.max(100, configuredTimeout))
    : 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let payload;
  try {
    const response = await fetchImpl(options.apiUrl || API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        state,
        model: String(env.ARIADNE_JEV_MODEL || 'jev-latest').trim() || 'jev-latest',
        questions,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      throw new JevError('PROVIDER_REJECTED', `TypeSafe rechazó la evaluación (HTTP ${response.status}).`, status);
    }
    try {
      payload = await response.json();
    } catch {
      throw new JevError('INVALID_PROVIDER_RESPONSE', 'TypeSafe devolvió JSON inválido.');
    }
  } catch (error) {
    if (error instanceof JevError) throw error;
    if (error && error.name === 'AbortError') {
      throw new JevError('PROVIDER_TIMEOUT', 'La solicitud a TypeSafe excedió el tiempo límite.', 504);
    }
    throw new JevError('PROVIDER_UNAVAILABLE', 'No fue posible conectar con TypeSafe.', 502);
  } finally {
    clearTimeout(timer);
  }
  return {
    payload,
    model: typeof payload.model === 'string' ? payload.model : (env.ARIADNE_JEV_MODEL || 'jev-latest'),
    elapsedMs: Date.now() - startedAt,
    usage: normalizeUsage(payload),
  };
}

async function evaluateTaskStartOptions(input, options = {}) {
  const env = options.env || process.env;
  if (!isJevEnabled(env)) return { enabled: false, skipped: true, reason: 'provider_disabled' };
  const normalized = normalizeTaskStartInput(input);
  if (normalized.missingContext.length) {
    return {
      enabled: true,
      skipped: true,
      reason: 'insufficient_context',
      missingContext: normalized.missingContext,
      rubricVersion: JEV_TASK_START_RUBRIC_VERSION,
      decisionPolicy: 'signals_only_human_decision_required',
    };
  }
  const { payload, model, elapsedMs, usage } = await requestJev(
    { projectName: normalized.projectName, options: normalized.options },
    taskStartQuestions(normalized.options),
    options,
  );
  return {
    enabled: true,
    skipped: false,
    provider: 'typesafe',
    model,
    rubricVersion: JEV_TASK_START_RUBRIC_VERSION,
    decisionPolicy: 'signals_only_human_decision_required',
    elapsedMs,
    ...(usage ? { usage } : {}),
    ...validateTaskStartResponse(payload, normalized.options),
  };
}

async function evaluateDafoReadiness(inputState, options = {}) {
  const env = options.env || process.env;
  if (!isJevEnabled(env)) return { enabled: false, skipped: true, reason: 'provider_disabled' };
  const state = sanitizeJevState(inputState ?? {});
  const missingContext = missingContextFields(state);
  if (missingContext.length) {
    return {
      enabled: true,
      skipped: true,
      reason: 'insufficient_context',
      missingContext,
      rubricVersion: JEV_RUBRIC_VERSION,
      decisionPolicy: 'signals_only_human_decision_required',
    };
  }
  const { payload, model, elapsedMs, usage } = await requestJev(state, QUESTIONS, options);
  return {
    enabled: true,
    skipped: false,
    provider: 'typesafe',
    model,
    rubricVersion: JEV_RUBRIC_VERSION,
    decisionPolicy: 'signals_only_human_decision_required',
    elapsedMs,
    ...(usage ? { usage } : {}),
    answers: validateAnswers(payload),
  };
}

module.exports = {
  API_URL,
  JEV_RUBRIC_VERSION,
  JEV_TASK_START_RUBRIC_VERSION,
  MAX_TASK_OPTIONS,
  QUESTIONS,
  TASK_START_DIMENSIONS,
  JevError,
  isJevEnabled,
  getJevStatus,
  sanitizeJevState,
  missingContextFields,
  evaluateDafoReadiness,
  evaluateTaskStartOptions,
};
