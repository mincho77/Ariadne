'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getFrontmatterList } = require('../lib/task-markdown');
const { getPack, recommendPackPolicy } = require('./packs');

const PROMPTS_FILE = path.join(__dirname, '..', 'docs', 'swarm', 'prompts.md');

function extractAcceptanceCriteria(source) {
  const text = String(source || '');
  const section = text.match(/##\s+Acceptance Criteria[\s\S]*?(?=\n##\s+|\n---\s*$|$)/i);
  const body = section ? section[0] : text;
  const items = [];
  for (const match of body.matchAll(/^\s*-\s*\[([ xX])\]\s*(.+)$/gm)) {
    items.push({
      done: String(match[1]).toLowerCase() === 'x',
      text: match[2].trim(),
    });
  }
  return items;
}

function extractPaths(source) {
  const text = String(source || '');
  const found = new Set();
  const patterns = [
    /`((?:[\w.-]+\/)+[\w.-]+\.[a-z0-9]+)`/gi,
    /\b((?:swarm|docs|scripts|public|lib)\/[\w./-]+)\b/g,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function loadRolePrompts(filePath = PROMPTS_FILE) {
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const prompts = {};
  const re = /^##\s+(\w+)\s*\n([\s\S]*?)(?=^##\s+|\s*$)/gm;
  let match;
  while ((match = re.exec(text))) {
    prompts[match[1].toLowerCase()] = match[2].trim();
  }
  return prompts;
}

function buildTaskBrief(task, options = {}) {
  if (!task || !task.id) throw new Error('buildTaskBrief requires a task with id');

  const policy = options.pack
    ? { pack: getPack(options.pack), modelHint: getPack(options.pack).modelHint, reason: 'explicit --pack' }
    : recommendPackPolicy(task);
  const pack = policy.pack;

  const source = task.source || '';
  const acceptance = extractAcceptanceCriteria(source);
  const dependencies = getFrontmatterList(source, 'dependencies');
  const paths = extractPaths(source);
  const prompts = loadRolePrompts(options.promptsFile);

  const roleBlocks = pack.roles.map((role) => ({
    role,
    prompt: prompts[role] || `(sin prompt para ${role} — ver docs/swarm/prompts.md)`,
  }));

  const markdown = [
    `# Swarm brief · ${task.id}`,
    '',
    `- **Title:** ${task.title || ''}`,
    `- **Status:** ${task.status || ''}`,
    `- **Priority:** ${task.priority || ''}`,
    `- **Pack:** ${pack.label} (${pack.roles.join(' → ')})`,
    `- **Pack use:** ${pack.use}`,
    `- **modelHint:** ${policy.modelHint} — ${policy.reason}`,
    '',
    '## Acceptance criteria',
    ...(acceptance.length
      ? acceptance.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`)
      : ['- (sin AC parseables en la tarea)']),
    '',
    '## Dependencies',
    ...(dependencies.length ? dependencies.map((dep) => `- ${dep}`) : ['- (ninguna)']),
    '',
    '## Paths',
    ...(paths.length ? paths.map((p) => `- \`${p}\``) : ['- (no detectados en el markdown; inferir al implementar)']),
    '',
    '## Role prompts',
    ...roleBlocks.flatMap((block) => [`### ${block.role}`, '', block.prompt, '']),
  ].join('\n').trimEnd() + '\n';

  return {
    taskId: task.id,
    pack,
    modelHint: policy.modelHint,
    policyReason: policy.reason,
    acceptance,
    dependencies,
    paths,
    roles: roleBlocks,
    markdown,
  };
}

module.exports = {
  extractAcceptanceCriteria,
  extractPaths,
  loadRolePrompts,
  buildTaskBrief,
};
