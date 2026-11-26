import { getSchedule, SCHEDULE_SOURCES } from '../schedule.mjs';
import { getRotation, getMarketRotation } from '../rotation.mjs';
import { ASSET_WINDOWS, TIMING_EVENTS, TIMING_SOURCES } from './rotation-reference.mjs';
import { getSessionPlays, PLAY_SOURCES } from './session-plays.mjs';
import { MARKET_MEMORY_PLAYBOOKS } from './market-memory.mjs';
import { PLAYBOOK_GROUPS, getPlaybooksForWindow } from './playbooks.mjs';

const clockZone = document.getElementById('planner-time-zone');
const filterButtons = [...document.querySelectorAll('[data-asset]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const allMarkets = 'all';
let activeFilter = allMarkets;
let activeView = 'execution';
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

const playbookAnchor = id => `playbook-${id}`;

function playbookLink({ id, title }) {
  const link = makeElement('a', title);
  link.href = `#${playbookAnchor(id)}`;
  return link;
}

function playbookChecklist(heading, entries, ordered = false) {
  const section = makeElement('div');
  const list = makeElement(ordered ? 'ol' : 'ul');
  list.append(...entries.map(entry => makeElement('li', entry)));
  section.append(makeElement('h4', heading), list);
  return section;
}

function playbookArticle({ id, title, window, overview, assets, preparation, setups, skip, sources = [], sourceNote, setupsLabel = 'Setups', tools = [] }) {
  const article = makeElement('article', '', 'playbook-article');
  article.id = playbookAnchor(id);
  article.tabIndex = -1;
  const heading = makeElement('h3', title);
  heading.id = `${article.id}-title`;
  article.setAttribute('aria-labelledby', heading.id);
  const headingRow = makeElement('div', '', 'playbook-heading');
  const back = makeElement('a', 'All playbooks', 'playbook-back');
  back.href = '#playbooks';
  headingRow.append(heading, back);
  const fields = makeElement('dl', '', 'playbook-markets');
  const markets = makeElement('dd');
  const marketList = makeElement('ul');
  marketList.append(...assets.map(asset => makeElement('li', asset)));
  markets.append(marketList);
  fields.append(makeElement('dt', 'Markets'), markets);
  article.append(headingRow, makeElement('p', window, 'playbook-timing'), makeElement('p', overview));
  if (tools.length) {
    const links = makeElement('div', '', 'playbook-tools');
    for (const { href, label } of tools) {
      const link = makeElement('a', label, 'planner-library-link');
      link.href = href;
      links.append(link);
    }
    article.append(links);
  }
  const playList = makeElement('div', '', 'playbook-setups');
  playList.append(makeElement('h4', setupsLabel));
  for (const { name, context, trigger, entry, invalidation, management, skip } of setups) {
    const card = makeElement('div', '', 'playbook-setup');
    const rules = makeElement('dl');
    for (const [label, text] of [
      ['Context', context], ['Confirmation', trigger], ['Entry', entry], ['Invalidation', invalidation],
      ['Management', management], ['Skip if', skip],
    ]) {
      if (!text) continue;
      rules.append(makeElement('dt', label), makeElement('dd', text));
    }
    card.append(makeElement('h5', name), rules);
    playList.append(card);
  }
  article.append(fields, playbookChecklist('Preparation', preparation, true), playList, playbookChecklist('When to skip', skip));
  if (sourceNote) article.append(makeElement('p', sourceNote, 'playbook-provenance'));
  for (const { label, url } of sources) {
    const link = makeElement('a', label, 'playbook-source');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    article.append(link);
  }
  return article;
}

const playbookIndex = document.getElementById('playbook-index');
const playbookCategories = PLAYBOOK_GROUPS.map(group => {
  const button = makeElement('button', group.label);
  button.type = 'button';
  button.setAttribute('aria-controls', 'playbook-index playbook-reader');
  const entries = group.playbooks.map(playbook => ({ groupId: group.id, link: playbookLink(playbook), article: playbookArticle(playbook) }));
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const entry = entries[0];
    selectPlaybook(entry);
    history.replaceState(history.state, '', entry.link.hash);
  });
  return { id: group.id, button, entries };
});
const playbookLibrary = playbookCategories.flatMap(({ entries }) => entries);
document.getElementById('playbook-categories').append(...playbookCategories.map(({ button }) => button));
document.getElementById('playbook-reader').append(...playbookLibrary.map(({ article }) => article));

