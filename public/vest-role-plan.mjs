import { getAccountFloor, getHeadroom, getRiskBudget } from './engine.mjs';

export const VEST_ROLES = Object.freeze({
  unassigned: 'Unassigned',
  scalp: 'Scalp',
  intraday: 'Intraday',
  swing: 'Swing',
});

export const VEST_SESSIONS = Object.freeze({
  '': 'No session selected',
  asia: 'Asia',
  london: 'London',
  'ny-open': 'New York open',
  'ny-afternoon': 'New York afternoon',
});

const blank = value => value == null || (typeof value === 'string' && !value.trim());
const number = value => !blank(value) && (typeof value === 'number' || typeof value === 'string') ? Number(value) : NaN;
const optionalNumber = value => blank(value) ? null : number(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const validOption = (options, value) => typeof value === 'string' && Object.hasOwn(options, value);
const roundoff = (left, right) => Math.min(1e-8, Number.EPSILON * 4 * Math.max(1, Math.abs(left), Math.abs(right)));

export function evaluateVestRole(account, plan, riskFraction) {
  const errors = [], notes = [];
  const requestedRole = plan?.role ?? 'unassigned';
  const requestedSession = plan?.session ?? '';
  const role = validOption(VEST_ROLES, requestedRole) ? requestedRole : 'unassigned';
  const session = validOption(VEST_SESSIONS, requestedSession) ? requestedSession : '';
  const inactive = plan?.inactive === true;
  const overnightConfirmed = plan?.overnightConfirmed === true;
  const weekendConfirmed = plan?.weekendConfirmed === true;
  const requestedLoss = optionalNumber(plan?.plannedLoss);
  const plannedLoss = nonnegative(requestedLoss) ? requestedLoss : null;
  if (role !== requestedRole) errors.push('Choose a recognized account role.');
  if (session !== requestedSession) errors.push('Choose a recognized planning session.');
  if (requestedLoss !== null && plannedLoss === null) errors.push('Enter a nonnegative all-in planned loss in USD.');

  const profile = account ?? {};
  const accountFloor = getAccountFloor(profile);
  const equity = number(profile.equity);
  const floor = number(accountFloor);
  const reserve = optionalNumber(profile.reserve) ?? 0;
  const dailyRemaining = profile.noDailyLimit === true ? null : optionalNumber(profile.dailyRemaining);
  const fraction = number(riskFraction);
  const missingBalances = blank(profile.equity) || blank(accountFloor);
  if ((!blank(profile.equity) && !Number.isFinite(equity)) || (!blank(accountFloor) && !Number.isFinite(floor))) {
    errors.push('Enter finite account equity and failure floor values.');
  }
  if (!nonnegative(reserve) || (dailyRemaining !== null && !nonnegative(dailyRemaining))) {
    errors.push('Enter a nonnegative safety reserve and optional daily loss allowance.');
  }
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) errors.push('Choose an account risk percentage greater than 0% and up to 100%.');

  const inputs = { equity, floor, reserve, dailyRemaining };
  const headroom = getHeadroom(inputs);
  const budget = getRiskBudget(inputs, fraction);
  const protectedThreshold = floor + reserve;
  const protectedFloor = nonnegative(reserve) && Number.isFinite(protectedThreshold) ? protectedThreshold : null;
  if (!missingBalances && !errors.length && (!headroom || protectedFloor === null)) {
    errors.push('These account values are outside the supported calculation range.');
  }
  const difference = plannedLoss === null || budget === null ? null : budget - plannedLoss;
  const budgetAfterPlanned = difference !== null && Math.abs(difference) <= roundoff(budget, plannedLoss) ? 0 : difference;
  const fitsBudget = budgetAfterPlanned === null ? null : budgetAfterPlanned >= 0;
  const reachesFloor = plannedLoss !== null && headroom?.raw > 0
    && headroom.raw - plannedLoss <= roundoff(headroom.raw, plannedLoss);
  const needsSession = (role === 'scalp' || role === 'intraday') && !session;
  const needsOvernight = role === 'swing' && !overnightConfirmed;

  if (missingBalances) notes.push('Enter current equity and the account’s failure floor to calculate a loss budget.');
  if (needsSession) notes.push('Select the session for this role.');
  if (needsOvernight) notes.push('Confirm the account permits overnight holding before using the swing plan.');
  if (role === 'swing' && !weekendConfirmed) notes.push('Weekend holding permission is unconfirmed.');
  if (reachesFloor) notes.push('The modeled loss would reach the account’s failure floor.');

  let status;
  if (inactive) status = 'inactive';
  else if (errors.length) status = 'invalid';
  else if (role === 'unassigned') status = 'unassigned';
  else if (budget === 0) {
    status = 'no-risk';
    notes.push('The account’s current limits leave no modeled loss budget.');
  } else if (budget === null || needsSession || needsOvernight) status = 'config-needed';
  else if (plannedLoss === null) status = 'estimate-needed';
  else if (!fitsBudget || reachesFloor) status = 'over-budget';
  else status = 'fits-estimate';

  return {
    status, role, session, inactive, overnightConfirmed, weekendConfirmed, plannedLoss, protectedFloor,
    headroom, budget, fitsBudget, budgetAfterPlanned, reachesFloor, errors, notes,
  };
}

export function summarizeVestAccounts(accounts, plans) {
  const byRole = { unassigned: 0, scalp: 0, intraday: 0, swing: 0 };
  let active = 0, inactive = 0;
  for (const account of accounts ?? []) {
    const plan = plans && Object.hasOwn(plans, account.id) ? plans[account.id] : null;
    if (plan?.inactive === true) {
      inactive += 1;
    } else {
      active += 1;
      const role = validOption(VEST_ROLES, plan?.role) ? plan.role : 'unassigned';
      byRole[role] += 1;
    }
  }
  return { total: active + inactive, active, inactive, byRole };
}
