import { projectCompound } from '../../compound.mjs';
import { readCompoundProfiles } from '../../compound-accounts.mjs';

const field = id => document.getElementById(id);
const form = field('compoundForm');
const results = field('compoundResults');
const status = field('compoundStatus');
const rows = field('compoundIndividualRows');
const savedVest = field('vestProfiles');
const mode = field('compoundMode');
const source = field('vestSource');
const storageKey = 'chicken-man-compound-v1';
const profiles = readCompoundProfiles();
const settingsFields = [
  'compoundMode', 'vestSource', 'vestCount', 'vestRoom', 'vestGoal', 'vestEarned', 'vestMinimum', 'compoundRisk',
  'compoundStreak', 'compoundKeep', 'compoundWins', 'compoundLosses', 'compoundWinR', 'compoundPace',
];
const cash = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const detail = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const usd = value => Number.isFinite(value) ? cash.format(value || 0) : '—';
const percentage = value => Number.isFinite(value) ? `${detail.format(value * 100)}%` : '—';
let nextRowId = 1;
let submitted = false;
let draft;
try { draft = JSON.parse(localStorage.getItem(storageKey)); } catch {}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function number(node) {
  if (node.validity.badInput) return NaN;
  return node.value === '' ? undefined : node.valueAsNumber;
}

const read = id => number(field(id));
const rowField = (row, key) => row.querySelector(`[data-field="${key}"]`);
const rowList = () => [...rows.querySelectorAll('[data-compound-account]')];
const savedRows = () => [...savedVest.querySelectorAll('[data-vest-profile]')];
const checkedVestRows = () => savedRows().filter(row => row.querySelector('input[type="checkbox"]').checked);

function metrics(items) {
  const list = element('dl', '', 'hedge-metrics');
  for (const [label, value] of items) {
    const item = element('div');
    item.append(element('dt', label), element('dd', value));
    list.append(item);
  }
  return list;
}

function table(caption, headings, entries) {
  const grid = element('table', '', 'hedge-result-table compound-table');
  grid.createCaption().textContent = caption;
  const head = grid.createTHead().insertRow();
  for (const title of headings) {
    const column = element('th', title);
    column.scope = 'col';
    head.append(column);
  }
  const body = grid.createTBody();
  for (const values of entries) {
    const row = body.insertRow();
    const label = element('th', values[0]);
    label.scope = 'row';
    row.append(label);
    for (const value of values.slice(1)) row.insertCell().textContent = value;
  }
  const scroll = element('div', '', 'table-wrap');
  scroll.append(grid);
  return scroll;
}

function notes(messages) {
  const list = element('ul', '', 'hedge-lines');
  list.append(...messages.map(message => element('li', message)));
  return list;
}

function settings() {
  return {
    riskFraction: read('compoundRisk') / 100, lossStreak: read('compoundStreak'), keepFraction: read('compoundKeep') / 100,
    wins: read('compoundWins'), losses: read('compoundLosses'), avgWinR: read('compoundWinR'), tradesPerWeek: read('compoundPace'),
  };
}

function evaluate(accounts, goal, earned, parameters) {
  if (!Number.isFinite(goal) || goal <= 0 || !Number.isFinite(earned)) {
    return { errors: ['Enter a positive profit goal and a valid booked P&L amount.'] };
  }
  const remaining = Math.max(0, goal - earned);
  const missingSample = remaining > 0 && [parameters.wins, parameters.losses, parameters.avgWinR, parameters.tradesPerWeek].some(value => value === undefined);
  const report = projectCompound({ ...parameters, accounts, target: missingSample ? 0 : remaining });
  return { goal, earned, remaining, missingSample, report, errors: report.errors };
}

function horizon(scenario, missingSample) {
  if (missingSample) return 'Trade data needed';
  if (scenario.status === 'projected') {
    const weeks = scenario.weeks < 0.1 ? '<0.1' : count.format(scenario.weeks);
    return `${count.format(scenario.trades)} trades · ${weeks} wks`;
  }
  return {
    reached: 'Goal reached', 'no-growth': 'No positive growth', 'minimum-risk-blocked': 'Minimum order blocks estimate',
    'out-of-range': 'Outside model range',
  }[scenario.status] ?? 'No estimate';
}

