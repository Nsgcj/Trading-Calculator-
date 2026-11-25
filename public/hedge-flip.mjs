import { HEDGE_CONTRACTS } from './hedge.mjs';

const positive = value => Number.isFinite(value) && value > 0;

function number(value) {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() ? Number(value) : NaN;
}

/** Classify a completed close. Positive distance is beyond the level against the held hedge. */
export function checkHedgeFlip(input = {}) {
  const { contractId, hedgeSide, invalidationPrice, lastClose, warningTicks, confirmedFollowThrough } = input ?? {};
  const contract = HEDGE_CONTRACTS.find(instrument => instrument?.id === contractId);
  const tick = contract?.tickSize;
  const level = number(invalidationPrice);
  const close = number(lastClose);
  const warning = number(warningTicks);
  const errors = [];
  const invalid = { errors, state: null, distanceTicks: null, threshold: null, adverseDirection: null };

  if (!positive(tick)) errors.push('Select ES, MES, NQ or MNQ with a valid tick size.');
  if (hedgeSide !== 'short' && hedgeSide !== 'long') errors.push('Choose the direction of the held hedge.');
  if (!positive(level)) errors.push('Enter a positive invalidation price.');
  if (!positive(close)) errors.push('Enter a positive price for the last completed close.');
  if (!Number.isSafeInteger(warning) || warning < 0) errors.push('Enter a nonnegative whole number of warning ticks.');
  if (errors.length) return invalid;

  const sign = hedgeSide === 'short' ? 1 : -1;
  const adverseDirection = hedgeSide === 'short' ? 'above' : 'below';
  const threshold = level - sign * warning * tick;
  const distanceTicks = close === level ? 0 : sign * (close - level) / tick;
  if (!Number.isFinite(distanceTicks) || !Number.isFinite(threshold)) {
    errors.push('These prices are outside the supported calculation range.');
    return invalid;
  }

  let state = 'intact';
  if (distanceTicks > 0) state = confirmedFollowThrough === true ? 'confirmed' : 'broken';
  else if (sign * (close - threshold) >= 0) state = 'watch';

  return { errors, state, distanceTicks, threshold, adverseDirection };
}
