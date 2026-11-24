import { DEFAULT_INSTRUMENTS } from './engine.mjs';
import { getSchedule } from './schedule.mjs';

const TIME_ZONE = 'America/New_York';
const MINUTE = 60_000;
const DAY = 1_440 * MINUTE;
const weekdays = [1, 2, 3, 4, 5];
const evenings = [0, 1, 2, 3, 4];

const easternClock = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});

function easternMinutes(date) {
  const parts = Object.fromEntries(easternClock.formatToParts(date)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function easternInstant(day, time) {
  const [hour, minute] = time.split(':').map(Number);
  const desired = day + (hour * 60 + minute) * MINUTE;
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const correction = desired - easternMinutes(new Date(instant));
    if (correction === 0) break;
    instant += correction;
  }
  return new Date(instant);
}

const instrumentKinds = {
  Futures: 'futures', Equity: 'equities', ETF: 'equities', FX: 'fx',
  'Spot FX': 'fx', 'Crypto spot': 'crypto', CFD: 'futures',
};
const instruments = new Map(DEFAULT_INSTRUMENTS.map(({ id, symbol, name, asset }) =>
  [id, { id, symbol, name, kind: instrumentKinds[asset] }]));
const references = {
  ASX200: { symbol: 'ASX200', name: 'S&P/ASX 200 index', kind: 'equities' },
  Nikkei: { symbol: 'Nikkei 225', name: 'Japanese equity index', kind: 'equities' },
  'Hang Seng': { symbol: 'Hang Seng', name: 'Hong Kong equity index', kind: 'equities' },
  'China A50': { symbol: 'China A50', name: 'FTSE China A50', kind: 'equities' },
  DAX: { symbol: 'DAX', name: 'German equity index', kind: 'equities' },
  FTSE: { symbol: 'FTSE 100', name: 'UK equity index', kind: 'equities' },
  'Euro Stoxx': { symbol: 'Euro Stoxx 50', name: 'Eurozone equity index', kind: 'equities' },
  HG: { symbol: 'HG', name: 'Copper futures', kind: 'futures' },
  Brent: { symbol: 'Brent', name: 'Brent crude oil', kind: 'futures' },
  ZN: { symbol: 'ZN', name: '10-year Treasury note futures', kind: 'futures' },
  ZB: { symbol: 'ZB', name: '30-year Treasury bond futures', kind: 'futures' },
  DXY: { symbol: 'DXY', name: 'U.S. Dollar Index', kind: 'fx' },
};
const list = (...keys) => keys.map(key => instruments.get(key) ?? references[key]);

const openingSteps = [
  { open: '09:15', close: '09:30', name: 'Prepare the equity open', status: 'prepare',
    description: 'Mark directional context, overnight liquidity and the levels you want to watch.' },
  { open: '09:30', close: '09:35', name: 'Observe price discovery', status: 'prepare',
    description: 'Observe the opening move and let the first five minutes establish a range.' },
  { open: '09:35', close: '09:45', name: 'Identify displacement and structure', status: 'prepare',
    description: 'Look for displacement, structure and where a retest could form.' },
  { open: '09:45', close: '10:30', name: 'Confirmed entries and retests', status: 'focus',
    description: 'Review setups with confirmation and a structural stop.' },
  { open: '10:30', close: '11:30', name: 'Continuation and position management', status: 'focus',
    description: 'Manage open positions and consider confirmed continuation setups. Morning execution ends at 11:30 a.m. ET.' },
];

const personalWindows = [
  {
    id: 'london-kill-zone', name: 'London Kill Zone', open: '02:00', close: '05:00',
    status: 'focus', assets: list('fx-eur', 'fx-gbpusd', 'DAX', 'c-xau'),
    description: 'European expansion and overnight liquidity. Use the cash-market clock for the exact DAX open.',
  },
  {
    id: 'ny-macro', name: 'New York macro window', open: '08:30', close: '09:25',
    status: 'focus', us: true, assets: list('c-xau', 'f-mgc', 'fx-eur', 'fx-gbpusd', 'fx-jpy', 'fx-usdcad', 'f-cl', 'f-mcl'),
    description: 'Watch macro-driven setups outside your account’s restricted news window. Start equity-open preparation at 9:15 a.m. ET.',
  },
  {
    id: 'ny-equity-prep', name: 'New York equity preparation', open: '09:25', close: '09:30',
    status: 'prepare', us: true, assets: list('f-mnq', 'f-mes', 'f-mgc'),
    description: 'Finish marking your opening levels before the cash session starts.',
  },
  {
    id: 'ny-equity-window', name: 'New York equity window', open: '09:30', close: '11:30',
    status: 'focus', us: true, assets: list('f-mnq', 'f-mes', 'f-mgc'), steps: openingSteps,
    description: 'Primary intraday window. Follow the opening playbook before looking for an entry.',
  },
  {
    id: 'mandatory-downtime', name: 'Mandatory downtime', open: '11:30', close: '13:30',
    status: 'manage', us: true, assets: [],
    description: 'No new positions. Manage open trades and review market structure.',
  },
  {
    id: 'afternoon-continuation', name: 'Afternoon continuation', open: '13:30', close: '15:00',
    status: 'focus', us: true, assets: list('f-mnq', 'f-mes'),
    description: 'Watch for confirmed continuation setups.',
  },
  {
    id: 'ny-close', name: 'New York close', open: '15:00', close: '16:00',
    status: 'focus', us: true, assets: list('f-mnq', 'f-mes'),
    description: 'Review power-hour setups and plan end-of-day exits.',
  },
  {
    id: 'asian-kill-zone', name: 'Asian Kill Zone', open: '20:00', close: '23:00',
    days: evenings, status: 'focus', assets: list('fx-jpy', 'fx-audjpy', 'fx-audusd'),
    description: 'Regional currency execution. Check the session clock for local cash hours and daylight-saving changes.',
  },
];

const marketWindows = [
  {
    id: 'rollover', name: 'Daily rollover & Sydney preparation', open: '17:00', close: '19:00',
    days: evenings, status: 'prepare', assets: list('fx-audusd', 'fx-nzdusd', 'fx-audnzd', 'ASX200'),
    description: 'Prepare the Asia-Pacific watchlist. FX spreads can widen, and CME normally pauses from 5–6 p.m. ET.',
  },
  {
    id: 'asian-expansion', name: 'Asian market expansion', open: '19:00', close: '23:00',
    days: evenings, status: 'focus', assets: list('fx-jpy', 'fx-audjpy', 'fx-audusd', 'fx-nzdusd', 'Nikkei', 'Hang Seng', 'China A50'),
    description: 'Use actual local cash opens for index setups. Gold, copper and BTC are secondary when supported by regional catalysts.',
    secondaryAssets: list('f-mgc', 'HG', 'c-btc'),
  },
  {
    id: 'late-asia', name: 'Late Asia', open: '23:00', close: '02:00',
    days: evenings, status: 'focus', assets: list('fx-jpy', 'fx-audjpy', 'Nikkei', 'Hang Seng'),
    description: 'Be selective around regional lunchtime breaks and quiet periods.',
  },
  {
    id: 'european-open', name: 'London & European open', open: '02:00', close: '05:00',
    status: 'focus', assets: list('fx-eur', 'fx-gbpusd', 'fx-eurgbp', 'fx-gbpjpy', 'fx-eurjpy', 'DAX', 'FTSE', 'Euro Stoxx', 'c-xau', 'Brent'),
    description: 'Watch European expansion. Check the actual local cash opens in the session clock.',
  },
  {
    id: 'european-continuation', name: 'European continuation', open: '05:00', close: '08:00',
    status: 'focus', assets: list('fx-eur', 'fx-gbpusd', 'DAX', 'FTSE', 'c-xau', 'f-si', 'Brent'),
    description: 'Watch established trends and pullbacks.',
  },
  {
    id: 'macro-premarket', name: 'New York macro & premarket', open: '08:00', close: '09:30',
    status: 'focus', us: true, assets: list('c-xau', 'f-si', 'f-cl', 'ZN', 'ZB', 'DXY', 'fx-eur', 'fx-gbpusd', 'fx-jpy', 'f-es', 'f-nq'),
    description: 'Check the U.S. economic calendar for scheduled releases, including the usual 8:30 a.m. ET release window.',
  },
  {
    id: 'cash-open-overlap', name: 'U.S. equity open & London overlap', open: '09:30', close: '11:30',
    status: 'focus', us: true, assets: list('f-nq', 'f-es', 'f-ym', 'f-rty', 'c-nvda', 'c-spy', 'c-qqq', 'c-xau', 'f-si', 'f-cl', 'fx-eur', 'fx-gbpusd', 'c-btc'),
    description: 'Watch opening price discovery. Use the actual London closing time for the overlap.',
  },
  {
    id: 'ny-lunch', name: 'New York lunch', open: '11:30', close: '13:30',
    status: 'manage', us: true, assets: [],
    description: 'Manage positions and prepare for the afternoon. Be selective around scheduled catalysts or exceptional momentum.',
  },
  {
    id: 'afternoon-energy', name: 'Afternoon expansion & energy settlement', open: '13:30', close: '15:00',
    status: 'focus', us: true, assets: list('f-es', 'f-nq', 'f-ym', 'f-rty', 'f-cl', 'f-ng'),
    description: 'Check scheduled Fed events and commodity settlement timings.',
  },
  {
    id: 'power-hour', name: 'U.S. power hour', open: '15:00', close: '16:00',
    status: 'focus', us: true, assets: list('f-nq', 'f-es', 'f-ym', 'f-rty', 'c-nvda', 'c-spy', 'c-qqq', 'c-btc'),
    description: 'Watch positioning ahead of the U.S. closing auction.',
  },
  {
    id: 'post-market', name: 'Post-market', open: '16:00', close: '17:00',
    status: 'manage', us: true, afterClose: true, assets: [],
    description: 'Manage remaining positions, check earnings, and journal the session.',
  },
];

function getUsSession(day) {
  return getSchedule(easternInstant(day, '10:00'), { kind: 'equities' }).active.find(session => session.id === 'us-equities');
}

function occurrence(definition, day, usSession) {
  const { days = weekdays, open, close, steps, us, afterClose, ...window } = definition;
  if (!days.includes(new Date(day).getUTCDay()) || (us && !usSession)) return null;
  const start = easternInstant(day, open);
  const closeDay = close < open ? day + DAY : day;
  const regularEnd = easternInstant(closeDay, close);
  const end = us && !afterClose && regularEnd > usSession.end ? usSession.end : regularEnd;
  if (end <= start) return null;
  const phases = steps?.map(({ open: phaseOpen, close: phaseClose, ...phase }) => ({
    ...phase,
    start: easternInstant(day, phaseOpen),
    end: easternInstant(day, phaseClose),
  }));
  return { ...window, start, end, ...(phases && { steps: phases }) };
}

function rotation(now, definitions) {
  const today = Math.floor(easternMinutes(now) / DAY) * DAY;
  const windows = [];
  for (let offset = -7; offset <= 7; offset++) {
    const day = today + offset * DAY;
    const weekday = new Date(day).getUTCDay();
    const us = weekdays.includes(weekday) ? getUsSession(day) : null;
    for (const definition of definitions) {
      const window = occurrence(definition, day, us);
      if (window) windows.push(window);
    }
  }
  windows.sort((a, b) => a.start - b.start);
  const previous = windows.reduce((latest, window) =>
    window.end <= now && (!latest || window.end >= latest.end) ? window : latest, null);
  const upcoming = windows.filter(window => window.start > now);
  const next = upcoming[0] ?? null;
  const nextDay = upcoming.filter(window => window.start - now <= DAY);
  const timeline = nextDay.length ? nextDay : upcoming.slice(0, 5);
  const active = windows.find(window => window.start <= now && now < window.end);
  if (active) {
    const phase = active.steps?.find(step => step.start <= now && now < step.end);
    const current = phase ? { ...active, phase, status: phase.status } : active;
    return { current, next, previous, timeline };
  }

  const current = {
    id: 'off-window', name: 'Outside planned execution windows', status: 'off', assets: [],
    start: previous?.end ?? easternInstant(today, '00:00'),
    end: next?.start ?? easternInstant(today + DAY, '00:00'),
    description: 'Review your plan or prepare for the next window.',
  };
  return { current, next, previous, timeline };
}

export function getRotation(now = new Date()) {
  return rotation(now, personalWindows);
}

export function getMarketRotation(now = new Date()) {
  return rotation(now, marketWindows);
}
