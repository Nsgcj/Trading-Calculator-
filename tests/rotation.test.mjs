import assert from 'node:assert/strict';
import test from 'node:test';
import { getMarketRotation, getRotation } from '../public/rotation.mjs';
import { getSessionPlays } from '../public/planner/session-plays.mjs';
import { getPlaybooksForWindow } from '../public/planner/playbooks.mjs';

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

test('Day Two plays match the New York entry phases and stay out of preparation and downtime', () => {
  const cases = [
    ['14:40', []],
    ['14:45', ['Day Two · John Wick rejection']],
    ['15:30', ['Day Two · Hold and retest (Hitchhiker)']],
    ['16:30', []],
    ['18:30', ['Day Two · Afternoon backside']],
  ];
  for (const [time, expected] of cases) {
    const { current } = personal(`2026-11-24T${time}:00Z`);
    const plays = getSessionPlays(current.phase?.name ?? current.id);
    assert.deepEqual(plays.filter(play => play.marketMemory).map(play => play.name), expected);
  }
});

test('playbook links distinguish opening, continuation and no-entry windows', () => {
  const cases = [
    ['14:25', ['equities-open', 'equity-hedge', 'stock-in-play']],
    ['14:40', ['equities-open']],
    ['14:45', ['equities-open', 'equity-hedge', 'structural-momentum', 'order-flow-momentum']],
    ['15:30', ['morning-continuation', 'structural-momentum', 'order-flow-momentum']],
    ['16:30', []],
    ['18:30', ['afternoon-continuation', 'structural-momentum', 'order-flow-momentum']],
    ['20:00', ['power-hour', 'structural-momentum']],
  ];
  for (const [time, expected] of cases) {
    const { current } = personal(`2026-11-24T${time}:00Z`);
    const playbooks = getPlaybooksForWindow(current.phase?.name ?? current.id);
    assert.deepEqual(playbooks.map(playbook => playbook.id), expected);
  }
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

test('previous rotation shows the completed window during an active opening phase', () => {
  const current = personal('2026-11-24T14:45:00Z');
  assert.equal(current.current.id, 'ny-equity-window');
  assert.equal(current.previous.id, 'ny-equity-prep');
  assert.equal(current.previous.end.toISOString(), '2026-11-24T14:30:00.000Z');

  const market = getMarketRotation(new Date('2026-11-24T14:45:00Z'));
  assert.equal(market.current.id, 'cash-open-overlap');
  assert.equal(market.previous.id, 'macro-premarket');
  assert.equal(market.previous.end.toISOString(), '2026-11-24T14:30:00.000Z');
});

test('weekend rotations show the last real window rather than the intervening gap', () => {
  const now = new Date('2026-11-29T16:00:00Z');
  const strategy = getRotation(now);
  assert.equal(strategy.current.id, 'off-window');
  assert.equal(strategy.previous.id, 'mandatory-downtime');
  assert.equal(strategy.previous.end.toISOString(), '2026-11-27T18:00:00.000Z');
  assert.equal(strategy.current.start.getTime(), strategy.previous.end.getTime());

  const market = getMarketRotation(now);
  assert.equal(market.current.id, 'off-window');
  assert.equal(market.previous.id, 'post-market');
  assert.equal(market.previous.end.toISOString(), '2026-11-27T22:00:00.000Z');
});
