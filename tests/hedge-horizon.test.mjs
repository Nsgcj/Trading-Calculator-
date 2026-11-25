import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHedgeHorizon } from '../public/hedge-horizon.mjs';

function assertExit(horizon, now, exitDate, exitAt, calendarDays, customDate) {
  assert.deepEqual(getHedgeHorizon(horizon, new Date(now), customDate), {
    exitDate, exitAt: new Date(exitAt), calendarDays,
  });
}

test('the Friday holiday-week exit uses its 1 p.m. Eastern cash close', () => {
  assertExit('week', '2026-11-25T15:00:00Z', '2026-11-27', '2026-11-27T18:00:00Z', 2);
  assertExit('week', '2026-11-27T17:59:59Z', '2026-11-27', '2026-11-27T18:00:00Z', 0);
  assertExit('week', '2026-11-27T18:00:00Z', '2026-12-04', '2026-12-04T21:00:00Z', 7);
  assertExit('week', '2026-12-21T15:00:00Z', '2026-12-24', '2026-12-24T18:00:00Z', 3);
});

test('the week follows New York calendar dates across UTC midnight and the weekend', () => {
  assertExit('week', '2026-11-28T00:30:00Z', '2026-12-04', '2026-12-04T21:00:00Z', 7);
  assertExit('week', '2026-11-29T18:00:00Z', '2026-12-04', '2026-12-04T21:00:00Z', 5);
});

test('month-end uses the last trading day and rolls after closing time', () => {
  assertExit('month', '2026-05-28T15:00:00Z', '2026-05-29', '2026-05-29T20:00:00Z', 1);
  assertExit('month', '2026-05-29T20:00:00Z', '2026-06-30', '2026-06-30T20:00:00Z', 32);
  assertExit('month', '2026-12-31T21:00:00Z', '2027-01-29', '2027-01-29T21:00:00Z', 29);
});

test('custom exits require a real future cash close in the covered calendar', () => {
  assertExit('custom', '2026-11-25T21:01:00Z', '2026-11-27', '2026-11-27T18:00:00Z', 2, '2026-11-27');
  assertExit('custom', '2026-11-27T17:59:59Z', '2026-11-27', '2026-11-27T18:00:00Z', 0, '2026-11-27');
  assert.equal(getHedgeHorizon('custom', new Date('2026-11-25T21:01:00Z'), '2026-11-26'), null);
  const now = new Date('2026-11-27T18:00:00Z');
  for (const invalidDate of [undefined, '2026-11-25', '2026-11-27', '2026-11-28', '2027-02-30', '2029-01-03', '2026-12-1']) {
    assert.equal(getHedgeHorizon('custom', now, invalidDate), null, String(invalidDate));
  }
  assert.equal(getHedgeHorizon('unknown', now), null);
  assert.equal(getHedgeHorizon('week', new Date(NaN)), null);
  assert.equal(getHedgeHorizon('month', new Date('2028-12-30T13:00:00Z')), null);
});
