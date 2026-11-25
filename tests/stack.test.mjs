import assert from 'node:assert/strict';
import test from 'node:test';
import { STACK_CONTRACTS, sizeStackPlan } from '../public/stack.mjs';

const contract = id => STACK_CONTRACTS.find(item => item.id === id);
const account = {
  key: 'first', name: 'First account', instrument: contract('f-mnq'),
  equity: 12_000, closedEquity: 11_000, floor: 10_000, reserve: 0, riskFraction: 0.2,
  existingSide: 'long', existingQuantity: 2, averageEntry: 24_990, mark: 25_020,
  entry: 25_025, stop: 25_000, target: 25_050, feePerUnit: 1.25, slippageTicks: 2,
};
const plan = (options = {}) => sizeStackPlan({ side: 'long', confirmed: true, accounts: [account], ...options });
const second = edits => ({ ...account, key: 'second', name: 'Second account', ...edits });
const closeTo = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${expected}, received ${actual}`);
};

test('charges open leg exit costs once and charges a new entry the full round trip', () => {
  const result = plan();
  assert.deepEqual(result.errors, []);
  assert.equal(result.family, 'NQ');
  const row = result.rows[0];
  assert.equal(row.sizingEquity, 11_000);
  assert.equal(row.riskBudget, 200);
  assert.equal(row.existingRisk, 84.5);
  assert.equal(row.addedRiskPerUnit, 53.5);
  assert.equal(row.availableRisk, 115.5);
  assert.equal(row.quantity, 2);
  assert.equal(row.addedRisk, 107);
  assert.equal(row.totalRisk, 191.5);
  assert.equal(row.projectedStopEquity, 11_808.5);
  assert.equal(row.projectedSizingEquity, 10_808.5);
  assert.equal(row.existingTargetPnL, 115.5);
  assert.equal(row.addedTargetPnL, 93);
  assert.equal(row.combinedTargetPnL, 208.5);
  assert.deepEqual(result.portfolio, { cap: null, existingRisk: 84.5, addedRisk: 107, totalRisk: 191.5, remainingRisk: null });
});

test('a short stack adds only after both mark and proposed entry are favorable', () => {
  const openShort = {
    ...account, existingSide: 'short', averageEntry: 25_100,
    mark: 25_020, entry: 25_030, stop: 25_050, target: 24_990, feePerUnit: 0, slippageTicks: 0,
  };
  const result = plan({ side: 'short', accounts: [openShort] });
  assert.equal(result.rows[0].quantity, 2);
  assert.equal(result.rows[0].existingRisk, 120);
  assert.equal(result.rows[0].addedRiskPerUnit, 40);
  assert.equal(result.rows[0].combinedTargetPnL, 280);

  const adverseAdd = plan({ side: 'short', accounts: [{ ...openShort, entry: 25_101, stop: 25_150 }] });
  assert.equal(adverseAdd.rows[0].quantity, 0);
  assert.match(adverseAdd.rows[0].reasons[0], /actual average entry/);
  const flatProfit = plan({ accounts: [{ ...account, averageEntry: account.mark }] });
  assert.equal(flatProfit.rows[0].quantity, 0);
});

test('subtracts initial risk across all rows and allocates a correlated risk cap in row order', () => {
  const flat = {
    ...account, entry: 25_010, existingSide: 'none', existingQuantity: 0, mark: null,
    averageEntry: null, target: null, feePerUnit: 0, slippageTicks: 0,
  };
  const open = second({
    entry: 25_010, existingQuantity: 1, target: null, feePerUnit: 0, slippageTicks: 0,
  });
  const result = plan({ portfolioCap: 90, accounts: [flat, open] });
  assert.deepEqual(result.rows.map(row => row.quantity), [2, 0]);
  assert.equal(result.rows[0].limits.portfolioRisk, 50);
  assert.equal(result.rows[1].limits.portfolioRisk, 10);
  assert.deepEqual(result.portfolio, { cap: 90, existingRisk: 40, addedRisk: 40, totalRisk: 80, remainingRisk: 10 });
  assert.deepEqual(plan({ portfolioCap: 90, accounts: [open, flat] }).rows.map(row => row.quantity), [2, 0]);
  const over = plan({ portfolioCap: 39, accounts: [flat, open] });
  assert.deepEqual(over.rows.map(row => row.quantity), [0, 0]);
  assert.equal(over.portfolio.remainingRisk, -1);
  assert.match(over.warnings[0], /already exceeds/);
});

test('confirmation blocks additions while still reporting known existing risk', () => {
  const output = plan({ confirmed: false });
  assert.deepEqual(output.errors, []);
  assert.equal(output.rows[0].quantity, 0);
  assert.equal(output.portfolio.existingRisk, 84.5);
  assert.match(output.rows[0].reasons[0], /Confirm/);
});

test('opposite exposure, unknown snapshots, duplicate accounts and mixed market families block all adds', () => {
  const opposite = second({ existingSide: 'short' });
  const invalid = second({ closedEquity: '' });
  const duplicate = second({ key: account.key });
  const otherFamily = second({ instrument: contract('f-mes') });
  for (const other of [opposite, invalid, duplicate, otherFamily]) {
    const output = plan({ accounts: [account, other] });
    assert.ok(output.errors.length);
    assert.deepEqual(output.rows.map(row => row.quantity), [0, 0]);
    assert.equal(output.portfolio.existingRisk, null);
    assert.equal(output.rows[0].existingRisk, 84.5);
  }
  const oppositeRow = plan({ accounts: [account, opposite] }).rows[1];
  assert.match(oppositeRow.errors.join(' '), /opposite this stack/);
});

test('sizing uses the lower equity snapshot and never shares profits to fund another account', () => {
  const belowFloor = second({ equity: 15_000, closedEquity: 9_000, floor: 10_000 });
  const output = plan({ accounts: [account, belowFloor] });
  assert.deepEqual(output.errors, []);
  assert.deepEqual(output.rows.map(row => row.quantity), [2, 0]);
  assert.equal(output.rows[1].sizingEquity, 9000);
  assert.equal(output.rows[1].riskBudget, 0);
  assert.equal(output.rows[1].existingRisk, 84.5);
});

test('applies reserve and optional daily cap and leaves positive equity above the mandatory floor', () => {
  const flat = {
    ...account, equity: 10_040, closedEquity: 10_040, existingSide: 'none',
    existingQuantity: 0, entry: 25_010, feePerUnit: 0, slippageTicks: 0, riskFraction: 1,
  };
  const capped = plan({ accounts: [flat] }).rows[0];
  assert.equal(capped.riskBudget, 40);
  assert.equal(capped.quantity, 1);
  assert.equal(capped.projectedStopEquity, 10_020);
  const reduced = plan({ accounts: [{ ...flat, reserve: 5, dailyRemaining: 18 }] }).rows[0];
  assert.equal(reduced.riskBudget, 18);
  assert.equal(reduced.quantity, 0);
});

test('Vest quantity uses the official fractional increment, remaining total cap, and USD conversion', () => {
  const vest = {
    ...contract('vest-nq'), pointValueQuote: 1, quoteToUSD: 1.02, tickSize: 0.25,
    quantityStep: 0.0001, minQuantity: 0.0001,
  };
  const row = plan({
    accounts: [{
      ...account, instrument: vest, existingQuantity: 0.1, maxQuantity: 0.3,
      feeRate: 0.000025, feePerUnit: 0, slippageTicks: 2,
    }],
  }).rows[0];
  assert.deepEqual(row.errors, []);
  assert.equal(row.limits.quantity, 0.2);
  assert.equal(row.quantity, 0.2);
  closeTo(row.existingRisk, 0.1 * 1.02 * (20 + 0.5 + 25_000.5 * 0.000025));
  closeTo(row.addedRisk, 0.2 * 1.02 * (25 + 0.5 + (25_025 + 25_000.5) * 0.000025));
});

test('requires an adverse structural stop and uses official CME whole-contract increments', () => {
  const candidate = { ...account, stop: 25_000.1, target: 25_050.1, instrument: { ...contract('f-mnq'), quantityStep: 0.5 } };
  const output = plan({ accounts: [candidate] });
  assert.equal(output.rows[0].stop, 25_000);
  assert.equal(output.rows[0].target, 25_050);
  assert.ok(Number.isInteger(output.rows[0].quantity));
  const wrongStop = plan({ accounts: [{ ...candidate, stop: 25_020.01 }] });
  assert.match(wrongStop.rows[0].errors.join(' '), /structural stop/);
  const badPosition = plan({ accounts: [{ ...candidate, existingQuantity: 1.5 }] });
  assert.match(badPosition.rows[0].errors.join(' '), /quantity increment/);
});
