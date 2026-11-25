import { getHeadroom, getRiskBudget, roundQuantityDown } from './engine.mjs';

const symbols = new Map([['vest-nq', 'NQ-PERP'], ['vest-es', 'ES-PERP']]);
const blank = value => value == null || (typeof value === 'string' && !value.trim());
const number = value => !blank(value) && (typeof value === 'number' || typeof value === 'string') ? Number(value) : NaN;
const optionalNumber = value => blank(value) ? null : number(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const positive = value => Number.isFinite(value) && value > 0;

function atMost(limit, step) {
  const quantity = roundQuantityDown(limit, step);
  return quantity <= limit ? quantity : roundQuantityDown(quantity - step, step);
}

function atLeast(limit, step) {
  const quantity = roundQuantityDown(limit, step);
  return quantity >= limit ? quantity : roundQuantityDown(quantity + step, step);
}

/** Model two opposite positions in the same Vest perpetual from a shared reference price. */
export function sizeVestHedge(input = {}) {
  const errors = [], warnings = [];
  const { instrument, side } = input;
  const account = input.account ?? {};
  const symbol = symbols.get(instrument?.id);
  const tick = number(instrument?.tickSize);
  const pointQuote = number(instrument?.pointValueQuote);
  const conversion = number(instrument?.quoteToUSD);
  const step = number(instrument?.quantityStep);
  const minQuantity = number(instrument?.minQuantity);
  const existingQuantity = number(input.existingQuantity);
  const entryPrice = number(input.entryPrice);
  const coverage = number(input.coveragePercent);
  const downPoints = number(input.downPoints);
  const upPoints = number(input.upPoints);
  const slippageTicks = optionalNumber(input.slippageTicks) ?? 0;
  const feeRate = number(input.feeRate);
  const funding = optionalNumber(input.fundingPerUnit) ?? 0;
  const target = optionalNumber(input.targetProtection);
  const accountMax = optionalNumber(account.maxQuantity);
  const headroom = getHeadroom(account);
  const riskBudget = getRiskBudget(account, number(input.riskFraction));

  if (!symbol || instrument.symbol !== symbol || instrument.platform !== 'vest' || instrument.unit !== 'units') {
    errors.push('Select the exact Vest NQ-PERP or ES-PERP contract.');
  }
  if (!positive(tick) || pointQuote !== 1 || !positive(conversion) || !positive(step) || !positive(minQuantity)) {
    errors.push('Enter the Vest contract increments, 1 USDC per point per unit, and a positive USDC-to-USD rate.');
  }
  if (side !== 'long' && side !== 'short') errors.push('Choose the side of the existing position.');
  if (!positive(existingQuantity)) errors.push('Enter a positive existing quantity in Vest units.');
  if (!positive(entryPrice)) errors.push('Enter a positive common reference price.');
  if (!nonnegative(coverage) || coverage > 100) errors.push('Maximum coverage must be between 0% and 100%.');
  if (!positive(downPoints) || !positive(upPoints) || downPoints >= entryPrice) {
    errors.push('Enter positive down and up moves in points and keep the down-scenario price above zero.');
  }
  if (!nonnegative(feeRate) || feeRate > 1) errors.push('Enter a nonnegative fee rate per side as a fraction between 0 and 1.');
  if (![slippageTicks, funding].every(nonnegative)) errors.push('Slippage and funding cost must be nonnegative.');
  if (target !== null && !nonnegative(target)) errors.push('Minimum net protection must be nonnegative.');
  if (accountMax !== null && !nonnegative(accountMax)) errors.push('The hedge account quantity cap must be nonnegative.');
  if (!headroom || riskBudget === null) errors.push('Enter valid hedge account equity, floor, reserve, risk fraction and any daily loss cap.');
  if (errors.length) return { errors, warnings };

  const pointValueUSD = pointQuote * conversion;
  const roundTripSlippagePoints = slippageTicks * tick;
  const slippagePerUnit = roundTripSlippagePoints * pointValueUSD;
  const direction = side === 'long' ? 1 : -1;
  const hedgeDirection = side === 'long' ? 'short' : 'long';
  const scenarioUnit = move => {
    const price = entryPrice + move;
    const gross = -direction * move * pointValueUSD;
    // Allow for higher execution notional by adding the modeled total slippage distance.
    const fee = (entryPrice * feeRate + price * feeRate + roundTripSlippagePoints * feeRate) * pointValueUSD;
    return { price, gross, fee, net: gross - (fee + slippagePerUnit + funding) };
  };
  const down = scenarioUnit(-downPoints), flat = scenarioUnit(0), up = scenarioUnit(upPoints);
  const riskPerUnit = -(side === 'long' ? up.net : down.net);
  const protectionPerUnit = side === 'long' ? down.net : up.net;
  const supportedQuantity = step * Number.MAX_SAFE_INTEGER;
  if (!positive(riskPerUnit) || !positive(supportedQuantity) || existingQuantity > supportedQuantity
    || ![...Object.values(down), ...Object.values(flat), ...Object.values(up)].every(Number.isFinite)) {
    return { errors: ['These values are outside the supported calculation range.'], warnings };
  }

  let riskQuantity = atMost(Math.min(riskBudget / riskPerUnit, supportedQuantity), step);
  const loss = riskQuantity * riskPerUnit;
  if (loss > riskBudget || (riskQuantity > 0 && loss >= headroom.raw - Math.abs(headroom.raw) * Number.EPSILON * 4)) {
    riskQuantity = roundQuantityDown(riskQuantity - step, step);
  }
  const limits = {
    coverage: atMost(existingQuantity * (coverage / 100), step),
    risk: riskQuantity,
    account: accountMax === null ? null : atMost(Math.min(accountMax, supportedQuantity), step),
  };
  const maxSize = Math.min(limits.coverage, limits.risk, limits.account ?? Infinity);
  const minimum = atLeast(minQuantity, step);
  let quantity = maxSize >= minimum ? maxSize : 0;
  if (protectionPerUnit <= 0) {
    quantity = 0;
    warnings.push('The losing-position scenario provides no positive hedge protection after modeled costs.');
  } else if (target === 0) {
    quantity = 0;
  } else if (target !== null && quantity > 0) {
    quantity = Math.min(quantity, Math.max(minimum, atLeast(Math.min(target / protectionPerUnit, quantity), step)));
  }
  if (maxSize < minimum) warnings.push('The entered limits leave no room for the venue’s minimum quantity.');
  if (headroom.usable <= 0) warnings.push('The hedge account has no spendable room above its floor and reserve.');

  const scenario = (move, perUnit) => {
    const underlying = move === 0 ? 0 : existingQuantity * direction * move * pointValueUSD;
    const hedgeGross = quantity === 0 || move === 0 ? 0 : quantity * perUnit.gross;
    const feeCost = quantity * perUnit.fee;
    const slippageCost = quantity * slippagePerUnit;
    const fundingCost = quantity * funding;
    const totalCosts = feeCost + slippageCost + fundingCost;
    const hedgeNet = hedgeGross - totalCosts;
    return { price: perUnit.price, underlying, hedgeGross, feeCost, slippageCost, fundingCost, totalCosts, hedgeNet, combined: underlying + hedgeNet };
  };
  const scenarios = { down: scenario(-downPoints, down), flat: scenario(0, flat), up: scenario(upPoints, up) };
  const protection = scenarios[side === 'long' ? 'down' : 'up'].hedgeNet;
  const shortfall = target === null ? null : Math.max(0, target - protection);
  const hedgeNotional = quantity * entryPrice * pointValueUSD;
  const actualCoveragePercent = 100 * (quantity / existingQuantity);
  if (![hedgeNotional, ...Object.values(scenarios).flatMap(Object.values)].every(Number.isFinite)) {
    return { errors: ['These values are outside the supported calculation range.'], warnings };
  }

  return {
    errors, warnings, quantity, hedgeDirection, pointValueUSD, hedgeNotional, actualCoveragePercent,
    headroom, riskBudget, riskPerUnit, protection, shortfall, scenarios, limits,
  };
}
