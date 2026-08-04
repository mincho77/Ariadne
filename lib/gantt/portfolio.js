'use strict';

const { getFrontmatterList } = require('../task-markdown');
const { effectiveCapacityFromConfig } = require('./capacity-policy');
const { buildHubGanttMetrics, maxEndDateIso } = require('./hub-metrics');

const CROSS_PROJECT_DEP_RE = /^([a-z0-9][a-z0-9-]*)[:@|]([A-Za-z0-9][A-Za-z0-9-]*)(?:[:|@](FS|SS|FF|SF)([+-]\d+(?:[dh])?)?)?$/i;

function parseCrossProjectDependency(raw, ownerSlug, knownSlugs) {
  const value = String(raw || '').trim();
  const match = value.match(CROSS_PROJECT_DEP_RE);
  if (!match) return null;

  const refSlug = String(match[1] || '').toLowerCase();
  const owner = String(ownerSlug || '').toLowerCase();
  if (!refSlug || refSlug === owner) return null;
  if (!knownSlugs.has(refSlug)) return null;

  return {
    fromProjectSlug: refSlug,
    fromTaskId: String(match[2] || '').trim(),
    relation: String(match[3] || 'FS').toUpperCase(),
    lagToken: String(match[4] || '').trim() || null,
    raw: value,
  };
}

function collectCrossProjectDependencies(tasks, projectSlug, knownSlugs) {
  const edges = [];
  for (const task of tasks || []) {
    const source = String(task.source || '');
    if (!source) continue;
    const dependencies = getFrontmatterList(source, 'dependencies');
    for (const dep of dependencies) {
      const cross = parseCrossProjectDependency(dep, projectSlug, knownSlugs);
      if (!cross) continue;
      edges.push({
        toProjectSlug: projectSlug,
        toTaskId: task.id,
        toTaskTitle: task.title,
        fromProjectSlug: cross.fromProjectSlug,
        fromTaskId: cross.fromTaskId,
        relation: cross.relation,
        lagToken: cross.lagToken,
        raw: cross.raw,
      });
    }
  }
  return edges;
}

function buildProjectRiskFlags(metrics, planSummary) {
  const flags = [];
  if (metrics?.cycleDetected) flags.push('cycle_detected');
  if ((metrics?.deadlineAtRisk || 0) > 0) flags.push('deadline_at_risk');
  if ((metrics?.blockedTasks || 0) > 0) flags.push('blocked_tasks');
  if ((metrics?.blockedWithoutUnblockDate || 0) > 0) flags.push('blocked_without_unblock');
  if ((metrics?.lowConfidenceTasks || 0) > 0) flags.push('low_confidence');
  if ((metrics?.unresolvedDependencies || 0) > 0) flags.push('unresolved_dependencies');
  if (metrics?.forecastConfidence === 'low') flags.push('aggregate_low_confidence');
  if ((planSummary?.criticalSlackTasks || 0) > 0) flags.push('critical_slack');
  return flags;
}

