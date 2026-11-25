import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CONTEST_ACCOUNT,
  PHIDIAS_ADVENT_2026,
  getContestInstrumentLimit,
  getContestStatus,
} from '../public/contests.mjs';
import { DEFAULT_INSTRUMENTS } from '../public/engine.mjs';

const contestId = PHIDIAS_ADVENT_2026.id;
const statusAt = time => getContestStatus(contestId, time);

test('Phidias Advent account begins as an unverified $10,000 simulation with a static $0 floor', () => {
  assert.equal(DEFAULT_CONTEST_ACCOUNT.contestId, contestId);
  assert.equal(DEFAULT_CONTEST_ACCOUNT.equity, 10_000);
  assert.equal(DEFAULT_CONTEST_ACCOUNT.floor, 0);
  assert.equal(DEFAULT_CONTEST_ACCOUNT.dailyRemaining, null);
  assert.equal(DEFAULT_CONTEST_ACCOUNT.verified, false);
  assert.equal(DEFAULT_CONTEST_ACCOUNT.instrumentId, 'f-mnq');
  assert.equal(DEFAULT_CONTEST_ACCOUNT.sourceUrl, PHIDIAS_ADVENT_2026.sourceUrl);
});

test('the contest has exactly 17 sessions and three Double Doors', () => {
  const event = PHIDIAS_ADVENT_2026;
  assert.equal(event.sessions.length, 17);
  assert.equal(event.startsAt, '2026-11-30T18:00:00-05:00');
  assert.equal(event.endsAt, '2026-12-23T17:00:00-05:00');
  assert.deepEqual(event.sessions.filter(session => session.doubleDoor).map(({ date, doubleDoor }) => [date, doubleDoor]), [
    ['2026-12-04', 'NFP'],
    ['2026-12-09', 'FOMC'],
    ['2026-12-18', 'Quad Witching'],
  ]);
});

test('contest opens and ends at the exact times in Eastern Time', () => {
  assert.equal(statusAt('2026-11-30T22:59:59.999Z').status, 'upcoming');
  assert.equal(statusAt('2026-11-30T23:00:00Z').session.date, '2026-12-01');
  assert.equal(statusAt(new Date('2026-12-23T21:59:59.999Z')).status, 'open');
  assert.equal(statusAt(Date.parse('2026-12-23T22:00:00Z')).status, 'ended');
  assert.equal(statusAt('2026-12-24T12:00:00Z').nextSession, null);
  assert.equal(statusAt('invalid'), null);
  assert.equal(getContestStatus('other-event'), null);
});

test('contest closes each day from 5 p.m. to 6 p.m. ET and over the weekend', () => {
  assert.equal(statusAt('2026-12-01T16:59:59-05:00').status, 'open');
  const gap = statusAt('2026-12-01T17:00:00-05:00');
  assert.equal(gap.status, 'closed');
  assert.equal(gap.nextSession.date, '2026-12-02');
  assert.equal(statusAt('2026-12-01T18:00:00-05:00').status, 'open');
  const weekend = statusAt('2026-12-04T17:00:00-05:00');
  assert.equal(weekend.status, 'closed');
  assert.equal(weekend.nextSession.opensAt, '2026-12-06T18:00:00-05:00');
  assert.equal(statusAt('2026-12-05T18:00:00-05:00').status, 'closed');
  assert.equal(statusAt('2026-12-06T18:00:00-05:00').session.date, '2026-12-07');
});

test('contest contract caps apply only to catalogued exchange futures', () => {
  const getLimit = id => getContestInstrumentLimit(contestId, DEFAULT_INSTRUMENTS.find(item => item.id === id));
  const limits = [
    ['f-nq', 'CME', 'mini', 25],
    ['f-mnq', 'CME', 'micro', 250],
    ['f-mym', 'CBOT', 'micro', 250],
    ['f-cl', 'NYMEX', 'mini', 25],
    ['f-ng', 'NYMEX', 'mini', 25],
    ['f-mgc', 'COMEX', 'micro', 250],
    ['f-sil', 'COMEX', 'micro', 250],
    ['f-mbt', 'CME', 'micro', 250],
    ['f-met', 'CME', 'micro', 250],
  ];
  for (const [id, exchange, contractClass, maxQuantity] of limits) {
    const limit = getLimit(id);
    assert.equal(limit.exchange, exchange);
    assert.equal(limit.contractClass, contractClass);
    assert.equal(limit.maxQuantity, maxQuantity);
  }
  assert.equal(getLimit('vest-nq'), null);
  assert.equal(getLimit('fx-eur'), null);
  assert.equal(getLimit('f-m6e'), null);
  assert.equal(getLimit('f-mng'), null);
  assert.equal(getContestInstrumentLimit(contestId, { id: 'instrument-custom', platform: 'futures', symbol: 'MNQ', unit: 'contracts' }), null);
  assert.equal(getContestInstrumentLimit(contestId, { id: 'f-mnq', platform: 'futures', symbol: 'OTHER', unit: 'contracts' }), null);
});
