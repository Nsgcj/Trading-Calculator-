import { fmt } from '../../engine.mjs';
import { sizeHedge, HEDGE_CONTRACTS } from '../../hedge.mjs';
import { getHedgeHorizon } from '../../hedge-horizon.mjs';

const field = id => document.getElementById(id);
const form = field('hedgeForm');
const results = field('hedgeResults');
const status = field('hedgeStatus');
const storageKey = 'chicken-man-hedge-v1';
const numericFields = [
  'portfolioValue', 'beta', 'entryPrice', 'coveragePercent', 'downPercent', 'upPercent', 'riskLimit',
  'feePerContract', 'holdingCostPerContract', 'targetProtection', 'maxContracts', 'availableMargin', 'marginPerContract',
];
const savedFields = [...numericFields, 'contractId', 'direction', 'horizon', 'customDate', 'expiryDate'];
const holdingInputs = new Set(['contractId', 'horizon', 'customDate', 'expiryDate']);
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;
const exitTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
let submitted = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function readNumber(id) {
  const input = field(id);
  if (input.validity.badInput) return NaN;
  return input.value === '' ? undefined : input.valueAsNumber;
}

function showStatus(message, state) {
  if (status.textContent !== message) status.textContent = message;
  status.dataset.state = state;
}

function readHorizon() {
  const type = field('horizon').value;
  const custom = type === 'custom';
  field('customDateField').hidden = !custom;
  field('customDate').disabled = !custom;
  field('customDate').required = custom;
  const horizon = getHedgeHorizon(type, new Date(), field('customDate').value);
  field('horizonSummary').textContent = horizon
    ? `${exitTime.format(horizon.exitAt)} · ${horizon.calendarDays} calendar ${horizon.calendarDays === 1 ? 'day' : 'days'} to exit`
    : 'Choose a future U.S. cash trading date with published hours.';
  return horizon;
}

function scenariosTable(model, down, up) {
  const table = element('table', '', 'hedge-result-table');
  table.createCaption().textContent = 'Modeled P&L through the selected exit';
  const head = table.createTHead().insertRow();
  for (const label of ['Benchmark move', 'Existing position', 'Hedge after costs', 'Combined']) {
    const heading = element('th', label);
    heading.scope = 'col';
    head.append(heading);
  }
  const body = table.createTBody();
  const flat = { underlying: 0, hedgeNet: -model.totalCosts, combined: -model.totalCosts };
  for (const [label, scenario] of [[`Down ${fmt(down, 4)}%`, model.scenarios.down], ['Flat', flat], [`Up ${fmt(up, 4)}%`, model.scenarios.up]]) {
    const row = body.insertRow();
    const heading = element('th', label);
    heading.scope = 'row';
    row.append(heading);
    for (const amount of [scenario.underlying, scenario.hedgeNet, scenario.combined]) {
      const cell = row.insertCell();
      cell.textContent = usd(amount || 0);
      if (amount !== 0) cell.classList.add(amount > 0 ? 'good-text' : 'bad-text');
    }
  }
  const scroll = element('div', '', 'table-wrap');
  scroll.append(table);
  return scroll;
}