function reportCard(title, run, parameters) {
  const card = element('section', '', 'compound-result-section');
  card.append(element('h3', title));
  if (run.errors.length) {
    card.append(notes(run.errors));
    return card;
  }
  const { report, remaining, earned, goal, missingSample } = run;
  const { scenarios, sample } = report;
  const values = [
    ['Profit goal', usd(goal)], ['Booked P&L', usd(earned)], ['Profit still needed', usd(remaining)],
    ['Usable drawdown today', usd(report.totalRoom)], ['Starting risk per opportunity', usd(report.firstRisk)],
    [`Room after ${parameters.lossStreak} modeled losses`, usd(report.postStreakRoom)],
  ];
  if (report.rows.length > 1) values.push(['Average profit still needed per account', usd(remaining / report.rows.length)]);
  card.append(metrics(values));
  card.append(element('p', `Entered risk ${percentage(report.enteredFraction)} · Streak ceiling ${percentage(report.guardFraction)} · Modeled risk ${percentage(report.effectiveFraction)} of usable room.`, 'hedge-callout'));
  if (report.rows.length > 1 || report.rows[0]?.minimumRisk != null) {
    card.append(table('Account risk per opportunity', ['Account', 'Usable room', 'Starting risk', 'Risk after streak'],
      report.rows.map(row => [row.name, usd(row.room), usd(row.firstRisk), usd(row.postStreakRisk)])));
  }
  const blocked = report.rows.filter(row => row.initialGate === 'blocked' || row.postStreakGate === 'blocked');
  if (blocked.length && remaining > 0) {
    card.append(notes(blocked.map(row => `${row.name} needs ${usd(row.minimumRisk)} for its smallest order, above modeled risk ${row.initialGate === 'blocked' ? 'at the start' : 'after the loss streak'}.`)));
  }

  if (remaining === 0) {
    card.append(element('p', 'Booked P&L meets the goal.', 'hedge-callout'));
    return card;
  }
  if (missingSample) {
    card.append(element('p', 'Enter comparable wins, losses, average win in R, and completed trade pace to estimate the time remaining.', 'hedge-callout'));
  } else {
    card.append(table('Modeled time at your trade pace', ['Scenario', 'Win rate', 'Net geometric growth', 'Horizon'], [
      ['Observed sample', percentage(scenarios.base.winRate), percentage(Math.expm1(scenarios.base.logGrowth)), horizon(scenarios.base)],
      ['Lower win-rate estimate', percentage(scenarios.cautious.winRate), percentage(Math.expm1(scenarios.cautious.logGrowth)), horizon(scenarios.cautious)],
    ]));
    card.append(element('p', `${count.format(sample.count)} comparable trades · ${detail.format(sample.expectedR)}R average expectancy at the observed win rate. The cautious path uses the lower 95% Wilson bound for the win rate.`, 'hedge-help'));
    if (scenarios.base.status === 'projected') {
      card.append(table('When to update risk after booking gains', ['Checkpoint', 'New booked profit', 'Usable room', 'Modeled risk'], report.milestones.map(point => [
        percentage(point.fraction), usd(point.netProfit), usd(point.room), usd(point.risk),
      ])));
      if (report.rows.length > 1) {
        const limits = element('details', '', 'compound-risk-details');
        limits.append(element('summary', 'Modeled risk per Vest account at each checkpoint'), table('Risk per opportunity',
          ['Account', ...report.milestones.map(point => percentage(point.fraction))],
          report.rows.map((row, index) => [row.name, ...report.milestones.map(point => usd(point.accounts[index].risk))])));
        card.append(limits);
      }
    }
  }
  if (report.warnings.length && !blocked.length) card.append(notes(report.warnings));
  return card;
}

function exampleAccounts(amount) {
  const room = read('vestRoom');
  const minimumRisk = read('vestMinimum');
  return Array.from({ length: amount }, (_, index) => ({ id: `example-${index}`, name: `Vest ${index + 1}`, room, minimumRisk }));
}

