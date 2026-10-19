'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { selectedEnvironment, redactLikelySecrets, appendExecutionLog, getDiff, assertConfiguredModelIdentity, assertNoInlineSecrets, readConfig } = require('../scripts/ariadne-enhancement-cycle');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ariadne-enhancement-cycle.js');

test('agent environment excludes credentials unless variable names are explicitly allowed', () => {
  const previous = process.env.ARIADNE_TEST_SECRET;
  process.env.ARIADNE_TEST_SECRET = 'do-not-forward';
  try {
    assert.equal(selectedEnvironment().ARIADNE_TEST_SECRET, undefined);
    assert.equal(selectedEnvironment(['ARIADNE_TEST_SECRET']).ARIADNE_TEST_SECRET, 'do-not-forward');
  } finally {
    if (previous == null) delete process.env.ARIADNE_TEST_SECRET;
    else process.env.ARIADNE_TEST_SECRET = previous;
  }
});

test('invoke tolerates a command that exits before consuming stdin', async () => {
  const { invoke } = require('../scripts/ariadne-enhancement-cycle');
  assert.equal(await invoke([process.execPath, '-e', 'process.exit(0)'], { input: 'prompt' }), '');
});

test('known model CLIs must explicitly select the model recorded in the ledger', () => {
  assert.doesNotThrow(() => assertConfiguredModelIdentity({ identity: 'codex:gpt-6-luna', command: ['codex', 'exec', '--model', 'gpt-6-luna'] }, 'cheap'));
  assert.throws(() => assertConfiguredModelIdentity({ identity: 'codex:gpt-6.1-sol', command: ['codex', 'exec', '--model', 'gpt-6-luna'] }, 'strong'), /identity debe coincidir/);
});

test('agent configuration rejects inline secrets in command arguments', () => {
  assert.throws(() => assertNoInlineSecrets(['claude', '--api-key=sk-proj-12345678901234567890'], 'agents.worker.command'), /parece incluir un secreto/);
  assert.doesNotThrow(() => assertNoInlineSecrets(['codex', 'exec', '--model', 'gpt-6-luna'], 'agents.worker.command'));
});

test('published configuration example satisfies model and read-only checks', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-config-'));
  try {
    fs.mkdirSync(path.join(projectPath, '.ariadne'));
    fs.copyFileSync(path.join(ROOT, 'docs', 'enhancement-cycle-config.example.json'), path.join(projectPath, '.ariadne', 'enhancement-cycle.json'));
    assert.equal(readConfig(projectPath).agents.arbiter.identity, 'codex:gpt-6-astra');
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test('redacts common credential patterns from diff and verification evidence', () => {
  const sanitized = redactLikelySecrets('token=abc123456789secret Bearer eyJhbGciOiJIUzI1NiJ9 https://x.test sk-proj-12345678901234567890');
  assert.doesNotMatch(sanitized, /abc123456789secret|eyJhbGciOiJIUzI1NiJ9|sk-proj-12345678901234567890/);
  assert.equal((sanitized.match(/\[REDACTED_SECRET\]/g) || []).length, 3);
});

test('execution log keeps snapshots from prior runs', () => {
  const taskFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-log-')), 'task.md');
  try {
    fs.writeFileSync(taskFile, '---\nid: JM-E-1\n---\nTask\n');
    const task = { file: taskFile };
    appendExecutionLog(task, { status: 'READY', cycles: [] });
    appendExecutionLog(task, { status: 'BLOCKED', cycles: [], reason: 'offline', finding: 'API_KEY=sk-proj-12345678901234567890' });
    const source = fs.readFileSync(taskFile, 'utf8');
    assert.match(source, /READY/);
    assert.match(source, /BLOCKED/);
    assert.doesNotMatch(source, /sk-proj-12345678901234567890/);
  } finally {
    fs.rmSync(path.dirname(taskFile), { recursive: true, force: true });
  }
});

test('review diff omits credential files while including ordinary source changes', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-diff-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: projectPath });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: projectPath });
    execFileSync('git', ['config', 'user.name', 'Ariadne test'], { cwd: projectPath });
    fs.writeFileSync(path.join(projectPath, '.env'), 'PRIVATE_TOKEN=top-secret-value\n');
    fs.writeFileSync(path.join(projectPath, 'src.js'), 'const value = 1;\n');
    execFileSync('git', ['add', '.'], { cwd: projectPath });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: projectPath });
    fs.writeFileSync(path.join(projectPath, '.env'), 'PRIVATE_TOKEN=another-secret-value\n');
    fs.writeFileSync(path.join(projectPath, 'src.js'), 'const value = 2;\n');
    const diff = await getDiff(projectPath);
    assert.match(diff, /src\.js/);
    assert.match(diff, /\.env.*omitted|omitted.*\.env/i);
    assert.doesNotMatch(diff, /top-secret-value|another-secret-value/);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

