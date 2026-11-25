import { MODES, fmt } from '../../engine.mjs';
import { VEST_ROSTER_KEY, createVestAccount, isTrackedVestAccount, mergeVestAccounts, readVestRoster, writeVestRoster } from '../../vest-accounts.mjs';
import { VEST_ROLES, evaluateVestRole, summarizeVestAccounts } from '../../vest-role-plan.mjs';

const field = id => document.getElementById(id);
const rosterEl = field('vestRoster');
const template = field('vestRosterTemplate');
const form = field('vestAddForm');
const nameInput = field('vestAccountName');
const riskKey = 'chicken-man-riskdesk-v1';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = value => Number.isFinite(value) ? currency.format(value) : '—';
const roleIds = ['scalp', 'intraday', 'swing'];
const statusLabels = {
  inactive: 'Inactive', unassigned: 'Unassigned', invalid: 'Check inputs', 'config-needed': 'Set up this role',
  'no-risk': 'No usable drawdown', 'estimate-needed': 'Add a loss estimate', 'over-budget': 'Over budget', 'fits-estimate': 'Fits the entered estimate',
};
const planSelectors = {
  role: '[data-role]', session: '[data-session]',
  overnightConfirmed: '[data-overnight]', weekendConfirmed: '[data-weekend]', plannedLoss: '[data-planned-loss]',
};
let riskDesk = readRiskDesk();
let roster = readVestRoster();

function readRiskDesk() {
  try { return JSON.parse(localStorage.getItem(riskKey)) ?? {}; } catch { return {}; }
}

function trackedAccounts() {
  return mergeVestAccounts(Array.isArray(riskDesk.accounts) ? riskDesk.accounts : [], roster).filter(isTrackedVestAccount);
}

function currentRiskMode() {
  const mode = Object.hasOwn(MODES, riskDesk.mode) ? riskDesk.mode : 'normal';
  const saved = riskDesk.modeFractions?.[mode];
  const fraction = Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : MODES[mode].fraction;
  return { label: MODES[mode].label, fraction };
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function linkAccount(anchor, path, account) {
  const url = new URL(path, window.location.href);
  url.searchParams.set('account', account.id);
  anchor.href = url;
}

function accountMetrics(entries) {
  const metrics = element('dl', '', 'vest-metrics');
  for (const [label, value] of entries) {
    const detail = element('div');
    detail.append(element('dt', label), element('dd', usd(value)));
    metrics.append(detail);
  }
  return metrics;
}

function renderCheck(card, account, plan) {
  const { fraction } = currentRiskMode();
  const report = evaluateVestRole(account, plan, fraction);
  const check = card.querySelector('[data-check]');
  const state = card.querySelector('[data-account-state]');
  const inactive = report.inactive;
  card.dataset.inactive = String(inactive);
  state.dataset.state = report.status;
  state.textContent = statusLabels[report.status];
  card.querySelector('[data-toggle-active]').textContent = inactive ? 'Restore to active' : 'Mark inactive';
  const stackLink = card.querySelector('[data-stack-link]');
  stackLink.hidden = inactive;
  const guide = card.querySelector('[data-role-guide]');
  guide.hidden = !roleIds.includes(report.role);
  if (!guide.hidden) {
    guide.href = `#role-${report.role}`;
    guide.textContent = `${VEST_ROLES[report.role]} playbook`;
  }
  for (const selector of Object.values(planSelectors)) card.querySelector(selector).disabled = inactive;

  const metrics = [
    ['Usable drawdown', report.headroom?.usable], ['Modeled loss cap', report.budget],
  ];
  if (Number.isFinite(report.plannedLoss)) metrics.push(['Estimated stop loss', report.plannedLoss]);
  if (Number.isFinite(report.budgetAfterPlanned)) metrics.push(['Room after estimate', report.budgetAfterPlanned]);
  check.replaceChildren(accountMetrics(metrics));
  const guidance = [...report.errors, ...report.notes];
  if (guidance.length) {
    const list = element('ul');
    list.append(...guidance.map(text => element('li', text)));
    check.append(list);
  }
}

function renderSummary(accounts) {
  const summary = summarizeVestAccounts(accounts, roster.plans);
  const { label, fraction } = currentRiskMode();
  field('vestActiveCount').textContent = String(summary.active);
  field('vestRoleCount').textContent = String(summary.active - summary.byRole.unassigned);
  const categories = [...roleIds, 'unassigned'].map(id => `${summary.byRole[id]} ${VEST_ROLES[id].toLowerCase()}`);
  if (summary.inactive) categories.push(`${summary.inactive} inactive`);
  field('vestRoleBreakdown').textContent = categories.join(' · ');
  field('vestModeSummary').textContent = `Risk Desk mode · ${label} · ${fmt(fraction * 100, 4)}% of usable drawdown`;
  field('vestRosterEmpty').hidden = summary.total > 0;
  for (const id of roleIds) {
    const article = field(`role-${id}`);
    let assigned = article.querySelector('.vest-role-owners');
    if (!assigned) {
      assigned = element('p', '', 'vest-role-owners');
      article.querySelector('h3').after(assigned);
    }
    const names = accounts.filter(account => !roster.plans[account.id]?.inactive && roster.plans[account.id]?.role === id)
      .map(account => account.name);
    assigned.textContent = names.length ? `Assigned · ${names.join(', ')}` : 'No active accounts assigned';
  }
}

function accountCard(account) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.vestAccount = account.id;
  card.querySelector('[data-account-name]').textContent = account.name;
  const plan = roster.plans[account.id] ?? {};
  for (const [key, selector] of Object.entries(planSelectors)) {
    const control = card.querySelector(selector);
    if (control.type === 'checkbox') control.checked = plan[key] === true;
    else control.value = plan[key] ?? (key === 'role' ? 'unassigned' : '');
  }
  linkAccount(card.querySelector('[data-risk-link]'), '../../', account);
  linkAccount(card.querySelector('[data-stack-link]'), '../stack/', account);
  renderCheck(card, account, plan);
  return card;
}

