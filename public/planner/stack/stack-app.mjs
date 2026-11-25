import { DEFAULT_ACCOUNTS, MODES, fmt } from '../../engine.mjs';
import { fetchContractSpec } from '../../contract-specs.mjs';
import { getCurrentPrice } from '../../quotes.mjs';
import { sizeStackPlan, STACK_CONTRACTS } from '../../stack.mjs';
import { mergeVestAccounts, readVestRoster } from '../../vest-accounts.mjs';
import { VEST_ROLES } from '../../vest-role-plan.mjs';

const field = id => document.getElementById(id);
const form = field('stackForm');
const accountList = field('stackAccounts');
const results = field('stackResults');
const status = field('stackStatus');
const template = field('stackAccountTemplate');
const confirmed = field('stackConfirmed');
const family = field('stackFamily');
const side = field('stackSide');
const storageKey = 'chicken-man-stack-v1';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = value => Number.isFinite(value) ? currency.format(value || 0) : '—';
const quoteTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', timeZoneName: 'short' });
const documentedTakerPercent = 0.0025;
const marketCache = new Map();
const rows = new Map();

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
}

const riskDesk = readLocal('chicken-man-riskdesk-v1');
const draft = readLocal(storageKey);
const plans = draft.plans && typeof draft.plans === 'object' ? draft.plans : {};
let displayedFamily;
const savedAccounts = Array.isArray(riskDesk.accounts) ? riskDesk.accounts : [];
const baseProfiles = [...new Map([...DEFAULT_ACCOUNTS, ...savedAccounts].filter(account =>
  account?.id && ['vest', 'futures'].includes(account.platform) && account.stage !== 'contest',
).map(account => [account.id, account])).values()];
const vestRoster = readVestRoster();
const profiles = mergeVestAccounts(baseProfiles, vestRoster);
const activeProfile = profiles.find(account => account.id === riskDesk.accountId);
const getProfile = id => profiles.find(account => account.id === id);
const getContract = id => STACK_CONTRACTS.find(contract => contract.id === id);
const input = (row, key) => row.querySelector(`[data-field="${key}"]`);

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

function showStatus(message, state) {
  if (status.textContent !== message) status.textContent = message;
  status.dataset.state = state;
}

function invalidate() {
  confirmed.checked = false;
  if (!results.hidden) {
    results.hidden = true;
    showStatus('Inputs changed. Confirm the updated setup and calculate again.', 'attention');
  }
}

function savePlan() {
  const accounts = [...rows].map(([row, state]) => ({
    rateEdited: state.rateEdited,
    values: Object.fromEntries([...row.querySelectorAll('[data-field]')].map(node => [node.dataset.field, node.value])),
  }));
  plans[displayedFamily] = { side: side.value, cap: field('stackPortfolioCap').value, accounts };
}

function remember() {
  try {
    savePlan();
    localStorage.setItem(storageKey, JSON.stringify({ family: displayedFamily, plans }));
  } catch {}
}

function venueMarket(contract, refresh) {
  if (refresh || !marketCache.has(contract.id)) {
    const loaded = Promise.allSettled([fetchContractSpec(contract), getCurrentPrice(contract)]);
    marketCache.set(contract.id, loaded);
    void loaded.then(([spec, quote]) => {
      if ((spec.status === 'rejected' || quote.status === 'rejected') && marketCache.get(contract.id) === loaded) marketCache.delete(contract.id);
    });
  }
  return marketCache.get(contract.id);
}

