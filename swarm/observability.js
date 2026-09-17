'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { computeSwarmStatus, isDoingStatus, summarizeTask } = require('./status');
const { listHandoffLines } = require('./specifier-gate');
const { listRoleWorktrees } = require('./worktrees');
const { recommendPackPolicy } = require('./packs');

function parseHandoffBullet(line) {
  const text = String(line || '').replace(/^\-\s*/, '').trim();
  // 2026-08-10 09:00:00 · coder → cleaner · summary · commit abc
  const match = text.match(
    /^(.+?)\s*·\s*([^\s→]+)\s*→\s*([^\s·]+)\s*·\s*(.+?)(?:\s*·\s*commit\s+(\S+))?$/i,
  );
  if (!match) {
    return { raw: text, at: null, fromRole: null, toRole: null, summary: text, commit: null };
  }
  return {
    raw: text,
    at: match[1].trim(),
    fromRole: match[2].trim().toLowerCase(),
    toRole: match[3].trim().toLowerCase(),
    summary: match[4].trim(),
    commit: match[5] || null,
  };
}

function extractTaskHandoffs(source) {
  return listHandoffLines(source).map(parseHandoffBullet);
}

function inferActiveRole(handoffs) {
  if (!handoffs.length) return null;
  const last = handoffs[handoffs.length - 1];
  return last.toRole || last.fromRole || null;
}

function handoffLogPath(projectPath) {
  return path.join(projectPath, '.ariadne', 'swarm', 'handoffs.jsonl');
}

function appendHandoffLog(projectPath, entry) {
  if (!projectPath) return { written: false, skipped: true };
  const file = handoffLogPath(projectPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const row = {
    at: new Date().toISOString(),
    ...entry,
  };
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
  return { written: true, path: file };
}

function readHandoffLog(projectPath, { limit = 40 } = {}) {
  const file = handoffLogPath(projectPath);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  }).reverse();
}

/**
 * Hub-facing swarm observability: roles, worktrees, handoffs.
 */
function buildSwarmObservability(project, tasks, options = {}) {
  const base = computeSwarmStatus(tasks);
  const listTrees = typeof options.listWorktrees === 'function'
    ? options.listWorktrees
    : listRoleWorktrees;
  const worktrees = project?.path ? listTrees(project.path) : [];

  const doingDetail = (tasks || [])
    .filter((task) => isDoingStatus(task.status))
    .map((task) => {
      const handoffs = extractTaskHandoffs(task.source || '');
      const policy = recommendPackPolicy(task);
      const taskTrees = worktrees.filter((tree) => {
        const name = String(tree.name || '').toLowerCase();
        return name.startsWith(`${String(task.id).toLowerCase()}-`)
          || name.includes(String(task.id).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      });
      return {
        ...summarizeTask(task),
        activeRole: inferActiveRole(handoffs) || policy.pack.roles[0] || null,
        pack: policy.pack.id,
        modelHint: policy.modelHint,
        lastHandoff: handoffs[handoffs.length - 1] || null,
        handoffs,
        worktrees: taskTrees.map((tree) => ({
          name: tree.name,
          path: tree.path,
          relativePath: tree.relativePath || tree.name,
        })),
      };
    });

  const recentFromTasks = doingDetail
    .flatMap((item) => (item.handoffs || []).map((h) => ({ ...h, taskId: item.id })))
    .slice(-20);

  const log = project?.path ? readHandoffLog(project.path, { limit: options.logLimit || 30 }) : [];

  return {
    project: project?.slug || null,
    generatedAt: new Date().toISOString(),
    ...base,
    doingDetail,
    worktrees: worktrees.map((tree) => ({
      name: tree.name,
      path: tree.path,
      relativePath: tree.relativePath || tree.name,
    })),
    recentHandoffs: log.length ? log : recentFromTasks,
    handoffLog: project?.path ? path.relative(project.path, handoffLogPath(project.path)) : null,
  };
}

module.exports = {
  parseHandoffBullet,
  extractTaskHandoffs,
  inferActiveRole,
  handoffLogPath,
  appendHandoffLog,
  readHandoffLog,
  buildSwarmObservability,
};
