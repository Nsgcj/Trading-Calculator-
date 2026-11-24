import { DEFAULT_INSTRUMENTS } from './engine.mjs';

const UTC = 'UTC';
const NEW_YORK = 'America/New_York';
const CHICAGO = 'America/Chicago';
const DAY = 24 * 60 * 60 * 1000;
const weekdays = [1, 2, 3, 4, 5];
const instruments = new Map(DEFAULT_INSTRUMENTS.map(({ id, symbol, name }) => [id, { id, symbol, name }]));
const assets = (...ids) => ids.map(id => instruments.get(id));

export const SCHEDULE_SOURCES = [
  { label: 'OANDA · FX sessions and overlaps', url: 'https://www.oanda.com/us-en/skills-and-insights/education/trading-asset-classes/forex/when-is-the-best-time-for-forex-trading/' },
  { label: 'OANDA · FX trading hours', url: 'https://www.oanda.com/us-en/trading/hours-of-operation/' },
  { label: 'NYSE · Core hours and holidays', url: 'https://www.nyse.com/trade/hours-calendars' },
  { label: 'Nasdaq · Stock market calendar', url: 'https://www.nasdaq.com/market-activity/stock-market-holiday-schedule' },
  { label: 'CME Group · Equity index futures hours', url: 'https://www.cmegroup.com/markets/equities/sp-500-and-nasdaq-100-futures.html' },
  { label: 'CME Group · WTI crude oil futures hours', url: 'https://www.cmegroup.com/education/courses/event-contracts-underlying-markets/wti-overview.html' },
  { label: 'CME Group · Henry Hub futures hours', url: 'https://www.cmegroup.com/articles/faqs/micro-henry-hub-natural-gas-futures-and-options-frequently-asked-questions.html' },
  { label: 'CME Group · Micro metals futures hours', url: 'https://www.cmegroup.com/markets/microsuite/metals.html' },
  { label: 'CME Group · Product and holiday hours', url: 'https://www.cmegroup.com/trading-hours.html' },
  { label: 'NinjaTrader · CME equity futures 2026 holiday adjustments', url: 'https://support.ninjatrader.com/eu/s/article/2026-Holiday-Trading-Hours?language=en_US' },
  { label: 'Coinbase · Crypto spot trading hours', url: 'https://help.coinbase.com/en/trading-and-funding/trading-hours-market-closures' },
];

export const SESSION_DEFINITIONS = [
  {
    id: 'sydney', name: 'Sydney', kind: 'fx', timeZone: 'Australia/Sydney',
    days: weekdays, open: '08:00', close: '17:00',
    assets: assets('fx-audusd', 'fx-nzdusd'),
    description: 'Asia-Pacific watchlist for Australian and New Zealand dollar pairs.',
  },
  {
    id: 'tokyo', name: 'Tokyo', kind: 'fx', timeZone: 'Asia/Tokyo',
    days: weekdays, open: '09:00', close: '18:00',
    assets: assets('fx-jpy', 'fx-eurjpy', 'fx-gbpjpy', 'fx-audusd'),
    description: 'Watch yen pairs and the Australian dollar during the Asian session.',
  },
  {
    id: 'london', name: 'London', kind: 'fx', timeZone: 'Europe/London',
    days: weekdays, open: '08:00', close: '17:00',
    assets: assets('fx-eur', 'fx-gbpusd', 'fx-eurgbp', 'fx-usdchf', 'fx-eurjpy'),
    description: 'Watch the euro and sterling. Check the New York overlap for USD crosses.',
  },
  {
    id: 'new-york', name: 'New York', kind: 'fx', timeZone: NEW_YORK,
    days: weekdays, open: '08:00', close: '17:00',
    assets: assets('fx-eur', 'fx-gbpusd', 'fx-jpy', 'fx-usdcad', 'fx-usdchf'),
    description: 'Watch major USD pairs and check the timing of scheduled US and Canadian releases.',
  },
  {
    id: 'us-equities', name: 'US equities', kind: 'equities', timeZone: NEW_YORK,
    days: weekdays, open: '09:30', close: '16:00',
    assets: assets('c-spy', 'c-qqq', 'c-iwm', 'c-aapl', 'c-nvda', 'c-tsla'),
    description: 'Core cash-market hours for listed stocks and ETFs. Broker extended hours are separate.',
  },
  {
    id: 'cme-equity', name: 'CME equity futures', kind: 'futures', timeZone: CHICAGO,
    days: [0, 1, 2, 3, 4], open: '17:00', close: '16:00', overnight: true,
    assets: assets('f-mnq', 'f-mes', 'f-nq', 'f-es', 'f-m2k', 'f-mym'),
    description: 'Regular Globex hours for these equity index contracts. Compare the US cash open and check broker cutoffs.',
  },
  {
    id: 'cme-metals', name: 'CME metals futures', kind: 'futures', timeZone: CHICAGO,
    days: [0, 1, 2, 3, 4], open: '17:00', close: '16:00', overnight: true,
    assets: assets('f-gc', 'f-mgc', 'f-si', 'f-sil'),
    description: 'Watch gold and silver futures. Check the dollar, yields and the contract’s holiday hours.',
  },
  {
    id: 'cme-energy', name: 'CME energy futures', kind: 'futures', timeZone: CHICAGO,
    days: [0, 1, 2, 3, 4], open: '17:00', close: '16:00', overnight: true,
    assets: assets('f-cl', 'f-mcl', 'f-ng', 'f-mng'),
    description: 'Watch WTI crude oil and Henry Hub natural gas. Check inventory releases before planning an entry.',
  },
  {
    id: 'crypto-spot', name: 'Crypto spot', kind: 'crypto', timeZone: UTC, continuous: true,
    assets: assets('c-btc', 'c-eth', 'c-sol', 'c-xrp', 'c-doge'),
    description: 'These spot pairs normally trade around the clock. Check your venue for maintenance and outages.',
  },
];