function selectPlaybook(entry) {
  const category = playbookCategories.find(({ id }) => id === entry.groupId);
  for (const { id, button } of playbookCategories) button.setAttribute('aria-pressed', String(id === entry.groupId));
  for (const { link, article } of playbookLibrary) {
    const selected = article === entry.article;
    article.hidden = !selected;
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  playbookIndex.replaceChildren(...category.entries.map(({ link }) => link));
}

function openLinkedPlaybook() {
  const entry = playbookLibrary.find(({ link }) => link.hash === window.location.hash);
  if (!entry) return;
  selectPlaybook(entry);
  entry.article.focus({ preventScroll: true });
  entry.article.scrollIntoView();
}

selectPlaybook(playbookLibrary[0]);
window.addEventListener('hashchange', openLinkedPlaybook);

function appendPlaybookLinks(card, windowId) {
  const entries = getPlaybooksForWindow(windowId);
  if (!entries.length) return;
  const links = makeElement('div', '', 'session-guide-links');
  links.setAttribute('role', 'group');
  links.setAttribute('aria-label', 'Detailed playbooks');
  links.append(makeElement('span', 'Playbooks'), ...entries.map(playbookLink));
  card.append(links);
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
    const item = makeElement('li');
    if (asset.id) {
      const link = makeElement('a', asset.symbol);
      link.href = `../?instrument=${encodeURIComponent(asset.id)}`;
      link.title = `${asset.name} in Risk Calculator`;
      item.append(link);
    } else {
      const label = makeElement('span', asset.symbol, 'asset-reference');
      label.title = asset.name;
      item.append(label);
    }
    list.append(item);
  }
  return list;
}

const memoryViews = MARKET_MEMORY_PLAYBOOKS.map(({ id, label, description, steps }) => {
  const button = makeElement('button', label);
  button.type = 'button';
  button.setAttribute('aria-controls', `memory-${id}`);
  button.addEventListener('click', () => selectMemoryView(id));
  const panel = makeElement('div');
  panel.id = `memory-${id}`;
  const list = makeElement('ol', '', 'memory-steps');
  for (const { title, body } of steps) {
    const step = makeElement('li');
    step.append(makeElement('h3', title), makeElement('p', body));
    list.append(step);
  }
  panel.append(makeElement('p', description, 'memory-description'), list);
  return { id, button, panel };
});

function selectMemoryView(id) {
  for (const view of memoryViews) {
    view.button.setAttribute('aria-pressed', String(view.id === id));
    view.panel.hidden = view.id !== id;
  }
}

document.getElementById('memory-timeframes').append(...memoryViews.map(view => view.button));
document.getElementById('memory-playbooks').append(...memoryViews.map(view => view.panel));
selectMemoryView('daily');

function memoryLink(text) {
  const link = makeElement('a', text, 'memory-link');
  link.href = '#market-memory';
  link.addEventListener('click', () => selectMemoryView('session'));
  return link;
}

function appendSessionPlays(card, id, heading) {
  const plays = getSessionPlays(id);
  if (!plays.length) return;
  const section = makeElement('div', '', 'session-plays');
  const list = makeElement('ul');
  for (const { name, watchFor, invalidatedBy } of plays) {
    const item = makeElement('li');
    const confirmation = makeElement('p');
    confirmation.append(makeElement('strong', 'Watch for · '), watchFor);
    const invalidation = makeElement('p');
    invalidation.append(makeElement('strong', 'Skip if · '), invalidatedBy);
    item.append(makeElement('h5', name), confirmation, invalidation);
    list.append(item);
  }
  section.append(makeElement('h4', heading), list);
  if (plays.some(play => play.marketMemory)) section.append(memoryLink('Open Market Memory playbook'));
  card.append(section);
}

function completedCard(session) {
  const card = makeElement('article', '', 'completed-session');
  const time = makeElement('time', sessionRange(session), 'session-time');
  time.dateTime = session.end.toISOString();
  card.append(makeElement('h3', session.name), time);
  if (session.assets.length) card.append(renderAssets(session.assets));
  return card;
}

