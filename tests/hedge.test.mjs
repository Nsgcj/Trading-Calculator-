import test from 'node:test';
import assert from 'node:assert/strict';
import { HEDGE_CONTRACTS, sizeHedge } from '../public/hedge.mjs';

const setup = {
  contractId: 'f-mes', portfolioValue: 100_000, direction: 'long', beta: 1.2,
  entryPrice: 6000, coveragePercent: 60, downPercent: 3, upPercent: 2, riskLimit: 10_000,
};

test('supports four published index futures contract multipliers', () => {
  assert.deepEqual(HEDGE_CONTRACTS.map(({ symbol, pointValueQuote }) => [symbol, pointValueQuote]), [
    ['ES', 50], ['MES', 5], ['NQ', 20], ['MNQ', 2],
  ]);
});

test('sizes the opposite futures side with a beta-adjusted coverage ceiling and both costed scenarios', () => {
  const hedge = sizeHedge({ ...setup, feePerContract: 10, holdingCostPerContract: 2 });
  assert.deepEqual(hedge.errors, []);
  assert.equal(hedge.quantity, 2);
  assert.equal(hedge.contractNotional, 30_000);
  assert.equal(hedge.exposure, 120_000);
  assert.equal(hedge.actualCoveragePercent, 50);
  assert.equal(hedge.hedgeDirection, 'short');
  assert.equal(hedge.hedgeNotional, 60_000);
  assert.equal(hedge.totalCosts, 24);
  assert.equal(hedge.protection, 1776);
  assert.equal(hedge.breakEvenPercent, 0.04);
  assert.deepEqual(hedge.scenarios, {
    down: { underlying: -3600, hedgeGross: 1800, hedgeNet: 1776, combined: -1824 },
    up: { underlying: 2400, hedgeGross: -1200, hedgeNet: -1224, combined: 1176 },
  });
});

test('hedges short equity with long futures and measures protection in a rising market', () => {
  const hedge = sizeHedge({
    ...setup, direction: 'short', contractId: 'f-mnq', entryPrice: 20_000,
    portfolioValue: 100_000, beta: 1, coveragePercent: 100, upPercent: 6, feePerContract: 5,
  });
  assert.deepEqual(hedge.errors, []);
  assert.equal(hedge.quantity, 2);
  assert.equal(hedge.hedgeDirection, 'long');
  assert.equal(hedge.protection, 4790);
  assert.deepEqual(hedge.scenarios, {
    down: { underlying: 3000, hedgeGross: -2400, hedgeNet: -2410, combined: 590 },
    up: { underlying: -6000, hedgeGross: 4800, hedgeNet: 4790, combined: -1210 },
  });
});

test('quantity is bounded by the adverse hedge-leg loss including costs, margin, and position cap', () => {
  const options = {
    ...setup, portfolioValue: 200_000, coveragePercent: 100, feePerContract: 10,
    riskLimit: 1219, availableMargin: 7500, marginPerContract: 2500, maxContracts: 4,
  };
  const hedge = sizeHedge(options);
  assert.deepEqual(hedge.limits, { coverage: 8, risk: 1, margin: 3, position: 4 });
  assert.equal(hedge.quantity, 1);
  assert.equal(hedge.marginUsed, 2500);
  assert.ok(-hedge.scenarios.up.hedgeNet <= options.riskLimit);
  assert.equal(sizeHedge({ ...options, riskLimit: 1220 }).quantity, 2);
  assert.equal(sizeHedge({ ...options, riskLimit: 100_000 }).quantity, 3);
  assert.equal(sizeHedge({ ...options, riskLimit: 100_000, maxContracts: 2 }).quantity, 2);
});

test('chooses the smallest hedge that meets the requested net protection or shows the best achievable shortfall', () => {
  const options = { ...setup, feePerContract: 10 };
  const exact = sizeHedge({ ...options, targetProtection: 890 });
  assert.equal(exact.quantity, 1);
  assert.equal(exact.shortfall, 0);
  const attainable = sizeHedge({ ...options, targetProtection: 891 });
  assert.equal(attainable.quantity, 2);
  assert.equal(attainable.shortfall, 0);
  const capped = sizeHedge({ ...options, targetProtection: 2000 });
  assert.equal(capped.quantity, 2);
  assert.equal(capped.protection, 1780);
  assert.equal(capped.shortfall, 220);
});

test('returns whole-contract zeroes for no capacity or no positive net protection', () => {
  const expensive = sizeHedge({ ...setup, feePerContract: 901, targetProtection: 100 });
  assert.equal(expensive.quantity, 0);
  assert.equal(expensive.protection, 0);
  assert.equal(expensive.shortfall, 100);
  assert.match(expensive.warnings[0], /after costs/);
  const undersized = sizeHedge({ ...setup, portfolioValue: 100 });
  assert.equal(undersized.quantity, 0);
  assert.equal(undersized.marginUsed, null);
  assert.equal(undersized.shortfall, null);
  const { underlying, hedgeGross, hedgeNet, combined } = undersized.scenarios.down;
  assert.ok(Math.abs(underlying + 3.6) < 1e-9);
  assert.equal(hedgeGross, 0);
  assert.equal(hedgeNet, 0);
  assert.equal(combined, underlying);
});

test('requires a modeled adverse move so a zero-loss scenario cannot bypass the loss limit', () => {
  const hedge = sizeHedge({ ...setup, upPercent: 0, riskLimit: 0 });
  assert.ok(hedge.errors.length > 0);
  assert.equal(sizeHedge({ ...setup, riskLimit: 0 }).quantity, 0);
});

test('rejects invalid prices, exposure inputs, percentages, and margin pairs', () => {
  for (const edits of [
    { contractId: 'vest-nq' }, { entryPrice: 0 }, { beta: -1 }, { portfolioValue: '' },
    { portfolioValue: Number.MAX_VALUE, beta: 2 }, { direction: 'flat' }, { coveragePercent: 101 },
    { riskLimit: Infinity }, { downPercent: -2 }, { holdingCostPerContract: -2 },
    { maxContracts: 1.5 }, { availableMargin: 1000 }, { marginPerContract: 100, availableMargin: '' },
  ]) {
    assert.ok(sizeHedge({ ...setup, ...edits }).errors.length > 0, JSON.stringify(edits));
  }
});
