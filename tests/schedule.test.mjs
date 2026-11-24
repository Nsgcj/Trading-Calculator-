import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_INSTRUMENTS } from '../public/engine.mjs';
import { getSchedule, SESSION_DEFINITIONS } from '../public/schedule.mjs';

const at = (iso, kind) => getSchedule(new Date(iso), { kind });
const ids = occurrences => occurrences.map(occurrence => occurrence.id);
const find = (occurrences, id) => occurrences.find(occurrence => occurrence.id === id);

test('session watchlists only link to unique Risk Desk instruments', () => {
  const instrumentIds = new Set(DEFAULT_INSTRUMENTS.map(instrument => instrument.id));
  for (const session of SESSION_DEFINITIONS) {
    const selection = new Set();
    for (const asset of session.assets) {
      assert.ok(instrumentIds.has(asset.id));
      assert.equal(selection.has(asset.id), false);
      selection.add(asset.id);
    }
  }
});

test('weekday cash opening appears alongside overlapping London and New York FX and Globex', () => {
  const before = at('2026-11-24T14:29:59Z');
  const open = at('2026-11-24T14:30:00Z');
  assert.deepEqual(ids(before.next), ['us-equities']);
  assert.deepEqual(ids(open.active), ['london', 'new-york', 'us-equities', 'cme-equity', 'cme-metals', 'cme-energy', 'crypto-spot']);
  assert.equal(find(open.active, 'us-equities').end.toISOString(), '2026-11-24T21:00:00.000Z');
});

test('uses each center’s local daylight rules in weeks with offset changes', () => {
  const march = at('2026-03-16T12:00:00Z', 'fx');
  assert.equal(find(march.active, 'london').start.toISOString(), '2026-03-16T08:00:00.000Z');
  assert.equal(find(march.active, 'new-york').start.toISOString(), '2026-03-16T12:00:00.000Z');
  const april = at('2026-04-07T12:00:00Z', 'fx');
  assert.equal(find(april.active, 'london').start.toISOString(), '2026-04-07T07:00:00.000Z');
  const jan = at('2027-01-12T00:00:00Z', 'fx');
  const june = at('2027-06-08T00:00:00Z', 'fx');
  assert.equal(find(jan.active, 'sydney').start.toISOString(), '2027-01-11T21:00:00.000Z');
  assert.equal(find(june.active, 'sydney').start.toISOString(), '2027-06-07T22:00:00.000Z');
  assert.equal(find(jan.active, 'tokyo').start.toISOString(), '2027-01-12T00:00:00.000Z');
  assert.equal(find(june.active, 'tokyo').start.toISOString(), '2027-06-08T00:00:00.000Z');
});

test('weekend forecast skips the continuous crypto market and clamps Sydney to the FX reopening', () => {
  const saturday = at('2026-11-28T15:00:00Z');
  assert.deepEqual(ids(saturday.active), ['crypto-spot']);
  assert.equal(saturday.active[0].continuous, true);
  assert.deepEqual(ids(saturday.next), ['sydney']);
  assert.equal(saturday.next[0].start.toISOString(), '2026-11-29T22:05:00.000Z');
  assert.ok(saturday.upcoming.length > 0);
  const cashForecast = at('2026-11-28T15:00:00Z', 'equities');
  assert.equal(cashForecast.next[0].start.toISOString(), '2026-11-30T14:30:00.000Z');
  assert.deepEqual(at('2026-11-28T15:00:00Z', 'crypto').next, []);
});

test('CME maintenance starts at 4 p.m. Chicago with a reopening one hour later', () => {
  assert.equal(at('2026-11-24T21:59:59Z', 'futures').active.length, 3);
  const breakTime = at('2026-11-24T22:00:00Z', 'futures');
  assert.deepEqual(breakTime.active, []);
  assert.equal(breakTime.next[0].start.toISOString(), '2026-11-24T23:00:00.000Z');
  assert.equal(at('2026-11-24T23:00:00Z', 'futures').active.length, 3);
});

test('Thanksgiving closures and early closes apply to cash equities and the documented Globex dates', () => {
  assert.deepEqual(at('2026-11-26T16:00:00Z', 'equities').active, []);
  const earlyCash = at('2026-11-27T17:59:59Z', 'equities').active[0];
  assert.equal(earlyCash.earlyClose, true);
  assert.equal(earlyCash.end.toISOString(), '2026-11-27T18:00:00.000Z');
  assert.deepEqual(at('2026-11-27T18:00:00Z', 'equities').active, []);
  const thanksgiving = at('2026-11-26T18:00:00Z', 'futures');
  assert.deepEqual(ids(thanksgiving.active), ['cme-metals', 'cme-energy']);
  assert.equal(find(thanksgiving.active, 'cme-energy').end.toISOString(), '2026-11-26T19:30:00.000Z');
  assert.equal(thanksgiving.next[0].start.toISOString(), '2026-11-26T23:00:00.000Z');
  assert.equal(find(thanksgiving.next, 'cme-equity').end.toISOString(), '2026-11-27T18:15:00.000Z');
  assert.equal(find(thanksgiving.next, 'cme-metals').end.toISOString(), '2026-11-27T19:45:00.000Z');
});

test('Christmas and New Year closures skip the prior evening reopening', () => {
  const christmas = at('2026-12-24T18:30:00Z', 'futures');
  assert.deepEqual(ids(christmas.active), ['cme-metals', 'cme-energy']);
  assert.equal(christmas.active[0].end.toISOString(), '2026-12-24T18:45:00.000Z');
  assert.equal(christmas.next[0].start.toISOString(), '2026-12-27T23:00:00.000Z');
  const newYear = at('2026-12-31T23:00:00Z', 'futures');
  assert.deepEqual(newYear.active, []);
  assert.equal(newYear.next[0].start.toISOString(), '2027-01-03T23:00:00.000Z');
});
