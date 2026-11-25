import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCompound } from '../public/compound.mjs';

const accounts = [
  { id: 'one', name: 'First Vest account', room: 1000, minimumRisk: 10 },
  { id: 'two', name: 'Second Vest account', room: 2000, minimumRisk: 10 },
];
const input = {
  accounts, target: 4000, riskFraction: 0.03, lossStreak: 5, keepFraction: 0.75,
  wins: 60, losses: 40, avgWinR: 1.8, tradesPerWeek: 4,
};
const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
};

test('aggregates usable group room while applying identical sample and opportunity counts to every account', () => {
  const result = projectCompound(input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalRoom, 3000);
  assert.equal(result.effectiveFraction, 0.03);
  assert.equal(result.firstRisk, 90);
  assert.deepEqual(result.rows.map(row => row.firstRisk), [30, 60]);
  assert.equal(result.sample.count, 100);
  assert.equal(result.sample.winRate, 0.6);
  near(result.sample.expectedR, 0.68);
  near(result.initialTargetR, 4000 / 90);

  const combined = projectCompound({ ...input, accounts: [{ id: 'one', room: 3000, minimumRisk: 10 }] });
  assert.deepEqual(combined.scenarios, result.scenarios);
});

test('stress guard caps the entered fraction and compounds losses against remaining room', () => {
  const result = projectCompound({ ...input, riskFraction: 0.6, lossStreak: 2, keepFraction: 0.5 });
  assert.equal(result.guardApplied, true);
  near(result.guardFraction, 1 - Math.sqrt(0.5));
  near(result.effectiveFraction, result.guardFraction);
  near(result.retainedFraction, 0.5);
  near(result.postStreakRoom, 1500);
  near(result.rows[0].postStreakRisk, 500 * result.effectiveFraction);
  near(result.postStreakRisk, 1500 * result.effectiveFraction);
});

test('the base and Wilson lower-bound scenarios use logarithmic growth and round opportunities up', () => {
  const result = projectCompound(input);
  const p = 0.6;
  const lower = ((p + 1.96 ** 2 / 200) - 1.96 * Math.sqrt((p * (1 - p) + 1.96 ** 2 / 400) / 100))
    / (1 + 1.96 ** 2 / 100);
  near(result.sample.cautiousWinRate, lower);
  for (const [scenario, rate] of [[result.scenarios.base, p], [result.scenarios.cautious, lower]]) {
    const growth = rate * Math.log1p(0.03 * 1.8) + (1 - rate) * Math.log1p(-0.03);
    const trades = Math.ceil(Math.log1p(4000 / 3000) / growth);
    assert.equal(scenario.status, 'projected');
    near(scenario.logGrowth, growth);
    assert.equal(scenario.trades, trades);
    assert.equal(scenario.weeks, trades / 4);
  }
  assert.ok(result.scenarios.cautious.weeks > result.scenarios.base.weeks);
});

test('reinvests modeled closed milestones in proportion to each selected account’s room', () => {
  const result = projectCompound(input);
  assert.deepEqual(result.milestones.map(({ fraction, netProfit, room, risk }) => [fraction, netProfit, room, risk]), [
    [0.25, 1000, 4000, 120], [0.5, 2000, 5000, 150], [0.75, 3000, 6000, 180], [1, 4000, 7000, 210],
  ]);
  const quarter = result.milestones[0];
  assert.deepEqual(quarter.accounts.map(row => row.id), ['one', 'two']);
  near(quarter.accounts[0].risk, 40);
  near(quarter.accounts[1].risk, 80);
  near(quarter.accounts[0].room + quarter.accounts[1].room, quarter.room);
});

test('suppresses horizons when a tested account cannot cover minimum risk at the start or after stress', () => {
  for (const [minimumRisk, initialGate] of [[31, 'blocked'], [28, 'fits']]) {
    const result = projectCompound({ ...input, accounts: [{ ...accounts[0], minimumRisk }, accounts[1]] });
    assert.equal(result.rows[0].initialGate, initialGate);
    assert.equal(result.rows[0].postStreakGate, 'blocked');
    assert.equal(result.gates.postStreak, 'blocked');
    for (const estimate of Object.values(result.scenarios)) {
      assert.equal(estimate.status, 'minimum-risk-blocked');
      assert.equal(estimate.trades, null);
      assert.equal(estimate.weeks, null);
    }
  }
});

