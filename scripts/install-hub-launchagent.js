#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const {
  HUB_LABEL,
  HUB_PLIST_NAME,
  renderHubPlist,
} = require('../lib/launchagent-hub');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage: node scripts/install-hub-launchagent.js [--dry-run] [--no-load] [--root <path>]

Installs ~/Library/LaunchAgents/${HUB_PLIST_NAME} pointing at this repo,
restarts any existing ${HUB_LABEL} service, and kickstarts it.
`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, load: true, root: ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-load') args.load = false;
    else if (arg === '--root') {
      args.root = path.resolve(argv[++i] || '');
    } else {
      usage();
    }
  }
  return args;
}

function resolveNodeBin() {
  const fromExec = process.execPath;
  if (fromExec && fs.existsSync(fromExec)) return fromExec;
  const which = spawnSync('which', ['node'], { encoding: 'utf8' });
  const candidate = (which.stdout || '').trim();
  if (candidate) return candidate;
  throw new Error('node binary not found');
}

function agentsDir() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents');
}

function run(cmd, cmdArgs, { dryRun } = {}) {
  const line = [cmd, ...cmdArgs].join(' ');
  if (dryRun) {
    console.log(`[dry-run] ${line}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  return spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
}

function bootoutLabel(label, { dryRun }) {
  const uid = process.getuid();
  const result = run('launchctl', ['bootout', `gui/${uid}/${label}`], { dryRun });
  // Already unloaded is fine
  if (!dryRun && result.status !== 0) {
    const msg = `${result.stdout || ''}${result.stderr || ''}`;
    if (!/Could not find service|No such process|Input.output error|not found/i.test(msg)) {
      console.warn(`bootout ${label}: ${(msg || 'failed').trim()}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;
  const serverPath = path.join(root, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`server.js not found under ${root}`);
  }

  const nodePath = resolveNodeBin();
  const plistBody = renderHubPlist({
    nodePath,
    serverPath,
    workingDirectory: root,
  });

  const dir = agentsDir();
  const hubTarget = path.join(dir, HUB_PLIST_NAME);

  console.log(`Hub label: ${HUB_LABEL}`);
  console.log(`Node: ${nodePath}`);
  console.log(`Root: ${root}`);
  console.log(`Plist: ${hubTarget}`);

  bootoutLabel(HUB_LABEL, args);

  if (args.dryRun) {
    console.log(`[dry-run] write ${hubTarget}\n${plistBody}`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hubTarget, plistBody.endsWith('\n') ? plistBody : `${plistBody}\n`, 'utf8');
    console.log(`Wrote ${hubTarget}`);
  }

  if (args.load) {
    const uid = process.getuid();
    run('launchctl', ['bootstrap', `gui/${uid}`, hubTarget], args);
    run('launchctl', ['kickstart', '-k', `gui/${uid}/${HUB_LABEL}`], args);
    console.log(`Loaded ${HUB_LABEL}`);
  } else {
    console.log('Skipped launchctl load (--no-load)');
  }

  console.log('\nVerify:');
  console.log(`  launchctl print gui/$(id -u)/${HUB_LABEL} | head`);
  console.log('  curl -sS http://127.0.0.1:4177/api/gantt/portfolio | head');
  console.log('  Docs: docs/launchagent-hub.md');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
