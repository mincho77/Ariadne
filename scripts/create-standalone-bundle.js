#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = String(pkg.version || '0.1.0');

const ref = process.argv[2] || 'HEAD';
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = path.join(root, 'dist');
const outName = `ariadne-standalone-v${version}-${stamp}.tar.gz`;
const outPath = path.join(outDir, outName);

fs.mkdirSync(outDir, { recursive: true });

try {
  execSync(`git -C "${root}" rev-parse --verify ${ref}`, { stdio: 'ignore' });
} catch {
  console.error(`Invalid git ref: ${ref}`);
  process.exit(1);
}

try {
  execSync(`git -C "${root}" archive --format=tar.gz --output "${outPath}" ${ref}`, { stdio: 'inherit' });
} catch (error) {
  console.error(`Could not generate bundle from ref ${ref}: ${error.message}`);
  process.exit(1);
}

console.log(`Bundle generated: ${outPath}`);
