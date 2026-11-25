import assert from 'node:assert/strict';
import test from 'node:test';
import { VEST_ROLES, VEST_SESSIONS, evaluateVestRole, summarizeVestAccounts } from '../public/vest-role-plan.mjs';

const account = { id: 'vest-one', platform: 'vest', equity: 500, floor: 490, reserve: 1, dailyRemaining: 3 };
const scalp = { role: 'scalp', session: 'ny-open', plannedLoss: 3 };
const evaluate = (plan = scalp, profile = account, fraction = 0.6) => evaluateVestRole(profile, plan, fraction);

test('role and session catalogs provide only explicit planning options', () => {
  assert.deepEqual(Object.keys(VEST_ROLES), ['unassigned', 'scalp', 'intraday', 'swing']);
  assert.deepEqual(Object.keys(VEST_SESSIONS), ['', 'asia', 'london', 'ny-open', 'ny-afternoon']);
  assert.equal(evaluate({}).status, 'unassigned');
  assert.equal(evaluate({}).plannedLoss, null);
});

test('uses the account protection floor, reserve and daily cap for an entered all-in loss', () => {
  const fits = evaluate();
  assert.equal(fits.status, 'fits-estimate');
  assert.equal(fits.protectedFloor, 491);
  assert.deepEqual(fits.headroom, { raw: 10, usable: 9 });
  assert.equal(fits.budget, 3);
  assert.equal(fits.fitsBudget, true);
  assert.equal(fits.budgetAfterPlanned, 0);
  const over = evaluate({ ...scalp, plannedLoss: 3.25 });
  assert.equal(over.status, 'over-budget');
  assert.equal(over.fitsBudget, false);
  assert.equal(over.budgetAfterPlanned, -0.25);
  const noDaily = evaluate({ ...scalp, plannedLoss: 5.4 }, { ...account, noDailyLimit: true });
  assert.ok(Math.abs(noDaily.budget - 5.4) < 1e-9);
  assert.equal(noDaily.status, 'fits-estimate');
  assert.equal(noDaily.budgetAfterPlanned, 0);
});

test('an omitted account balance does not become zero or return a modeled budget', () => {
  for (const changes of [{ equity: '' }, { floor: '' }, { equity: null }, { floor: undefined }]) {
    const result = evaluate(scalp, { ...account, ...changes });
    assert.equal(result.status, 'config-needed');
    assert.equal(result.headroom, null);
    assert.equal(result.budget, null);
    assert.equal(result.fitsBudget, null);
  }
});

test('scalp and intraday plans require a chosen session before showing a fit', () => {
  for (const role of ['scalp', 'intraday']) {
    const incomplete = evaluate({ ...scalp, role, session: '' });
    assert.equal(incomplete.status, 'config-needed');
    assert.equal(incomplete.fitsBudget, true);
    assert.equal(evaluate({ ...scalp, role, session: 'london' }).status, 'fits-estimate');
  }
});

test('overnight confirmation is required for a swing, and weekend permission remains separate', () => {
  const plan = { role: 'swing', plannedLoss: 2, session: '' };
  assert.equal(evaluate({ ...plan, weekendConfirmed: true }).status, 'config-needed');
  const overnight = evaluate({ ...plan, overnightConfirmed: true });
  assert.equal(overnight.status, 'fits-estimate');
  assert.equal(overnight.weekendConfirmed, false);
  assert.ok(overnight.notes.some(note => /Weekend/.test(note)));
  const weekends = evaluate({ ...plan, overnightConfirmed: true, weekendConfirmed: true });
  assert.equal(weekends.status, 'fits-estimate');
  assert.equal(weekends.notes.some(note => /Weekend/.test(note)), false);
});

test('inactive accounts and missing loss estimates are distinct from an arithmetic fit', () => {
  assert.equal(evaluate({ ...scalp, inactive: true }).status, 'inactive');
  const noEstimate = evaluate({ ...scalp, plannedLoss: ' ' });
  assert.equal(noEstimate.status, 'estimate-needed');
  assert.equal(noEstimate.plannedLoss, null);
  assert.equal(noEstimate.fitsBudget, null);
  assert.equal(evaluate({ ...scalp, plannedLoss: 0 }).status, 'fits-estimate');
});

test('no-risk and floor-touching estimates cannot indicate a fit', () => {
  assert.equal(evaluate(scalp, { ...account, equity: 490 }).status, 'no-risk');
  assert.equal(evaluate(scalp, { ...account, reserve: 10 }).status, 'no-risk');
  assert.equal(evaluate(scalp, { ...account, dailyRemaining: 0 }).status, 'no-risk');
  const floorTouch = evaluate({ ...scalp, plannedLoss: 10 }, { ...account, reserve: 0, dailyRemaining: null }, 1);
  assert.equal(floorTouch.status, 'over-budget');
  assert.equal(floorTouch.fitsBudget, true);
  assert.equal(floorTouch.reachesFloor, true);
});

test('malformed numeric values and unsupported classifications never show a fit', () => {
  for (const [plan, profile, fraction] of [
    [{ ...scalp, plannedLoss: -1 }, account, 0.6],
    [{ ...scalp, role: 'automatic' }, account, 0.6],
    [{ ...scalp, session: 'markets' }, account, 0.6],
    [scalp, { ...account, equity: false }, 0.6],
    [scalp, { ...account, reserve: -1 }, 0.6],
    [scalp, { ...account, dailyRemaining: -1 }, 0.6],
    [scalp, account, 2],
  ]) {
    const result = evaluate(plan, profile, fraction);
    assert.equal(result.status, 'invalid');
    assert.ok(result.errors.length);
  }
});

test('roster totals count only tracked accounts and active assignments', () => {
  const accounts = Array.from({ length: 6 }, (_, index) => ({ id: `vest-${index}` }));
  const summary = summarizeVestAccounts(accounts, {
    'vest-0': { role: 'scalp' },
    'vest-1': { role: 'swing', inactive: true },
    'vest-2': { role: 'intraday' },
    'vest-3': { role: 'swing' },
    'vest-5': { role: 'invalid' },
    'not-tracked': { role: 'scalp' },
  });
  assert.deepEqual(summary, {
    total: 6, active: 5, inactive: 1, byRole: { unassigned: 2, scalp: 1, intraday: 1, swing: 1 },
  });
});
