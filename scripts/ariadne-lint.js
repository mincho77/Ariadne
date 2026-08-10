#!/usr/bin/env node
'use strict';

/**
 * Lightweight lint gate for Ariadne (no eslint dep): node --check on JS sources.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIRS = ['swarm', 'lib', 'scripts'];

function listJsFiles(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = path.join(dir, entry.name);
    const full = path.join(ROOT, rel);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'fixtures') continue;
      listJsFiles(rel, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(rel);
    }
  }
  return out;
}

function main() {
  const files = DIRS.flatMap((dir) => listJsFiles(dir));
  // Also check root entrypoints commonly edited
  for (const rootFile of ['server.js', 'hub-hoy.js', 'task-ids.js']) {
    if (fs.existsSync(path.join(ROOT, rootFile))) files.push(rootFile);
  }

  const unique = [...new Set(files)].sort();
  let failed = 0;
  for (const rel of unique) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, rel)], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      failed += 1;
      console.error(`FAIL ${rel}`);
      process.stderr.write(result.stderr || result.stdout || '');
    }
  }

  if (failed) {
    console.error(`ariadne-lint: ${failed}/${unique.length} files failed node --check`);
    process.exit(1);
  }
  console.log(`ariadne-lint: ${unique.length} files ok (node --check)`);
}

main();