async function syncMarket(row, refresh = false) {
  const state = rows.get(row);
  const revision = ++state.revision;
  const markRevision = state.markRevision;
  const contract = getContract(input(row, 'contractId').value);
  const marketStatus = row.querySelector('[data-market-status]');
  const specStatus = row.querySelector('[data-spec-status]');
  const refreshButton = row.querySelector('[data-action="refresh-market"]');
  const vest = contract.platform === 'vest';
  state.rules = undefined;
  for (const node of row.querySelectorAll('[data-venue]')) node.hidden = node.dataset.venue !== (vest ? 'vest' : 'cme');
  for (const key of ['feePercent', 'feePerUnit', 'conversion']) {
    const control = input(row, key);
    const visible = key === 'feePerUnit' ? !vest : vest;
    control.disabled = !visible;
    control.closest('.field').hidden = !visible;
  }
  refreshButton.hidden = !vest;
  if (!vest) {
    state.rules = contract;
    marketStatus.textContent = 'Use the mark from your futures platform.';
    specStatus.textContent = `CME ${contract.symbol} · ${fmt(contract.tickSize)} tick · ${usd(contract.pointValueQuote)} per point per contract`;
    return;
  }
  refreshButton.disabled = true;
  marketStatus.textContent = 'Loading Vest’s last public trade…';
  specStatus.textContent = 'Loading Vest order increments…';
  const [spec, quote] = await venueMarket(contract, refresh);
  if (!rows.has(row) || state.revision !== revision) return;
  refreshButton.disabled = false;
  if (spec.status === 'fulfilled') {
    state.rules = { ...contract, ...spec.value };
    state.marketRate = Number.isFinite(spec.value.takerFeeRate) ? spec.value.takerFeeRate * 100 : documentedTakerPercent;
    if (!state.rateEdited) input(row, 'feePercent').value = state.marketRate;
    specStatus.textContent = `${contract.symbol} · ${fmt(state.rules.tickSize, 12)} tick · ${fmt(state.rules.quantityStep, 12)} unit step · ${fmt(state.marketRate, 8)}% public taker rate per fill`;
  } else {
    specStatus.textContent = 'Vest order rules are unavailable. Refresh market data before sizing.';
  }
  if (state.markRevision === markRevision) {
    if (quote.status === 'fulfilled') {
      const mark = input(row, 'mark');
      if (refresh || !mark.value) {
        mark.value = quote.value.price;
        confirmed.checked = false;
        marketStatus.textContent = `Vest ${quote.value.lastKnown ? 'last known trade' : 'public last trade'} · ${quoteTime.format(quote.value.time)}`;
      } else marketStatus.textContent = 'Using the entered or saved mark. Compare it with your platform before sizing.';
    } else marketStatus.textContent = 'Public quote unavailable. Enter your Vest mark from the platform.';
  }
}

function selectContracts(row, preferred) {
  const contractSelect = input(row, 'contractId');
  const profile = getProfile(input(row, 'profile').value);
  const options = STACK_CONTRACTS.filter(contract =>
    contract.reference.toLowerCase() === family.value && (!profile || profile.platform === contract.platform),
  );
  contractSelect.replaceChildren(...options.map(contract => new Option(`${contract.symbol} · ${contract.platform === 'vest' ? 'Vest units' : 'CME contracts'}`, contract.id)));
  const defaultId = profile?.platform === 'futures' ? `f-m${family.value}` : `vest-${family.value}`;
  contractSelect.value = options.some(contract => contract.id === preferred) ? preferred : defaultId;
}

function applyProfile(row) {
  const profile = getProfile(input(row, 'profile').value);
  const fraction = riskDesk.modeFractions?.[riskDesk.mode] ?? MODES[riskDesk.mode]?.fraction;
  for (const [key, value] of Object.entries({
    name: profile?.name, equity: profile?.equity, closedEquity: null, floor: profile?.floor, reserve: profile?.reserve,
    dailyRemaining: profile?.noDailyLimit ? null : profile?.dailyRemaining, maxQuantity: profile?.maxQuantity,
    riskPercent: Number.isFinite(fraction) && fraction > 0 && fraction <= 1 ? Number((fraction * 100).toFixed(4)) : 5,
    existingSide: 'none', existingQuantity: 0, averageEntry: null,
  })) input(row, key).value = value ?? '';
}

function updateRowControls() {
  [...rows.keys()].forEach((row, index) => {
    const name = input(row, 'name').value.trim();
    row.querySelector('[data-account-title]').textContent = name || `Account ${index + 1}`;
    row.querySelector('[data-action="remove"]').disabled = rows.size === 1;
    input(row, 'averageEntry').required = number(input(row, 'existingQuantity')) > 0;
  });
}

