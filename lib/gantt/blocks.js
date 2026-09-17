'use strict';

const { getFrontmatterField } = require('../task-markdown');
const { parseBooleanField, toDateOnlyIso, dateToStartIaHour } = require('./restrictions');

function parseFieldDate(value) {
  // Parse date field respecting local timezone.
  // IMPORTANT: Apply T00:00:00 format for date-only fields (expected_unblock_date, blocked_until)
  // to ensure local midnight interpretation instead of UTC, which would shift date backward by 1 day
  // in timezones west of UTC. This ensures blocking constraints are enforced on the intended dates.
  // See: lib/gantt/restrictions.js::dateToStartIaHour for working-day normalization that depends on this.
  const input = String(value || '').trim();
  if (!input) return null;
  const normalized = input.includes('T') || input.includes(' ')
    ? input.replace(' ', 'T')
    : `${input}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(value) {
  if (!value) return null;
  return toDateOnlyIso(value);
}

function isBlockedStatus(status) {
  return /^blocked$/i.test(String(status || ''));
}

function resolveExpectedUnblockIso(source) {
  return toIsoDate(parseFieldDate(getFrontmatterField(source, 'expected_unblock_date')))
    || toIsoDate(parseFieldDate(getFrontmatterField(source, 'blocked_until')));
}

function parseBlockFields(task) {
  const blockedFlag = parseBooleanField(getFrontmatterField(task.source, 'blocked'));
  const statusBlocked = isBlockedStatus(task.status);
  const isBlocked = blockedFlag || statusBlocked;
  const expectedUnblockIso = resolveExpectedUnblockIso(task.source);
  const blockedSinceIso = toIsoDate(parseFieldDate(getFrontmatterField(task.source, 'blocked_since')));
  const blockedReason = String(getFrontmatterField(task.source, 'blocked_reason') || '').trim();
  const blockedBy = String(getFrontmatterField(task.source, 'blocked_by') || '').trim();

  let forecastConfidence = 'high';
  if (isBlocked) {
    forecastConfidence = expectedUnblockIso ? 'medium' : 'low';
  }

  return {
    isBlocked,
    blockedSinceIso,
    blockedReason,
    blockedBy,
    expectedUnblockIso,
    forecastConfidence,
  };
}

function buildBlockConstraint(task, calendar) {
  if (!task.isBlocked) {
    return { earliestStartIaHour: 0, drivers: [], forecastConfidence: 'high' };
  }

  const drivers = [{
    code: task.expectedUnblockIso ? 'blocked_until' : 'blocked_open',
    cause: 'block',
    severity: task.expectedUnblockIso ? 'info' : 'warning',
    message: task.blockedReason
      || (task.expectedUnblockIso
        ? `Bloqueada hasta ${task.expectedUnblockIso}`
        : 'Bloqueada sin fecha de desbloqueo (confianza baja)'),
    blockedBy: task.blockedBy || undefined,
    blockedSince: task.blockedSinceIso || undefined,
    expectedUnblock: task.expectedUnblockIso || undefined,
  }];

  let earliestStartIaHour = 0;
  if (task.expectedUnblockIso) {
    earliestStartIaHour = dateToStartIaHour(calendar, task.expectedUnblockIso);
  }

  return {
    earliestStartIaHour,
    drivers,
    forecastConfidence: task.forecastConfidence,
  };
}

module.exports = {
  isBlockedStatus,
  parseBlockFields,
  buildBlockConstraint,
  resolveExpectedUnblockIso,
};
