#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifyMessage } = require('./ariadne-route-hint');

const ROOT = path.join(__dirname, '..');

function readMessage(argv) {
  const fromArgv = argv.slice(2).join(' ').trim();
  if (fromArgv) return fromArgv;
  if (process.stdin.isTTY) return '';
  return fs.readFileSync(0, 'utf8').trim();
}

function buildLaunchPlan(message) {
  const hint = classifyMessage(message);
  const skillName = hint.skill;
  const skillDir = path.join(ROOT, 'skills', skillName);
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    throw new Error(`skill file not found: ${path.relative(ROOT, skillFile)}`);
  }

  return {
    ...hint,
    message,
    repoRoot: ROOT,
    skillName,
    skillDir,
    skillFile,
    skillRelative: path.relative(ROOT, skillFile),
    env: {
      ARIADNE_SKILL: skillName,
      ARIADNE_MODEL_TIER: hint.modelTier,
      ARIADNE_ROUTE_MODE: hint.mode,
    },
    instructions: hint.mode === 'lite'
      ? 'Load skills/ariadne-lite/SKILL.md only; avoid lib/gantt and deploy flows unless user escalates.'
      : 'Load skills/ariadne/SKILL.md; full governance and code audit rules apply.',
  };
}

function usage() {
  console.error(`Usage:
  node scripts/ariadne-launcher.js "<user message>"
  echo "mueve tarea a cola" | node scripts/ariadne-launcher.js

Emits JSON for external Codex/Cursor launchers: skill path, mode, env exports.
`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();
  const message = readMessage(process.argv);
  if (!message) usage();
  console.log(JSON.stringify(buildLaunchPlan(message), null, 2));
}

if (require.main === module) main();

module.exports = { buildLaunchPlan, readMessage };
