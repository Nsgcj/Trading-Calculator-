import assert from 'node:assert/strict';
import test from 'node:test';
import { getMarketRotation, getRotation } from '../public/rotation.mjs';

const personal = time => getRotation(new Date(time));

test('New York equity opening applies preparation before entry review', () => {
  const observed = personal('2026-11-24T14:30:00Z').current;
  assert.equal(observed.id, 'ny-equity-window');
  assert.equal(observed.status, 'prepare');
  assert.equal(observed.phase.name, 'Observe price discovery');
  assert.equal(observed.steps[0].start.toISOString(), '2026-11-24T14:15:00.000Z');
  const structure = personal('2026-11-24T14:35:00Z').current;
  assert.equal(structure.phase.name, 'Identify displacement and structure');
  const entry = personal('2026-11-24T14:45:00Z').current;
  assert.equal(entry.status, 'focus');
  assert.deepEqual(entry.assets.map(asset => asset.symbol), ['MNQ', 'MES', 'MGC']);
  assert.equal(personal('2026-11-24T15:30:00Z').current.phase.name, 'Continuation and position management');
});

test('New York macro focus remains active until the equity preparation handoff', () => {
  assert.equal(personal('2026-11-24T14:15:00Z').current.id, 'ny-macro');
  const handoff = personal('2026-11-24T14:25:00Z');
  assert.equal(handoff.current.status, 'prepare');
  assert.equal(handoff.next.id, 'ny-equity-window');
});

test('mandatory downtime has no new-entry watchlist', () => {
  const { current, next } = personal('2026-11-24T16:30:00Z');
  assert.equal(current.id, 'mandatory-downtime');
  assert.equal(current.status, 'manage');
  assert.deepEqual(current.assets, []);
  assert.equal(next.id, 'afternoon-continuation');
  assert.equal(next.start.toISOString(), '2026-11-24T18:30:00.000Z');
});

test('the Asia strategy keeps its 8 p.m. Eastern start across daylight changes', () => {
  const winter = personal('2026-11-24T01:00:00Z').current;
  const summer = personal('2027-07-07T00:00:00Z').current;
  assert.equal(winter.id, 'asian-kill-zone');
  assert.equal(summer.id, 'asian-kill-zone');
  assert.equal(winter.start.toISOString(), '2026-11-24T01:00:00.000Z');
  assert.equal(summer.start.toISOString(), '2027-07-07T00:00:00.000Z');
  assert.ok(summer.assets.some(asset => asset.id === 'fx-audjpy'));
});

test('weekends, New York cash holidays, and early closes suppress the applicable focus windows', () => {
  const saturday = personal('2026-11-28T15:00:00Z');
  assert.equal(saturday.current.status, 'off');
  assert.equal(saturday.next.start.toISOString(), '2026-11-30T01:00:00.000Z');
  assert.equal(personal('2026-11-26T15:00:00Z').current.status, 'off');
  assert.equal(personal('2026-11-27T17:59:00Z').current.id, 'mandatory-downtime');
  assert.equal(personal('2026-11-27T18:00:00Z').current.status, 'off');
});

test('the broader rotation covers rollover and crosses midnight through late Asia', () => {
  const rollover = getMarketRotation(new Date('2026-11-23T22:00:00Z'));
  assert.equal(rollover.current.id, 'rollover');
  assert.equal(rollover.current.status, 'prepare');
  assert.equal(rollover.next.id, 'asian-expansion');
  const overnight = getMarketRotation(new Date('2026-11-24T06:59:00Z'));
  assert.equal(overnight.current.id, 'late-asia');
  assert.equal(overnight.next.start.toISOString(), '2026-11-24T07:00:00.000Z');
  assert.ok(overnight.timeline.every(window => window.assets.every(Boolean)));
});
