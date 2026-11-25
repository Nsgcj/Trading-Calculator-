import { DEFAULT_INSTRUMENTS, getHeadroom, getRiskBudget, roundQuantityDown } from './engine.mjs';

const families = new Map([
  ['f-es', 'ES'], ['f-mes', 'ES'], ['vest-es', 'ES'],
  ['f-nq', 'NQ'], ['f-mnq', 'NQ'], ['vest-nq', 'NQ'],
]);
export const STACK_CONTRACTS = Object.freeze(DEFAULT_INSTRUMENTS.filter(instrument => families.has(instrument.id)));
const contracts = new Map(STACK_CONTRACTS.map(instrument => [instrument.id, instrument]));
const blank = value => value == null || (typeof value === 'string' && !value.trim());
const number = value => !blank(value) && (typeof value === 'number' || typeof value === 'string') ? Number(value) : NaN;
const optionalNumber = value => blank(value) ? null : number(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const positive = value => Number.isFinite(value) && value > 0;

function contractSpec(instrument) {
  const preset = contracts.get(instrument?.id);
  if (!preset || instrument.symbol !== preset.symbol || instrument.platform !== preset.platform || instrument.unit !== preset.unit) {
    return null;
  }
  if (preset.platform === 'futures') return preset;
  return instrument;
}

function tickPrice(price, tick, direction) {
  const units = price / tick;
  return tick * (direction === 'down' ? Math.floor(units + 1e-10) : Math.ceil(units - 1e-10));
}

function remainingQuantity(maxQuantity, existingQuantity, step) {
  if (maxQuantity === null) return null;
  const bounded = Math.min(maxQuantity, step * Number.MAX_SAFE_INTEGER);
  const rounded = roundQuantityDown(bounded, step);
  const cap = rounded <= bounded ? rounded : roundQuantityDown(rounded - step, step);
  return roundQuantityDown(cap - existingQuantity, step);
}

function prepareRow(row, side) {
  const errors = [];
  const key = typeof row?.key === 'string' ? row.key.trim() : '';
  const name = typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : key;
  if (!key) errors.push('Select an account with a unique identifier.');
  const spec = contractSpec(row?.instrument);
  if (!spec) errors.push('Select a matching ES, MES, NQ, MNQ or Vest index perpetual.');
  const family = spec ? families.get(spec.id) : null;
  const equity = number(row?.equity);
  const closedEquity = number(row?.closedEquity);
  const sizingEquity = Math.min(equity, closedEquity);
  const floor = number(row?.floor);
  const reserve = optionalNumber(row?.reserve) ?? 0;
  const dailyRemaining = optionalNumber(row?.dailyRemaining);
  const riskInputs = { equity: sizingEquity, floor, reserve, dailyRemaining };
  const headroom = getHeadroom(riskInputs);
  const riskBudget = getRiskBudget(riskInputs, number(row?.riskFraction));
  if (!headroom || riskBudget === null) errors.push('Enter valid marked and closed equity, account floor, reserve, risk mode and optional daily cap.');
  const maxQuantity = optionalNumber(row?.maxQuantity);
  if (maxQuantity !== null && !nonnegative(maxQuantity)) errors.push('Enter a valid total account quantity cap.');

  const existingSide = row?.existingSide;
  const existingQuantity = number(row?.existingQuantity);
  const hasPosition = existingQuantity > 0;
  if (!['none', 'long', 'short'].includes(existingSide) || !nonnegative(existingQuantity) || (hasPosition && existingSide === 'none')) {
    errors.push('Provide the current exposure side and native quantity.');
  }
  if (hasPosition && existingSide !== 'none' && existingSide !== side) {
    errors.push('An existing position is opposite this stack. All additions are blocked.');
  }
  const mark = optionalNumber(row?.mark);
  const averageEntry = optionalNumber(row?.averageEntry);
  if (hasPosition && (!positive(mark) || !positive(averageEntry))) {
    errors.push('Enter the current mark and actual average entry for the open position.');
  }
  const entry = number(row?.entry);
  const requestedStop = number(row?.stop);
  const requestedTarget = optionalNumber(row?.target);
  const isLong = side === 'long';
  const direction = isLong ? 1 : -1;
  if (!positive(entry) || !positive(requestedStop)
    || direction * (entry - requestedStop) <= 0
    || (hasPosition && direction * (mark - requestedStop) <= 0)) {
    errors.push('Enter a positive structural stop beyond the proposed entry and any current mark in the loss direction.');
  }
  if (requestedTarget !== null && (!positive(requestedTarget)
    || direction * (requestedTarget - entry) <= 0
    || (hasPosition && direction * (requestedTarget - mark) <= 0))) {
    errors.push('Enter a target beyond the proposed entry and any current mark in the profit direction.');
  }

  const feeRate = optionalNumber(row?.feeRate) ?? 0;
  const feePerUnit = optionalNumber(row?.feePerUnit) ?? 0;
  const slippageTicks = optionalNumber(row?.slippageTicks) ?? 0;
  if (![feeRate, feePerUnit, slippageTicks].every(nonnegative) || feeRate > 1) {
    errors.push('Enter nonnegative slippage and per-side costs, with fee rate between 0 and 1.');
  }
  const tick = number(spec?.tickSize);
  const pointQuote = number(spec?.pointValueQuote);
  const fx = number(spec?.quoteToUSD);
  const step = number(spec?.quantityStep);
  const minimum = number(spec?.minQuantity);
  if (![tick, pointQuote, fx, step, minimum].every(positive) || (spec?.platform === 'vest' && pointQuote !== 1)) {
    errors.push('Load valid contract increments, point value and quote-to-USD conversion.');
  }
  if (hasPosition && positive(step)) {
    const increments = existingQuantity / step;
    if (!Number.isSafeInteger(Math.round(increments)) || Math.abs(increments - Math.round(increments)) > 1e-8) {
      errors.push('The current position must use the instrument quantity increment.');
    }
  }
  if (errors.length) return { key, name, family, errors };

  const stop = tickPrice(requestedStop, tick, isLong ? 'down' : 'up');
  const target = requestedTarget === null ? null : tickPrice(requestedTarget, tick, isLong ? 'down' : 'up');
  if (!positive(stop) || (target !== null && (!positive(target) || direction * (target - entry) <= 0
    || (hasPosition && direction * (target - mark) <= 0)))) {
    return { key, name, family, errors: ['The stop and optional target must fit valid instrument ticks.'] };
  }
  const cashPerPoint = pointQuote * fx;
  const slipPoints = slippageTicks * tick;
  const slippageCost = slipPoints * cashPerPoint;
  // Existing marked equity already reflects entry costs. Each modeled exit funds only its own remaining costs.
  const exitCost = price => (price + slipPoints) * cashPerPoint * feeRate + feePerUnit + slippageCost;
  const addEntryCost = entry * cashPerPoint * feeRate + feePerUnit;
  const existingRisk = hasPosition ? existingQuantity * (direction * (mark - stop) * cashPerPoint + exitCost(stop)) : 0;
  const addedRiskPerUnit = direction * (entry - stop) * cashPerPoint + addEntryCost + exitCost(stop);
  const existingTargetPnL = target === null ? null
    : hasPosition ? existingQuantity * (direction * (target - mark) * cashPerPoint - exitCost(target)) : 0;
  const addedTargetPerUnit = target === null ? null : direction * (target - entry) * cashPerPoint - addEntryCost - exitCost(target);
  const quantityRoom = remainingQuantity(maxQuantity, existingQuantity, step);
  const favorable = !hasPosition || (direction * (mark - averageEntry) > 0 && direction * (entry - averageEntry) > 0);
  if (!nonnegative(existingRisk) || !positive(addedRiskPerUnit)
    || ![equity - existingRisk, sizingEquity - existingRisk].every(Number.isFinite)
    || (target !== null && ![existingTargetPnL, addedTargetPerUnit].every(Number.isFinite))) {
    return { key, name, family, errors: ['These prices, position size or modeled costs are outside the supported range.'] };
  }
  return {
    key, name, family, errors, equity, sizingEquity, floor, headroom, riskBudget, existingRisk,
    addedRiskPerUnit, existingTargetPnL, addedTargetPerUnit, quantityRoom, favorable, stop, target,
    step, minimum,
  };
}

function sizeRow(row, confirmed, planErrors, portfolioRoom) {
  if (row.errors.length) return { key: row.key, name: row.name, errors: row.errors, reasons: [], quantity: 0 };
  const reasons = [];
  const accountRisk = Math.max(0, row.riskBudget - row.existingRisk);
  const availableRisk = Math.min(accountRisk, portfolioRoom ?? Infinity);
  const limits = { accountRisk, portfolioRisk: portfolioRoom, quantity: row.quantityRoom };
  let quantity = 0;
  if (planErrors.length) reasons.push('Reconcile all account snapshots before sizing additions.');
  else if (!confirmed) reasons.push('Confirm the reviewed setup before sizing an addition.');
  else if (!row.favorable) reasons.push('The current mark and proposed addition must both be beyond the actual average entry in the profitable direction.');
  else if (availableRisk <= 0) reasons.push('The current stop exposure uses all available account or portfolio risk.');
  else {
    const cashRoom = Math.max(0, row.headroom.raw - row.existingRisk);
    const firmTolerance = Number.EPSILON * 4 * Math.max(1, Math.abs(row.sizingEquity), Math.abs(row.floor));
    const riskTolerance = Math.min(1e-8, Number.EPSILON * 4 * Math.max(1, availableRisk, row.existingRisk));
    const amount = Math.min(availableRisk / row.addedRiskPerUnit, row.quantityRoom ?? Infinity, row.step * Number.MAX_SAFE_INTEGER);
    quantity = roundQuantityDown(amount, row.step);
    const safe = amount => amount * row.addedRiskPerUnit <= availableRisk + riskTolerance
      && amount <= (row.quantityRoom ?? Infinity)
      && amount * row.addedRiskPerUnit < cashRoom - firmTolerance;
    if (quantity > 0 && !safe(quantity)) quantity = roundQuantityDown(quantity - row.step, row.step);
    if (quantity < row.minimum || !safe(quantity)) quantity = 0;
    if (!quantity) reasons.push('The available risk and quantity limits cannot fit the venue minimum while preserving the floor.');
  }
  const addedRisk = quantity * row.addedRiskPerUnit;
  const totalRisk = row.existingRisk + addedRisk;
  const addedTargetPnL = row.target === null ? null : quantity * row.addedTargetPerUnit;
  return {
    key: row.key, name: row.name, errors: row.errors, reasons, quantity,
    existingRisk: row.existingRisk, addedRiskPerUnit: row.addedRiskPerUnit, addedRisk, totalRisk,
    riskBudget: row.riskBudget, availableRisk, sizingEquity: row.sizingEquity,
    projectedStopEquity: row.equity - totalRisk, projectedSizingEquity: row.sizingEquity - totalRisk,
    stop: row.stop, target: row.target,
    existingTargetPnL: row.existingTargetPnL, addedTargetPnL,
    combinedTargetPnL: row.target === null ? null : row.existingTargetPnL + addedTargetPnL,
    limits,
  };
}

/** Size proposed same-direction additions account by account, sharing only the optional risk cap. */
export function sizeStackPlan(input = {}) {
  const { side, confirmed, accounts } = input;
  const cap = optionalNumber(input.portfolioCap);
  const errors = [], warnings = [];
  if (!['long', 'short'].includes(side)) errors.push('Choose the stack direction.');
  if (!Array.isArray(accounts) || accounts.length === 0) errors.push('Add at least one account to the stack.');
  if (cap !== null && !nonnegative(cap)) errors.push('Enter a nonnegative portfolio risk cap.');
  if (errors.length) return { errors, warnings, side, family: null, rows: [], portfolio: null };

  const prepared = accounts.map(account => prepareRow(account, side));
  const families = new Set(prepared.map(row => row.family).filter(Boolean));
  const family = families.size === 1 ? [...families][0] : null;
  if (families.size > 1) errors.push('All stack accounts must use the same ES or NQ contract family.');
  const seen = new Set();
  for (const row of prepared) {
    if (row.key && seen.has(row.key)) row.errors.push('An account may appear only once in a stack.');
    seen.add(row.key);
  }
  if (prepared.some(row => row.errors.length)) errors.push('Resolve the account errors before any additions can be sized.');
  const allRisksKnown = family && prepared.every(row => !row.errors.length && Number.isFinite(row.existingRisk));
  const existingTotal = allRisksKnown ? prepared.reduce((sum, row) => sum + row.existingRisk, 0) : null;
  const existingRisk = Number.isFinite(existingTotal) ? existingTotal : null;
  if (existingTotal !== null && existingRisk === null) errors.push('Total existing risk is outside the supported calculation range.');
  const capLeft = cap === null || existingRisk === null ? null : cap - existingRisk;
  if (capLeft !== null && capLeft < 0) warnings.push('Existing stop exposure already exceeds the portfolio cap.');
  let addedRisk = 0;
  const rows = prepared.map(row => {
    const result = sizeRow(row, confirmed === true, errors, capLeft === null ? null : Math.max(0, capLeft - addedRisk));
    addedRisk += result.addedRisk ?? 0;
    return result;
  });
  const totalRisk = existingRisk === null ? null : existingRisk + addedRisk;
  const remainingRisk = cap === null || totalRisk === null ? null : cap - totalRisk;
  return { errors, warnings, side, family, rows, portfolio: { cap, existingRisk, addedRisk, totalRisk, remainingRisk } };
}
