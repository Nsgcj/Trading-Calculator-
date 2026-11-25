import { DEFAULT_INSTRUMENTS } from './engine.mjs';

const contractIds = ['f-es', 'f-mes', 'f-nq', 'f-mnq'];
export const HEDGE_CONTRACTS = Object.freeze(contractIds.map(id => DEFAULT_INSTRUMENTS.find(instrument => instrument.id === id)));

const isBlank = value => value == null || (typeof value === 'string' && !value.trim());
const number = value => !isBlank(value) && (typeof value === 'number' || typeof value === 'string') ? Number(value) : NaN;
const optionalNumber = value => isBlank(value) ? null : number(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const positive = value => Number.isFinite(value) && value > 0;
const percent = value => nonnegative(value) && value <= 100;

function contractLimit(cap, perContract) {
  if (perContract === 0) return null;
  const whole = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(cap / perContract));
  return whole * perContract > cap ? whole - 1 : whole;
}

/** Model a single beta-adjusted equity exposure offset with whole index futures contracts. */
export function sizeHedge(input = {}) {
  const errors = [], warnings = [];
  const contract = HEDGE_CONTRACTS.find(instrument => instrument.id === input.contractId);
  const { direction } = input;
  const value = number(input.portfolioValue);
  const beta = number(input.beta);
  const entry = number(input.entryPrice);
  const coverage = number(input.coveragePercent);
  const down = number(input.downPercent);
  const up = number(input.upPercent);
  const riskLimit = number(input.riskLimit);
  const commission = optionalNumber(input.feePerContract) ?? 0;
  const holdingCost = optionalNumber(input.holdingCostPerContract) ?? 0;
  const target = optionalNumber(input.targetProtection);
  const maxContracts = optionalNumber(input.maxContracts);
  const availableMargin = optionalNumber(input.availableMargin);
  const marginPerContract = optionalNumber(input.marginPerContract);

  if (!contract) errors.push('Select ES, MES, NQ or MNQ.');
  if (direction !== 'long' && direction !== 'short') errors.push('Choose the side of the existing equity exposure.');
  if (!positive(value)) errors.push('Enter a positive USD equity exposure value.');
  if (!positive(beta)) errors.push('Enter a positive beta to the selected futures index.');
  if (!positive(entry)) errors.push('Enter a positive futures entry price.');
  if (!percent(coverage)) errors.push('Coverage must be between 0% and 100%.');
  if (![down, up].every(move => positive(move) && move <= 100)) errors.push('Enter an advance and a decline greater than 0% and up to 100%.');
  if (!nonnegative(riskLimit)) errors.push('Enter a nonnegative USD loss limit for the hedge leg.');
  if (![commission, holdingCost].every(nonnegative)) errors.push('Commission and holding costs must be nonnegative USD amounts per contract.');
  if (target !== null && !nonnegative(target)) errors.push('Minimum net protection must be a nonnegative USD amount.');
  if (maxContracts !== null && (!Number.isSafeInteger(maxContracts) || maxContracts < 0)) errors.push('Position cap must be a nonnegative whole contract count.');
  const hasMargin = availableMargin !== null || marginPerContract !== null;
  if (hasMargin && (!nonnegative(availableMargin) || !positive(marginPerContract))) {
    errors.push('Enter both available margin and a positive margin requirement per contract.');
  }
  if (errors.length) return { errors, warnings };

  const hedgeDirection = direction === 'long' ? 'short' : 'long';
  const exposure = value * beta;
  const contractNotional = entry * contract.pointValueQuote;
  const costPerContract = commission + holdingCost;
  const downFraction = down / 100;
  const upFraction = up / 100;
  const hedgeGainPerContract = contractNotional * (direction === 'long' ? downFraction : upFraction);
  const hedgeLossPerContract = contractNotional * (direction === 'long' ? upFraction : downFraction) + costPerContract;
  const protectionPerContract = hedgeGainPerContract - costPerContract;
  const breakEvenPercent = 100 * (costPerContract / contractNotional);
  if (!positive(exposure) || !positive(contractNotional)
    || ![costPerContract, hedgeLossPerContract, breakEvenPercent].every(nonnegative)) {
    return { errors: ['These values are outside the supported calculation range.'], warnings };
  }

  const limits = {
    coverage: contractLimit(exposure * (coverage / 100), contractNotional),
    risk: contractLimit(riskLimit, hedgeLossPerContract),
    margin: hasMargin ? contractLimit(availableMargin, marginPerContract) : null,
    position: maxContracts,
  };
  const maxSize = Math.min(...Object.values(limits).filter(limit => limit !== null));
  let quantity = maxSize;
  if (protectionPerContract <= 0) {
    quantity = 0;
    warnings.push('The modeled move produces no positive protection after costs.');
  } else if (target !== null) {
    quantity = Math.min(maxSize, Math.ceil(target / protectionPerContract));
    const protectionAt = size => size * hedgeGainPerContract - size * costPerContract;
    if (quantity > 0 && protectionAt(quantity - 1) >= target) quantity -= 1;
    if (quantity < maxSize && protectionAt(quantity) < target) quantity += 1;
  }
  if (maxSize === 0) warnings.push('The entered limits leave no capacity for a whole contract.');

  const hedgeNotional = quantity * contractNotional;
  const totalCosts = quantity * costPerContract;
  const marginUsed = hasMargin ? quantity * marginPerContract : null;
  const actualCoveragePercent = 100 * (hedgeNotional / exposure);
  const portfolioSign = direction === 'long' ? 1 : -1;
  const scenario = move => {
    const underlying = move === 0 ? 0 : portfolioSign * (exposure * move);
    const hedgeGross = quantity === 0 || move === 0 ? 0 : -portfolioSign * quantity * (contractNotional * move);
    const hedgeNet = hedgeGross - totalCosts;
    return { underlying, hedgeGross, hedgeNet, combined: underlying + hedgeNet };
  };
  const scenarios = { down: scenario(-downFraction), up: scenario(upFraction) };
  const protection = scenarios[direction === 'long' ? 'down' : 'up'].hedgeNet;
  const shortfall = target === null ? null : Math.max(0, target - protection);
  if (![...Object.values(scenarios.down), ...Object.values(scenarios.up), marginUsed ?? 0].every(Number.isFinite)) {
    return { errors: ['These values are outside the supported calculation range.'], warnings };
  }

  return {
    errors, warnings, quantity, hedgeDirection, contractNotional, exposure, actualCoveragePercent,
    hedgeNotional, totalCosts, breakEvenPercent, marginUsed, protection, shortfall, scenarios, limits,
  };
}
