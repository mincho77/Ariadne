#!/usr/bin/env node
'use strict';

/**
 * Ariadne Swarm CLI (AH-E-2 / AS-E-1)
 *
 *   npm run swarm -- status [--project ariadne]
 *   npm run swarm -- run [--project ariadne] [--task ID] [--role coder]
 *   npm run swarm -- handoff --task ID --from coder --to cleaner --summary "…" [--commit sha]
 *   npm run swarm -- complete --task ID --evidence "npm test → ok" [--notes "…"]
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  computeSwarmStatus,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
  createServerDeps,
  listPacks,
  getPack,
  suggestPack,
  recommendPackPolicy,
  buildTaskBrief,
  findTaskById,
  ensureRoleWorktree,
  listRoleWorktrees,
  applySpecifierAcceptance,
  runQaGate,
  formatQaHandoffSummary,
  buildSwarmObservability,
  exportSwarmforgeBundle,
  listRoleBackends,
  governanceNote,
  backendForRole,
} = require('../swarm');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.resolve(process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json'));

function usage(exitCode = 1) {
  console.error(`Usage:
  ariadne-swarm status   [--project <slug>]
  ariadne-swarm run      [--project <slug>] [--task <id>] [--role <name>]
  ariadne-swarm packs
  ariadne-swarm pack     [--task <id>] [--pack two|four|six] [--project <slug>]
  ariadne-swarm brief    --task <id> [--pack two|four|six] [--project <slug>] [--write]
  ariadne-swarm worktree --task <id> --role <name> [--project <slug>]
  ariadne-swarm handoff  --task <id> --from <role> --to <role> --summary <text> [--commit <sha>] [--approved] [--project <slug>]
  ariadne-swarm specify  --task <id> --ac <text> [--ac <text> ...] [--gherkin <text>] [--project <slug>]
  ariadne-swarm qa       [--project <slug>] [--cwd <path>]
  ariadne-swarm observe  [--project <slug>]
  ariadne-swarm backends
  ariadne-swarm export-swarmforge [--out <dir>] [--project <slug>]
  ariadne-swarm complete --task <id> --evidence <text> [--qa|--skip-qa] [--notes <text>] [--command <cmd>] [--no-ledger] [--no-check-ac] [--project <slug>]

Rules:
  - Only Queue tasks with FS deps Done may enter (run → In Progress / Doing)
  - four/six: specifier first; handoff a coder exige AC + --approved (o summary "AC ok")
  - six-pack (hardender/qa): complete corre lint + npm test; fallo bloquea Done (--skip-qa para omitir)
  - complete requires --evidence (tests, commit, acceptance note)
  - packs: two / four / six (see docs/swarm/prompts.md · specifier.md · qa-gate.md)

Examples:
  npm run swarm -- status --project ariadne
  npm run swarm -- run --project ariadne
  npm run swarm -- brief --task AH-E-32 --pack four
  npm run swarm -- handoff --task AH-E-32 --from coder --to cleaner --summary "CLI + tests verdes"
  npm run swarm -- complete --task AH-E-32 --evidence "npm test → swarm.test.js ok"
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const flags = {};
  while (args.length) {
    const token = args.shift();
    if (token === '--help' || token === '-h') {
      flags.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`argumento inesperado: ${token}`);
    }
    const key = token.slice(2);
    const value = args[0] && !args[0].startsWith('--') ? args.shift() : true;
    if (key === 'ac') {
      if (!Array.isArray(flags.ac)) flags.ac = flags.ac ? [flags.ac] : [];
      flags.ac.push(value);
    } else {
      flags[key] = value;
    }
  }
  return { command, flags };
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}

function resolveProject(slug) {
  const catalog = readCatalog();
  const needle = String(slug || process.env.ARIADNE_PROJECT || 'ariadne').trim();
  const project = catalog.find((item) => item.slug === needle);
  if (!project) throw new Error(`proyecto desconocido: ${needle}`);
  return project;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) usage(0);

  let command;
  let flags;
  try {
    ({ command, flags } = parseArgs(argv));
  } catch (error) {
    console.error(error.message);
    usage();
  }

  if (flags.help || command === 'help') usage(0);

  const server = require('../server');
  const deps = createServerDeps(server);
  const project = resolveProject(flags.project);

  if (command === 'status') {
    const snapshot = computeSwarmStatus(server.projectTasks(project));
    printJson({ project: project.slug, ...snapshot });
    return;
  }

  if (command === 'packs') {
    printJson({ packs: listPacks() });
    return;
  }

  if (command === 'pack') {
    const tasks = server.projectTasks(project);
    const task = flags.task ? findTaskById(tasks, flags.task) : null;
    if (flags.task && !task) throw new Error(`tarea no encontrada: ${flags.task}`);
    const pack = flags.pack ? getPack(flags.pack) : null;
    const policy = pack
      ? { pack, modelHint: pack.modelHint, reason: 'explicit --pack' }
      : (task ? recommendPackPolicy(task) : null);
    if (!policy) throw new Error('indica --pack o --task para sugerir pack');
    printJson({
      project: project.slug,
      taskId: task?.id || null,
      pack: policy.pack,
      modelHint: policy.modelHint,
      reason: policy.reason,
    });
    return;
  }

  if (command === 'brief') {
    if (!flags.task) throw new Error('brief requires --task');
    const tasks = server.projectTasks(project);
    const task = findTaskById(tasks, flags.task);
    if (!task) throw new Error(`tarea no encontrada: ${flags.task}`);
    const brief = buildTaskBrief(task, { pack: flags.pack || undefined });
    if (flags.write) {
      const outDir = path.join(project.path, '.ariadne', 'swarm');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `${task.id.toLowerCase()}-brief.md`);
      fs.writeFileSync(outFile, brief.markdown, 'utf8');
      printJson({ project: project.slug, written: outFile, pack: brief.pack, taskId: task.id });
      return;
    }
    process.stdout.write(brief.markdown);
    return;
  }

  if (command === 'worktree') {
    if (!flags.task) throw new Error('worktree requires --task');
    if (!flags.role) throw new Error('worktree requires --role');
    const result = ensureRoleWorktree(project.path, {
      taskId: flags.task,
      role: flags.role,
    });
    printJson({ project: project.slug, ...result, worktrees: listRoleWorktrees(project.path) });
    return;
  }

  if (command === 'run') {
    const result = await runSwarmTask(project, {
      taskId: flags.task || null,
      role: flags.role || null,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  if (command === 'handoff') {
    const result = await handoffSwarmTask(project, {
      taskId: flags.task,
      fromRole: flags.from,
      toRole: flags.to,
      summary: flags.summary,
      commit: flags.commit,
      approved: flags.approved === true,
      pack: flags.pack || undefined,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  if (command === 'specify') {
    if (!flags.task) throw new Error('specify requires --task');
    const tasks = server.projectTasks(project);
    const task = findTaskById(tasks, flags.task);
    if (!task) throw new Error(`tarea no encontrada: ${flags.task}`);
    const criteria = [];
    if (Array.isArray(flags.ac)) criteria.push(...flags.ac);
    else if (flags.ac) criteria.push(flags.ac);
    if (!criteria.length && flags.criteria) {
      criteria.push(...String(flags.criteria).split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean));
    }
    if (!criteria.length) throw new Error('specify requires --ac "…" (repetible) o --criteria "a | b | c"');
    const next = applySpecifierAcceptance(task.source || '', {
      criteria,
      gherkin: typeof flags.gherkin === 'string' ? flags.gherkin : '',
    });
    const updated = await deps.writeSource(project, task.id, next);
    printJson({
      project: project.slug,
      action: 'specify',
      taskId: task.id,
      acceptanceCount: criteria.length,
      title: updated.title || task.title,
    });
    return;
  }

  if (command === 'qa') {
    const qa = runQaGate({
      cwd: flags.cwd || project.path || ROOT,
    });
    printJson({
      project: project.slug,
      action: 'qa',
      ...qa,
      handoffSummary: formatQaHandoffSummary(qa),
    });
    return;
  }

  if (command === 'observe') {
    printJson(buildSwarmObservability(project, server.projectTasks(project)));
    return;
  }

  if (command === 'backends') {
    printJson({
      action: 'backends',
      roles: listRoleBackends(),
      governance: governanceNote(),
      docs: 'docs/swarm/backends.md',
      example: backendForRole('coder'),
    });
    return;
  }

  if (command === 'export-swarmforge' || command === 'export') {
    const outRel = flags.out || path.join('.ariadne', 'swarmforge-export');
    const outDir = path.isAbsolute(outRel) ? outRel : path.join(ROOT, outRel);
    const result = exportSwarmforgeBundle(outDir, {
      root: ROOT,
      projectSlug: project.slug,
    });
    printJson({ project: project.slug, action: 'export-swarmforge', ...result });
    return;
  }

  if (command === 'complete') {
    const result = await completeSwarmTask(project, {
      taskId: flags.task,
      evidence: flags.evidence,
      notes: flags.notes,
      command: flags.command,
      ledger: flags['no-ledger'] ? false : true,
      checkAc: flags['no-check-ac'] ? false : true,
      ledgerPath: flags.ledger || undefined,
      qa: flags.qa === true,
      skipQa: flags['skip-qa'] === true,
      pack: flags.pack || undefined,
      cwd: flags.cwd || ROOT,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  console.error(`comando desconocido: ${command}`);
  usage();
}

main().catch((error) => {
  console.error(error.message);
  if (error.blockers) {
    for (const blocker of error.blockers) {
      console.error(`  - ${blocker.message || blocker.id}`);
    }
  }
  process.exit(1);
});
