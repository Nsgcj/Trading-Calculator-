import { fmt } from '../../../engine.mjs';
import { HEDGE_CONTRACTS } from '../../../hedge.mjs';
import { checkHedgeFlip } from '../../../hedge-flip.mjs';
import { checkProtection, sizeHedgeReduction } from '../../../hedge-protection.mjs';

const field = id => document.getElementById(id);
const form = field('reviewForm');
const result = field('reviewResults');
const status = field('reviewStatus');
const reviewTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;
const storageKey = 'chicken-man-hedge-review-v1';
const accountInputs = ['PeakEquity', 'FirmFloor', 'Reserve', 'Giveback'];
const savedFields = [
  'contractId', 'hedgeSide', 'invalidationPrice', 'warningTicks', 'openContracts', 'adverseTicks', 'exitCostPerContract',
  ...accountInputs.map(key => `hedge${key}`), ...accountInputs.map(key => `other${key}`),
];
const candleInputs = new Set(['contractId', 'hedgeSide', 'invalidationPrice', 'lastClose']);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function number(id) {
  const input = field(id);
  if (input.validity.badInput) return NaN;
  return input.value === '' ? undefined : input.valueAsNumber;
}

function metrics(rows) {
  const list = element('dl', '', 'hedge-metrics');
  for (const [label, value] of rows) {
    const row = element('div');
    row.append(element('dt', label), element('dd', value));
    list.append(row);
  }
  return list;
}

function accountSnapshot(prefix) {
  return checkProtection({
    equity: number(`${prefix}Equity`),
    peakEquity: number(`${prefix}PeakEquity`),
    firmFloor: number(`${prefix}FirmFloor`),
    reserve: number(`${prefix}Reserve`) ?? 0,
    giveback: number(`${prefix}Giveback`),
  });
}

const chartStatuses = {
  intact: ['Structure intact', 'The completed candle remains outside the warning zone on the favorable side of the hedge level.'],
  watch: ['Early warning', 'Price is at the level or within your warning distance. Prepare the next review while you wait for a candle close through it.'],
  broken: ['Break awaiting confirmation', 'A candle closed through the level. Watch for a retest that holds on the far side or a subsequent close that stays there.'],
  confirmed: ['Flip confirmed by your chart check', 'The close breached the level and you confirmed follow-through. Reassess whether the original exposure still needs this hedge.'],
};

function chartResult(chart, level, lastClose) {
  const section = element('section', '', 'review-chart-result');
  const [title, description] = chartStatuses[chart.state];
  section.append(element('h3', title), element('p', description), metrics([
    ['Level', fmt(level, 8)], ['Completed close', fmt(lastClose, 8)],
    ['Warning starts', `${chart.adverseDirection === 'above' ? 'At or above' : 'At or below'} ${fmt(chart.threshold, 8)}`],
    ['Distance to level', chart.distanceTicks === 0 ? 'At level' : `${fmt(Math.abs(chart.distanceTicks), 2)} ticks ${chart.distanceTicks > 0 ? 'past' : 'before'} the level`],
  ]));
  return section;
}

function accountResult(title, account) {
  const section = element('section');
  section.append(element('h3', title), metrics([
    ['Current equity', usd(account.equity)],
    ['High-water equity', usd(account.peakEquity)],
    ['Giveback already used', usd(account.givebackUsed)],
    ['Profit floor', usd(account.profitFloor)],
    ['Firm floor plus reserve', usd(account.firmThreshold)],
    ['Protected floor', usd(account.protectedFloor)],
    ['Room to protected floor', usd(account.room)],
  ]));
  if (account.atLimit) section.append(element('p', 'Equity is at or below the protected floor.', 'hedge-callout'));
  return section;
}

function reductionResult(reduction, openContracts, contract) {
  const section = element('section');
  section.append(element('h3', 'Size under your stress move'), metrics([
    ['Open contracts', `${fmt(openContracts)} ${contract.symbol}`],
    ['Most contracts that fit', fmt(reduction.keep)],
    ['Minimum modeled trim', fmt(reduction.trim)],
    ['Adverse move per remaining contract', usd(reduction.riskPerContract)],
    ['Estimated total exit costs', usd(reduction.totalExitCost)],
    ['Modeled equity after trim, stress and exit', usd(reduction.modeledEquity)],
    ['Modeled room after costs and stress', usd(reduction.remainingRoom)],
  ]));
  if (reduction.unavoidableCost > 0) {
    section.append(element('p', `Even closing all contracts would use ${usd(reduction.unavoidableCost)} more than the room available for exit costs.`, 'hedge-callout'));
  } else if (reduction.firmThresholdReached) {
    section.append(element('p', 'Modeled equity still reaches the firm floor plus reserve. Review permitted risk reduction.', 'hedge-callout'));
  }
  return section;
}