function addAccount(saved) {
  const row = template.content.firstElementChild.cloneNode(true);
  const state = { revision: 0, markRevision: 0, rateEdited: saved?.rateEdited === true };
  rows.set(row, state);
  const picker = input(row, 'profile');
  picker.append(new Option('Manual account', 'manual'), ...profiles.map(profile => {
    const plan = vestRoster.plans[profile.id];
    const role = Object.hasOwn(VEST_ROLES, plan?.role) && plan.role !== 'unassigned' ? VEST_ROLES[plan.role] : '';
    const note = plan?.inactive ? 'Inactive' : role;
    const option = new Option(note ? `${profile.name} · ${note}` : profile.name, profile.id);
    option.disabled = plan?.inactive === true;
    return option;
  }));
  picker.value = getProfile(saved?.values?.profile) ? saved.values.profile : 'manual';
  applyProfile(row);
  selectContracts(row, saved?.values?.contractId);
  for (const node of row.querySelectorAll('[data-field]')) {
    const key = node.dataset.field;
    const value = saved?.values?.[key];
    if (key === 'profile' || key === 'contractId' || typeof value !== 'string') continue;
    if (node.tagName !== 'SELECT' || [...node.options].some(option => option.value === value)) node.value = value;
  }
  accountList.append(row);
  updateRowControls();
  void syncMarket(row);
  return row;
}

function readRow(row, state) {
  const value = name => number(input(row, name));
  const name = input(row, 'name').value.trim();
  const profileId = input(row, 'profile').value;
  const instrument = state.rules;
  const vest = instrument?.platform === 'vest';
  return {
    key: profileId === 'manual' ? `${instrument?.platform}:${name.toLowerCase()}` : `profile:${profileId}`,
    name, instrument: instrument && { ...instrument, quoteToUSD: vest ? value('conversion') : 1 },
    equity: value('equity'), closedEquity: value('closedEquity'), floor: value('floor'), reserve: value('reserve') ?? 0,
    riskFraction: value('riskPercent') / 100, dailyRemaining: value('dailyRemaining'), maxQuantity: value('maxQuantity'),
    existingSide: input(row, 'existingSide').value, existingQuantity: value('existingQuantity') ?? 0,
    averageEntry: value('averageEntry'), mark: value('mark'), entry: value('entry'), stop: value('stop'), target: value('target'),
    feeRate: vest ? value('feePercent') / 100 : 0, feePerUnit: vest ? 0 : value('feePerUnit') ?? 0,
    slippageTicks: value('slippageTicks') ?? 0,
  };
}

function metrics(items) {
  const list = element('dl', '', 'hedge-metrics');
  for (const [label, value] of items) {
    const item = element('div');
    item.append(element('dt', label), element('dd', value));
    list.append(item);
  }
  return list;
}

function notes(items) {
  const list = element('ul', '', 'hedge-lines');
  list.append(...items.map(message => element('li', message)));
  return list;
}

function renderPlan(plan, accounts) {
  if (plan.errors.length) {
    results.hidden = false;
    const accountErrors = plan.rows.flatMap((item, index) => item.errors.map(message => `${accounts[index]?.name || `Account ${index + 1}`} · ${message}`));
    results.replaceChildren(notes([...plan.errors, ...accountErrors]));
    showStatus('Update the account and exposure details below before sizing an add.', 'attention');
    return;
  }

  const { portfolio } = plan;
  const summary = metrics([
    ['Open risk to stops', usd(portfolio.existingRisk)], ['Planned added risk', usd(portfolio.addedRisk)],
    ['Combined modeled stop loss', usd(portfolio.totalRisk)],
    ['Room under portfolio cap', Number.isFinite(portfolio.remainingRisk) ? usd(portfolio.remainingRisk) : 'Cap unset'],
  ]);
  const cards = plan.rows.map((item, index) => {
    const { instrument } = accounts[index];
    const card = element('section', '', 'stack-result-account');
    const unit = item.quantity === 1 ? instrument.unit.slice(0, -1) : instrument.unit;
    card.append(element('h3', item.name), element('p', `Add ${fmt(item.quantity, 12)} ${instrument.symbol} ${unit} · ${plan.side === 'long' ? 'Long' : 'Short'}`, 'stack-quantity'));
    const lines = [
      ['Equity used for sizing', usd(item.sizingEquity)], ['Account risk cap', usd(item.riskBudget)],
      ['Existing stop risk', usd(item.existingRisk)], ['New order stop risk', usd(item.addedRisk)],
      ['Total stop risk', usd(item.totalRisk)], ['Projected equity at stop', usd(item.projectedStopEquity)],
      ['Applied stop', `${fmt(item.stop, 12)} pts`],
    ];
    if (Number.isFinite(item.combinedTargetPnL)) lines.push(['Combined P&L to target', usd(item.combinedTargetPnL)]);
    card.append(metrics(lines));
    if (item.reasons?.length) card.append(notes(item.reasons));
    return card;
  });
  const alerts = plan.warnings.length ? [notes(plan.warnings)] : [];
  results.replaceChildren(summary, ...alerts, ...cards);
  results.hidden = false;
  const active = plan.rows.some(item => item.quantity > 0);
  showStatus(active ? 'Same-direction plan calculated.' : 'No new units fit the current setup.', active ? 'ready' : 'attention');
}