function nodeAgent(result) {
  const payload = JSON.stringify(JSON.stringify(result));
  return [process.execPath, '-e', `process.stdin.resume();process.stdin.on('end',()=>console.log(${payload}));`];
}

test('CLI runs configured local planner, worker, checks and distinct read-only arbiter end-to-end', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-cycle-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: projectPath });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: projectPath });
    execFileSync('git', ['config', 'user.name', 'Ariadne test'], { cwd: projectPath });
    fs.mkdirSync(path.join(projectPath, 'backlog', 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, '.ariadne'), { recursive: true });
    fs.writeFileSync(path.join(projectPath, '.gitignore'), '.ariadne/\n');
    fs.writeFileSync(path.join(projectPath, 'evidence.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/QXcAAAAASUVORK5CYII=', 'base64'));
    const taskFile = path.join(projectPath, 'backlog', 'tasks', 'jm-e-12 - panel.md');
    fs.writeFileSync(path.join(projectPath, 'backlog', 'tasks', 'jm-b-1 - base.md'), [
      '---',
      'id: JM-B-1',
      'title: Base',
      'status: Done',
      'type: bug',
      'dependencies: []',
      '---',
      '',
    ].join('\n'));
    fs.writeFileSync(taskFile, [
      '---',
      'id: JM-E-12',
      'title: Panel de estado',
      'status: To Do',
      'type: enhancement',
      'dependencies: ["JM-B-1:FS+1d"]',
      '---',
      '',
      '## Acceptance Criteria',
      '- [ ] El panel muestra el estado actual.',
      '',
    ].join('\n'));
    execFileSync('git', ['add', '.'], { cwd: projectPath });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: projectPath });
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('status: To Do', 'status: In Progress'));

    const config = {
      maxCycles: 1,
      agents: {
        planner: { identity: 'planner-fixture', readOnly: true, command: nodeAgent({ questions: [], plan: ['Inspeccionar panel'], checks: ['configured check', 'visual responsive review'], scope: ['panel'] }) },
        cheap: { identity: 'worker-cheap-fixture', command: nodeAgent({ summary: 'Comprobado', criteriaVerified: true, visualEvidence: { files: ['evidence.png'], summary: 'captura fixture' }, notes: [] }) },
        strong: { identity: 'worker-strong-fixture', command: nodeAgent({ summary: 'Comprobado', criteriaVerified: true, visualEvidence: { files: ['evidence.png'], summary: 'captura fixture' }, notes: [] }) },
        arbiter: { identity: 'arbiter-fixture', readOnly: true, visualArgs: ['--'], command: nodeAgent({ verdict: 'PASS', criteriaVerified: true, visualEvidence: { files: ['evidence.png'], summary: 'Fixture de captura visual' }, findings: [] }) },
      },
      checks: [{ name: 'configured check', command: [process.execPath, '-e', 'process.exit(0)'] }],
    };
    fs.writeFileSync(path.join(projectPath, '.ariadne', 'enhancement-cycle.json'), JSON.stringify(config));
    const result = spawnSync(process.execPath, [SCRIPT, '--project-path', projectPath, '--task', 'JM-E-12', '--tier', 'cheap'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /"status": "PASS"/);
    assert.match(fs.readFileSync(taskFile, 'utf8'), /"status": "PASS"/);
    assert.match(fs.readFileSync(taskFile, 'utf8'), /planner-fixture/);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});
