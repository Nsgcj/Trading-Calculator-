import { HEDGE_CONTRACTS } from './hedge.mjs';

const number = value => typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
const nonnegative = value => Number.isFinite(value) && value >= 0;

/** Measure one account's available loss room against its firm and giveback limits. */
export function checkProtection(input = {}) {
  const errors = [];
  const equity = number(input.equity);
  const observedPeak = number(input.peakEquity);
  const firmFloor = number(input.firmFloor);
  const reserve = number(input.reserve);
  const giveback = number(input.giveback);
  if (!Number.isFinite(equity)) errors.push('Enter the account’s current equity.');
  if (!Number.isFinite(observedPeak)) errors.push('Enter the account’s highest observed equity.');
  if (!Number.isFinite(firmFloor)) errors.push('Enter the current firm failure floor.');
  if (!nonnegative(reserve)) errors.push('Enter a nonnegative safety reserve.');
  if (!nonnegative(giveback)) errors.push('Enter a nonnegative allowed giveback.');
  if (errors.length) return { errors };

  const peakEquity = Math.max(equity, observedPeak);
  const firmThreshold = firmFloor + reserve;
  const profitFloor = peakEquity - giveback;
  const protectedFloor = Math.max(firmThreshold, profitFloor);
  const givebackUsed = peakEquity - equity;
  const rawRoom = equity - protectedFloor;
  if (![firmThreshold, profitFloor, givebackUsed, rawRoom].every(Number.isFinite)) {
    return { errors: ['These account values are outside the supported calculation range.'] };
  }

  return {
    errors, equity, peakEquity, firmThreshold, profitFloor, protectedFloor, givebackUsed,
    room: Math.max(0, rawRoom), atLimit: rawRoom <= 0,
  };
}

/** Charge each open contract's exit cost once, plus an adverse move on contracts kept. */
export function sizeHedgeReduction(input = {}) {
  const errors = [];
  const contract = HEDGE_CONTRACTS.find(candidate => candidate.id === input.contractId);
  const openContracts = number(input.openContracts);
  const adverseTicks = number(input.adverseTicks);
  const exitCost = number(input.exitCostPerContract);
  const { protection } = input;
  const { equity, firmThreshold, protectedFloor } = protection ?? {};

  if (!contract) errors.push('Select ES, MES, NQ or MNQ.');
  if (!Number.isSafeInteger(openContracts) || openContracts < 0) errors.push('Enter a nonnegative whole number of open hedge contracts.');
  if (!Number.isSafeInteger(adverseTicks) || adverseTicks <= 0) errors.push('Enter a positive whole number of adverse ticks.');
  if (!nonnegative(exitCost)) errors.push('Enter a nonnegative expected exit cost per contract.');
  if (protection?.errors?.length || ![equity, firmThreshold, protectedFloor].every(Number.isFinite) || protectedFloor < firmThreshold) {
    errors.push('Enter valid protection limits for the account carrying this hedge.');
  }
  if (errors.length) return { errors };

  const riskPerContract = adverseTicks * contract.tickSize * contract.pointValueQuote;
  const totalExitCost = openContracts * exitCost;
  const rawRoom = equity - protectedFloor;
  const roomAfterCost = rawRoom - totalExitCost;
  const firmRoomAfterCost = equity - firmThreshold - totalExitCost;
  if (![riskPerContract, totalExitCost, roomAfterCost, firmRoomAfterCost].every(Number.isFinite)) {
    return { errors: ['These hedge inputs are outside the supported calculation range.'] };
  }

  // Use a small roundoff allowance at the firm threshold so exact equality remains unsafe.
  const firmTolerance = Number.EPSILON * 4 * Math.max(1, Math.abs(equity), Math.abs(firmThreshold), totalExitCost);
  const firmLimit = Math.ceil((firmRoomAfterCost - firmTolerance) / riskPerContract) - 1;
  // Equality with a higher giveback floor is acceptable. Account values can subtract with sub-cent roundoff.
  const roomTolerance = Math.min(1e-6, Number.EPSILON * 4 * Math.max(1, Math.abs(equity), Math.abs(protectedFloor), totalExitCost));
  const protectionLimit = Math.floor((roomAfterCost + roomTolerance) / riskPerContract);
  const keep = Math.max(0, Math.min(openContracts, firmLimit, protectionLimit));
  const trim = openContracts - keep;
  const modeledKeepLoss = keep * riskPerContract;
  const modeledLoss = totalExitCost + modeledKeepLoss;
  const modeledEquity = equity - modeledLoss;
  const roomAfterMove = roomAfterCost - modeledKeepLoss;
  const remainingRoom = Math.abs(roomAfterMove) <= roomTolerance ? 0 : roomAfterMove;
  if (![modeledLoss, modeledEquity, remainingRoom].every(Number.isFinite)) {
    return { errors: ['These hedge inputs are outside the supported calculation range.'] };
  }

  return {
    errors, keep, trim, riskPerContract, totalExitCost, modeledKeepLoss, modeledLoss, modeledEquity, remainingRoom,
    unavoidableCost: Math.max(0, totalExitCost - Math.max(0, rawRoom)),
    firmThresholdReached: firmRoomAfterCost - modeledKeepLoss <= firmTolerance,
  };
}
