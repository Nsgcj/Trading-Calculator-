import { getSchedule, SCHEDULE_SOURCES } from '../schedule.mjs';

const clockZone = document.getElementById('planner-time-zone');
const filterButtons = [...document.querySelectorAll('[data-asset]')];
const allMarkets = 'all';
let activeFilter = allMarkets;
let lastMinute;
let dateFormat;
let clockFormat;
let startFormat;
let rangeDayFormat;

const marketLabels = {
  fx: 'FX focus window',
  futures: 'Futures session',
  equities: 'Cash session',
  crypto: 'Continuous market',
};

const preparation = {
  fx: 'Mark the prior session range and check scheduled releases for both currencies.',
  futures: 'Mark the prior session high and low. Confirm your contract month and the venue’s hours.',
  equities: 'Mark the premarket range and check earnings or scheduled releases before the open.',
};

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function displayZone() {
  return clockZone.value === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : clockZone.value;
}

function configureFormatters() {
  const timeZone = displayZone();
  dateFormat = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  clockFormat = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  startFormat = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  rangeDayFormat = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function startsIn(start, now) {
  const minutes = Math.max(1, Math.ceil((start - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const parts = [days && `${days}d`, hours && `${hours}h`, remainder && `${remainder}m`].filter(Boolean);
  return `In ${parts.join(' ')}`;
}

function sessionRange(session) {
  if (session.continuous) return 'Typically 24/7';
  const end = dateFormat.format(session.start) === dateFormat.format(session.end)
    ? rangeDayFormat.format(session.end)
    : startFormat.format(session.end);
  return `${startFormat.format(session.start)} – ${end}`;
}

function renderAssets(assets) {
  const list = makeElement('ul', '', 'session-assets');
  list.setAttribute('aria-label', 'Assets to watch');
  for (const asset of assets) {
    const link = makeElement('a', asset.symbol);
    link.href = `../?instrument=${encodeURIComponent(asset.id)}`;
    link.title = `${asset.name} in Risk Calculator`;
    const item = makeElement('li');
    item.append(link);
    list.append(item);
  }
  return list;
}

function sessionCard(session, upcoming) {
  const card = makeElement('article', '', 'session-card');
  const head = makeElement('div', '', 'session-card-head');
  head.append(makeElement('h3', session.name), makeElement('span', marketLabels[session.kind], 'session-kind'));
  const time = makeElement('time', sessionRange(session), 'session-time');
  if (!session.continuous) time.dateTime = session.start.toISOString();
  card.append(head, time);
  if (session.earlyClose) card.append(makeElement('p', 'Scheduled early close.', 'session-adjustment'));
  if (session.description) card.append(makeElement('p', session.description));
  if (session.assets.length) card.append(renderAssets(session.assets));
  if (upcoming && preparation[session.kind]) card.append(makeElement('p', preparation[session.kind]));
  return card;
}

function agendaCard(session) {
  const card = makeElement('article');
  const time = makeElement('time', startFormat.format(session.start));
  time.dateTime = session.start.toISOString();
  card.append(time, makeElement('h3', session.name));
  if (session.assets.length) card.append(renderAssets(session.assets));
  return card;
}

function renderSection(id, sessions, renderer, empty) {
  const container = document.getElementById(id);
  const children = sessions.length ? sessions.map(renderer) : [makeElement('p', empty, 'session-empty')];
  container.replaceChildren(...children);
}

function update(now = new Date(), force = false) {
  const minute = Math.floor(now.getTime() / 60_000);
  const date = document.getElementById('planner-date');
  const time = document.getElementById('planner-time');
  date.textContent = dateFormat.format(now);
  time.textContent = clockFormat.format(now);
  date.dateTime = time.dateTime = now.toISOString();
  if (!force && minute === lastMinute) return;
  lastMinute = minute;
  const { active, next, upcoming } = getSchedule(now, { kind: activeFilter === allMarkets ? undefined : activeFilter });
  document.getElementById('current-count').textContent = active.length ? `${active.length} active` : '';
  document.getElementById('next-countdown').textContent = next.length ? startsIn(next[0].start, now) : '';
  renderSection('current-sessions', active, session => sessionCard(session, false), 'No scheduled session is active for this market.');
  const nextMessage = activeFilter === 'crypto' ? 'Crypto has no scheduled daily open.' : 'No scheduled open is shown for this market.';
  renderSection('next-sessions', next, session => sessionCard(session, true), nextMessage);
  const later = upcoming.filter(session => session.start.getTime() !== next[0]?.start.getTime());
  renderSection('upcoming-sessions', later, agendaCard, activeFilter === 'crypto' ? nextMessage : 'No additional sessions in this window.');
}

clockZone.addEventListener('change', () => {
  configureFormatters();
  update(new Date(), true);
});

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.asset;
    for (const candidate of filterButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
    update(new Date(), true);
  });
}

const sources = document.getElementById('schedule-sources');
for (const source of SCHEDULE_SOURCES) {
  const item = makeElement('li');
  const link = makeElement('a', source.label);
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  item.append(link);
  sources.append(item);
}

configureFormatters();
update();
window.setInterval(update, 1000);