const equityHolidays = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
]);
const equityEarlyClose = new Set(['2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24']);
const cmeClosed = new Set(['2026-12-25', '2027-01-01']);
const cmeHolidayClose = {
  '2026-11-26': { equity: '12:00', commodities: '13:30' },
  '2026-11-27': { equity: '12:15', commodities: '13:45' },
  '2026-12-24': { equity: '12:15', commodities: '12:45' },
};

const localFormatters = new Map();
function wallTime(date, timeZone) {
  if (!localFormatters.has(timeZone)) {
    localFormatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    }));
  }
  const parts = localFormatters.get(timeZone).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function wallStamp({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function localDay(date, timeZone) {
  const { year, month, day } = wallTime(date, timeZone);
  return wallStamp({ year, month, day });
}

// A UTC date stamp represents the local calendar day here. It does not yet represent a market instant.
function toInstant(day, clock, timeZone) {
  const [hours, minutes] = clock.split(':').map(Number);
  const desired = day + (hours * 60 + minutes) * 60_000;
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const drift = desired - wallStamp(wallTime(new Date(instant), timeZone));
    if (!drift) break;
    instant += drift;
  }
  return new Date(instant);
}

function dateKey(day) {
  return new Date(day).toISOString().slice(0, 10);
}

function fxWeek(instant) {
  const day = localDay(instant, NEW_YORK);
  const weekDay = new Date(day).getUTCDay();
  const sunday = day - weekDay * DAY;
  return [
    toInstant(sunday, '17:05', NEW_YORK),
    toInstant(sunday + 5 * DAY, '16:59', NEW_YORK),
  ];
}

function occurrence(definition, day) {
  if (!definition.days.includes(new Date(day).getUTCDay())) return null;
  const endDay = definition.overnight ? day + DAY : day;
  const settlementDate = dateKey(endDay);
  let close = definition.close;
  let earlyClose = false;
  if (definition.id === 'us-equities') {
    if (equityHolidays.has(settlementDate)) return null;
    if (equityEarlyClose.has(settlementDate)) {
      close = '13:00';
      earlyClose = true;
    }
  }
  if (definition.kind === 'futures') {
    if (cmeClosed.has(settlementDate)) return null;
    const adjustedClose = cmeHolidayClose[settlementDate]?.[definition.id === 'cme-equity' ? 'equity' : 'commodities'];
    if (adjustedClose) {
      close = adjustedClose;
      earlyClose = true;
    }
  }
  const { id, name, kind, assets, description, timeZone } = definition;
  let start = toInstant(day, definition.open, timeZone);
  let end = toInstant(endDay, close, timeZone);
  if (kind === 'fx') {
    const [weekOpen, weekClose] = fxWeek(start);
    if (start < weekOpen) start = weekOpen;
    if (end > weekClose) end = weekClose;
    if (start >= end) return null;
  }
  return { id, name, kind, start, end, assets, description, timeZone, earlyClose };
}

export function getSchedule(now = new Date(), { kind } = {}) {
  const active = [];
  const later = [];
  for (const definition of SESSION_DEFINITIONS) {
    if (kind && kind !== 'all' && definition.kind !== kind) continue;
    const today = localDay(now, definition.timeZone);
    if (definition.continuous) {
      active.push({ ...definition, start: new Date(today), end: new Date(today + DAY) });
      continue;
    }
    // Overnight CME sessions can have started on the prior local day. A week covers long weekends.
    for (let offset = -1; offset <= 7; offset++) {
      const session = occurrence(definition, today + offset * DAY);
      if (!session) continue;
      if (session.start <= now && now < session.end) active.push(session);
      if (session.start > now) later.push(session);
    }
  }
  later.sort((a, b) => a.start - b.start);
  const nextStart = later[0]?.start.getTime();
  const next = later.filter(session => session.start.getTime() === nextStart);
  const withinDay = later.filter(session => session.start - now <= DAY);
  return { active, next, upcoming: withinDay.length ? withinDay : later.slice(0, 3) };
}