function renderResults(model, input, horizon, instrument) {
  const expiry = field('expiryDate').value;
  const checks = [];
  if (!horizon) checks.push('Choose a valid exit date to check the holding period.');
  if (horizon?.calendarDays > 0 && !field('holdingAllowed').checked) {
    checks.push('Confirm your account allows holding through the selected date, including any overnight or weekend sessions.');
  }
  if (horizon && (!expiry || horizon.exitDate >= expiry)) {
    checks.push(expiry
      ? 'The exit reaches or passes this contract’s last trading date. Price a later contract or recalculate with the planned roll.'
      : 'Enter the contract’s last trading date to check whether the position needs a roll.');
  }
  if (model.marginUsed === null) checks.push('No margin inputs. Check available margin and initial overnight margin per contract.');
  if (!(input.feePerContract || input.holdingCostPerContract)) checks.push('Costs are modeled at $0. Update fees, slippage and any holding or roll costs for this horizon.');

  const hedge = model.quantity === 0 ? '0 contracts' : `${fmt(model.quantity)} ${instrument.symbol} · ${model.hedgeDirection === 'short' ? 'Short' : 'Long'}`;
  const heading = element('h3', hedge);
  const stats = element('dl', '', 'hedge-metrics');
  const constraints = Object.values(model.limits).filter(limit => limit !== null);
  const lines = [
    ['Benchmark exposure', usd(model.exposure)],
    ['Hedge notional', usd(model.hedgeNotional)],
    ['Exposure offset', `${fmt(model.actualCoveragePercent, 2)}%`],
    ['Contract capacity under inputs', fmt(Math.min(...constraints))],
    ['Net protection in the loss scenario', usd(model.protection)],
    ['Estimated total costs', usd(model.totalCosts)],
    ['Modeled margin used', model.marginUsed === null ? 'Not checked' : usd(model.marginUsed)],
  ];
  if (model.quantity > 0) lines.push(['Move needed to cover costs', `${fmt(model.breakEvenPercent, 4)}%`]);
  for (const [label, value] of lines) {
    const row = element('div');
    row.append(element('dt', label), element('dd', value));
    stats.append(row);
  }

  const details = [heading, stats, scenariosTable(model, input.downPercent, input.upPercent)];
  if (model.shortfall > 0) {
    details.push(element('p', `${usd(model.shortfall)} short of your net protection target under these assumptions. The result stays within your quantity, loss and margin inputs.`, 'hedge-callout'));
  } else if (input.targetProtection > 0) {
    details.push(element('p', 'This is the smallest whole-contract size that meets the net protection target in your modeled loss scenario.', 'hedge-callout'));
  }
  if (model.quantity > 0) {
    details.push(element('p', 'The hedge lowers modeled gains when the benchmark moves in your favor. Actual holdings may diverge from the benchmark, especially around gaps and events. The scenarios share the same beta and assume the futures moves with its benchmark.', 'hedge-callout'));
  }
  const notes = [...model.warnings, ...checks];
  if (notes.length) {
    const list = element('ul', '', 'hedge-lines');
    list.append(...notes.map(note => element('li', note)));
    details.push(list);
  }
  results.replaceChildren(...details);
  results.hidden = false;
  const message = model.quantity === 0 ? 'No hedge contracts in this scenario.'
    : checks.length ? 'Scenario calculated. Review the holding and cost checks below.' : 'Scenario calculated.';
  showStatus(message, checks.length ? 'attention' : 'ready');
}

function update() {
  const horizon = readHorizon();
  if (!submitted) return;
  const input = Object.fromEntries(numericFields.map(id => [id, readNumber(id)]));
  input.direction = field('direction').value;
  input.contractId = field('contractId').value;
  const model = sizeHedge(input);
  if (model.errors.length) {
    showStatus(model.errors.join(' '), 'attention');
    results.hidden = true;
    return;
  }
  const instrument = HEDGE_CONTRACTS.find(contract => contract.id === input.contractId);
  renderResults(model, input, horizon, instrument);
}

function remember() {
  try {
    const values = Object.fromEntries(savedFields.map(id => [id, field(id).value]));
    localStorage.setItem(storageKey, JSON.stringify({ values, submitted }));
  } catch {}
}

field('contractId').append(...HEDGE_CONTRACTS.map(contract =>
  new Option(`${contract.symbol} · ${contract.name} (${usd(contract.pointValueQuote)}/point)`, contract.id),
));
field('contractId').value = 'f-mes';
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const id of savedFields) {
    if (typeof saved?.values?.[id] === 'string') field(id).value = saved.values[id];
  }
  submitted = saved?.submitted === true;
} catch {}

form.addEventListener('input', event => {
  if (holdingInputs.has(event.target.id)) field('holdingAllowed').checked = false;
  update();
  remember();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  submitted = true;
  update();
  remember();
  field('hedgeResultsTitle').focus();
});
update();
