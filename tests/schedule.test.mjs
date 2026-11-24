import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_INSTRUMENTS } from '../public/engine.mjs';
import { getSchedule, SESSION_DEFINITIONS } from '../public/schedule.mjs';

const at = (iso, kind) => getSchedule(new Date(iso), { kind });
const ids = occurrences => occurrences.map(occurrence => occurrence.id);
const find = (occurrences, id) => occurrences.find(occurrence => occurrence.id === id);

test('session watchlists link to known instruments and show distinct cash references', () => {
  const instrumentIds = new Set(DEFAULT_INSTRUMENTS.map(instrument => instrument.id));
  for (const session of SESSION_DEFINITIONS) {
    const selection = new Set();
    for (const asset of session.assets) {
      assert.ok(asset.symbol && asset.name);
      if (asset.id) assert.ok(instrumentIds.has(asset.id));
      const key = asset.id ?? asset.symbol;
      assert.equal(selection.has(key), false);
      selection.add(key);
    }
  }
});

test('weekday cash opening appears alongside overlapping London and New York FX and Globex', () => {
  const before = at('2026-11-24T14:29:59Z');
  const open = at('2026-11-24T14:30:00Z');
  assert.deepEqual(ids(before.next), ['us-equities']);
  assert.deepEqual(ids(open.active), [
    'london', 'new-york', 'xetra', 'lse', 'us-equities', 'cme-equity', 'cme-metals', 'cme-energy', 'crypto-spot',
  ]);
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
  assert.deepEqual(ids(cashForecast.next), ['asx']);
  assert.equal(cashForecast.next[0].start.toISOString(), '2026-11-29T23:00:00.000Z');
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
  assert.equal(find(at('2026-11-26T16:00:00Z', 'equities').active, 'us-equities'), undefined);
  const earlyCash = find(at('2026-11-27T17:59:59Z', 'equities').active, 'us-equities');
  assert.equal(earlyCash.earlyClose, true);
  assert.equal(earlyCash.end.toISOString(), '2026-11-27T18:00:00.000Z');
  assert.equal(find(at('2026-11-27T18:00:00Z', 'equities').active, 'us-equities'), undefined);
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

test('Asian cash markets pause and reopen on their own lunch schedules', () => {
  const tokyoLunch = at('2026-11-24T02:45:00Z', 'equities');
  assert.deepEqual(ids(tokyoLunch.active), ['asx', 'hkex-am', 'sse-am']);
  assert.deepEqual(ids(tokyoLunch.next), ['tse-pm']);
  assert.equal(tokyoLunch.next[0].start.toISOString(), '2026-11-24T03:30:00.000Z');

  const hongKongLunch = at('2026-11-24T04:30:00Z', 'equities');
  assert.deepEqual(ids(hongKongLunch.active), ['asx', 'tse-pm']);
  assert.deepEqual(ids(hongKongLunch.next), ['hkex-pm', 'sse-pm']);
  assert.deepEqual(ids(at('2026-11-24T05:00:00Z', 'equities').active), ['tse-pm', 'hkex-pm', 'sse-pm']);
});

test('global cash opening uses local daylight time', () => {
  const sydneySummer = at('2026-11-23T23:00:00Z', 'equities');
  const sydneyWinter = at('2027-06-08T00:00:00Z', 'equities');
  assert.equal(find(sydneySummer.active, 'asx').start.toISOString(), '2026-11-23T23:00:00.000Z');
  assert.equal(find(sydneyWinter.active, 'asx').start.toISOString(), '2027-06-08T00:00:00.000Z');

  const eurasiaWinter = at('2026-03-16T08:00:00Z', 'equities');
  const eurasiaSummer = at('2026-04-07T07:00:00Z', 'equities');
  for (const id of ['xetra', 'lse']) {
    assert.equal(find(eurasiaWinter.active, id).start.toISOString(), '2026-03-16T08:00:00.000Z');
    assert.equal(find(eurasiaSummer.active, id).start.toISOString(), '2026-04-07T07:00:00.000Z');
  }
});

test('overseas calendars account for documented closures, half days and coverage gaps', () => {
  const tokyoHoliday = at('2026-11-23T01:00:00Z', 'equities');
  assert.equal(find(tokyoHoliday.active, 'tse-am'), undefined);
  assert.ok(find(tokyoHoliday.active, 'asx'));

  const holidayEve = at('2026-12-24T03:09:59Z', 'equities');
  assert.equal(find(holidayEve.active, 'asx').end.toISOString(), '2026-12-24T03:10:00.000Z');
  assert.equal(find(holidayEve.active, 'hkex-am').earlyClose, true);
  assert.equal(find(holidayEve.active, 'hkex-am').end.toISOString(), '2026-12-24T04:00:00.000Z');
  assert.equal(find(at('2026-12-24T05:00:00Z', 'equities').active, 'hkex-pm'), undefined);

  const later = at('2027-01-05T02:00:00Z', 'equities');
  assert.equal(find(later.active, 'hkex-am').regularOnly, true);
  assert.equal(find(later.active, 'tse-am').regularOnly, false);
});

test('previous session is determined by its closing time during an overlap', () => {
  const overlap = at('2026-11-24T14:45:00Z', 'fx');
  assert.deepEqual(ids(overlap.active), ['london', 'new-york']);
  assert.deepEqual(ids(overlap.previous), ['tokyo']);
  assert.equal(overlap.previous[0].end.toISOString(), '2026-11-24T09:00:00.000Z');

  const globexBreak = at('2026-11-24T22:00:00Z', 'futures');
  assert.deepEqual(ids(globexBreak.previous), ['cme-equity', 'cme-metals', 'cme-energy']);
  assert.ok(globexBreak.previous.every(session => session.end.toISOString() === '2026-11-24T22:00:00.000Z'));
});

test('previous sessions look through holiday weekends and exclude continuous crypto', () => {
  const holidayWeekend = at('2026-12-27T22:00:00Z', 'futures');
  assert.deepEqual(ids(holidayWeekend.previous), ['cme-metals', 'cme-energy']);
  assert.equal(holidayWeekend.previous[0].end.toISOString(), '2026-12-24T18:45:00.000Z');
  assert.deepEqual(at('2026-12-27T22:00:00Z', 'crypto').previous, []);
});
