import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const REPORTS_DIR = path.join(ROOT, 'backlog', 'docs', 'reports');
const TASKS_DIR = path.join(ROOT, 'backlog', 'tasks');

function latestReportFile() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter((f) => /^parity-audit-.*\.json$/.test(f))
    .sort();
  if (!files.length) throw new Error('No parity report found in backlog/docs/reports');
  return path.join(REPORTS_DIR, files[files.length - 1]);
}

function toBacklogStatus(testStatus) {
  if (testStatus === 'pass') return 'Done';
  if (testStatus === 'fail') return 'In Progress';
  if (testStatus === 'blocked') return 'Queued';
  return 'Queued';
}

function findTaskFile(caseId) {
  const suffix = caseId.toLowerCase().replace('t-', '');
  const files = fs.readdirSync(TASKS_DIR);
  const match = files.find((f) => f.startsWith(`ka-t-${suffix}`) && f.endsWith('.md'));
  return match ? path.join(TASKS_DIR, match) : null;
}

function updateFrontmatterStatus(content, status, updatedDate) {
  const fmRegex = /^---\n([\s\S]*?)\n---/;
  const m = content.match(fmRegex);
  if (!m) return content;
  let fm = m[1];

  if (/^status:\s.*$/m.test(fm)) {
    fm = fm.replace(/^status:\s.*$/m, `status: ${status}`);
  }
  if (/^updated_date:\s.*$/m.test(fm)) {
    fm = fm.replace(/^updated_date:\s.*$/m, `updated_date: '${updatedDate}'`);
  }

  return `---\n${fm}\n---${content.slice(m[0].length)}`;
}

function appendProgressNote(content, note) {
  const marker = '## Progress Notes';
  const idx = content.indexOf(marker);
  if (idx === -1) return `${content}\n\n## Progress Notes\n\n- ${note}\n`;

  const after = content.slice(idx + marker.length);
  const noteLine = `\n\n- ${note}`;
  if (after.includes(note)) return content;
  return content.slice(0, idx + marker.length) + noteLine + after;
}

function main() {
  const reportPath = latestReportFile();
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  const now = new Date();
  const updatedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const updated = [];
  const missing = [];

  for (const [caseId, entry] of Object.entries(report.cases || {})) {
    const taskFile = findTaskFile(caseId);
    if (!taskFile) {
      missing.push(caseId);
      continue;
    }

    const backlogStatus = toBacklogStatus(entry.status);
    const evidence = Array.isArray(entry.evidence) ? entry.evidence.join(' | ') : '';
    const gaps = Array.isArray(entry.gaps) ? entry.gaps.join(' | ') : '';

    let content = fs.readFileSync(taskFile, 'utf8');
    content = updateFrontmatterStatus(content, backlogStatus, updatedDate);

    const note = `${updatedDate}: Auto-sync parity report ${path.basename(reportPath)} -> status=${entry.status.toUpperCase()}${evidence ? `; evidence=${evidence}` : ''}${gaps ? `; gaps=${gaps}` : ''}`;
    content = appendProgressNote(content, note);
    fs.writeFileSync(taskFile, content, 'utf8');

    updated.push({ caseId, taskFile: path.basename(taskFile), status: backlogStatus });
  }

  const fails = Object.entries(report.cases || {})
    .filter(([, c]) => c.status === 'fail')
    .map(([id, c]) => ({ id, gaps: c.gaps || [], evidence: c.evidence || [] }));

  console.log(JSON.stringify({
    reportPath,
    summary: report.summary,
    updatedCount: updated.length,
    missingCases: missing,
    failingCases: fails,
  }, null, 2));
}

main();
