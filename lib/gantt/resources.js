'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getFrontmatterField, getFrontmatterList } = require('../task-markdown');
const { clampCapacity, canAcceptTask, taskScheduleLane } = require('./capacity-policy');

function resourceConfigPath(project) {
  return path.join(project.path, 'backlog', 'docs', 'gantt', 'resources.config.json');
}

function defaultResourceConfig(fallbackParallel = 2) {
  const maxParallel = clampCapacity(fallbackParallel, 2);
  return {
    pools: [{
      id: 'general',
      skills: ['*'],
      resourceTypes: ['human', 'ai', 'shared'],
      maxParallel,
    }],
  };
}

function normalizePool(pool, fallbackParallel = 2) {
  const id = String(pool?.id || 'general').trim() || 'general';
  const skills = Array.isArray(pool?.skills) && pool.skills.length
    ? pool.skills.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : ['*'];
  const resourceTypes = Array.isArray(pool?.resourceTypes) && pool.resourceTypes.length
    ? pool.resourceTypes.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : ['human', 'ai', 'shared'];
  return {
    id,
    skills,
    resourceTypes,
    maxParallel: clampCapacity(pool?.maxParallel, fallbackParallel),
  };
}

function readResourceConfig(project, fallbackParallel = 2) {
  const file = resourceConfigPath(project);
  if (!project?.path || !fs.existsSync(file)) {
    return defaultResourceConfig(fallbackParallel);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pools = Array.isArray(parsed?.pools) && parsed.pools.length
      ? parsed.pools.map((pool) => normalizePool(pool, fallbackParallel))
      : defaultResourceConfig(fallbackParallel).pools;
    return { pools };
  } catch {
    return defaultResourceConfig(fallbackParallel);
  }
}

function parseResourceFields(task) {
  const assignees = getFrontmatterList(task.source, 'assignee');
  const requiredSkills = getFrontmatterList(task.source, 'required_skills')
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  const resourceType = String(getFrontmatterField(task.source, 'resource_type') || 'human').trim().toLowerCase() || 'human';
  return { assignees, requiredSkills, resourceType };
}

function resolveTaskPool(task, config) {
  const pools = config?.pools || defaultResourceConfig().pools;
  const skills = task.requiredSkills || [];
  const resourceType = task.resourceType || 'human';

  for (const pool of pools) {
    if (!pool.resourceTypes.includes(resourceType) && !pool.resourceTypes.includes('*')) continue;
    if (!skills.length) {
      if (pool.skills.includes('*')) return pool;
      continue;
    }
    if (pool.skills.includes('*')) return pool;
    if (skills.every((skill) => pool.skills.includes(skill))) return pool;
  }

  return pools.find((pool) => pool.id === 'general') || pools[0];
}

function poolRunningCount(running, poolId) {
  return running.filter((item) => item.poolId === poolId).length;
}

function canAcceptTaskWithResources(running, task, lanePolicy, resourceConfig) {
  const lane = taskScheduleLane(task);
  if (!canAcceptTask(running, lane, lanePolicy)) return false;

  const pool = resolveTaskPool(task, resourceConfig);
  if (poolRunningCount(running, pool.id) >= pool.maxParallel) return false;

  const assignees = task.assignees || [];
  if (assignees.length === 1) {
    const assignee = assignees[0];
    const sameAssignee = running.filter((item) => item.primaryAssignee === assignee).length;
    if (sameAssignee >= 1) return false;
  }

  return true;
}

module.exports = {
  resourceConfigPath,
  defaultResourceConfig,
  readResourceConfig,
  parseResourceFields,
  resolveTaskPool,
  canAcceptTaskWithResources,
};
