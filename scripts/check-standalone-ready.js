#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = ['README.md', 'server.js', 'package.json', 'projects.example.json', '.gitignore'];
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function run(command) {
  return execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) fail(`Missing required file: ${rel}`);
}

const gitignorePath = path.join(root, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = readText(gitignorePath);
  if (!gitignore.includes('projects.json')) fail('Expected projects.json to be ignored in .gitignore');
  if (!gitignore.includes('projects/')) warn('Recommendation: ignore local projects/ in .gitignore');
  if (!gitignore.includes('dist/')) warn('Recommendation: ignore release dist/ artifacts in .gitignore');
}

const packagePath = path.join(root, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(readText(packagePath));
  const repoUrl = pkg?.repository?.url || '';
  if (!repoUrl || !String(repoUrl).includes('github.com')) {
    fail('package.json repository.url must point to GitHub before publishing');
  }
}

const projectsExamplePath = path.join(root, 'projects.example.json');
if (fs.existsSync(projectsExamplePath)) {
  let example;
  try {
    example = JSON.parse(readText(projectsExamplePath));
  } catch (error) {
    fail(`projects.example.json is invalid JSON: ${error.message}`);
  }

  if (!Array.isArray(example) || example.length === 0) {
    fail('projects.example.json must contain at least one project example');
  } else {
    for (const item of example) {
      if (!item?.slug || !item?.name || !item?.path) {
        fail(`Invalid projects.example.json entry: ${JSON.stringify(item)}`);
      }
      const projectPath = String(item.path || '');
      if (!projectPath.includes('/Users/TU_USUARIO/') && !projectPath.includes('/home/TU_USUARIO/')) {
        warn(`Project example path is not placeholder-style: ${projectPath}`);
      }
    }
  }
}

try {
  const tracked = run('git ls-files projects.json || true');
  if (tracked) {
    fail('projects.json is tracked by git; it should remain local-only');
  }
} catch {
  warn('Could not verify tracked projects.json with git ls-files');
}

try {
  const files = run('git ls-files').split('\n').filter(Boolean);
  for (const rel of files) {
    if (rel === 'projects.example.json') continue;
    const full = path.join(root, rel);
    let text;
    try {
      text = readText(full);
    } catch {
      continue;
    }

    if (text.includes('/Users/') && !text.includes('/Users/TU_USUARIO/')) {
      fail(`Potential local absolute path found in ${rel}`);
      break;
    }
  }
} catch {
  warn('Could not scan tracked files for local absolute paths');
}

if (warnings.length) {
  console.log('Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error('Standalone readiness check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Standalone readiness check passed.');
