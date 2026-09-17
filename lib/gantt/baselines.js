'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseStartDate } = require('./calendar');

function baselinesDir(project) {
  return path.join(project.path, 'backlog', 'docs', 'gantt', 'baselines');
}

function baselineFilePath(project, id) {
  const safeId = String(id || '').trim();
  if (!/^bl-[a-z0-9-]+$/i.test(safeId)) {
    throw new Error('id de baseline inválido');
  }
  const dir = baselinesDir(project);
  const file = path.resolve(dir, `${safeId}.json`);
  if (!file.startsWith(`${path.resolve(dir)}${path.sep}`)) {
    throw new Error('ruta de baseline inválida');
  }
  return file;
}

function slugifyBaselineName(name) {
  return String(name || 'baseline')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'baseline';
}

function generateBaselineId(name) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = slugifyBaselineName(name);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `bl-${stamp}-${slug}-${suffix}`;
}

function dayDiffIso(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = parseStartDate(startIso);
  const end = parseStartDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function snapshotTask(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    lane: task.lane,
    startDate: task.startDate,
    endDate: task.endDate,
    startIaHour: task.startIaHour,
    endIaHour: task.endIaHour,
    durationIaHours: task.durationIaHours,
  };
}

function buildBaselineFromPlan(plan, meta = {}) {
  const name = String(meta.name || '').trim();
  if (!name) throw new Error('name es requerido');
  const author = String(meta.author || 'unknown').trim() || 'unknown';
  const id = String(meta.id || generateBaselineId(name)).trim();
  const tasks = [...(plan.tasks || []), ...(plan.doneTimeline || [])].map(snapshotTask);

  return {
    id,
    name,
    author,
    createdAt: new Date().toISOString(),
    project: plan.project,
    parameters: plan.parameters,
    summary: {
      totalTasks: plan.summary?.totalTasks ?? tasks.length,
      pendingTasks: plan.summary?.pendingTasks ?? plan.tasks?.length ?? 0,
      estimatedPendingDays: plan.summary?.estimatedPendingDays ?? 0,
      estimatedPendingIaHours: plan.summary?.estimatedPendingIaHours ?? 0,
      completionRate: plan.summary?.completionRate ?? 0,
    },
    tasks,
  };
}

function writeBaselineAtomic(project, baseline) {
  const dir = baselinesDir(project);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = baselineFilePath(project, baseline.id);
  if (fs.existsSync(filePath)) {
    throw new Error(`baseline ya existe: ${baseline.id} (inmutable)`);
  }
  const payload = `${JSON.stringify(baseline, null, 2)}\n`;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, payload, 'utf8');
  fs.renameSync(tmpPath, filePath);
  return baseline;
}

function readBaselineFile(project, id) {
  const filePath = baselineFilePath(project, id);
  if (!fs.existsSync(filePath)) throw new Error('baseline no encontrada');
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || parsed.id !== id) {
    throw new Error('baseline corrupta o id no coincide');
  }
  return parsed;
}

function listBaselines(project) {
  const dir = baselinesDir(project);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        return {
          id: parsed.id,
          name: parsed.name,
          author: parsed.author,
          createdAt: parsed.createdAt,
          taskCount: Array.isArray(parsed.tasks) ? parsed.tasks.length : 0,
          summary: parsed.summary || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function taskMapFromBaseline(baseline) {
  return new Map((baseline.tasks || []).map((task) => [String(task.id).toLowerCase(), task]));
}

function taskMapFromPlan(plan) {
  const tasks = [...(plan.tasks || []), ...(plan.doneTimeline || [])];
  return new Map(tasks.map((task) => [String(task.id).toLowerCase(), snapshotTask(task)]));
}

function compareBaselineToPlan(baseline, plan) {
  const baseMap = taskMapFromBaseline(baseline);
  const forecastMap = taskMapFromPlan(plan);
  const allIds = [...new Set([...baseMap.keys(), ...forecastMap.keys()])].sort();

  const rows = [];
  let slipped = 0;
  let pulledForward = 0;
  let maxEndSlipDays = 0;

  for (const key of allIds) {
    const baseTask = baseMap.get(key) || null;
    const forecastTask = forecastMap.get(key) || null;
    const id = baseTask?.id || forecastTask?.id || key;
    const delta = {
      startDays: null,
      endDays: null,
      endSlipDays: null,
      startSlipDays: null,
    };

    if (baseTask && forecastTask) {
      delta.startDays = dayDiffIso(baseTask.startDate, forecastTask.startDate);
      delta.endDays = dayDiffIso(baseTask.endDate, forecastTask.endDate);
      delta.endSlipDays = delta.endDays;
      delta.startSlipDays = delta.startDays;
      if (delta.endSlipDays > 0) slipped += 1;
      if (delta.endSlipDays < 0) pulledForward += 1;
      if (delta.endSlipDays != null) maxEndSlipDays = Math.max(maxEndSlipDays, delta.endSlipDays);
    }

    rows.push({
      id,
      title: forecastTask?.title || baseTask?.title || id,
      status: forecastTask?.status || baseTask?.status || '',
      baseline: baseTask,
      forecast: forecastTask,
      delta,
      change: !baseTask ? 'added' : !forecastTask ? 'removed' : (
        delta.endSlipDays > 0 ? 'slipped' : delta.endSlipDays < 0 ? 'pulled_forward' : 'unchanged'
      ),
    });
  }

  const addedTasks = rows.filter((row) => row.change === 'added').map((row) => row.id);
  const removedTasks = rows.filter((row) => row.change === 'removed').map((row) => row.id);

  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    baselineCreatedAt: baseline.createdAt,
    baselineAuthor: baseline.author,
    comparedAt: new Date().toISOString(),
    summary: {
      tasksInBaseline: baseMap.size,
      tasksInForecast: forecastMap.size,
      addedTasks,
      removedTasks,
      slippedTasks: slipped,
      pulledForwardTasks: pulledForward,
      unchangedTasks: rows.filter((row) => row.change === 'unchanged').length,
      maxEndSlipDays,
      forecastEstimatedPendingDays: plan.summary?.estimatedPendingDays ?? null,
      baselineEstimatedPendingDays: baseline.summary?.estimatedPendingDays ?? null,
      pendingDaysDelta: (
        plan.summary?.estimatedPendingDays != null && baseline.summary?.estimatedPendingDays != null
      )
        ? plan.summary.estimatedPendingDays - baseline.summary.estimatedPendingDays
        : null,
    },
    tasks: rows,
  };
}

module.exports = {
  baselinesDir,
  baselineFilePath,
  generateBaselineId,
  buildBaselineFromPlan,
  writeBaselineAtomic,
  readBaselineFile,
  listBaselines,
  compareBaselineToPlan,
  snapshotTask,
};
