import { getSchedule } from './schedule.mjs';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Match the years with U.S. cash holiday schedules in schedule.mjs.
const cashCalendarYears = [2026, 2027, 2028];
const newYorkCalendar = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
});

function newYorkDay(instant) {
  const parts = Object.fromEntries(newYorkCalendar.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function dateKey(day) {
  return new Date(day).toISOString().slice(0, 10);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const day = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(day) && dateKey(day) === value ? day : NaN;
}

function cashClose(day) {
  const date = new Date(day);
  if (!cashCalendarYears.includes(date.getUTCFullYear()) || [0, 6].includes(date.getUTCDay())) return null;
  // 16:00 UTC falls inside the U.S. cash session even on a 1 p.m. ET early close.
  const { active } = getSchedule(new Date(day + 16 * HOUR), { kind: 'equities' });
  return active.find(session => session.id === 'us-equities')?.end ?? null;
}

function periodEnds(horizon, today) {
  const date = new Date(today);
  if (horizon === 'week') {
    const weekday = (date.getUTCDay() + 6) % 7;
    const friday = today + (4 - weekday) * DAY;
    return [friday, friday + 7 * DAY];
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return [Date.UTC(year, month + 1, 0), Date.UTC(year, month + 2, 0)];
}

function upcomingClose(firstDay, lastDay, now) {
  if (!cashCalendarYears.includes(new Date(lastDay).getUTCFullYear())) return null;
  for (let day = lastDay; day >= firstDay; day -= DAY) {
    const exitAt = cashClose(day);
    if (exitAt && exitAt > now) return { day, exitAt };
  }
  return null;
}

export function getHedgeHorizon(horizon, now = new Date(), customDate) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const today = newYorkDay(now);
  if (horizon === 'custom') {
    const day = parseDate(customDate);
    if (!Number.isFinite(day) || day < today) return null;
    const exitAt = cashClose(day);
    return exitAt && exitAt > now ? { exitDate: customDate, exitAt, calendarDays: (day - today) / DAY } : null;
  }
  if (horizon !== 'week' && horizon !== 'month') return null;

  const [currentEnd, nextEnd] = periodEnds(horizon, today);
  const result = upcomingClose(today, currentEnd, now)
    ?? upcomingClose(Math.max(today, currentEnd + DAY), nextEnd, now);
  return result && { exitDate: dateKey(result.day), exitAt: result.exitAt, calendarDays: (result.day - today) / DAY };
}
