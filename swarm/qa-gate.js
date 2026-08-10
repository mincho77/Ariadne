'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { getPack, recommendPackPolicy } = require('./packs');

function packRequiresQa(packOrId) {
  const pack = packOrId && typeof packOrId === 'object' && packOrId.roles
    ? packOrId
    : getPack(packOrId);
  const roles = pack.roles || [];
  return roles.includes('qa') || roles.includes('hardender');
}

function defaultQaSteps() {
  return [
    { name: 'lint', command: 'npm run lint', args: [] },
    { name: 'test', command: 'npm test', args: [] },
  ];
}

/**
 * Run hardener/QA gate: lint + npm test.
 * deps.runCommand optional for tests: ({ command, cwd }) => { status, stdout, stderr }
 */
function runQaGate(options = {}) {
  const cwd = options.cwd || process.cwd();
  const steps = options.steps || defaultQaSteps();
  const runCommand = typeof options.runCommand === 'function'
    ? options.runCommand
    : ({ command, cwd: workDir }) => {
      const result = spawnSync(command, {
        cwd: workDir,
        encoding: 'utf8',
        shell: true,
        env: process.env,
      });
      return {
        status: result.status == null ? 1 : result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error || null,
      };
    };

  const results = [];
  for (const step of steps) {
    const cmd = step.args && step.args.length
      ? `${step.command} ${step.args.join(' ')}`
      : step.command;
    const outcome = runCommand({ command: cmd, cwd, step: step.name });
    const row = {
      name: step.name,
      command: cmd,
      status: outcome.status,
      ok: outcome.status === 0,
      stdout: String(outcome.stdout || '').slice(0, 4000),
      stderr: String(outcome.stderr || '').slice(0, 2000),
    };
    results.push(row);
    if (!row.ok) {
      const detail = (row.stderr || row.stdout || outcome.error?.message || 'failed').trim().slice(0, 500);
      const error = new Error(`QA gate falló en ${step.name} (${cmd}): ${detail}`);
      error.code = 'QA_GATE_FAILED';
      error.step = step.name;
      error.results = results;
      throw error;
    }
  }

  const evidence = results.map((row) => `${row.name}:ok`).join(' · ');
  return {
    ok: true,
    results,
    evidence: `QA gate ${evidence}`,
    summary: results.map((row) => `${row.name} ✓`).join(', '),
  };
}

function shouldEnforceQaGate(task, options = {}) {
  if (options.skipQa === true) return false;
  if (options.qa === true || options.requireQa === true) return true;
  const pack = options.pack
    ? (typeof options.pack === 'object' ? options.pack : getPack(options.pack))
    : recommendPackPolicy(task || {}).pack;
  return packRequiresQa(pack);
}

function formatQaHandoffSummary(qaResult) {
  return `lint+test gate · ${qaResult.summary || qaResult.evidence}`;
}

module.exports = {
  packRequiresQa,
  defaultQaSteps,
  runQaGate,
  shouldEnforceQaGate,
  formatQaHandoffSummary,
  ROOT_HINT: path.join(__dirname, '..'),
};