function vestPlan(parameters) {
  const goal = read('vestGoal');
  const earned = read('vestEarned') ?? 0;
  const amount = read('vestCount');
  const example = source.value === 'example';
  const selected = checkedVestRows();
  if (example && (!Number.isInteger(amount) || amount < 1 || amount > 10)) {
    return { sections: [notes(['Choose a count from 1 to 10 for the Vest example.'])], ready: false };
  }
  if (!example && (!selected.length || selected.length > 10)) {
    return { sections: [notes(['Select 1 to 10 of your tracked Vest accounts.'])], ready: false };
  }
  const minimumRisk = read('vestMinimum');
  const accounts = example ? exampleAccounts(amount) : selected.map(row => ({
    id: row.dataset.vestProfile, name: row.querySelector('[data-vest-name]').textContent,
    room: number(row.querySelector('[data-vest-room]')), minimumRisk,
  }));
  const run = evaluate(accounts, goal, earned, parameters);
  const sections = [reportCard(example ? 'Vest shared goal · example' : 'Vest shared goal · saved profiles', run, parameters)];
  if (example && !run.errors.length && run.remaining > 0) {
    sections.push(table('Compare the same goal at different Vest account counts', ['Accounts', 'Profit per account', 'Starting group risk', 'Observed horizon', 'Cautious horizon'],
      [...new Set([3, 6, 10, amount])].sort((a, b) => a - b).map(size => {
        const comparison = evaluate(exampleAccounts(size), goal, earned, parameters);
        if (comparison.errors.length) return [String(size), usd(run.remaining / size), '—', 'Outside model range', 'Outside model range'];
        return [String(size), usd(run.remaining / size), usd(comparison.report.firstRisk),
          horizon(comparison.report.scenarios.base, run.missingSample), horizon(comparison.report.scenarios.cautious, run.missingSample)];
      })));
  }
  sections.push(element('p', 'Vest accounts can contribute toward the shared target. Their drawdown floors stay separate. A copied same-direction trade counts as one market opportunity for the group.', 'hedge-help'));
  return { sections, ready: !run.errors.length && !run.missingSample && ['projected', 'reached'].includes(run.report.scenarios.base.status) };
}

function individualPlans(parameters) {
  const seen = new Set();
  const reports = rowList().map((row, index) => {
    const profile = rowField(row, 'profile').value;
    const name = rowField(row, 'name').value.trim() || `Account ${index + 1}`;
    const id = profile || row.dataset.compoundAccount;
    const account = { id, name, room: number(rowField(row, 'room')), minimumRisk: number(rowField(row, 'minimum')) };
    const run = seen.has(id) ? { errors: ['Choose a different account for this separate goal.'] }
      : evaluate([account], number(rowField(row, 'target')), number(rowField(row, 'earned')) ?? 0, parameters);
    seen.add(id);
    return { name, run };
  });
  const valid = reports.every(({ run }) => !run.errors.length && !run.missingSample);
  const ready = valid && reports.every(({ run }) => ['projected', 'reached'].includes(run.report.scenarios.base.status));
  const sections = reports.map(({ name, run }) => reportCard(name, run, parameters));
  if (reports.length > 1 && reports.every(({ run }) => !run.errors.length)) {
    const summary = element('section', '', 'compound-result-section');
    const goals = reports.reduce((total, { run }) => total + run.goal, 0);
    const combined = [['Sum of separate profit goals', usd(goals)]];
    if (ready) {
      const slowest = reports.reduce((longest, { run }) => run.report.scenarios.base.weeks > longest.weeks ? run.report.scenarios.base : longest, { weeks: 0, status: 'reached' });
      combined.push(['Parallel time at the entered pace', horizon(slowest)]);
      const cautious = reports.map(({ run }) => run.report.scenarios.cautious);
      if (cautious.every(scenario => scenario.weeks !== null)) {
        const cautiousSlowest = cautious.reduce((longest, scenario) => scenario.weeks > longest.weeks ? scenario : longest);
        combined.push(['Cautious parallel estimate', horizon(cautiousSlowest)]);
      }
    }
    summary.append(element('h3', 'Separate goal summary'), metrics(combined), element('p', 'Each account uses its own drawdown and advances toward its own goal. If the plans run in parallel, the slower plan determines when both are modeled to finish.', 'hedge-help'));
    sections.unshift(summary);
  }
  return { sections, ready };
}

function update() {
  field('compoundVestFields').hidden = mode.value !== 'vest';
  field('compoundIndividualFields').hidden = mode.value === 'vest';
  field('vestExampleFields').hidden = source.value !== 'example';
  savedVest.hidden = source.value === 'example';
  const individualRows = rowList();
  for (const [index, row] of individualRows.entries()) {
    row.querySelector('[data-compound-title]').textContent = rowField(row, 'name').value.trim() || `Account ${index + 1}`;
    row.querySelector('[data-action="remove"]').disabled = individualRows.length === 1;
  }
  for (const row of savedRows()) {
    row.querySelector('[data-vest-room]').disabled = !row.querySelector('input[type="checkbox"]').checked;
  }
  if (!submitted) return;
  const parameters = settings();
  const plan = mode.value === 'vest' ? vestPlan(parameters) : individualPlans(parameters);
  results.replaceChildren(...plan.sections);
  results.hidden = false;
  status.dataset.state = plan.ready ? 'ready' : 'attention';
  status.textContent = plan.ready ? 'Projection calculated from your inputs.' : 'Review the inputs and risk checks below.';
}

