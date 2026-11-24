import { DEFAULT_INSTRUMENTS } from './engine.mjs';

const UTC = 'UTC';
const NEW_YORK = 'America/New_York';
const CHICAGO = 'America/Chicago';
const DAY = 24 * 60 * 60 * 1000;
const weekdays = [1, 2, 3, 4, 5];
const instruments = new Map(DEFAULT_INSTRUMENTS.map(({ id, symbol, name }) => [id, { id, symbol, name }]));
const assets = (...ids) => ids.map(id => instruments.get(id));

function cashMarket(id, name, timeZone, watchlist, periods, description) {
  return periods.map(({ part, open, close }) => ({
    id: part ? `${id}-${part.toLowerCase()}` : id,
    name: part ? `${name} · ${part}` : name,
    kind: 'equities', timeZone, days: weekdays, open, close, assets: watchlist,
    description, cashCalendar: id,
  }));
}

export const SCHEDULE_SOURCES = [
  { label: 'OANDA · FX sessions and overlaps', url: 'https://www.oanda.com/us-en/skills-and-insights/education/trading-asset-classes/forex/when-is-the-best-time-for-forex-trading/' },
  { label: 'OANDA · FX trading hours', url: 'https://www.oanda.com/us-en/trading/hours-of-operation/' },
  { label: 'NYSE · Core hours and holidays', url: 'https://www.nyse.com/trade/hours-calendars' },
  { label: 'ASX · Cash market trading hours', url: 'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours' },
  { label: 'ASX · 2026–2027 cash calendars', url: 'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours/trading-calendar' },
  { label: 'JPX · Tokyo Stock Exchange trading hours', url: 'https://www.jpx.co.jp/english/equities/trading/domestic/01.html' },
  { label: 'JPX · 2026–2027 market holidays', url: 'https://www.jpx.co.jp/english/corporate/about-jpx/calendar/' },
  { label: 'HKEX · Securities-market hours', url: 'https://www.hkex.com.hk/Services/Trading-hours-and-Severe-Weather-Arrangements/Trading-Hours/Securities-Market?sc_lang=en' },
  { label: 'HKEX · 2026 market holidays', url: 'https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf' },
  { label: 'Shanghai Stock Exchange · Trading hours', url: 'https://english.sse.com.cn/start/trading/schedule/' },
  { label: 'Shanghai Stock Exchange · 2026 market holidays', url: 'https://www.sse.com.cn/disclosure/dealinstruc/closed/' },
  { label: 'Xetra · Core trading hours', url: 'https://www.xetra.com/xetra-en/trading/trading-calendar-and-trading-hours' },
  { label: 'Xetra · 2026 calendar', url: 'https://www.xetra.com/resource/blob/4580826/3e974decb414d6769cc2bc8e601f6c9a/data/xetra-trading-calendar-2026.pdf' },
  { label: 'London Stock Exchange · Main Market hours', url: 'https://www.londonstockexchange.com/en/resources/faqs/personal-investing' },
  { label: 'London Stock Exchange · Business days and half days', url: 'https://www.londonstockexchange.com/en/resources/markets-products/business-days' },
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
  ...cashMarket('asx', 'Sydney · ASX', 'Australia/Sydney', [
    { symbol: 'ASX 200', name: 'S&P/ASX 200 cash market reference' },
  ], [{ open: '10:00', close: '16:00' }], 'Regular cash trading is shown from the approximate opening auction through the end of continuous trading.'),
  ...cashMarket('tse', 'Tokyo · TSE', 'Asia/Tokyo', [
    { symbol: 'Nikkei 225', name: 'Nikkei 225 cash market reference' },
  ], [
    { part: 'AM', open: '09:00', close: '11:30' },
    { part: 'PM', open: '12:30', close: '15:30' },
  ], 'Tokyo cash equities pause for lunch from 11:30 a.m. to 12:30 p.m. Japan time.'),
  ...cashMarket('hkex', 'Hong Kong · HKEX', 'Asia/Hong_Kong', [
    { symbol: 'Hang Seng', name: 'Hang Seng Index cash market reference' },
  ], [
    { part: 'AM', open: '09:30', close: '12:00' },
    { part: 'PM', open: '13:00', close: '16:00' },
  ], 'Shows the regular continuous cash sessions and excludes the closing auction.'),
  ...cashMarket('sse', 'Shanghai · SSE', 'Asia/Shanghai', [
    { symbol: 'China A50 context', name: 'Mainland cash market context for China A50' },
  ], [
    { part: 'AM', open: '09:30', close: '11:30' },
    { part: 'PM', open: '13:00', close: '15:00' },
  ], 'Mainland A-share hours provide context for China A50. Check the separate schedule for any futures or CFD.'),
  ...cashMarket('xetra', 'Frankfurt · Xetra', 'Europe/Berlin', [
    { symbol: 'DAX 40', name: 'DAX 40 cash market reference' },
  ], [{ open: '09:00', close: '17:30' }], 'Core Xetra cash hours. Extended retail and derivatives schedules are separate.'),
  ...cashMarket('lse', 'London · LSE', 'Europe/London', [
    { symbol: 'FTSE 100', name: 'FTSE 100 cash market reference' },
  ], [{ open: '08:00', close: '16:30' }], 'Regular London Main Market cash hours for FTSE-listed shares.'),
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
// Local exchange dates. Outside these years the overseas cards show regular hours.
const overseasCashCalendars = {
  asx: {
    years: [2026, 2027],
    closed: new Set([
      '2026-01-01', '2026-01-26', '2026-04-03', '2026-04-06', '2026-06-08',
      '2026-12-25', '2026-12-28', '2027-01-01', '2027-01-26', '2027-03-26',
      '2027-03-29', '2027-06-14', '2027-12-27', '2027-12-28',
    ]),
    earlyClose: { '2026-12-24': '14:10', '2026-12-31': '14:10', '2027-12-24': '14:10', '2027-12-31': '14:10' },
  },
  tse: {
    years: [2026, 2027],
    closed: new Set([
      '2026-01-01', '2026-01-02', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
      '2026-04-29', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11',
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23', '2026-12-31',
      '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-22', '2027-04-29',
      '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11',
      '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23', '2027-12-31',
    ]),
  },
  hkex: {
    years: [2026],
    closed: new Set([
      '2026-01-01', '2026-02-17', '2026-02-18', '2026-02-19', '2026-04-03',
      '2026-04-06', '2026-04-07', '2026-05-01', '2026-05-25', '2026-06-19',
      '2026-07-01', '2026-10-01', '2026-10-19', '2026-12-25',
    ]),
    earlyClose: { '2026-02-16': '12:00', '2026-12-24': '12:00', '2026-12-31': '12:00' },
  },
  sse: {
    years: [2026],
    closed: new Set([
      '2026-01-01', '2026-01-02', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
      '2026-02-20', '2026-02-23', '2026-04-06', '2026-05-01', '2026-05-04', '2026-05-05',
      '2026-06-19', '2026-09-25', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
    ]),
  },
  xetra: {
    years: [2026],
    closed: new Set([
      '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31',
    ]),
  },
  lse: {
    years: [2027, 2028],
    closed: new Set([
      '2026-08-31', '2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29',
      '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
      '2028-01-03', '2028-04-14', '2028-04-17', '2028-05-01', '2028-05-29', '2028-08-28',
      '2028-12-25', '2028-12-26', '2029-01-01',
    ]),
    earlyClose: {
      '2026-12-24': '12:30', '2026-12-31': '12:30', '2027-12-24': '12:30', '2027-12-31': '12:30',
      '2028-12-22': '12:30', '2028-12-29': '12:30',
    },
  },
};
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
  const overseas = overseasCashCalendars[definition.cashCalendar];
  if (overseas?.closed.has(settlementDate)) return null;
  const overseasClose = overseas?.earlyClose?.[settlementDate];
  if (overseasClose && overseasClose <= close) {
    close = overseasClose;
    earlyClose = true;
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
  if (start >= end) return null;
  const regularOnly = Boolean(overseas && !overseas.years.includes(new Date(endDay).getUTCFullYear()));
  return { id, name, kind, start, end, assets, description, timeZone, earlyClose, regularOnly };
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
