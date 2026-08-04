'use strict';

function queuedLaneTasks(tasks, laneFilter) {
  return tasks.filter(
    (task) => task.status.toLowerCase() === 'queued' && laneFilter(task),
  );
}

function sortQueuedTasks(tasks) {
  return [...tasks].sort(
    (a, b) => (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER)
      || String(a.title || '').localeCompare(String(b.title || ''), 'es'),
  );
}

function activeLaneTasks(tasks, laneFilter) {
  return tasks.filter(
    (task) => /^in progress$/i.test(task.status) && laneFilter(task),
  );
}

function laneQueueState(tasks, laneFilter) {
  const queued = sortQueuedTasks(queuedLaneTasks(tasks, laneFilter));
  const active = activeLaneTasks(tasks, laneFilter);
  const next = active.length ? null : (queued[0] || null);
  return {
    active: active[0] || null,
    activeCount: active.length,
    queued,
    next,
    queueLength: queued.length,
  };
}

function bugQueueState(tasks, isBugTask) {
  return laneQueueState(tasks, isBugTask);
}

function buildBugRunInstruction(task, project) {
  const lines = [
    `Atiende ${task.id}: ${task.title}`,
    '',
    'Corrige el bug en el repositorio del proyecto, prueba los cambios, audita con Pharos y despliega solo si pasa.',
    'Al terminar: marca la tarea Done en el Kanban (o ejecuta `npm run queue:complete -- <project> ${task.id}`).',
    '',
    `Proyecto: ${project.name} (${project.slug})`,
    `Ruta: ${project.path}`,
  ];
  if (task.file) lines.push(`Backlog: backlog/${task.file}`);
  return lines.join('\n');
}

function bugRunPacket(task, project) {
  const instruction = buildBugRunInstruction(task, project);
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    file: task.file,
    project: project.slug,
    projectPath: project.path,
    instruction,
    claimedAt: new Date().toISOString(),
  };
}

module.exports = {
  sortQueuedTasks,
  queuedLaneTasks,
  activeLaneTasks,
  laneQueueState,
  bugQueueState,
  buildBugRunInstruction,
  bugRunPacket,
};