function render() {
  const accounts = trackedAccounts();
  rosterEl.replaceChildren(...accounts.map(accountCard));
  renderSummary(accounts);
}

function save(next, status) {
  if (!writeVestRoster(next)) {
    status.textContent = 'This browser could not save the roster.';
    return false;
  }
  roster = next;
  return true;
}

function updatePlan(card, change) {
  const accounts = trackedAccounts();
  const id = card.dataset.vestAccount;
  const account = accounts.find(item => item.id === id);
  if (!account) return;
  const latest = readVestRoster();
  const plan = { ...latest.plans[id], ...change };
  const status = field('vestRosterStatus');
  if (!save({ ...latest, plans: { ...latest.plans, [id]: plan } }, status)) return;
  renderCheck(card, account, plan);
  renderSummary(accounts);
  status.textContent = plan.inactive ? `${account.name} marked inactive.` : `${account.name} updated.`;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const status = field('vestAddStatus');
  const account = createVestAccount(nameInput.value);
  if (!account) {
    status.textContent = 'Enter a nickname for this Vest account.';
    return;
  }
  roster = readVestRoster();
  if (trackedAccounts().some(existing => existing.name.trim().toLowerCase() === account.name.toLowerCase())) {
    status.textContent = 'An account already uses that nickname. Choose the existing profile or use another nickname.';
    return;
  }
  if (!save({ ...roster, accounts: [...roster.accounts, account] }, status)) return;
  nameInput.value = '';
  render();
  status.textContent = `${account.name} added to the roster.`;
  rosterEl.lastElementChild?.querySelector('[data-role]').focus();
});

rosterEl.addEventListener('change', event => {
  const card = event.target.closest('[data-vest-account]');
  if (!card) return;
  const key = Object.keys(planSelectors).find(name => event.target.matches(planSelectors[name]));
  if (!key) return;
  const target = event.target;
  const value = target.type === 'checkbox' ? target.checked : key === 'plannedLoss' && target.value !== '' ? target.valueAsNumber : target.value;
  updatePlan(card, { [key]: value });
});

rosterEl.addEventListener('click', event => {
  const button = event.target.closest('[data-toggle-active]');
  if (!button) return;
  const card = button.closest('[data-vest-account]');
  updatePlan(card, { inactive: !roster.plans[card.dataset.vestAccount]?.inactive });
});

window.addEventListener('storage', event => {
  if (event.key !== riskKey && event.key !== VEST_ROSTER_KEY) return;
  riskDesk = readRiskDesk();
  roster = readVestRoster();
  render();
});

render();
