'use strict';

const CONTRACT_VERSION = '1.0';

const FRONTEND_REPO = String(
  process.env.ARIADNE_GANTT_UI_REPO || 'https://github.com/repoxai/frontend-angular',
).trim();

const FRONTEND_DEFAULT_PORT = Number(process.env.ARIADNE_GANTT_UI_PORT || 63447);

const REQUIRED_PLAN_KEYS = [
  'project',
  'parameters',
  'summary',
  'tasks',
  'dependencyEdges',
  'criticalPath',
  'dayMarkers',
  'generatedAt',
];

const REQUIRED_SUMMARY_KEYS = [
  'totalTasks',
  'pendingTasks',
  'estimatedPendingDays',
  'cycleDetected',
  'unresolvedDependencies',
];

const REQUIRED_TASK_KEYS = [
  'id',
  'title',
  'status',
  'startDate',
  'endDate',
  'startIaHour',
  'endIaHour',
  'durationIaHours',
  'lane',
];

const UI_OPTIONAL_PLAN_KEYS = [
  'milestones',
  'hierarchy',
  'doneTimeline',
  'parallelGroups',
  'monthMarkers',
];

function buildGanttLaunchUrl(ganttBaseUrl, projectSlug, query = {}) {
  const url = new URL(String(ganttBaseUrl || `http://localhost:${FRONTEND_DEFAULT_PORT}/`));
  url.searchParams.set('project', String(projectSlug || '').trim());
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildHubGanttUiConfig({ hubApiBase, ganttBaseUrl, hubPort, boardPort } = {}) {
  const apiBase = hubApiBase || `http://127.0.0.1:${hubPort || 4177}`;
  const uiBase = String(ganttBaseUrl || `http://localhost:${FRONTEND_DEFAULT_PORT}/`);

  return {
    contractVersion: CONTRACT_VERSION,
    frontend: {
      repoUrl: FRONTEND_REPO,
      defaultPort: FRONTEND_DEFAULT_PORT,
      launchUrlTemplate: `${uiBase}?project={slug}`,
      blockedInWorkspace: true,
      blockId: 'AGANTT-DEF-01',
      blockReason: 'El frontend Angular vive en un repo externo; este workspace entrega contrato API y smoke Hub→backend.',
      docs: 'docs/gantt-ui-integration.md',
    },
    hubApiBase: apiBase,
    ganttBaseUrl: uiBase,
    hubPort,
    boardPort,
    cors: {
      allowOrigin: '*',
      allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowHeaders: ['content-type', 'if-match'],
    },
    endpoints: {
      hubConfig: { method: 'GET', path: '/api/hub-config' },
      ganttPlan: { method: 'GET', path: '/api/projects/{slug}/gantt' },
      taskPatch: { method: 'PATCH', path: '/api/projects/{slug}/tasks/{id}', headers: ['If-Match'] },
      taskDependencies: { method: 'POST', path: '/api/projects/{slug}/tasks/dependencies' },
      baselinesList: { method: 'GET', path: '/api/projects/{slug}/gantt/baselines' },
      baselinesCreate: { method: 'POST', path: '/api/projects/{slug}/gantt/baselines' },
      baselineCompare: { method: 'GET', path: '/api/projects/{slug}/gantt/baselines/{id}/compare' },
      aiCapacity: { method: 'GET', path: '/api/projects/{slug}/ai-capacity-config' },
    },
    uiViews: {
      table: 'tasks[] + hierarchy.nodes',
      timeline: 'tasks[] + dayMarkers + dependencyEdges',
      milestones: 'milestones[]',
      diagnostics: 'tasks[].diagnostics + tasks[].violations',
    },
    editFlows: {
      temporalFields: {
        method: 'PATCH',
        path: '/api/projects/{slug}/tasks/{id}',
        lock: 'If-Match sourceHash',
        docs: 'docs/gantt-temporal-model.md',
      },
      dependencies: {
        method: 'POST',
        path: '/api/projects/{slug}/tasks/dependencies',
        docs: 'docs/gantt-planner-contract.md',
      },
    },
    requiredPlanKeys: REQUIRED_PLAN_KEYS,
    optionalPlanKeys: UI_OPTIONAL_PLAN_KEYS,
  };
}

function validateGanttPlanForUi(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['plan must be an object'] };
  }

  for (const key of REQUIRED_PLAN_KEYS) {
    if (!(key in plan)) errors.push(`missing plan.${key}`);
  }

  if (plan.summary && typeof plan.summary === 'object') {
    for (const key of REQUIRED_SUMMARY_KEYS) {
      if (!(key in plan.summary)) errors.push(`missing plan.summary.${key}`);
    }
  } else if (plan.summary == null) {
    errors.push('missing plan.summary');
  }

  if (Array.isArray(plan.tasks)) {
    for (const task of plan.tasks) {
      for (const key of REQUIRED_TASK_KEYS) {
        if (task[key] == null || task[key] === '') errors.push(`task ${task.id || '?'} missing ${key}`);
      }
    }
  } else {
    errors.push('plan.tasks must be an array');
  }

  if (plan.dependencyEdges != null && !Array.isArray(plan.dependencyEdges)) {
    errors.push('plan.dependencyEdges must be an array');
  }

  if (plan.milestones != null && !Array.isArray(plan.milestones)) {
    errors.push('plan.milestones must be an array');
  }

  if (plan.hierarchy != null) {
    if (!Array.isArray(plan.hierarchy.roots)) errors.push('plan.hierarchy.roots must be an array');
    if (!plan.hierarchy.nodes || typeof plan.hierarchy.nodes !== 'object') {
      errors.push('plan.hierarchy.nodes must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  CONTRACT_VERSION,
  FRONTEND_REPO,
  FRONTEND_DEFAULT_PORT,
  buildGanttLaunchUrl,
  buildHubGanttUiConfig,
  validateGanttPlanForUi,
};