function addIndividual(saved) {
  const row = field('compoundIndividualTemplate').content.firstElementChild.cloneNode(true);
  row.dataset.compoundAccount = `manual-${nextRowId++}`;
  const picker = rowField(row, 'profile');
  picker.replaceChildren(new Option('Manual account', ''), ...profiles.individual.map(profile => new Option(profile.name, profile.id)));
  for (const input of row.querySelectorAll('[data-field]')) {
    if (typeof saved?.[input.dataset.field] !== 'string') continue;
    if (input !== picker || [...picker.options].some(option => option.value === saved.profile)) input.value = saved[input.dataset.field];
  }
  rows.append(row);
  return row;
}

function remember() {
  const values = Object.fromEntries(settingsFields.map(id => [id, field(id).value]));
  const accounts = rowList().map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value])));
  const selectedVest = checkedVestRows().map(row => row.dataset.vestProfile);
  const vestRooms = Object.fromEntries(savedRows().flatMap(row => {
    const room = row.querySelector('[data-vest-room]');
    return room.value !== room.defaultValue ? [[row.dataset.vestProfile, room.value]] : [];
  }));
  try { localStorage.setItem(storageKey, JSON.stringify({ values, accounts, selectedVest, vestRooms })); } catch {}
}

for (const id of settingsFields) {
  const value = draft?.values?.[id];
  const input = field(id);
  if (typeof value === 'string' && (input.tagName !== 'SELECT' || [...input.options].some(option => option.value === value))) input.value = value;
}
const restored = Array.isArray(draft?.accounts) && draft.accounts.length ? draft.accounts : [{}];
for (const row of restored) addIndividual(row);
if (profiles.vest.length) {
  savedVest.append(element('p', 'Saved room starts from your Risk Calculator snapshot. Adjust it to reflect closed equity.', 'hedge-help'));
  for (const profile of profiles.vest) {
    const row = element('div', '', 'compound-account compound-saved-profile');
    row.dataset.vestProfile = profile.id;
    const label = element('label', '', 'check-row');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Array.isArray(draft?.selectedVest) && draft.selectedVest.includes(profile.id);
    const name = element('span', profile.name);
    name.setAttribute('data-vest-name', '');
    label.append(checkbox, name);
    const roomLabel = element('label', '', 'field compound-field');
    const room = element('input');
    room.type = 'number';
    room.min = '0';
    room.step = 'any';
    room.inputMode = 'decimal';
    room.defaultValue = profile.room === null ? '' : String(profile.room);
    if (typeof draft?.vestRooms?.[profile.id] === 'string') room.value = draft.vestRooms[profile.id];
    room.setAttribute('data-vest-room', '');
    roomLabel.append(element('span', 'Usable room from closed equity · USD', 'compound-field-caption'), room);
    row.append(label, roomLabel);
    savedVest.append(row);
  }
} else {
  const link = element('a', 'Open Vest Accounts', 'link-button');
  link.href = '../vest/';
  savedVest.append(element('p', 'Track your Vest accounts to select them here.', 'hedge-help'), link);
}

form.addEventListener('input', event => {
  const row = event.target.closest('[data-compound-account]');
  if (row && event.target.dataset.field === 'profile') {
    const profile = profiles.individual.find(item => item.id === event.target.value);
    rowField(row, 'name').value = profile?.name ?? '';
    rowField(row, 'room').value = profile?.room ?? '';
    rowField(row, 'earned').value = '';
    rowField(row, 'minimum').value = '';
  }
  remember();
  update();
});
field('compoundAddIndividual').addEventListener('click', () => {
  const row = addIndividual();
  remember();
  update();
  rowField(row, 'profile').focus();
});
rows.addEventListener('click', event => {
  const button = event.target.closest('[data-action="remove"]');
  if (!button || rowList().length < 2) return;
  button.closest('[data-compound-account]').remove();
  remember();
  update();
  field('compoundAddIndividual').focus();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  submitted = true;
  remember();
  update();
  field('compoundResultsTitle').focus();
});
update();
