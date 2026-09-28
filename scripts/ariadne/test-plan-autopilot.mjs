import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    args[key] = val;
    if (val !== 'true') i += 1;
  }
  return args;
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fmtDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function statusMap(testStatus) {
  if (testStatus === 'pass') return 'Done';
  if (testStatus === 'fail') return 'In Progress';
  if (testStatus === 'blocked') return 'Queued';
  return 'Queued';
}

function priorityMap(priority) {
  if (priority === 'P0') return 'High';
  if (priority === 'P1') return 'Medium';
  return 'Low';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseReportGlob(pattern, repoRoot) {
  const normalized = pattern.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return {
      dir: repoRoot,
      regex: new RegExp(`^${escapeRegex(normalized).replace(/\\\*/g, '.*')}$`),
    };
  }
  const dirPart = normalized.slice(0, lastSlash);
  const filePart = normalized.slice(lastSlash + 1);
  return {
    dir: path.join(repoRoot, dirPart),
    regex: new RegExp(`^${escapeRegex(filePart).replace(/\\\*/g, '.*')}$`),
  };
}

function latestReportPath(reportGlob, repoRoot) {
  const { dir, regex } = parseReportGlob(reportGlob, repoRoot);
  if (!fs.existsSync(dir)) die(`Report directory does not exist: ${dir}`);
  const candidates = fs
    .readdirSync(dir)
    .filter((name) => regex.test(name))
    .map((name) => ({
      name,
      fullPath: path.join(dir, name),
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .sort((a, b) => a.mtime - b.mtime);

  if (!candidates.length) die(`No report matches glob: ${reportGlob}`);
  return candidates[candidates.length - 1].fullPath;
}

async function checkUrls(urls) {
  for (const url of urls) {
    let ok = false;
    let status = 0;
    try {
      const res = await fetch(url);
      status = res.status;
      ok = status >= 200 && status < 300;
    } catch {
      ok = false;
    }
    if (!ok) {
      die(`Health check failed: ${url} (status=${status || 'n/a'})`);
    }
  }
}

function renderTaskMarkdown({ projectKey, caseItem, status, createdDate, updatedDate }) {
  const idNum = String(caseItem.id || '').replace(/^T-?/i, '').padStart(3, '0');
  const taskId = `${projectKey}-T-${idNum}`;
  const title = `T-${idNum} ${caseItem.title}`;
  const dependency = caseItem.dependency || `${projectKey}-E-BASE`;
  const priority = priorityMap(caseItem.priority || 'P1');
  const tags = Array.isArray(caseItem.tags) ? caseItem.tags : [];
  const labelLines = ['  - test-plan', '  - auto-generated', ...tags.map((t) => `  - ${t}`)].join('\n');

  return `---\nid: ${taskId}\ntitle: ${title}\nstatus: ${status}\nassignee: []\ncreated_date: '${createdDate}'\nupdated_date: '${updatedDate}'\nlabels:\n${labelLines}\ndependencies:\n  - ${dependency}\npriority: ${priority}\ntype: task\nordinal: 900${idNum}\n---\n\n## Description\n\nCaso ${caseItem.id} del plan de pruebas ${projectKey}.\n\n## Acceptance Criteria\n\n- [ ] #1 Resultado PASS/FAIL/QUEUED registrado automaticamente.\n- [ ] #2 Evidencia de ejecucion adjunta en notas.\n- [ ] #3 Si falla, bug ${projectKey}-B asociado y reproducible.\n\n## Progress Notes\n\n- ${updatedDate}: Tarea creada automaticamente por test-plan-autopilot.\n`;
}

function ensureTasksFromPlan(config, repoRoot) {
  const tasksDir = path.join(repoRoot, config.tasksDir || 'backlog/tasks');
  ensureDir(tasksDir);

  const created = [];
  const date = fmtDate();
  const existingFiles = fs.readdirSync(tasksDir).filter((n) => n.endsWith('.md'));

  for (const caseItem of config.cases || []) {
    const idNum = String(caseItem.id || '').replace(/^T-?/i, '').padStart(3, '0');
    const idPrefix = `${config.projectKey.toLowerCase()}-t-${idNum}`;
    const alreadyExists = existingFiles.some((name) => name.startsWith(idPrefix));
    if (alreadyExists) continue;

    const fileName = `${config.projectKey.toLowerCase()}-t-${idNum} - t-${idNum}-${slugify(caseItem.title)}.md`;
    const fullPath = path.join(tasksDir, fileName);

    fs.writeFileSync(
      fullPath,
      renderTaskMarkdown({ projectKey: config.projectKey, caseItem, status: 'To Do', createdDate: date, updatedDate: date }),
      'utf8'
    );
    created.push(fileName);
  }

  return created;
}

function findTaskFileForCase(tasksDir, projectKey, caseId) {
  const idNum = String(caseId || '').replace(/^T-?/i, '').padStart(3, '0');
  const prefix = `${projectKey.toLowerCase()}-t-${idNum}`;
  return fs.readdirSync(tasksDir).find((name) => name.startsWith(prefix) && name.endsWith('.md')) || null;
}

function replaceOrInsert(content, regex, replacement, insertAfter) {
  if (regex.test(content)) return content.replace(regex, replacement);
  const idx = content.indexOf(insertAfter);
  if (idx === -1) return `${content}\n${replacement}\n`;
  const at = idx + insertAfter.length;
  return `${content.slice(0, at)}\n${replacement}${content.slice(at)}`;
}

function appendProgressNote(content, note) {
  const marker = '## Progress Notes';
  const idx = content.indexOf(marker);
  if (idx === -1) return `${content}\n\n## Progress Notes\n\n- ${note}\n`;
  const after = content.slice(idx + marker.length);
  if (after.includes(note)) return content;
  return `${content.slice(0, idx + marker.length)}\n\n- ${note}${after}`;
}

function syncCasesToTasks(config, report, reportFile, repoRoot) {
  const tasksDir = path.join(repoRoot, config.tasksDir || 'backlog/tasks');
  const date = fmtDate();
  const updated = [];
  const missing = [];

  for (const [caseId, entry] of Object.entries(report.cases || {})) {
    const taskFile = findTaskFileForCase(tasksDir, config.projectKey, caseId);
    if (!taskFile) {
      missing.push(caseId);
      continue;
    }

    const fullPath = path.join(tasksDir, taskFile);
    let content = fs.readFileSync(fullPath, 'utf8');
    content = replaceOrInsert(content, /^status:\s.*$/m, `status: ${statusMap(entry.status)}`, '---');
    content = replaceOrInsert(content, /^updated_date:\s.*$/m, `updated_date: '${date}'`, '---');

    const ev = Array.isArray(entry.evidence) && entry.evidence.length ? entry.evidence.join(' | ') : 'none';
    const gaps = Array.isArray(entry.gaps) && entry.gaps.length ? entry.gaps.join(' | ') : 'none';
    const note = `${date}: Auto-sync ${path.basename(reportFile)} -> ${entry.status.toUpperCase()}; evidence=${ev}; gaps=${gaps}`;
    content = appendProgressNote(content, note);

    fs.writeFileSync(fullPath, content, 'utf8');
    updated.push({ caseId, taskFile, status: statusMap(entry.status) });
  }

  return { updated, missing };
}

function bugNumberFromFilename(name) {
  const m = name.match(new RegExp(`^${name.includes('-b-') ? '[a-z]+' : ''}-?b-(\\d+)\\s-`, 'i'));
  return m ? Number(m[1]) : null;
}

function syncFailingCasesToBugs(config, report, reportFile, repoRoot) {
  const tasksDir = path.join(repoRoot, config.tasksDir || 'backlog/tasks');
  const bugPrefix = `${config.projectKey.toLowerCase()}-b-`;
  const existingBugFiles = fs.readdirSync(tasksDir).filter((n) => n.startsWith(bugPrefix) && n.endsWith('.md'));
  const date = fmtDate();

  const touched = [];
  const failing = Object.entries(report.cases || {}).filter(([, entry]) => entry.status === 'fail');

  const maxBug = existingBugFiles
    .map((f) => {
      const m = f.match(new RegExp(`^${bugPrefix}(\\d+)\\s-`, 'i'));
      return m ? Number(m[1]) : 0;
    })
    .reduce((acc, n) => Math.max(acc, n), 0);

  let nextBug = maxBug + 1;

  for (const [caseId, entry] of failing) {
    const idNum = String(caseId || '').replace(/^T-?/i, '').padStart(3, '0');
    const caseNeedle = `t-${idNum}`;
    const found = existingBugFiles.find((f) => f.toLowerCase().includes(caseNeedle));

    const evidence = Array.isArray(entry.evidence) && entry.evidence.length
      ? entry.evidence.map((e) => `- ${e}`).join('\n')
      : '- none';
    const gaps = Array.isArray(entry.gaps) && entry.gaps.length
      ? entry.gaps.map((g) => `- ${g}`).join('\n')
      : '- none';
    const note = `- ${date}: Auto-detected from ${path.basename(reportFile)}.\n  - Evidence:\n${evidence}\n  - Gaps:\n${gaps}`;

    if (found) {
      const fullPath = path.join(tasksDir, found);
      let content = fs.readFileSync(fullPath, 'utf8');
      content = replaceOrInsert(content, /^status:\s.*$/m, 'status: In Progress', '---');
      content = replaceOrInsert(content, /^updated_date:\s.*$/m, `updated_date: '${date}'`, '---');
      content = appendProgressNote(content, note);
      fs.writeFileSync(fullPath, content, 'utf8');
      touched.push({ caseId, action: 'updated', file: found });
      continue;
    }

    const bugNum = nextBug;
    nextBug += 1;
    const fileName = `${bugPrefix}${bugNum} - t-${idNum}-${slugify(entry.title || 'test-failure')}.md`;
    const fullPath = path.join(tasksDir, fileName);

    const md = `---\nid: ${config.projectKey}-B-${bugNum}\ntitle: ${caseId} ${entry.title || 'Test failure'}\nstatus: In Progress\nassignee: []\ncreated_date: '${date}'\nupdated_date: '${date}'\nlabels:\n  - bug\n  - auto-detected\n  - test-plan\npriority: ${priorityMap(entry.priority || 'P1')}\ntype: bug\nordinal: 990${bugNum}\n---\n\n## Description\n\nFallo detectado automaticamente por el autopiloto en el caso ${caseId}.\n\n## Acceptance Criteria\n\n- [ ] #1 Reproducir el fallo con evidencia local.\n- [ ] #2 Corregir causa raiz en V3/V4/backend segun corresponda.\n- [ ] #3 Re-test del caso ${caseId} en PASS.\n\n## Observed vs Expected\n\n- Observado:\n${gaps}\n- Esperado:\n- Equivalencia funcional V3 vs V4 para ${caseId}.\n\n## Progress Notes\n\n${note}\n`;
    fs.writeFileSync(fullPath, md, 'utf8');
    touched.push({ caseId, action: 'created', file: fileName });
  }

  return touched;
}

function renderCorrectionsPlan(config, report, reportPath, repoRoot) {
  const outDir = path.join(repoRoot, 'backlog/docs/reports');
  ensureDir(outDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `${config.projectKey.toLowerCase()}-corrections-${ts}.md`);

  const fails = Object.entries(report.cases || {}).filter(([, c]) => c.status === 'fail');

  const lines = [];
  lines.push(`# Correction Plan ${config.projectKey}`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Source report: ${path.basename(reportPath)}`);
  lines.push(`- Fail count: ${fails.length}`);
  lines.push('');
  lines.push('## Prioritized Worklist');
  lines.push('');
  lines.push('| Case | Priority | Gap | Suggested action |');
  lines.push('| --- | --- | --- | --- |');

  const sorted = fails.sort((a, b) => {
    const pa = a[1].priority || 'P2';
    const pb = b[1].priority || 'P2';
    const rank = { P0: 0, P1: 1, P2: 2 };
    return (rank[pa] ?? 9) - (rank[pb] ?? 9);
  });

  for (const [caseId, entry] of sorted) {
    const gap = (entry.gaps && entry.gaps[0]) || 'No gap message';
    lines.push(`| ${caseId} | ${entry.priority || 'P1'} | ${gap} | Fix root cause and re-run autopilot |`);
  }

  lines.push('');
  lines.push('## Evidence Snapshot');
  lines.push('');
  for (const [caseId, entry] of sorted) {
    lines.push(`### ${caseId} ${entry.title || ''}`);
    for (const ev of entry.evidence || []) lines.push(`- ${ev}`);
    lines.push('');
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

function summarize(report) {
  const values = Object.values(report.cases || {}).map((c) => c.status);
  return {
    pass: values.filter((s) => s === 'pass').length,
    fail: values.filter((s) => s === 'fail').length,
    blocked: values.filter((s) => s === 'blocked').length,
    pending: values.filter((s) => s === 'pending').length,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config) die('Usage: node scripts/ariadne/test-plan-autopilot.mjs --config <path-to-config.json> [--skip-preflight] [--skip-run] [--report <path>]');

  const repoRoot = process.cwd();
  const configPath = path.isAbsolute(args.config) ? args.config : path.join(repoRoot, args.config);
  if (!fs.existsSync(configPath)) die(`Config not found: ${configPath}`);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.projectKey) die('Config requires projectKey');
  if (!Array.isArray(config.cases) || !config.cases.length) die('Config requires non-empty cases[]');
  if (!config.runCommand && args['skip-run'] !== 'true') die('Config requires runCommand');
  if (!config.reportGlob && !args.report) die('Config requires reportGlob (or pass --report)');

  const createdTasks = ensureTasksFromPlan(config, repoRoot);

  if (args['skip-preflight'] !== 'true') {
    await checkUrls(config.preflightUrls || []);
  }

  if (args['skip-run'] !== 'true') {
    execSync(config.runCommand, {
      stdio: 'inherit',
      cwd: repoRoot,
      env: process.env,
    });
  }

  const reportPath = args.report
    ? (path.isAbsolute(args.report) ? args.report : path.join(repoRoot, args.report))
    : latestReportPath(config.reportGlob, repoRoot);
  if (!fs.existsSync(reportPath)) die(`Report not found: ${reportPath}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  const taskSync = syncCasesToTasks(config, report, reportPath, repoRoot);
  const bugsTouched = syncFailingCasesToBugs(config, report, reportPath, repoRoot);
  const correctionPlanPath = renderCorrectionsPlan(config, report, reportPath, repoRoot);

  const out = {
    config: configPath,
    reportPath,
    summary: report.summary || summarize(report),
    createdTasks,
    updatedTasks: taskSync.updated.length,
    missingTasks: taskSync.missing,
    bugsTouched,
    correctionPlanPath,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('Autopilot failed:', err);
  process.exit(1);
});
