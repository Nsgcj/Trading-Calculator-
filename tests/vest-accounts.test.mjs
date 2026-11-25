import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VEST_ROSTER_KEY,
  createVestAccount,
  isTrackedVestAccount,
  mergeVestAccounts,
  readVestRoster,
  writeVestRoster,
} from '../public/vest-accounts.mjs';

function memoryStorage(entries = []) {
  const records = new Map(entries);
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, value); },
  };
}

test('new Vest profiles have distinct IDs and require their own equity and floor', () => {
  const account = createVestAccount('  Vest account A  ');
  assert.equal(account.name, 'Vest account A');
  assert.equal(account.platform, 'vest');
  assert.equal(account.stage, 'sim-funded');
  assert.equal(account.instrumentId, 'vest-nq');
  assert.equal(account.equity, null);
  assert.equal(account.floor, null);
  assert.equal(account.reserve, 0);
  assert.equal(account.verified, false);
  assert.notEqual(account.id, createVestAccount(account.name).id);
  assert.equal(createVestAccount(' '), null);
});

test('roster tracking excludes the Vest illustration and other platforms', () => {
  const example = { id: 'vest', name: 'Vest Instant — example', platform: 'vest' };
  assert.equal(isTrackedVestAccount(example), false);
  assert.equal(isTrackedVestAccount({ ...example, trackedVest: true }), true);
  assert.equal(isTrackedVestAccount({ ...example, id: 'personal', platform: 'futures' }), false);
  assert.equal(isTrackedVestAccount(createVestAccount('Vest B')), true);
});

test('roster keeps role and review metadata separate from calculator data', () => {
  const riskKey = 'chicken-man-riskdesk-v1';
  const storage = memoryStorage([[riskKey, '{"accountId":"mff"}']]);
  const account = createVestAccount('Vest C');
  const roster = {
    accounts: [account],
    plans: {
      [account.id]: {
        role: 'Swing', session: 'US AM', overnightConfirmed: true,
        weekendConfirmed: false, plannedLoss: 12.5, inactive: false,
      },
    },
  };
  assert.equal(writeVestRoster(roster, storage), true);
  assert.deepEqual(readVestRoster(storage), roster);
  assert.equal(storage.getItem(riskKey), '{"accountId":"mff"}');
});

test('calculator and dashboard keep existing balances when roster records overlap', () => {
  const account = createVestAccount('Vest D');
  const additional = createVestAccount('Vest E');
  const saved = { ...account, equity: 501, floor: 475, instrumentId: 'vest-es' };
  const other = { id: 'mff', name: 'MFF', platform: 'futures' };
  const merged = mergeVestAccounts([saved, other], { accounts: [account, additional, additional] });
  assert.deepEqual(merged, [saved, other, additional]);
  assert.notEqual(merged[2], additional);
});

test('missing, malformed and inaccessible roster storage degrade safely', () => {
  const empty = { accounts: [], plans: {} };
  assert.deepEqual(readVestRoster(memoryStorage()), empty);
  assert.deepEqual(readVestRoster(memoryStorage([[VEST_ROSTER_KEY, 'broken']])), empty);
  const noStorage = {
    getItem() { throw new Error('Storage denied'); },
    setItem() { throw new Error('Storage denied'); },
  };
  assert.deepEqual(readVestRoster(noStorage), empty);
  assert.equal(writeVestRoster(empty, noStorage), false);
});