test('keeps a computable benchmark conditional when a minimum estimate is missing', () => {
  const result = projectCompound({ ...input, accounts: [{ ...accounts[0], minimumRisk: '' }, accounts[1]] });
  assert.equal(result.rows[0].minimumRisk, null);
  assert.deepEqual(result.gates, { initial: 'unknown', postStreak: 'unknown' });
  assert.equal(result.scenarios.base.status, 'projected');
  assert.match(result.warnings[0], /Minimum trade risk is missing/);
});

test('nonpositive log growth suppresses time projections even with positive arithmetic expectation', () => {
  const overbet = projectCompound({
    ...input, wins: 52, losses: 48, avgWinR: 1,
    riskFraction: 0.6, lossStreak: 1, keepFraction: 0.3,
  });
  assert.ok(overbet.sample.expectedR > 0);
  assert.ok(overbet.scenarios.base.logGrowth < 0);
  assert.equal(overbet.scenarios.base.status, 'no-growth');
  assert.equal(overbet.scenarios.base.weeks, null);
  const cautious = projectCompound({ ...input, wins: 13, losses: 7, avgWinR: 1 });
  assert.equal(cautious.scenarios.base.status, 'projected');
  assert.equal(cautious.scenarios.cautious.status, 'no-growth');
});

test('an achieved target has zero remaining opportunities even before entering a sample', () => {
  const reached = projectCompound({ ...input, target: 0, wins: '', losses: undefined, avgWinR: '', tradesPerWeek: '' });
  assert.deepEqual(reached.errors, []);
  assert.equal(reached.sample.count, 0);
  assert.equal(reached.initialTargetR, 0);
  for (const scenario of Object.values(reached.scenarios)) {
    assert.equal(scenario.status, 'reached');
    assert.equal(scenario.trades, 0);
    assert.equal(scenario.weeks, 0);
  }
  assert.ok(reached.milestones.every(milestone => milestone.netProfit === 0));
});

test('reports no-growth or out-of-range instead of implying a safe actionable horizon at extreme fractions', () => {
  const fullRetention = projectCompound({ ...input, keepFraction: 1, accounts: [{ id: 'a', room: 1000 }] });
  assert.equal(fullRetention.effectiveFraction, 0);
  assert.equal(fullRetention.firstRisk, 0);
  assert.equal(fullRetention.scenarios.base.status, 'no-growth');
  const hugeHorizon = projectCompound({
    ...input, riskFraction: 1e-18, accounts: [{ id: 'a', room: 1000 }],
  });
  assert.ok(hugeHorizon.scenarios.base.logGrowth > 0);
  assert.equal(hugeHorizon.scenarios.base.status, 'out-of-range');
  assert.equal(hugeHorizon.scenarios.base.trades, null);
});

test('rejects missing rooms, duplicate accounts and invalid risk, streak, sample, goal or pace settings', () => {
  for (const edits of [
    { accounts: [] }, { accounts: [accounts[0], { ...accounts[1], room: 0 }] },
    { accounts: [accounts[0], accounts[0]] }, { accounts: [{ ...accounts[0], minimumRisk: -1 }] },
    { accounts: [{ ...accounts[0], room: Number.MAX_VALUE }], target: Number.MAX_VALUE },
    { riskFraction: 1.01 }, { lossStreak: 1.5 }, { keepFraction: 0 }, { target: -1 },
    { wins: 0, losses: 0 }, { wins: 0.5 }, { wins: Number.MAX_SAFE_INTEGER },
    { avgWinR: Infinity }, { tradesPerWeek: 0 },
  ]) {
    assert.ok(projectCompound({ ...input, ...edits }).errors.length > 0, JSON.stringify(edits));
  }
});
