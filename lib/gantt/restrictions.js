'use strict';

const { parseStartDate, toDateOnlyIso } = require('./calendar');

function parseBooleanField(value) {
  if (typeof value === 'boolean') return value;
  const key = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'si', 'sí'].includes(key);
}

function dateToStartIaHour(calendar, isoDate) {
  const target = parseStartDate(isoDate);
  const anchor = calendar.startDate;
  if (target <= anchor) return 0;

  let iaHour = 0;
  let cursor = new Date(anchor);
  while (calendar.dayDiff(cursor, target) > 0) {
    if (calendar.isWorkingDay(cursor)) iaHour += calendar.iaHoursPerDay;
    cursor.setDate(cursor.getDate() + 1);
  }

  let startDay = new Date(target);
  while (!calendar.isWorkingDay(startDay)) startDay.setDate(startDay.getDate() + 1);
  if (startDay.getTime() !== target.getTime()) {
    let walk = new Date(target);
    while (walk < startDay) {
      if (calendar.isWorkingDay(walk)) iaHour += calendar.iaHoursPerDay;
      walk.setDate(walk.getDate() + 1);
    }
  }
  return iaHour;
}

function dateToEndIaHour(calendar, isoDate) {
  return dateToStartIaHour(calendar, isoDate) + calendar.iaHoursPerDay;
}

function buildTemporalRestrictionConstraint(task, calendar) {
  const drivers = [];
  let earliestStartIaHour = 0;

  if (task.notBeforeIso) {
    const bound = dateToStartIaHour(calendar, task.notBeforeIso);
    if (bound > earliestStartIaHour) {
      earliestStartIaHour = bound;
      drivers.push({
        code: 'not_before',
        cause: 'restriction',
        date: task.notBeforeIso,
        message: `No puede iniciar antes de ${task.notBeforeIso}`,
      });
    }
  }

  if (task.fixed && task.plannedStartIso) {
    const bound = dateToStartIaHour(calendar, task.plannedStartIso);
    earliestStartIaHour = bound;
    drivers.push({
      code: 'fixed_start',
      cause: 'restriction',
      date: task.plannedStartIso,
      message: `Inicio fijado en ${task.plannedStartIso}`,
    });
  } else if (task.plannedStartIso) {
    const bound = dateToStartIaHour(calendar, task.plannedStartIso);
    if (bound > earliestStartIaHour) {
      earliestStartIaHour = bound;
      drivers.push({
        code: 'planned_start',
        cause: 'restriction',
        date: task.plannedStartIso,
        message: `Inicio planeado desde ${task.plannedStartIso}`,
      });
    }
  }

  return { earliestStartIaHour, drivers };
}

function buildDependencyDrivers(task, schedule, pendingMap) {
  const drivers = [];
  for (const dep of task.pendingDependencyLinks || []) {
    const predecessor = schedule.get(dep.id);
    if (!predecessor) {
      if (!pendingMap.has(dep.id)) {
        drivers.push({
          code: 'dependency_unresolved',
          cause: 'dependency',
          predecessorId: dep.id,
          relation: dep.relation || 'FS',
          message: `Predecesora ${dep.id} no encontrada en el plan`,
        });
      }
      continue;
    }
    drivers.push({
      code: `dependency_${String(dep.relation || 'FS').toLowerCase()}`,
      cause: 'dependency',
      predecessorId: dep.id,
      relation: dep.relation || 'FS',
      lagIaHours: dep.lagIaHours || 0,
      message: `Restricción ${dep.relation || 'FS'} con ${dep.id}`,
    });
  }
  return drivers;
}

function evaluateDeadlineViolations(task, scheduledItem, calendar) {
  const violations = [];
  const deadlineIso = task.deadlineIso || task.targetFinishIso;
  if (!deadlineIso || !scheduledItem?.endDate) return violations;

  const endDate = parseStartDate(scheduledItem.endDate);
  const deadlineDate = parseStartDate(deadlineIso);
  if (endDate > deadlineDate) {
    violations.push({
      code: 'deadline_missed',
      cause: 'restriction',
      severity: 'violation',
      deadline: deadlineIso,
      endDate: scheduledItem.endDate,
      message: `Termina ${scheduledItem.endDate} después del deadline ${deadlineIso}`,
    });
  }

  if (task.fixed && task.plannedFinishIso && scheduledItem.endDate !== task.plannedFinishIso) {
    violations.push({
      code: 'fixed_finish_mismatch',
      cause: 'restriction',
      severity: 'violation',
      plannedFinish: task.plannedFinishIso,
      endDate: scheduledItem.endDate,
      message: `Fin planificado fijo ${task.plannedFinishIso} difiere del pronóstico ${scheduledItem.endDate}`,
    });
  }

  return violations;
}

function summarizeScheduleDiagnostics(scheduledItem, drivers, violations, capacityDelayed) {
  const diagnostics = [...drivers];
  if (capacityDelayed) {
    diagnostics.push({
      code: 'capacity_wait',
      cause: 'capacity',
      message: 'Esperó slot de capacidad paralela',
    });
  }
  diagnostics.push(...violations);
  return diagnostics;
}

module.exports = {
  parseBooleanField,
  dateToStartIaHour,
  dateToEndIaHour,
  buildTemporalRestrictionConstraint,
  buildDependencyDrivers,
  evaluateDeadlineViolations,
  summarizeScheduleDiagnostics,
  toDateOnlyIso,
};