function sessionCard(session, upcoming) {
  const card = makeElement('article', '', 'session-card');
  const head = makeElement('div', '', 'session-card-head');
  head.append(makeElement('h3', session.name), makeElement('span', marketLabels[session.kind], 'session-kind'));
  const time = makeElement('time', sessionRange(session), 'session-time');
  if (!session.continuous) time.dateTime = session.start.toISOString();
  card.append(head, time);
  if (session.regularOnly) card.append(makeElement('p', 'Regular hours · holiday exceptions may apply.'));
  if (session.earlyClose) card.append(makeElement('p', 'Scheduled early close.', 'session-adjustment'));
  if (session.description) card.append(makeElement('p', session.description));
  if (session.assets.length) card.append(renderAssets(session.assets));
  if (upcoming && preparation[session.kind]) card.append(makeElement('p', preparation[session.kind]));
  appendSessionPlays(card, session.id, upcoming ? 'Plays to prepare' : 'Session setup examples');
  if (session.id === 'us-equities') card.append(memoryLink('Day Two · U.S. stock session playbook'));
  appendPlaybookLinks(card, session.id);
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

const rotationStatus = {
  focus: 'Watch for confirmed entries',
  prepare: 'Prepare · no new entries',
  manage: 'Manage · no new entries',
  off: 'No new entries',
};

function rotationCard(window, upcoming) {
  const card = makeElement('article', '', 'session-card');
  const step = upcoming ? null : window.phase;
  const status = step?.status ?? window.status;
  const label = activeView==='rotation' && status==='manage' ? 'Position management' : rotationStatus[status];
  const badge = makeElement('span', label, 'session-kind rotation-status');
  badge.dataset.status = status;
  const head = makeElement('div', '', 'session-card-head');
  head.append(makeElement('h3', window.name), badge);
  const time = makeElement('time', sessionRange(window), 'session-time');
  time.dateTime = window.start.toISOString();
  card.append(head, time);
  if (window.description) card.append(makeElement('p', window.description));
  if (step) card.append(makeElement('p', `${step.name} · ${step.description}`, 'current-phase'));
  if (window.assets.length) card.append(renderAssets(window.assets));
  if (window.secondaryAssets?.length) {
    card.append(makeElement('p', 'Secondary watchlist'), renderAssets(window.secondaryAssets));
  }
  const playKey = step?.name ?? window.playKey ?? window.id;
  if (status === 'focus') {
    appendSessionPlays(card, playKey, upcoming ? 'Plays to prepare' : 'Plays to watch');
  }
  if (status === 'prepare' && (playKey === 'ny-equity-prep' || playKey === 'Prepare the equity open')) {
    card.append(memoryLink('Prepare prior-day levels with Market Memory'));
  }
  if (status === 'prepare' || status === 'focus') appendPlaybookLinks(card, playKey);
  return card;
}

function renderOpeningSteps(opening, now) {
  const panel = document.getElementById('opening-plan');
  panel.hidden = !opening?.steps?.length;
  if (panel.hidden) return;
  const entries = opening.steps.map(step => {
    const item = makeElement('article');
    if (step.start <= now && now < step.end) item.setAttribute('aria-current', 'true');
    const time = makeElement('time', sessionRange(step));
    time.dateTime = step.start.toISOString();
    item.append(time, makeElement('h3', step.name), makeElement('p', step.description, 'session-empty'));
    return item;
  });
  document.getElementById('opening-steps').replaceChildren(...entries);
}

function renderRotationView(now) {
  const isExecution = activeView === 'execution';
  const { current, next, previous, timeline } = isExecution ? getRotation(now) : getMarketRotation(now);
  const visibleTimeline = timeline.filter(window => window.start.getTime() !== next?.start.getTime());
  document.getElementById('current-title').textContent = isExecution ? 'Execution now' : 'Rotation now';
  const opening = current?.steps?.length ? current : timeline.find(window => window.steps?.length);
  const upcomingStep = opening?.steps?.find(step => step.start > now);
  const showStep = isExecution && upcomingStep && (!next || upcomingStep.start <= next.start);
  document.getElementById('next-title').textContent = showStep ? 'Next opening step' : 'Next to prepare for';
  const nextCard = showStep ? { ...upcomingStep, assets: opening.assets, playKey: upcomingStep.name } : next;
  document.getElementById('agenda-title').textContent = isExecution ? 'Later execution windows' : 'Later rotation windows';
  document.getElementById('current-count').textContent = '';
  document.getElementById('next-countdown').textContent = nextCard ? startsIn(nextCard.start, now) : '';
  renderSection('previous-sessions', previous ? [previous] : [], completedCard, 'No completed session is available.');
  renderSection('current-sessions', current ? [current] : [], window => rotationCard(window, false), 'No execution window is active.');
  renderSection('next-sessions', nextCard ? [nextCard] : [], window => rotationCard(window, true), 'No upcoming window is shown.');
  renderSection('upcoming-sessions', showStep ? timeline : visibleTimeline, agendaCard, 'No additional windows in this view.');
  renderOpeningSteps(isExecution ? opening : null, now);
}

function renderMarketView(now) {
  document.getElementById('opening-plan').hidden = true;
  document.getElementById('current-title').textContent = 'Active markets';
  document.getElementById('next-title').textContent = 'Next market open';
  document.getElementById('agenda-title').textContent = 'Later market sessions';
  const { active, next, previous, upcoming } = getSchedule(now, { kind: activeFilter === allMarkets ? undefined : activeFilter });
  document.getElementById('current-count').textContent = active.length ? `${active.length} active` : '';
  document.getElementById('next-countdown').textContent = next.length ? startsIn(next[0].start, now) : '';
  const previousMessage = activeFilter === 'crypto' ? 'Spot crypto has no scheduled daily close.' : 'No completed session is available.';
  renderSection('previous-sessions', previous, completedCard, previousMessage);
  renderSection('current-sessions', active, session => sessionCard(session, false), 'No scheduled session is active for this market.');
  const nextMessage = activeFilter === 'crypto' ? 'Crypto has no scheduled daily open.' : 'No scheduled open is shown for this market.';
  renderSection('next-sessions', next, session => sessionCard(session, true), nextMessage);
  const later = upcoming.filter(session => session.start.getTime() !== next[0]?.start.getTime());
  renderSection('upcoming-sessions', later, agendaCard, activeFilter === 'crypto' ? nextMessage : 'No additional sessions in this window.');
}

function makeTable(label, headings, rows) {
  const table = makeElement('table');
  table.setAttribute('aria-label', label);
  const head = table.createTHead().insertRow();
  for (const heading of headings) {
    const header = makeElement('th', heading);
    header.scope = 'col';
    head.append(header);
  }
  const body = table.createTBody();
  for (const columns of rows) {
    const row = body.insertRow();
    for (const value of columns) row.insertCell().textContent = value || '—';
  }
  return table;
}

const search = document.getElementById('asset-window-search');
const searchKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function renderAssetWindows() {
  const query = searchKey(search.value);
  const tables = [];
  for (const { category, rows } of ASSET_WINDOWS) {
    const matches = rows.filter(row => searchKey(row.asset).includes(query) || searchKey(category).includes(query));
    if (!matches.length) continue;
    const wrap = makeElement('div', '', 'table-wrap');
    wrap.append(makeTable(category, ['Asset', 'Primary window', 'Secondary window'], matches.map(row => [row.asset, row.primary, row.secondary])));
    tables.push(makeElement('h3', category), wrap);
  }
  document.getElementById('asset-window-tables').replaceChildren(...(tables.length ? tables : [makeElement('p', 'No matching asset windows.')]));
}
search.addEventListener('input', renderAssetWindows);
renderAssetWindows();
document.getElementById('timing-events').append(makeTable('Institutional timing events', ['Time', 'Event', 'Assets', 'Conditions'],
  TIMING_EVENTS.map(item => [item.time, item.event, item.assets, item.note]),
));

function update(now = new Date(), force = false) {
  const minute = Math.floor(now.getTime() / 60_000);
  const date = document.getElementById('planner-date');
  const time = document.getElementById('planner-time');
  date.textContent = dateFormat.format(now);
  time.textContent = clockFormat.format(now);
  date.dateTime = time.dateTime = now.toISOString();
  if (!force && minute === lastMinute) return;
  lastMinute = minute;
  if (activeView === 'markets') renderMarketView(now);
  else renderRotationView(now);
}

clockZone.addEventListener('change', () => {
  configureFormatters();
  update(new Date(), true);
});

for (const button of viewButtons) {
  button.addEventListener('click', () => {
    activeView = button.dataset.view;
    for (const candidate of viewButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
    document.getElementById('market-filters').hidden = activeView !== 'markets';
    update(new Date(), true);
  });
}

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.asset;
    for (const candidate of filterButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
    update(new Date(), true);
  });
}

const sources = document.getElementById('schedule-sources');
const distinctSources = new Map([...SCHEDULE_SOURCES, ...TIMING_SOURCES, ...PLAY_SOURCES].map(source => [source.url, source]));
for (const source of distinctSources.values()) {
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
if (window.location.hash) openLinkedPlaybook();
window.setInterval(update, 1000);