function buildGanttPortfolio(catalog, ganttOptions, adapters = {}) {
  const {
    buildProjectGantt,
    buildProjectGanttMetrics,
    projectTasks,
    readAiCapacityConfig,
    projectExists,
  } = adapters;

  if (typeof buildProjectGantt !== 'function' || typeof projectTasks !== 'function') {
    throw new Error('buildGanttPortfolio requires buildProjectGantt and projectTasks adapters');
  }

  const projectsInput = Array.isArray(catalog) ? catalog : [];
  const knownSlugs = new Set(
    projectsInput.map((item) => String(item.slug || '').toLowerCase()).filter(Boolean),
  );

  const projects = [];
  const milestones = [];
  const crossProjectDependencies = [];
  const sharedCapacity = [];
  const risks = [];

  let latestForecastFinish = null;
  let atRiskProjects = 0;

  for (const project of projectsInput) {
    const slug = project.slug;
    const exists = projectExists ? projectExists(project) : true;
    if (!exists) {
      projects.push({
        slug,
        name: project.name,
        path: project.path,
        available: false,
        error: 'path missing',
      });
      continue;
    }

    try {
      const plan = buildProjectGantt(project, ganttOptions);
      const metrics = typeof buildProjectGanttMetrics === 'function'
        ? buildProjectGanttMetrics(project, ganttOptions)
        : buildHubGanttMetrics(plan);
      const tasks = projectTasks(project);
      const crossEdges = collectCrossProjectDependencies(tasks, slug, knownSlugs);
      crossProjectDependencies.push(...crossEdges);

      const riskFlags = buildProjectRiskFlags(metrics, plan.summary);
      if (riskFlags.length) {
        atRiskProjects += 1;
        risks.push({
          projectSlug: slug,
          projectName: project.name,
          flags: riskFlags,
          forecastConfidence: metrics.forecastConfidence,
          forecastFinishDate: metrics.forecastFinishDate,
        });
      }

      for (const item of plan.milestones || []) {
        milestones.push({
          ...item,
          projectSlug: slug,
          projectName: project.name,
          compositeId: `${slug}:${item.id}`,
        });
      }

      const capConfig = typeof readAiCapacityConfig === 'function'
        ? readAiCapacityConfig(project)
        : null;
      const effectiveCapacity = effectiveCapacityFromConfig(
        capConfig,
        plan.parameters?.capacity ?? ganttOptions?.capacity ?? 2,
      );
      sharedCapacity.push({
        projectSlug: slug,
        projectName: project.name,
        effectiveCapacity,
        capacityPolicy: plan.parameters?.capacityPolicy || null,
        resourceAware: Boolean(plan.parameters?.resourceAware),
      });

      const finish = metrics.forecastFinishDate || maxEndDateIso(plan.tasks);
      if (finish && (!latestForecastFinish || finish > latestForecastFinish)) {
        latestForecastFinish = finish;
      }

      projects.push({
        slug,
        name: project.name,
        path: project.path,
        available: true,
        metrics,
        summary: {
          pendingTasks: plan.summary?.pendingTasks ?? null,
          estimatedPendingDays: plan.summary?.estimatedPendingDays ?? null,
          milestoneCount: plan.summary?.milestoneCount ?? 0,
          criticalSlackTasks: plan.summary?.criticalSlackTasks ?? 0,
        },
        riskFlags,
        crossProjectDependencyCount: crossEdges.length,
      });
    } catch (error) {
      projects.push({
        slug,
        name: project.name,
        path: project.path,
        available: false,
        error: error.message,
      });
      risks.push({
        projectSlug: slug,
        projectName: project.name,
        flags: ['plan_error'],
        error: error.message,
      });
      atRiskProjects += 1;
    }
  }

  milestones.sort((a, b) => {
    const ad = a.endDate || a.startDate || '';
    const bd = b.endDate || b.startDate || '';
    return ad.localeCompare(bd);
  });

  const taskIndex = new Map();
  for (const project of projectsInput) {
    if (!project?.slug) continue;
    try {
      for (const task of projectTasks(project)) {
        taskIndex.set(`${String(project.slug).toLowerCase()}:${String(task.id).toUpperCase()}`, {
          projectSlug: project.slug,
          id: task.id,
          title: task.title,
          status: task.status,
        });
      }
    } catch {
      // ignore unreadable project tasks
    }
  }

  const unresolvedCross = crossProjectDependencies.filter((edge) => {
    const key = `${edge.fromProjectSlug}:${String(edge.fromTaskId).toUpperCase()}`;
    return !taskIndex.has(key);
  });

  return {
    generatedAt: new Date().toISOString(),
    parameters: ganttOptions,
    summary: {
      projectCount: projectsInput.length,
      availableProjects: projects.filter((row) => row.available).length,
      atRiskProjects,
      milestoneCount: milestones.length,
      crossProjectDependencies: crossProjectDependencies.length,
      unresolvedCrossProjectDependencies: unresolvedCross.length,
      latestForecastFinish,
      aggregateEffectiveCapacity: sharedCapacity.reduce(
        (sum, row) => sum + (row.effectiveCapacity || 0),
        0,
      ),
    },
    projects,
    milestones,
    crossProjectDependencies,
    unresolvedCrossProjectDependencies: unresolvedCross,
    sharedCapacity,
    risks,
  };
}

module.exports = {
  CROSS_PROJECT_DEP_RE,
  parseCrossProjectDependency,
  collectCrossProjectDependencies,
  buildGanttPortfolio,
};