function showStatus(message, state) {
  status.textContent = message;
  status.dataset.state = state;
}

function reviewStatus(chart, hedge, other, reduction, openContracts) {
  if (hedge.atLimit) return ['The hedge account is at or below its protected floor.', 'attention'];
  if (reduction.unavoidableCost > 0 || reduction.firmThresholdReached) return ['Estimated exit costs exhaust the hedge account’s protection room.', 'attention'];
  if (other?.atLimit) return ['The separate account is at or below its protected floor. Recheck its exposure before changing hedge coverage.', 'attention'];
  if (openContracts === 0) return ['No open hedge contracts. The account and chart checks are below.', 'ready'];
  if (reduction.trim > 0) return [`The stress check calls for a modeled trim of ${fmt(reduction.trim)}. Review the exposure that remains on both sides.`, 'attention'];
  if (chart.state === 'intact') return ['Current hedge size fits the entered stress move. The chart level remains intact.', 'ready'];
  return [`${chartStatuses[chart.state][0]}. The current size fits the entered stress move.`, 'attention'];
}

function runReview() {
  const contractId = field('contractId').value;
  const level = number('invalidationPrice');
  const lastClose = number('lastClose');
  const chart = checkHedgeFlip({
    contractId, hedgeSide: field('hedgeSide').value,
    invalidationPrice: level, lastClose, warningTicks: number('warningTicks') ?? 4,
    confirmedFollowThrough: field('confirmedFollowThrough').checked,
  });
  const hedge = accountSnapshot('hedge');
  const other = field('includeOther').checked ? accountSnapshot('other') : null;
  const openContracts = number('openContracts');
  const reduction = sizeHedgeReduction({
    contractId, openContracts, adverseTicks: number('adverseTicks'),
    exitCostPerContract: number('exitCostPerContract') ?? 0, protection: hedge,
  });
  const errors = [...chart.errors, ...hedge.errors, ...(other?.errors ?? []), ...reduction.errors];
  if (errors.length) {
    result.hidden = true;
    showStatus([...new Set(errors)].join(' '), 'attention');
    return;
  }

  field('hedgePeakEquity').value = hedge.peakEquity;
  if (other) field('otherPeakEquity').value = other.peakEquity;
  const contract = HEDGE_CONTRACTS.find(item => item.id === contractId);
  const sections = [element('p', `Manual review · ${reviewTime.format(new Date())}`, 'review-stage'), chartResult(chart, level, lastClose),
    reductionResult(reduction, openContracts, contract), accountResult('Hedge account', hedge)];
  if (other) sections.push(accountResult('Other account', other));
  sections.push(element('p', 'Size assumes the move and costs you entered. Gaps and slippage can pass an equity floor. Recheck exposure on both accounts before removing hedge coverage.', 'hedge-callout'));
  result.replaceChildren(...sections);
  result.hidden = false;
  showStatus(...reviewStatus(chart, hedge, other, reduction, openContracts));
}

function showOtherAccount() {
  const fields = field('otherAccountFields');
  const active = field('includeOther').checked;
  fields.hidden = !active;
  for (const input of fields.querySelectorAll('input')) input.disabled = !active;
}

function remember() {
  try {
    const values = Object.fromEntries(savedFields.map(id => [id, field(id).value]));
    localStorage.setItem(storageKey, JSON.stringify({ values, includeOther: field('includeOther').checked }));
  } catch {}
}

field('contractId').append(...HEDGE_CONTRACTS.map(contract => new Option(`${contract.symbol} · ${contract.name}`, contract.id)));
field('contractId').value = 'f-mes';
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const id of savedFields) {
    if (typeof saved?.values?.[id] === 'string') field(id).value = saved.values[id];
  }
  field('includeOther').checked = saved?.includeOther === true;
} catch {}
showOtherAccount();

form.addEventListener('input', event => {
  if (candleInputs.has(event.target.id)) field('confirmedFollowThrough').checked = false;
  showOtherAccount();
  if (!result.hidden) {
    result.hidden = true;
    showStatus('Inputs changed. Run the review again to refresh the result.', 'pending');
  }
  remember();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  runReview();
  remember();
  field('reviewResultsTitle').focus();
});
