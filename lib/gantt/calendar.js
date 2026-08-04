'use strict';

function parseHolidayList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date, deltaDays) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + deltaDays);
  return shifted;
}

function moveToMondayDate(date) {
  const moved = new Date(date);
  while (moved.getDay() !== 1) moved.setDate(moved.getDate() + 1);
  return moved;
}

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function colombiaHolidaysByYear(year) {
  const fixed = [
    new Date(year, 0, 1),
    new Date(year, 4, 1),
    new Date(year, 6, 20),
    new Date(year, 7, 7),
    new Date(year, 11, 8),
    new Date(year, 11, 25),
  ];

  const emiliani = [
    moveToMondayDate(new Date(year, 0, 6)),
    moveToMondayDate(new Date(year, 2, 19)),
    moveToMondayDate(new Date(year, 5, 29)),
    moveToMondayDate(new Date(year, 7, 15)),
    moveToMondayDate(new Date(year, 9, 12)),
    moveToMondayDate(new Date(year, 10, 1)),
    moveToMondayDate(new Date(year, 10, 11)),
  ];

  const easter = easterDate(year);
  const easterBased = [
    shiftDate(easter, -3),
    shiftDate(easter, -2),
    moveToMondayDate(shiftDate(easter, 43)),
    moveToMondayDate(shiftDate(easter, 64)),
    moveToMondayDate(shiftDate(easter, 71)),
  ];

  return [...fixed, ...emiliani, ...easterBased].map((date) => formatIsoDate(date));
}

function colombiaHolidaysAround(startDate) {
  const year = startDate.getFullYear();
  return [...new Set([...colombiaHolidaysByYear(year), ...colombiaHolidaysByYear(year + 1)])];
}

function toDateOnlyIso(date) {
  return formatIsoDate(date);
}

function parseStartDate(value) {
  const input = String(value || '').trim();
  if (!input) return new Date();
  const date = new Date(`${input}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildWorkingCalendar(options = {}) {
  const today = parseStartDate(options.startDate);
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const iaHoursPerDay = Math.max(1, Math.min(24, Number(options.iaHoursPerDay) || 8));
  const workOnSaturday = options.workOnSaturday === true;
  const holidaySet = new Set([
    ...colombiaHolidaysAround(startDate),
    ...parseHolidayList(options.holidays),
  ]);

  const dayDiff = (from, to) => {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  };

  const isWorkingDay = (date) => {
    const day = date.getDay();
    if (day === 0) return false;
    if (!workOnSaturday && day === 6) return false;
    return !holidaySet.has(toDateOnlyIso(date));
  };

  const toCalendarMarker = (hourOffset) => {
    const safeOffset = Math.max(0, Number(hourOffset) || 0);
    let remaining = safeOffset;
    let businessDayIndex = 0;
    const cursor = new Date(startDate);

    while (!isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);

    while (remaining >= iaHoursPerDay) {
      remaining -= iaHoursPerDay;
      do {
        cursor.setDate(cursor.getDate() + 1);
      } while (!isWorkingDay(cursor));
      businessDayIndex += 1;
    }

    return {
      date: new Date(cursor),
      dateIso: toDateOnlyIso(cursor),
      monthKey: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: cursor.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      businessDayIndex,
      hourInDay: remaining,
      calendarDayOfWeek: cursor.getDay(),
    };
  };

  return {
    startDateIso: toDateOnlyIso(startDate),
    startDate,
    iaHoursPerDay,
    workOnSaturday,
    holidays: [...holidaySet],
    isWorkingDay,
    dayDiff,
    toCalendarMarker,
  };
}

module.exports = {
  parseHolidayList,
  parseStartDate,
  toDateOnlyIso,
  buildWorkingCalendar,
  colombiaHolidaysAround,
};
