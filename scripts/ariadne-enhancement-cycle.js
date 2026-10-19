#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const yaml = require('yaml');
const { recommendEnhancementTier, runEnhancementCycle } = require('../swarm/enhancement-cycle');
const { parseDependencySpec } = require('../lib/gantt/dependencies');

const ARIADNE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_OUTPUT_CHARS = 160_000;
const BASE_ENV = ['PATH', 'HOME', 'CODEX_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'TMPDIR', 'TEMP', 'LANG', 'LC_ALL', 'TERM', 'SHELL', 'USER', 'LOGNAME'];

function selectedEnvironment(allowEnv = []) {
  if (!Array.isArray(allowEnv) || allowEnv.some((key) => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
    throw new Error('allowEnv debe ser una lista de nombres de variables válidos; no se admiten valores inline');
  }
  const result = {};
  for (const key of [...new Set([...BASE_ENV, ...allowEnv])]) {
    if (process.env[key] != null) result[key] = process.env[key];
  }
  return result;
}

function redactLikelySecrets(value) {
  return String(value || '')
    .replace(/\b(?:sk|xai|gh[pousr])[-_][A-Za-z0-9_-]{16,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/((?:api[_ -]?key|access[_ -]?token|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED_SECRET]');
}

function usage() {
  console.error('Usage: node scripts/ariadne-enhancement-cycle.js --project-path <path> --task <ID> [--tier cheap|strong] [--max-cycles 1..20]');
  process.exit(2);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--project-path') options.projectPath = path.resolve(args[++index] || '');
    else if (flag === '--task') options.taskId = args[++index];
    else if (flag === '--tier') options.tier = args[++index];
    else if (flag === '--max-cycles') options.maxCycles = Number(args[++index]);
    else usage();
  }
  if (!options.projectPath || !options.taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.taskId)) usage();
  if (options.tier && !['cheap', 'strong'].includes(options.tier)) usage();
  if (options.maxCycles != null && (!Number.isInteger(options.maxCycles) || options.maxCycles < 1 || options.maxCycles > 20)) usage();
  return options;
}

function taskFiles(projectPath) {
  const root = path.join(projectPath, 'backlog', 'tasks');
  if (!fs.existsSync(root)) throw new Error(`No se encontró backlog/tasks en ${projectPath}`);
  return fs.readdirSync(root).filter((file) => {
    if (!file.endsWith('.md')) return false;
    try { return fs.lstatSync(path.join(root, file)).isFile(); } catch { return false; }
  }).map((file) => path.join(root, file));
}

function parseTaskFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return null;
  const frontmatter = yaml.parse(match[1]) || {};
  return { file, source, frontmatter, body: source.slice(match[0].length) };
}

function loadTask(projectPath, taskId) {
  const parsed = taskFiles(projectPath).map(parseTaskFile).filter(Boolean);
  const item = parsed.find((candidate) => String(candidate.frontmatter.id || '').toLowerCase() === taskId.toLowerCase());
  if (!item) throw new Error(`No existe la tarea ${taskId} bajo backlog/tasks`);
  const type = String(item.frontmatter.type || '').toLowerCase();
  if (type && type !== 'enhancement' && !/-E-\d+$/i.test(taskId)) throw new Error(`${taskId} no es una tarea Enhancement`);
  if (!/-E-\d+$/i.test(taskId) && type !== 'enhancement') throw new Error(`${taskId} no es una tarea Enhancement (E)`);
  const status = String(item.frontmatter.status || '').toLowerCase();
  if (!['in progress', 'doing'].includes(status)) throw new Error(`Primero mueve ${taskId} a In Progress en el tablero (estado actual: ${item.frontmatter.status || 'sin estado'})`);
  const dependencies = Array.isArray(item.frontmatter.dependencies) ? item.frontmatter.dependencies.map(String) : [];
  for (const dependency of dependencies) {
    const relation = parseDependencySpec(dependency, 8);
    if (!relation) throw new Error(`No se pudo interpretar la dependencia ${dependency} de ${taskId}`);
    if (String(relation.relation || 'FS').toUpperCase() !== 'FS') continue;
    const dep = parsed.find((candidate) => String(candidate.frontmatter.id || '').toLowerCase() === relation.id.toLowerCase());
    if (!dep || !['done', 'completed'].includes(String(dep.frontmatter.status || '').toLowerCase())) {
      throw new Error(`Dependencia FS ${relation.id} de ${taskId} falta o no está Done`);
    }
  }
  return {
    id: taskId,
    title: String(item.frontmatter.title || ''),
    status: item.frontmatter.status,
    type,
    dependencies,
    source: item.source,
    file: item.file,
  };
}

function readConfig(projectPath) {
  const file = path.join(projectPath, '.ariadne', 'enhancement-cycle.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Falta configuración local: ${file}. Copia docs/enhancement-cycle-config.example.json, personaliza los comandos/modelos y guárdalo en ese archivo (está ignorado por Git).`);
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const role of ['planner', 'cheap', 'strong', 'arbiter']) {
    const row = config.agents?.[role];
    if (!row || !Array.isArray(row.command) || row.command.length === 0 || row.command.some((part) => typeof part !== 'string')) {
      throw new Error(`Configura agents.${role}.command como arreglo de argumentos, sin shell`);
    }
    assertNoInlineSecrets(row.command, `agents.${role}.command`);
    selectedEnvironment(row.allowEnv);
    if (!row.identity) throw new Error(`Configura agents.${role}.identity para dejar evidencia del modelo/backend`);
    assertConfiguredModelIdentity(row, role);
    if (row.visualArgs != null && (!Array.isArray(row.visualArgs) || row.visualArgs.some((part) => typeof part !== 'string'))) {
      throw new Error(`agents.${role}.visualArgs debe ser un arreglo de argumentos`);
    }
    if (row.readOnly === true) {
      const executable = path.basename(row.command[0]);
      const args = row.command.slice(1);
      if (executable === 'codex' && !(args.includes('--sandbox') && args[args.indexOf('--sandbox') + 1] === 'read-only')) {
        throw new Error(`agents.${role} declara solo lectura pero Codex no tiene --sandbox read-only`);
      }
      if (executable === 'claude' && !(args.includes('--permission-mode') && args[args.indexOf('--permission-mode') + 1] === 'plan')) {
        throw new Error(`agents.${role} declara solo lectura pero Claude no tiene --permission-mode plan`);
      }
      if (executable === 'gemini' && !(args.includes('--approval-mode') && args[args.indexOf('--approval-mode') + 1] === 'plan')) {
        throw new Error(`agents.${role} declara solo lectura pero Gemini no tiene --approval-mode plan`);
      }
    }
  }
  if (config.agents.planner.readOnly !== true || config.agents.arbiter.readOnly !== true) {
    throw new Error('planner y arbiter deben declarar readOnly: true en la configuración');
  }
  if (!Array.isArray(config.checks) || config.checks.length === 0) throw new Error('Configura al menos una verificación fija en checks');
  for (const check of config.checks) {
    if (!check || typeof check.name !== 'string' || !Array.isArray(check.command) || check.command.length === 0 || check.command.some((part) => typeof part !== 'string')) {
      throw new Error('Cada check debe tener name y command como arreglo de argumentos (sin shell)');
    }
    assertNoInlineSecrets(check.command, `checks.${check.name}.command`);
    selectedEnvironment(check.allowEnv);
    assertValidTimeout(check.timeoutMs, `checks.${check.name}`);
  }
  for (const [role, agent] of Object.entries(config.agents)) assertValidTimeout(agent.timeoutMs, `agents.${role}`);
  assertValidTimeout(config.timeoutMs, 'timeoutMs');
  if (config.maxCycles != null && (!Number.isInteger(config.maxCycles) || config.maxCycles < 1 || config.maxCycles > 20)) {
    throw new Error('maxCycles debe ser un entero entre 1 y 20');
  }
  return { ...config, file };
}

function assertValidTimeout(value, label) {
  if (value != null && (!Number.isFinite(value) || value < 1_000 || value > 3_600_000)) {
    throw new Error(`${label} debe estar entre 1000 y 3600000 ms`);
  }
}

function assertNoInlineSecrets(parts, label) {
  if (parts.some((part) => redactLikelySecrets(part) !== part)) {
    throw new Error(`${label} parece incluir un secreto; configúralo por el mecanismo del CLI y lista solo el nombre en allowEnv`);
  }
}

function assertConfiguredModelIdentity(row, role) {
  const executable = path.basename(row.command[0]);
  if (!['codex', 'claude', 'gemini'].includes(executable)) return;
  const args = row.command.slice(1);
  const modelFlag = args.findIndex((arg) => arg === '--model' || arg === '-m');
  const model = modelFlag >= 0 ? args[modelFlag + 1] : '';
  const declared = String(row.identity).includes(':') ? String(row.identity).split(':').slice(1).join(':') : String(row.identity);
  if (!model || !declared || declared !== model) {
    throw new Error(`agents.${role}.identity debe coincidir con --model del comando (${executable}:${model || 'sin modelo explícito'})`);
  }
}

async function assertConfigIsLocal(projectPath) {
  const relative = path.relative(projectPath, path.join(projectPath, '.ariadne', 'enhancement-cycle.json'));
  try {
    await git(projectPath, ['check-ignore', '-q', '--', relative]);
  } catch {
    throw new Error(`Agrega ${relative} a .gitignore antes de usarlo; la configuración de modelos debe permanecer local y fuera de Git`);
  }
}

function invoke(command, { cwd, input = '', timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputChars = MAX_OUTPUT_CHARS, env = selectedEnvironment() } = {}) {
  const [executable, ...args] = command;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false, env });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    const collect = (chunk) => {
      output += chunk.toString('utf8');
      if (output.length > maxOutputChars) child.kill('SIGTERM');
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (output.length > maxOutputChars) return reject(new Error(`${executable} excedió el límite de salida`));
      if (code !== 0) return reject(new Error(`${executable} terminó con ${signal || code}: ${output.slice(-8000)}`));
      resolve(output);
    });
    child.stdin.end(input);
  });
}

