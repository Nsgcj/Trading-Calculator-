import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkHedgeFlip } from '../public/hedge-flip.mjs';

const heldShort = { contractId: 'f-mes', hedgeSide: 'short', invalidationPrice: 6000, warningTicks: 4 };

test('a rally into a short hedge warning boundary uses the contract tick size', () => {
  assert.deepEqual(checkHedgeFlip({ ...heldShort, lastClose: 5998.75 }), {
    errors: [], state: 'intact', distanceTicks: -5, threshold: 5999, adverseDirection: 'above',
  });
  assert.deepEqual(checkHedgeFlip({ ...heldShort, lastClose: 5999 }), {
    errors: [], state: 'watch', distanceTicks: -4, threshold: 5999, adverseDirection: 'above',
  });
  assert.equal(checkHedgeFlip({ ...heldShort, lastClose: 6000.25 }).state, 'broken');
});

test('a long hedge is adverse below the level, including a partial tick beyond it', () => {
  const heldLong = { contractId: 'f-mnq', hedgeSide: 'long', invalidationPrice: 20_100, warningTicks: 4 };
  assert.deepEqual(checkHedgeFlip({ ...heldLong, lastClose: 20_101 }), {
    errors: [], state: 'watch', distanceTicks: -4, threshold: 20_101, adverseDirection: 'below',
  });
  assert.equal(checkHedgeFlip({ ...heldLong, invalidationPrice: 20_100.125, lastClose: 20_100 }).state, 'broken');
  assert.equal(checkHedgeFlip({ ...heldLong, lastClose: 20_099.75, confirmedFollowThrough: true }).state, 'confirmed');
  assert.equal(checkHedgeFlip({ ...heldLong, lastClose: 20_101.25, confirmedFollowThrough: true }).state, 'intact');
});

test('follow-through confirms only a completed close strictly outside the level', () => {
  assert.deepEqual(checkHedgeFlip({ ...heldShort, lastClose: 6000.25, confirmedFollowThrough: true }), {
    errors: [], state: 'confirmed', distanceTicks: 1, threshold: 5999, adverseDirection: 'above',
  });
  assert.equal(checkHedgeFlip({ ...heldShort, lastClose: 6000.25, confirmedFollowThrough: 'true' }).state, 'broken');
  assert.equal(checkHedgeFlip({ ...heldShort, lastClose: 6000, confirmedFollowThrough: true }).state, 'watch');
  assert.equal(checkHedgeFlip({ ...heldShort, lastClose: 5999.75, confirmedFollowThrough: true }).state, 'watch');
  assert.equal(checkHedgeFlip({ ...heldShort, lastClose: 5998.75, confirmedFollowThrough: true }).state, 'intact');
});

test('zero warning ticks still mark a completed close at the level as watch', () => {
  const zeroWarning = { ...heldShort, invalidationPrice: '6000', warningTicks: '0' };
  assert.deepEqual(checkHedgeFlip({ ...zeroWarning, lastClose: '6000' }), {
    errors: [], state: 'watch', distanceTicks: 0, threshold: 6000, adverseDirection: 'above',
  });
  assert.equal(checkHedgeFlip({ ...zeroWarning, lastClose: 5999.75 }).state, 'intact');
});

test('invalid prices, sides, warning distances and unsupported contracts have no state', () => {
  const input = { ...heldShort, lastClose: 6000 };
  for (const changes of [
    { contractId: 'vest-es' }, { hedgeSide: 'buy' }, { invalidationPrice: null }, { invalidationPrice: -1 },
    { lastClose: '' }, { lastClose: Infinity }, { lastClose: 0 }, { lastClose: true },
    { warningTicks: -1 }, { warningTicks: 0.5 }, { warningTicks: ' ' }, { warningTicks: 2 ** 53 },
    { lastClose: Number.MAX_VALUE },
  ]) {
    const result = checkHedgeFlip({ ...input, ...changes });
    assert.equal(result.errors.length, 1);
    assert.equal(result.state, null);
    assert.equal(result.distanceTicks, null);
  }
});
