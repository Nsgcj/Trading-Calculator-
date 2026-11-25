import assert from 'node:assert/strict';
import test from 'node:test';
import { sizeVestHedge } from '../public/vest-hedge.mjs';

const instrument = {
  id: 'vest-nq', symbol: 'NQ-PERP', platform: 'vest', unit: 'units',
  tickSize: 0.25, pointValueQuote: 1, quantityStep: 0.0001, minQuantity: 0.0001, quoteToUSD: 1,
};
const account = { equity: 2000, floor: 1000, reserve: 0, dailyRemaining: null, maxQuantity: null };
const base = {
  instrument, account, side: 'long', existingQuantity: 2, entryPrice: 25_000,
  coveragePercent: 60, downPoints: 150, upPoints: 75, riskFraction: 0.6, feeRate: 0,
};

function approximately(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${expected}, received ${actual}`);
}

test('sizes a same-symbol short hedge with native fractional units and down, flat and up price scenarios', () => {
  const result = sizeVestHedge(base);
  assert.deepEqual(result.errors, []);
  assert.equal(result.quantity, 1.2);
  assert.equal(result.hedgeDirection, 'short');
  assert.equal(result.hedgeNotional, 30_000);
  assert.equal(result.actualCoveragePercent, 60);
  assert.equal(result.riskBudget, 600);
  assert.equal(result.protection, 180);
  assert.deepEqual(result.scenarios.down, {
    price: 24_850, underlying: -300, hedgeGross: 180, feeCost: 0, slippageCost: 0, fundingCost: 0,
    totalCosts: 0, hedgeNet: 180, combined: -120,
  });
  assert.equal(result.scenarios.flat.combined, 0);
  assert.equal(result.scenarios.up.underlying, 150);
  assert.equal(result.scenarios.up.hedgeNet, -90);
});

test('sizes the opposite long side for ES and protects an existing short against a rally', () => {
  const result = sizeVestHedge({
    ...base, instrument: { ...instrument, id: 'vest-es', symbol: 'ES-PERP' }, entryPrice: 6000, side: 'short',
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.hedgeDirection, 'long');
  assert.equal(result.scenarios.up.underlying, -150);
  assert.equal(result.scenarios.up.hedgeNet, 90);
  assert.equal(result.protection, 90);
  assert.equal(result.scenarios.down.combined, 120);
});

test('fees use both notionals for each scenario while slippage and funding remain charged at flat', () => {
  const feeRate = 0.000025;
  const result = sizeVestHedge({
    ...base, feeRate, slippageTicks: 2, fundingPerUnit: 0.2,
    instrument: { ...instrument, quoteToUSD: 1.1 },
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.quantity, 1.2);
  assert.equal(result.pointValueUSD, 1.1);
  const { down, flat, up } = result.scenarios;
  for (const scenario of [down, flat, up]) {
    approximately(scenario.feeCost, 1.2 * 1.1 * (25_000 + scenario.price + 0.5) * feeRate);
    approximately(scenario.slippageCost, 1.2 * 1.1 * 0.5);
    approximately(scenario.fundingCost, 1.2 * 0.2);
  }
  assert.ok(up.feeCost > flat.feeCost && flat.feeCost > down.feeCost);
  assert.equal(flat.underlying, 0);
  assert.equal(flat.hedgeGross, 0);
  assert.equal(flat.combined, -flat.totalCosts);
  approximately(result.riskPerUnit * result.quantity, -up.hedgeNet);
});

test('limits use only hedge account headroom, optional daily and native caps, and adverse loss with costs', () => {
  const input = {
    ...base, riskFraction: 0.1, downPoints: 100, upPoints: 100, slippageTicks: 4, fundingPerUnit: 4,
    account: { ...account, reserve: 100, dailyRemaining: 25, maxQuantity: 0.2015 },
  };
  const result = sizeVestHedge(input);
  assert.deepEqual(result.headroom, { raw: 1000, usable: 900 });
  assert.equal(result.riskBudget, 25);
  assert.equal(result.riskPerUnit, 105);
  assert.deepEqual(result.limits, { coverage: 1.2, risk: 0.238, account: 0.2015 });
  assert.equal(result.quantity, 0.2015);
  assert.ok(-result.scenarios.up.hedgeNet <= result.riskBudget);
  assert.ok((result.limits.risk + instrument.quantityStep) * result.riskPerUnit > result.riskBudget);
});

test('strictly preserves a positive floor buffer even at 100 percent risk', () => {
  const result = sizeVestHedge({
    ...base, downPoints: 100, upPoints: 100, riskFraction: 1,
    account: { ...account, equity: 1100 },
  });
  assert.equal(result.riskBudget, 100);
  assert.equal(result.quantity, 0.9999);
  assert.ok(result.headroom.raw + result.scenarios.up.hedgeNet > 0);
});

test('minimum protection selects the least valid size or returns the shortfall at the cap', () => {
  const fractional = {
    ...base, instrument: { ...instrument, quantityStep: 0.001, minQuantity: 0.01 }, downPoints: 100,
  };
  const attained = sizeVestHedge({ ...fractional, targetProtection: 15.01 });
  assert.equal(attained.quantity, 0.151);
  approximately(attained.protection, 15.1);
  assert.equal(attained.shortfall, 0);
  assert.equal(sizeVestHedge({ ...fractional, targetProtection: 0.1 }).quantity, 0.01);
  assert.equal(sizeVestHedge({ ...fractional, targetProtection: 0 }).quantity, 0);
  const capped = sizeVestHedge({ ...fractional, targetProtection: 150 });
  assert.equal(capped.quantity, 1.2);
  assert.equal(capped.shortfall, 30);
});

test('leaves zero units when room or minimum size fails, or when costs consume potential protection', () => {
  const noRoom = sizeVestHedge({ ...base, account: { ...account, equity: 1000 } });
  assert.equal(noRoom.quantity, 0);
  assert.equal(noRoom.riskBudget, 0);
  const belowMinimum = sizeVestHedge({
    ...base, instrument: { ...instrument, minQuantity: 0.1 }, account: { ...account, maxQuantity: 0.09 },
  });
  assert.equal(belowMinimum.quantity, 0);
  const expensive = sizeVestHedge({ ...base, fundingPerUnit: 151, targetProtection: 50 });
  assert.equal(expensive.quantity, 0);
  assert.equal(expensive.shortfall, 50);
  assert.match(expensive.warnings[0], /no positive hedge protection/);
});

test('rejects other venues, wrong symbols, missing conversion or fee, and invalid scenarios and balances', () => {
  for (const changes of [
    { instrument: { ...instrument, id: 'f-mnq' } },
    { instrument: { ...instrument, symbol: 'MNQ-PERP' } },
    { instrument: { ...instrument, pointValueQuote: 2 } },
    { instrument: { ...instrument, quoteToUSD: '' } },
    { feeRate: undefined }, { feeRate: -0.001 }, { feeRate: 2 }, { riskFraction: 0 },
    { coveragePercent: 101 }, { downPoints: 25_000 }, { upPoints: 0 },
    { account: { ...account, floor: '' } }, { existingQuantity: 0 },
  ]) {
    assert.ok(sizeVestHedge({ ...base, ...changes }).errors.length > 0, JSON.stringify(changes));
  }
});