function safeCommand(command, role, input, allowEnv) {
  const args = [...command];
  // Codex CLI reads the prompt from stdin only when '-' is supplied.
  if (path.basename(args[0]) === 'codex' && args[1] === 'exec' && !args.includes('-')) args.push('-');
  if (input.visualEvidence?.files?.length) {
    const visualArgs = input.agent?.visualArgs || (path.basename(args[0]) === 'codex' ? ['-i'] : null);
    if (!visualArgs?.length) throw new Error(`${role} no tiene visualArgs configurado para recibir capturas`);
    for (const file of input.visualEvidence.files) args.push(...visualArgs, path.resolve(input.cwd, file));
  }
  return invoke(args, { cwd: input.cwd, input: redactLikelySecrets(input.prompt), timeoutMs: input.timeoutMs, env: selectedEnvironment(allowEnv) });
}

async function runChecks(checks, cwd) {
  const results = [];
  for (const check of checks) {
    if (!check || typeof check.name !== 'string' || !Array.isArray(check.command) || check.command.length === 0) {
      throw new Error('Cada check debe tener name y command (arreglo de argumentos)');
    }
    try {
      const output = await invoke(check.command, { cwd, timeoutMs: check.timeoutMs || DEFAULT_TIMEOUT_MS, maxOutputChars: 24_000, env: selectedEnvironment(check.allowEnv) });
      results.push({ name: check.name, ok: true, output: redactLikelySecrets(output.slice(-4000)) });
    } catch (error) {
      results.push({ name: check.name, ok: false, output: redactLikelySecrets(String(error.message).slice(-4000)) });
    }
  }
  return results;
}

