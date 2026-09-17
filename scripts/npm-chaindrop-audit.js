#!/usr/bin/env node
'use strict';

/** Thin wrapper → personal skill `npm-chaindrop-guard` (usable from any repo). */
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

const skillScript = path.join(
  os.homedir(),
  '.cursor',
  'skills',
  'npm-chaindrop-guard',
  'scripts',
  'audit.js',
);

if (!fs.existsSync(skillScript)) {
  console.warn(
    `npm-chaindrop-guard skill missing at ${skillScript}; skipping (GitHub Actions has no Cursor skills).`,
  );
  process.exit(0);
}

const result = spawnSync(process.execPath, [skillScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`npm-chaindrop-guard failed: ${result.error.message}`);
  process.exit(2);
}

process.exit(result.status == null ? 1 : result.status);
