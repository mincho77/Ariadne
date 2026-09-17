'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WORKTREE_ROOT = '.worktrees';

function slugPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'x';
}

function worktreePath(projectPath, taskId, role) {
  return path.join(projectPath, WORKTREE_ROOT, `${slugPart(taskId)}-${slugPart(role)}`);
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim();
    const error = new Error(message);
    error.code = 'GIT_FAILED';
    throw error;
  }
  return (result.stdout || '').trim();
}

function ensureGitRepo(projectPath) {
  const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: projectPath,
    encoding: 'utf8',
  });
  if (probe.status !== 0) {
    const error = new Error(`no es un repo git: ${projectPath}`);
    error.code = 'NOT_GIT';
    throw error;
  }
}

/**
 * Create (or reuse) a git worktree for a task role under `.worktrees/<task>-<role>`.
 */
function ensureRoleWorktree(projectPath, { taskId, role, branchFrom = 'HEAD' } = {}) {
  if (!taskId) throw new Error('worktree requires taskId');
  if (!role) throw new Error('worktree requires role');
  ensureGitRepo(projectPath);

  const abs = worktreePath(projectPath, taskId, role);
  const root = path.join(projectPath, WORKTREE_ROOT);
  fs.mkdirSync(root, { recursive: true });

  if (fs.existsSync(abs)) {
    return {
      action: 'reuse',
      path: abs,
      relativePath: path.relative(projectPath, abs),
      taskId,
      role,
    };
  }

  const branch = `swarm/${slugPart(taskId)}/${slugPart(role)}`;
  // Prefer new branch from branchFrom; if branch exists, attach worktree to it.
  const branchExists = spawnSync('git', ['rev-parse', '--verify', branch], {
    cwd: projectPath,
    encoding: 'utf8',
  }).status === 0;

  if (branchExists) {
    runGit(projectPath, ['worktree', 'add', abs, branch]);
  } else {
    runGit(projectPath, ['worktree', 'add', '-b', branch, abs, branchFrom]);
  }

  return {
    action: 'created',
    path: abs,
    relativePath: path.relative(projectPath, abs),
    branch,
    taskId,
    role,
  };
}

function listRoleWorktrees(projectPath) {
  const root = path.join(projectPath, WORKTREE_ROOT);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(root, entry.name),
      relativePath: path.join(WORKTREE_ROOT, entry.name),
    }));
}

module.exports = {
  WORKTREE_ROOT,
  worktreePath,
  ensureRoleWorktree,
  listRoleWorktrees,
};
