'use strict';

const { priorityRank } = require('../task-priority');
const { buildWorkingCalendar, parseStartDate, toDateOnlyIso } = require('./calendar');
const { isDoneStatus, toPlanningTask } = require('./planning-task');
const { criticalPath } = require('./critical-path');
const {
  buildTemporalRestrictionConstraint,
  buildDependencyDrivers,
  evaluateDeadlineViolations,
  summarizeScheduleDiagnostics,
} = require('./restrictions');
const { buildBlockConstraint } = require('./blocks');
const {
  parseCapacityPolicy,
  taskScheduleLane,
  compareOperationalOrder,
  canAcceptTask,
} = require('./capacity-policy');

function isInProgressStatus(status) {
  return /^in progress$/i.test(String(status || ''));
}

function buildProjectGanttFromTasks(tasks, projectMeta, options = {}) {
  const capacityPolicy = parseCapacityPolicy(options.aiCapacityConfig || null, {
    capacity: options.capacity,
    capacityBugs: options.capacityBugs,
    capacityEnhancements: options.capacityEnhancements,
    fallbackCapacity: options.fallbackCapacity ?? 1,
  });
  const capacity = capacityPolicy.total;
  const includeDone = options.includeDone !== false;
  const calendar = buildWorkingCalendar(options);
  const iaHoursPerDay = calendar.iaHoursPerDay;
  const planningTasks = tasks.map((task) => toPlanningTask(task, iaHoursPerDay));
  const doneTasks = planningTasks.filter((task) => isDoneStatus(task.status));
  const pendingTasks = planningTasks.filter((task) => !isDoneStatus(task.status));
  const pendingMap = new Map(pendingTasks.map((task) => [task.id, task]));
  const doneIds = new Set(doneTasks.map((task) => task.id));
  const dependents = new Map();
  const indegree = new Map();

  for (const task of pendingTasks) {
    indegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  for (const task of pendingTasks) {
    const pendingLinks = (task.dependencyLinks || []).filter((dep) => pendingMap.has(dep.id));
    const pendingDeps = [...new Set(pendingLinks.map((dep) => dep.id))];
    task.pendingDependencyLinks = pendingLinks;
    task.pendingDependencies = pendingDeps;
    for (const depId of pendingDeps) {
      indegree.set(task.id, (indegree.get(task.id) || 0) + 1);
      dependents.get(depId).push(task.id);
    }
  }

  const prioritySort = (a, b) => compareOperationalOrder(a, b, priorityRank);

  const running = [];
  const schedule = new Map();
  const completed = new Set();
  let timelineHour = 0;

  const planTask = (task, startIaHour, scheduleMeta = {}) => {
    const endIaHour = startIaHour + task.durationIaHours;
    const startCalendar = calendar.toCalendarMarker(startIaHour);
    const endCalendar = calendar.toCalendarMarker(Math.max(0, endIaHour - 1));
    const startCalendarDay = calendar.dayDiff(calendar.startDate, startCalendar.date);
    const endCalendarDay = calendar.dayDiff(calendar.startDate, endCalendar.date);
    const item = {
      id: task.id,
      title: task.title,
      status: task.status,
      type: task.type,
      priority: task.priority,
      dependencies: task.dependencies,
      dependencyLinks: task.dependencyLinks,
      pendingDependencies: task.pendingDependencies,
      pendingDependencyLinks: task.pendingDependencyLinks,
      durationDays: task.durationDays,
      durationIaHours: task.durationIaHours,
      baselineEstimateIaHours: task.baselineEstimateIaHours,
      remainingIaHours: task.remainingIaHours,
      executedIaHours: task.executedIaHours,
      progress: task.progress,
      progressDeclared: task.progressDeclared,
      progressSuggestedFromChecklist: task.progressSuggestedFromChecklist,
      remainingDeclared: task.remainingDeclared,
      durationSource: task.durationSource,
      isBlocked: task.isBlocked,
      blockedSince: task.blockedSinceIso,
      blockedReason: task.blockedReason,
      blockedBy: task.blockedBy,
      expectedUnblock: task.expectedUnblockIso,
      forecastConfidence: task.forecastConfidence,
      startDay: startCalendar.businessDayIndex,
      endDay: endCalendar.businessDayIndex + 1,
      startIaHour,
      endIaHour,
      startDate: startCalendar.dateIso,
      endDate: endCalendar.dateIso,
      startCalendarDay,
      endCalendarDay,
      startMonth: startCalendar.monthLabel,
      endMonth: endCalendar.monthLabel,
      startHourInDay: startCalendar.hourInDay,
      endHourInDay: endCalendar.hourInDay,
      lane: String(task.type || '').toLowerCase() === 'bug' ? 'bugs' : 'mejoras',
      canRunInParallel: task.pendingDependencies.length === 0
        || (task.pendingDependencyLinks || []).some((dep) => dep.relation === 'SS' || dep.relation === 'FF'),
    };
    const dependencyDrivers = buildDependencyDrivers(task, schedule, pendingMap);
    const violations = evaluateDeadlineViolations(task, item, calendar);
    const operationalDrivers = scheduleMeta.operationalDrivers || [];
    item.diagnostics = summarizeScheduleDiagnostics(
      item,
      [...dependencyDrivers, ...(scheduleMeta.restrictionDrivers || []), ...operationalDrivers],
      violations,
      Boolean(scheduleMeta.capacityDelayed),
    );
    item.scheduleDrivers = item.diagnostics
      .filter((entry) => entry.cause !== 'restriction' || entry.severity !== 'violation')
      .map((entry) => `${entry.cause}:${entry.code}`);
    item.violations = violations;
    schedule.set(task.id, item);
  };

  const dependencyStartConstraint = (task) => {
    let earliestStartIaHour = 0;
    let waitingForPredecessor = false;

    for (const dep of task.pendingDependencyLinks || []) {
      const predecessorSchedule = schedule.get(dep.id);
      if (!predecessorSchedule) {
        waitingForPredecessor = true;
        continue;
      }

      const relation = String(dep.relation || 'FS').toUpperCase();
      const lagIaHours = Number(dep.lagIaHours || 0);
      let relationBound = predecessorSchedule.endIaHour;

      if (relation === 'SS') {
        relationBound = predecessorSchedule.startIaHour + lagIaHours;
      } else if (relation === 'FF') {
        relationBound = predecessorSchedule.endIaHour + lagIaHours - task.durationIaHours;
      } else if (relation === 'SF') {
        relationBound = predecessorSchedule.startIaHour + lagIaHours - task.durationIaHours;
      } else {
        relationBound = predecessorSchedule.endIaHour + lagIaHours;
      }

      earliestStartIaHour = Math.max(earliestStartIaHour, relationBound);
    }

    return {
      earliestStartIaHour: Math.max(0, Math.round(earliestStartIaHour)),
      waitingForPredecessor,
    };
  };

  const startConstraintForTask = (task) => {
    const dependency = dependencyStartConstraint(task);
    const temporal = buildTemporalRestrictionConstraint(task, calendar);
    const block = buildBlockConstraint(task, calendar);
    const earliestStartIaHour = Math.max(
      dependency.earliestStartIaHour,
      temporal.earliestStartIaHour,
      block.earliestStartIaHour,
    );
    return {
      earliestStartIaHour,
      waitingForPredecessor: dependency.waitingForPredecessor,
      restrictionDrivers: [...temporal.drivers, ...block.drivers],
      forecastConfidence: block.forecastConfidence,
    };
  };

  const seedOperationalTask = (task, startIaHour, scheduleMeta = {}) => {
    planTask(task, startIaHour, {
      ...scheduleMeta,
      operationalDrivers: scheduleMeta.operationalDrivers || [{
        code: isInProgressStatus(task.status) ? 'operational_in_progress' : 'operational_seed',
        cause: 'operational',
        message: isInProgressStatus(task.status)
          ? 'Doing consume capacidad al inicio de la proyección'
          : 'Tarea operativa priorizada',
      }],
    });
    const planned = schedule.get(task.id);
    running.push({ id: task.id, endIaHour: planned.endIaHour, lane: planned.lane });
  };

  for (const task of pendingTasks.filter((item) => isInProgressStatus(item.status)).sort(prioritySort)) {
    const constraint = startConstraintForTask(task);
    if (constraint.waitingForPredecessor) continue;
    const chosenStart = Math.max(0, constraint.earliestStartIaHour);
    if (!canAcceptTask(running, taskScheduleLane(task), capacityPolicy)) continue;
    seedOperationalTask(task, chosenStart, { restrictionDrivers: constraint.restrictionDrivers });
  }

  while (completed.size < pendingTasks.length) {
    const finishedNow = running.filter((item) => item.endIaHour <= timelineHour);
    for (const item of finishedNow) {
      completed.add(item.id);
      const index = running.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) running.splice(index, 1);
    }

    let startedThisTick = false;
    let canStartMore = true;

    while (canStartMore) {
      canStartMore = false;
      const unscheduled = pendingTasks
        .filter((task) => !schedule.has(task.id))
        .sort(prioritySort);

      for (const task of unscheduled) {
        const lane = taskScheduleLane(task);
        if (!canAcceptTask(running, lane, capacityPolicy)) continue;
        const constraint = startConstraintForTask(task);
        if (constraint.waitingForPredecessor) continue;
        if (timelineHour < constraint.earliestStartIaHour) continue;

        const chosenStart = Math.max(timelineHour, constraint.earliestStartIaHour);
        const capacityDelayed = chosenStart > constraint.earliestStartIaHour && timelineHour > constraint.earliestStartIaHour;
        planTask(task, chosenStart, {
          restrictionDrivers: constraint.restrictionDrivers,
          capacityDelayed,
        });
        const plannedTask = schedule.get(task.id);
        running.push({ id: task.id, endIaHour: plannedTask.endIaHour, lane: plannedTask.lane });
        startedThisTick = true;
        canStartMore = true;
        break;
      }
    }

    if (completed.size >= pendingTasks.length) break;

    if (running.length === 0 && !startedThisTick) {
      let nextHour = Number.POSITIVE_INFINITY;
      for (const task of pendingTasks) {
        if (schedule.has(task.id)) continue;
        const constraint = startConstraintForTask(task);
        if (constraint.waitingForPredecessor) continue;
        if (constraint.earliestStartIaHour > timelineHour) {
          nextHour = Math.min(nextHour, constraint.earliestStartIaHour);
        }
      }

      if (Number.isFinite(nextHour)) {
        timelineHour = nextHour;
        continue;
      }

      break;
    }

    timelineHour += 1;
  }

  const unresolved = pendingTasks.filter((task) => !schedule.has(task.id));
  for (const task of unresolved.sort(prioritySort)) {
    const temporal = buildTemporalRestrictionConstraint(task, calendar);
    planTask(task, timelineHour, { restrictionDrivers: temporal.drivers });
  }

  const planned = [...schedule.values()].sort((a, b) => a.startDay - b.startDay || priorityRank(a.priority) - priorityRank(b.priority));
  const allViolations = planned.flatMap((item) => item.violations || []);
  const byStartHour = new Map();
  for (const item of planned) {
    if (!byStartHour.has(item.startIaHour)) byStartHour.set(item.startIaHour, []);
    byStartHour.get(item.startIaHour).push(item.id);
  }

  const parallelGroups = [...byStartHour.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([startIaHour, ids]) => {
      const marker = calendar.toCalendarMarker(startIaHour);
      return {
        startIaHour,
        startDay: marker.businessDayIndex,
        startDate: marker.dateIso,
        ids,
      };
    });

  const critical = criticalPath(pendingTasks, dependents, pendingMap);
  const total = planningTasks.length;
  const done = doneTasks.length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const doneTimeline = includeDone
    ? doneTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      durationDays: task.durationDays,
      durationIaHours: task.durationIaHours,
      startDay: 0,
      endDay: task.durationDays,
      startIaHour: 0,
      endIaHour: task.durationIaHours,
      startDate: calendar.startDateIso,
      endDate: calendar.startDateIso,
      lane: String(task.type || '').toLowerCase() === 'bug' ? 'bugs' : 'mejoras',
      completedAt: task.updatedDate ? task.updatedDate.toISOString() : null,
    }))
    : [];

  const dependencyEdges = pendingTasks.flatMap((task) =>
    (task.pendingDependencyLinks || []).map((dep) => ({
      fromId: dep.id,
      toId: task.id,
      relation: dep.relation,
      fromAnchor: dep.fromAnchor,
      toAnchor: dep.toAnchor,
      lagBusinessDays: dep.lagBusinessDays,
      lagIaHours: dep.lagIaHours,
      sequential: dep.sequential,
    }))
  );

  const monthMarkers = [];
  const maxHour = planned.reduce((max, item) => Math.max(max, item.endIaHour), 0);
  const preCalendarPaddingDays = 120;
  const maxCalendarDate = planned.reduce((max, task) => {
    const end = parseStartDate(task.endDate);
    return end > max ? end : max;
  }, parseStartDate(calendar.startDateIso));
  const totalCalendarDays = Math.max(180, calendar.dayDiff(calendar.startDate, maxCalendarDate) + 1 + preCalendarPaddingDays);
  const dayMarkers = [];
  for (let dayIndex = 0; dayIndex < totalCalendarDays; dayIndex += 1) {
    const date = new Date(calendar.startDate);
    date.setDate(calendar.startDate.getDate() + dayIndex - preCalendarPaddingDays);
    const isWorking = calendar.isWorkingDay(date);
    const iso = toDateOnlyIso(date);
    dayMarkers.push({
      dayIndex,
      date: iso,
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      dayLabel: date.toLocaleDateString('es-CO', { weekday: 'short' }),
      dayNumber: date.getDate(),
      isWorking,
      isSaturday: date.getDay() === 6,
      isSunday: date.getDay() === 0,
      isHoliday: calendar.holidays.includes(iso),
    });
  }

  for (const task of planned) {
    task.startCalendarDay += preCalendarPaddingDays;
    task.endCalendarDay += preCalendarPaddingDays;
  }
  const seenMonths = new Set();
  for (const marker of dayMarkers) {
    if (seenMonths.has(marker.monthKey)) continue;
    seenMonths.add(marker.monthKey);
    monthMarkers.push({
      monthKey: marker.monthKey,
      monthLabel: marker.monthLabel,
      atIaHour: marker.dayIndex * iaHoursPerDay,
      atBusinessDay: marker.dayIndex,
      atCalendarDay: marker.dayIndex,
      date: marker.date,
    });
  }

  return {
    project: { slug: projectMeta.slug, name: projectMeta.name },
    parameters: {
      capacity,
      capacityPolicy,
      operationalPolicy: {
        doingFirst: true,
        queueByOrdinal: true,
        order: ['In Progress', 'Queued', 'To Do'],
      },
      includeDone,
      iaHoursPerDay,
      startDate: calendar.startDateIso,
      holidays: calendar.holidays,
      workOnSaturday: calendar.workOnSaturday,
    },
    summary: {
      totalTasks: total,
      doneTasks: done,
      pendingTasks: pendingTasks.length,
      completionRate,
      estimatedPendingIaHours: planned.reduce((max, item) => Math.max(max, item.endIaHour), 0),
      estimatedPendingDays: planned.reduce((max, item) => Math.max(max, item.endDay), 0),
      blockedByDependencies: pendingTasks.filter((task) => task.pendingDependencies.length > 0).length,
      unresolvedDependencies: pendingTasks.filter((task) =>
        (task.dependencyLinks || []).some((dep) => !pendingMap.has(dep.id) && !doneIds.has(dep.id))
      ).length,
      cycleDetected: unresolved.length > 0,
      deadlineViolations: allViolations.filter((item) => item.code === 'deadline_missed').length,
      restrictionViolations: allViolations.length,
      blockedTasks: pendingTasks.filter((task) => task.isBlocked).length,
      lowConfidenceForecasts: planned.filter((item) => item.forecastConfidence === 'low').length,
    },
    criticalPath: critical,
    parallelGroups,
    dependencyEdges,
    monthMarkers,
    dayMarkers,
    tasks: planned,
    doneTimeline,
    generatedAt: new Date().toISOString(),
  };
}

function buildProjectGantt(project, options, loadTasks) {
  const tasks = loadTasks(project);
  return buildProjectGanttFromTasks(tasks, { slug: project.slug, name: project.name }, options);
}

module.exports = { buildProjectGantt, buildProjectGanttFromTasks };