function git(projectPath, args) {
  return invoke(['git', ...args], { cwd: projectPath, timeoutMs: 30_000, maxOutputChars: MAX_OUTPUT_CHARS });
}

async function assertCleanRepository(projectPath, allowedDirtyFile) {
  const status = await git(projectPath, ['status', '--porcelain', '--untracked-files=all', '-z']);
  const dirty = status.split('\0').filter(Boolean).map((line) => line.slice(3));
  const allowed = allowedDirtyFile ? path.relative(projectPath, allowedDirtyFile) : '';
  if (dirty.some((file) => file !== allowed)) throw new Error('El ciclo requiere un árbol limpio excepto la tarjeta de esta tarea, para atribuir diff y hallazgos. Guarda o confirma los demás cambios y vuelve a intentarlo.');
}

async function getDiff(projectPath) {
  const changedPaths = (await git(projectPath, ['diff', '--name-only', '--no-ext-diff', '--no-color', 'HEAD', '-z'])).split('\0').filter(Boolean);
  const safePaths = changedPaths.filter((relative) => !isSensitivePath(relative));
  const omitted = changedPaths.filter(isSensitivePath);
  const tracked = safePaths.length ? await git(projectPath, ['diff', '--no-ext-diff', '--no-color', 'HEAD', '--', ...safePaths]) : '';
  const untracked = (await git(projectPath, ['ls-files', '--others', '--exclude-standard'])).split('\n').filter(Boolean);
  const files = [];
  for (const relative of untracked) {
    if (isSensitivePath(relative)) {
      omitted.push(relative);
      continue;
    }
    const absolute = path.resolve(projectPath, relative);
    if (!absolute.startsWith(`${path.resolve(projectPath)}${path.sep}`)) continue;
    if (fs.lstatSync(absolute).isSymbolicLink()) {
      files.push(`\n[ARIADNE_REVIEW_INCOMPLETE] Symlink omitted: ${relative}`);
      continue;
    }
    const stat = fs.statSync(absolute);
    if (/\.(?:png|jpe?g|webp|gif)$/i.test(relative)) {
      files.push(`\n[Binary artifact omitted from text diff; ${relative} will be attached separately if it is visual evidence]`);
      continue;
    }
    if (!stat.isFile() || stat.size > 30_000) {
      files.push(`\n[ARIADNE_REVIEW_INCOMPLETE] New file omitted: ${relative}; ${stat.size} bytes`);
      continue;
    }
    if (/\.(?:pdf|zip|gz|sqlite|db)$/i.test(relative)) {
      files.push(`\n[ARIADNE_REVIEW_INCOMPLETE] Binary artifact omitted: ${relative}; ${stat.size} bytes`);
      continue;
    }
    const content = fs.readFileSync(absolute, 'utf8');
    files.push(`\n--- new file: ${relative} ---\n${content}`);
  }
  const omissionNote = omitted.length ? `\n[ARIADNE_REVIEW_INCOMPLETE] Credential-like files omitted from review: ${omitted.join(', ')}\n` : '';
  const combined = `${tracked}\n${files.join('\n')}${omissionNote}`;
  if (combined.length > MAX_OUTPUT_CHARS) return `${redactLikelySecrets(combined.slice(0, MAX_OUTPUT_CHARS))}\n[ARIADNE_REVIEW_INCOMPLETE] Diff truncated at ${MAX_OUTPUT_CHARS} characters`;
  return redactLikelySecrets(combined);
}

function isSensitivePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  const name = path.posix.basename(normalized).toLowerCase();
  const sensitiveSegment = normalized.split('/').some((segment) => /^\.env(?:\.|$)/i.test(segment)
    || /secret|credential|private[-_]?key/i.test(segment));
  return sensitiveSegment
    || /^(?:id_rsa|id_ed25519|id_ecdsa)$/i.test(name)
    || /\.(?:pem|key|p12|pfx)$/i.test(name);
}

function appendExecutionLog(task, record) {
  const marker = '\n## Ariadne enhancement cycle log';
  const current = fs.readFileSync(task.file, 'utf8');
  const [beforePart, historyPart = ''] = current.split(marker);
  const before = beforePart.trimEnd();
  const history = historyPart.trimEnd();
  const snapshot = { ...record, cycleCount: record.cycles?.length || 0, cycles: record.cycles?.slice(-1) || [] };
  const entry = `### ${new Date().toISOString()} · ${record.status}${record.stage ? ` · ${record.stage}` : ''}\n\n\`\`\`json\n${redactLikelySecrets(JSON.stringify(snapshot, null, 2))}\n\`\`\``;
  const header = '> Ariadne records each plan, cycle and verdict here. The task remains In Progress until a separately authorized closeout.\n\n';
  fs.writeFileSync(task.file, `${before}${marker}\n\n${header}${history ? `${history}\n\n` : ''}${entry}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(options.projectPath, '.git'))) throw new Error('El proyecto debe ser un repositorio Git para auditar el diff');
  const task = loadTask(options.projectPath, options.taskId);
  await assertCleanRepository(options.projectPath, task.file);
  await assertConfigIsLocal(options.projectPath);
  const project = { name: path.basename(options.projectPath), path: options.projectPath };
  const config = readConfig(options.projectPath);
  const routing = options.tier ? { tier: options.tier, reason: 'manual override' } : recommendEnhancementTier(task);
  if (config.agents[routing.tier].identity === config.agents.arbiter.identity) throw new Error('El modelo/backend árbitro debe diferir del ejecutor seleccionado');
  let latest;
  const result = await runEnhancementCycle({
    task,
    project,
    maxCycles: options.maxCycles ?? config.maxCycles,
    tier: options.tier || routing.tier,
    tierOverride: Boolean(options.tier),
    agents: config.agents,
    checks: config.checks,
    executeAgent: async ({ role, agent, prompt, readOnly, visualEvidence }) => {
      if (readOnly && agent.readOnly !== true) throw new Error(`${role} no está configurado como solo lectura`);
      try {
        return await safeCommand(agent.command, role, { cwd: project.path, prompt, timeoutMs: agent.timeoutMs || config.timeoutMs, visualEvidence, agent }, agent.allowEnv);
      } catch (error) {
        error.message = redactLikelySecrets(error.message);
        throw error;
      }
    },
    runChecks,
    getDiff,
    persist: async (record) => {
      latest = record;
      appendExecutionLog(task, record);
    },
  });
  console.log(JSON.stringify({ task: task.id, status: result.status, routing: result.routing, models: result.models, cycles: result.cycles?.length || 0, log: task.file }, null, 2));
  if (latest?.questions?.length) console.log(`\nPreguntas para el usuario:\n- ${latest.questions.join('\n- ')}`);
  if (result.status === 'BLOCKED') process.exitCode = 1;
}

module.exports = { parseArgs, parseTaskFile, loadTask, readConfig, assertConfiguredModelIdentity, assertValidTimeout, assertNoInlineSecrets, selectedEnvironment, redactLikelySecrets, invoke, runChecks, assertCleanRepository, assertConfigIsLocal, getDiff, appendExecutionLog };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
