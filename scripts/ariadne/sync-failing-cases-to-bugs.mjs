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

function readBugFiles() {
  return fs.readdirSync(TASKS_DIR).filter((f) => /^ka-b-\d+\s-\s.*\.md$/.test(f));
}

function nextBugNumber(existing) {
  let maxNum = 0;
  for (const f of existing) {
    const m = f.match(/^ka-b-(\d+)\s-/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  return maxNum + 1;
}

function findBugFileByCase(caseId, bugFiles) {
  const token = caseId.toLowerCase();
  return bugFiles.find((f) => f.toLowerCase().includes(token));
}

function fmtDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function mapPriority(priority) {
  if (priority === 'P0') return 'high';
  if (priority === 'P1') return 'medium';
  return 'low';
}

function mapDependency(caseId) {
  const n = Number(caseId.replace('T-', ''));
  if (n <= 11) return 'KA-E-12';
  if (n <= 15) return 'KA-E-13';
  if (n === 16) return 'KA-E-14';
  if (n === 17) return 'KA-E-15';
  if (n <= 20) return 'KA-E-16';
  if (n <= 24) return 'KA-E-17';
  if (n <= 27) return 'KA-E-18';
  if (n <= 29) return 'KA-E-20';
  return 'KA-E-21';
}

function sanitizeSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function appendOrCreateBug(caseId, entry, reportName) {
  const bugFiles = readBugFiles();
  const existing = findBugFileByCase(caseId, bugFiles);
  const date = fmtDate();

  const evidence = (entry.evidence || []).map((e) => `- ${e}`).join('\n');
  const gaps = (entry.gaps || []).map((g) => `- ${g}`).join('\n');
  const note = `- ${date}: Auto-detected from ${reportName}.\n  - Evidence:\n${evidence || '- (none)'}\n  - Gaps:\n${gaps || '- (none)'}`;

  if (existing) {
    const fullPath = path.join(TASKS_DIR, existing);
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/^status:\s.*$/m, 'status: In Progress');
    content = content.replace(/^updated_date:\s.*$/m, `updated_date: '${date}'`);

    if (content.includes('## Notes')) {
      content = content.replace(/## Notes\n([\s\S]*)$/, (m, notes) => `## Notes\n${notes.trimEnd()}\n${note}\n`);
    } else {
      content += `\n\n## Notes\n\n${note}\n`;
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    return { action: 'updated', file: existing };
  }

  const num = nextBugNumber(bugFiles);
  const priority = mapPriority(entry.priority);
  const dep = mapDependency(caseId);
  const slug = sanitizeSlug(`${caseId}-${entry.title}`);
  const filename = `ka-b-${num} - ${slug}.md`;
  const filePath = path.join(TASKS_DIR, filename);

  const body = `---
id: KA-B-${num}
title: ${caseId} ${entry.title}
status: In Progress
assignee: []
created_date: '${date}'
updated_date: '${date}'
labels:
  - parity
  - bug
  - auto-detected
  - e2e
dependencies:
  - ${dep}
priority: ${priority}
type: bug
ordinal: ${250 + num}
---

## Description

Fallo detectado automaticamente en la corrida de paridad V3 vs V4 para el caso ${caseId}.

## Acceptance Criteria

- [ ] #1 Reproduccion confirmada con evidencia local.
- [ ] #2 Causa raiz identificada en frontend/backend segun corresponda.
- [ ] #3 Re-test en verde en V3 y V4 para ${caseId}.

## Evidence

${evidence || '- (none)'}

## Observed vs Expected

- Observado:
${gaps || '- (none)'}
- Esperado:
- Comportamiento equivalente entre V3 y V4 para ${caseId}.

## Notes

${note}
`;

  fs.writeFileSync(filePath, body, 'utf8');
  return { action: 'created', file: filename };
}

function main() {
  const reportPath = latestReportFile();
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const reportName = path.basename(reportPath);

  const failing = Object.entries(report.cases || {}).filter(([, entry]) => entry.status === 'fail');
  const results = [];

  for (const [caseId, entry] of failing) {
    results.push({ caseId, ...appendOrCreateBug(caseId, entry, reportName) });
  }

  console.log(JSON.stringify({
    reportPath,
    failingCount: failing.length,
    bugsTouched: results,
  }, null, 2));
}

main();