function loadPlan(profileId = activeProfile?.id) {
  displayedFamily = family.value;
  const plan = plans[displayedFamily];
  side.value = plan?.side === 'short' ? 'short' : 'long';
  field('stackPortfolioCap').value = typeof plan?.cap === 'string' ? plan.cap : '';
  rows.clear();
  accountList.replaceChildren();
  const firstProfile = vestRoster.plans[profileId]?.inactive ? undefined : profileId;
  const savedRows = Array.isArray(plan?.accounts) && plan.accounts.length ? plan.accounts : [{ values: { profile: firstProfile } }];
  for (const saved of savedRows) addAccount(saved);
  confirmed.checked = false;
  results.hidden = true;
}

if (['nq', 'es'].includes(draft.family)) family.value = draft.family;
const linkedUrl = new URL(window.location.href);
const linkedAccount = getProfile(linkedUrl.searchParams.get('account'));
loadPlan(linkedAccount?.id ?? activeProfile?.id);
if (linkedAccount && !vestRoster.plans[linkedAccount.id]?.inactive) {
  const existing = [...rows.keys()].find(row => input(row, 'profile').value === linkedAccount.id);
  const row = existing ?? addAccount({ values: { profile: linkedAccount.id } });
  linkedUrl.searchParams.delete('account');
  window.history.replaceState(null, '', linkedUrl);
  remember();
  input(row, 'profile').focus();
}

form.addEventListener('input', event => {
  const { target } = event;
  if (target !== confirmed) invalidate();
  else if (!results.hidden) {
    results.hidden = true;
    showStatus('Confirmation changed. Calculate again to review the plan.', 'attention');
  }
  const row = target.closest('[data-stack-account]');
  if (target === family) {
    savePlan();
    loadPlan();
    showStatus('Review the account snapshots for the selected market.', 'attention');
  } else if (row) {
    const state = rows.get(row);
    const key = target.dataset.field;
    if (key === 'profile') {
      const previous = input(row, 'contractId').value;
      applyProfile(row);
      selectContracts(row, previous);
    }
    if (key === 'profile' || key === 'contractId') {
      for (const price of ['mark', 'entry', 'stop', 'target', 'averageEntry']) input(row, price).value = '';
      input(row, 'existingSide').value = 'none';
      input(row, 'existingQuantity').value = '0';
      state.rateEdited = false;
      void syncMarket(row);
    }
    if (key === 'mark') {
      state.markRevision += 1;
      row.querySelector('[data-market-status]').textContent = 'Using your entered platform mark.';
    }
    if (key === 'feePercent') state.rateEdited = target.value !== '' && number(target) !== state.marketRate;
  }
  updateRowControls();
  remember();
});

field('stackAddAccount').addEventListener('click', () => {
  invalidate();
  const row = addAccount();
  input(row, 'profile').focus();
  remember();
});

accountList.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('[data-stack-account]');
  invalidate();
  if (button.dataset.action === 'remove' && rows.size > 1) {
    rows.delete(row);
    row.remove();
    updateRowControls();
    field('stackAddAccount').focus();
  } else if (button.dataset.action === 'refresh-market') void syncMarket(row, true);
  remember();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const currentRoster = readVestRoster();
  if ([...rows.keys()].some(row => currentRoster.plans[input(row, 'profile').value]?.inactive === true)) {
    results.hidden = true;
    showStatus('Remove inactive rows or restore those profiles in Vest Accounts before sizing.', 'attention');
  } else if ([...rows.values()].some(state => !state.rules)) {
    results.hidden = true;
    showStatus('Wait for each account’s order rules or retry market data before sizing.', 'attention');
  } else {
    const accounts = [...rows].map(([row, state]) => readRow(row, state));
    renderPlan(sizeStackPlan({ side: side.value, confirmed: confirmed.checked, portfolioCap: number(field('stackPortfolioCap')), accounts }), accounts);
  }
  remember();
  field('stackResultsTitle').focus();
});
