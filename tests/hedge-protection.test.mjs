import assert from 'node:assert/strict';
import test from 'node:test';
import { checkProtection, sizeHedgeReduction } from '../public/hedge-protection.mjs';

const account = { equity: 1000, peakEquity: 1050, firmFloor: 800, reserve: 100, giveback: 100 };
const leg = { contractId: 'f-mnq', openContracts: 8, adverseTicks: 10, exitCostPerContract: 4 };

test('protection takes the stronger of the firm reserve and profit giveback', () => {
  assert.deepEqual(checkProtection(account), {
    errors: [], equity: 1000, peakEquity: 1050, firmThreshold: 900, profitFloor: 950,
    protectedFloor: 950, givebackUsed: 50, room: 50, atLimit: false,
  });
  const firmWins = checkProtection({ ...account, reserve: 180 });
  assert.equal(firmWins.protectedFloor, 980);
  assert.equal(firmWins.room, 20);
});

test('equity sets a new high without sharing peak or giveback across accounts', () => {
  const first = checkProtection(account);
  const second = checkProtection({ ...account, equity: 1150 });
  assert.equal(first.peakEquity, 1050);
  assert.equal(first.givebackUsed, 50);
  assert.equal(second.peakEquity, 1150);
  assert.equal(second.profitFloor, 1050);
  assert.equal(second.givebackUsed, 0);
});

test('hedge reduction charges all open exit costs once and reports least trim', () => {
  const result = sizeHedgeReduction({ ...leg, protection: checkProtection(account) });
  assert.deepEqual(result, {
    errors: [], keep: 3, trim: 5, riskPerContract: 5, totalExitCost: 32,
    modeledKeepLoss: 15, modeledLoss: 47, modeledEquity: 953, remainingRoom: 3,
    unavoidableCost: 0, firmThresholdReached: false,
  });
});

test('kept contracts may use all giveback while leaving firm reserve intact', () => {
  const result = sizeHedgeReduction({ ...leg, adverseTicks: 12, protection: checkProtection(account) });
  assert.equal(result.keep, 3);
  assert.equal(result.modeledEquity, 950);
  assert.equal(result.remainingRoom, 0);
  assert.equal(result.firmThresholdReached, false);
});

test('gives a whole contract credit for exact giveback equality with decimal reserves', () => {
  const protection = checkProtection({ equity: 106.3, peakEquity: 106.3, firmFloor: 95, reserve: 0, giveback: 6.3 });
  const result = sizeHedgeReduction({ ...leg, openContracts: 1, exitCostPerContract: 0.3, adverseTicks: 12, protection });
  assert.equal(result.keep, 1);
  assert.equal(result.remainingRoom, 0);
  assert.equal(result.modeledEquity, protection.protectedFloor);
});

test('modeled equity must remain strictly above the firm threshold', () => {
  const protection = checkProtection({ equity: 104, peakEquity: 104, firmFloor: 98, reserve: 2, giveback: 10 });
  const result = sizeHedgeReduction({ ...leg, openContracts: 4, exitCostPerContract: 0, adverseTicks: 2, protection });
  assert.equal(result.keep, 3);
  assert.equal(result.trim, 1);
  assert.equal(result.remainingRoom, 1);
  const equality = sizeHedgeReduction({ ...leg, openContracts: 4, exitCostPerContract: 1, adverseTicks: 2, protection });
  assert.equal(equality.keep, 0);
  assert.equal(equality.modeledEquity, protection.firmThreshold);
  assert.equal(equality.firmThresholdReached, true);
  assert.equal(equality.unavoidableCost, 0);
});

test('flattening can leave negative headroom when closing costs exceed the room', () => {
  const result = sizeHedgeReduction({ ...leg, exitCostPerContract: 8, protection: checkProtection(account) });
  assert.equal(result.keep, 0);
  assert.equal(result.trim, 8);
  assert.equal(result.modeledEquity, 936);
  assert.equal(result.remainingRoom, -14);
  assert.equal(result.unavoidableCost, 14);

  const exactRoom = checkProtection({ ...account, equity: 100.3, peakEquity: 100.3, firmFloor: 90, reserve: 0, giveback: 0.3 });
  const closeAll = sizeHedgeReduction({ ...leg, openContracts: 3, exitCostPerContract: 0.1, protection: exactRoom });
  assert.equal(closeAll.keep, 0);
  assert.equal(closeAll.remainingRoom, 0);
  assert.equal(closeAll.unavoidableCost, 0);
});

test('existing giveback shortfall and a flat leg still report signed room', () => {
  const protection = checkProtection({ ...account, equity: 945 });
  assert.equal(protection.atLimit, true);
  assert.equal(protection.room, 0);
  const result = sizeHedgeReduction({ ...leg, openContracts: 0, protection });
  assert.equal(result.keep, 0);
  assert.equal(result.trim, 0);
  assert.equal(result.totalExitCost, 0);
  assert.equal(result.unavoidableCost, 0);
  assert.equal(result.remainingRoom, -5);
});

test('invalid cash inputs and impossible contract counts or tick scenarios are rejected', () => {
  for (const edits of [{ equity: '' }, { giveback: -1 }, { reserve: -1 }, { firmFloor: Infinity }, { peakEquity: false }]) {
    assert.ok(checkProtection({ ...account, ...edits }).errors.length > 0);
  }
  const protection = checkProtection(account);
  for (const edits of [
    { protection: checkProtection({}) }, { contractId: 'vest-nq' }, { openContracts: 0.5 },
    { adverseTicks: 0 }, { adverseTicks: 2.5 }, { exitCostPerContract: -1 },
  ]) {
    assert.ok(sizeHedgeReduction({ ...leg, protection, ...edits }).errors.length > 0);
  }
});
