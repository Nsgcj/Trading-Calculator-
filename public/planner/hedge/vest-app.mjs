import { DEFAULT_ACCOUNTS, DEFAULT_INSTRUMENTS, MODES, fmt, getHeadroom, getRiskBudget } from '../../engine.mjs';
import { fetchContractSpec } from '../../contract-specs.mjs';
import { getCurrentPrice } from '../../quotes.mjs';
import { sizeVestHedge } from '../../vest-hedge.mjs';

const field = id => document.getElementById(id);
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = amount => currency.format(amount || 0);
const quoteTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const draftKey = 'chicken-man-vest-hedge-v1';
const publishedIndexTakerPercent = 0.0025;
const instruments = DEFAULT_INSTRUMENTS.filter(item => item.platform === 'vest');
const draftFields = [
  'vestInstrument', 'vestHedgeAccount', 'vestHeldSide', 'vestHeldQuantity', 'vestRiskMode', 'vestRiskPercent', 'vestCoveragePercent',
  'vestDownPoints', 'vestUpPoints', 'vestProtectionTarget', 'vestFeePercent', 'vestSlippageTicks', 'vestHoldingCost', 'vestConversion',
];

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

function scenarioTable(model, down, up) {
  const table = element('table', '', 'hedge-result-table');
  table.createCaption().textContent = 'Modeled P&L from this entry';
  const header = table.createTHead().insertRow();
  for (const label of ['Vest price move', 'Existing leg before costs', 'Hedge after costs', 'Combined P&L']) {
    const cell = element('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = table.createTBody();
  for (const [label, scenario] of [[`Down ${fmt(down)} pts`, model.scenarios.down], ['Flat', model.scenarios.flat], [`Up ${fmt(up)} pts`, model.scenarios.up]]) {
    const row = body.insertRow();
    const title = element('th', label);
    title.scope = 'row';
    row.append(title);
    for (const value of [scenario.underlying, scenario.hedgeNet, scenario.combined]) {
      const cell = row.insertCell();
      cell.textContent = usd(value);
      if (value !== 0) cell.classList.add(value < 0 ? 'bad-text' : 'good-text');
    }
  }
  const scroll = element('div', '', 'table-wrap');
  scroll.append(table);
  return scroll;
}

function fillRulesNote() {
  const paragraph = field('vestRulesNote');
  const rules = element('a', 'Vest Capital account rules');
  rules.href = 'https://next.vestmarkets.com/prop-terms-of-service';
  rules.target = '_blank';
  rules.rel = 'noopener noreferrer';
  paragraph.replaceChildren('Vest Capital allows offsetting positions across permitted accounts and prohibits self-matching. Each account has its own limits. ', rules);
}

export function initVestHedge(riskDesk) {
  const form = field('vestHedgeForm');
  const results = field('vestHedgeResults');
  const status = field('vestHedgeStatus');
  const accountPicker = field('vestHedgeAccount');
  const riskPicker = field('vestRiskMode');
  const priceField = field('vestEntry');
  const feeField = field('vestFeePercent');
  const savedAccounts = Array.isArray(riskDesk.accounts) ? riskDesk.accounts : [];
  const vestAccounts = savedAccounts.filter(account => account?.platform === 'vest' && typeof account.id === 'string');
  if (!vestAccounts.some(account => account.id === 'vest')) vestAccounts.push(DEFAULT_ACCOUNTS.find(account => account.id === 'vest'));
  const getInstrument = () => instruments.find(item => item.id === field('vestInstrument').value) ?? instruments[0];
  let rules;
  let request;
  let priceRevision = 0;
  let submitted = false;
  let venueFeePercent;
  let feeEdited = false;
  let draft;

  function showStatus(message, state) {
    if (status.textContent !== message) status.textContent = message;
    status.dataset.state = state;
  }

  function setAccount(id) {
    const account = vestAccounts.find(item => item.id === id);
    const values = {
      vestEquity: account?.equity, vestFloor: account?.floor, vestReserve: account?.reserve,
      vestDailyRemaining: account?.noDailyLimit ? null : account?.dailyRemaining, vestMaxQuantity: account?.maxQuantity,
    };
    for (const [fieldId, value] of Object.entries(values)) field(fieldId).value = value ?? '';
  }

  function setRisk(mode) {
    const saved = riskDesk.modeFractions?.[mode];
    const fraction = Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : MODES[mode]?.fraction;
    if (Number.isFinite(fraction)) field('vestRiskPercent').value = Number((fraction * 100).toFixed(4));
  }

  function accountSnapshot() {
    return {
      equity: readNumber('vestEquity'), floor: readNumber('vestFloor'), reserve: readNumber('vestReserve') ?? 0,
      dailyRemaining: readNumber('vestDailyRemaining'), maxQuantity: readNumber('vestMaxQuantity'),
    };
  }

  function renderBudget(account, fraction) {
    const headroom = getHeadroom(account);
    const budget = getRiskBudget(account, fraction);
    field('vestBudgetSummary').textContent = headroom && Number.isFinite(budget)
      ? `${usd(headroom.usable)} usable drawdown · ${usd(budget)} hedge loss cap for this scenario`
      : 'Enter current equity and the current failure floor to see available risk.';
  }

  function render(model, input) {
    const instrument = input.instrument;
    const header = element('h3', `${fmt(model.quantity, 12)} ${instrument.symbol} units${model.quantity > 0 ? ` · ${model.hedgeDirection === 'long' ? 'Long' : 'Short'}` : ''}`);
    const stats = element('dl', '', 'hedge-metrics');
    const adverse = model.scenarios[model.hedgeDirection === 'long' ? 'down' : 'up'];
    for (const [label, value] of [
      ['Hedge loss cap', usd(model.riskBudget)], ['Exposure offset', `${fmt(model.actualCoveragePercent, 3)}%`],
      ['Hedge notional', usd(model.hedgeNotional)], ['Hedge loss in its adverse scenario', usd(Math.max(0, -adverse.hedgeNet))],
      ['Protection after costs', usd(model.protection)], ['Estimated hedge costs in the adverse scenario', usd(adverse.totalCosts)],
    ]) {
      const item = element('div');
      item.append(element('dt', label), element('dd', value));
      stats.append(item);
    }
    const details = [header, stats, scenarioTable(model, input.downPoints, input.upPoints)];
    if (model.shortfall > 0) details.push(element('p', `${usd(model.shortfall)} short of your modeled protection target.`, 'hedge-callout'));
    const notes = [...model.warnings, 'Combined P&L is for comparison. Each account’s drawdown, margin and liquidation are separate. Check Vest’s available size and temporary leverage limits before holding around a closure or release.'];
    const list = element('ul', '', 'hedge-lines');
    list.append(...notes.map(note => element('li', note)));
    results.replaceChildren(...details, list);
    results.hidden = false;
    showStatus(model.quantity > 0 ? 'Vest scenario calculated.' : 'No tradable Vest hedge size under these inputs.', model.quantity > 0 ? 'ready' : 'attention');
  }

  function update() {
    const account = accountSnapshot();
    const riskFraction = readNumber('vestRiskPercent') / 100;
    renderBudget(account, riskFraction);
    if (!submitted) return;
    if (request || !rules) {
      results.hidden = true;
      showStatus(request ? 'Loading Vest market data…' : 'Vest order rules are unavailable. Refresh the market data to size the hedge.', 'attention');
      return;
    }
    const input = {
      account, riskFraction, instrument: { ...getInstrument(), ...rules, quoteToUSD: readNumber('vestConversion') },
      side: field('vestHeldSide').value, existingQuantity: readNumber('vestHeldQuantity'), entryPrice: readNumber('vestEntry'),
      coveragePercent: readNumber('vestCoveragePercent'), downPoints: readNumber('vestDownPoints'), upPoints: readNumber('vestUpPoints'),
      targetProtection: readNumber('vestProtectionTarget'), slippageTicks: readNumber('vestSlippageTicks'),
      feeRate: readNumber('vestFeePercent') / 100, fundingPerUnit: readNumber('vestHoldingCost'),
    };
    const model = sizeVestHedge(input);
    if (model.errors.length) {
      results.hidden = true;
      showStatus(model.errors.join(' '), 'attention');
      return;
    }
    render(model, input);
  }

  async function loadMarket() {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const instrument = getInstrument();
    const revision = priceRevision;
    rules = undefined;
    field('vestRefreshQuote').disabled = true;
    field('vestSpecStatus').textContent = 'Loading Vest tick size and order increments…';
    field('vestQuoteStatus').textContent = 'Loading Vest’s last public price…';
    update();
    await Promise.all([
      fetchContractSpec(instrument, { signal: controller.signal }).then(spec => {
        if (controller.signal.aborted) return;
        rules = spec;
        venueFeePercent = Number.isFinite(spec.takerFeeRate) ? spec.takerFeeRate * 100 : publishedIndexTakerPercent;
        if (!feeEdited) feeField.value = venueFeePercent;
        const fee = ` · Published market taker fee ${fmt(venueFeePercent, 8)}% per fill`;
        field('vestSpecStatus').textContent = `Vest ${instrument.symbol} · ${fmt(spec.tickSize, 12)} tick · ${fmt(spec.quantityStep, 12)} unit step · ${fmt(spec.minQuantity, 12)} units minimum${fee}`;
      }).catch(() => {
        if (!controller.signal.aborted) field('vestSpecStatus').textContent = 'Vest order rules are unavailable. Refresh market data to retry.';
      }),
      getCurrentPrice(instrument, { signal: controller.signal }).then(quote => {
        if (controller.signal.aborted || revision !== priceRevision) return;
        priceField.value = quote.price;
        field('vestQuoteStatus').textContent = `Vest ${quote.lastKnown ? 'last known trade' : 'public last trade'} · ${quoteTime.format(quote.time)}`;
      }).catch(() => {
        if (!controller.signal.aborted && revision === priceRevision) field('vestQuoteStatus').textContent = 'Public price unavailable. Enter your Vest platform price.';
      }),
    ]);
    if (request === controller) {
      request = undefined;
      field('vestRefreshQuote').disabled = false;
      update();
    }
  }

  function remember() {
    try {
      const values = Object.fromEntries(draftFields.map(id => [id, field(id).value]));
      localStorage.setItem(draftKey, JSON.stringify({ values, feeEdited }));
    } catch {}
  }

  accountPicker.append(new Option('Enter current Vest account values', 'manual'), ...vestAccounts.map(account => new Option(account.name, account.id)));
  riskPicker.append(...Object.entries(MODES).map(([key, mode]) => new Option(mode.label, key)), new Option('Custom', 'custom'));
  accountPicker.value = savedAccounts.some(account => account?.id === riskDesk.accountId && account.platform === 'vest') ? riskDesk.accountId : 'manual';
  riskPicker.value = Object.hasOwn(MODES, riskDesk.mode) ? riskDesk.mode : 'normal';
  setRisk(riskPicker.value);
  try { draft = JSON.parse(localStorage.getItem(draftKey)); } catch {}
  for (const id of draftFields) {
    if (typeof draft?.values?.[id] !== 'string') continue;
    const input = field(id);
    if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === draft.values[id])) continue;
    input.value = draft.values[id];
  }
  feeEdited = draft?.feeEdited === true;
  setAccount(accountPicker.value);
  fillRulesNote();
  form.addEventListener('input', event => {
    const id = event.target.id;
    if (id === 'vestHedgeAccount') setAccount(accountPicker.value);
    if (id === 'vestRiskMode') setRisk(riskPicker.value);
    if (id === 'vestRiskPercent') riskPicker.value = 'custom';
    if (id === 'vestFeePercent') feeEdited = feeField.value !== '' && readNumber('vestFeePercent') !== venueFeePercent;
    if (id === 'vestEntry') {
      priceRevision += 1;
      field('vestQuoteStatus').textContent = priceField.value ? 'Using your entered Vest price.' : 'Enter your Vest price or refresh the public quote.';
    }
    if (id === 'vestInstrument') {
      priceField.value = '';
      void loadMarket();
    }
    remember();
    update();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitted = true;
    update();
    field('vestHedgeResultsTitle').focus();
  });
  field('vestRefreshQuote').addEventListener('click', () => { void loadMarket(); });
  void loadMarket();
}
