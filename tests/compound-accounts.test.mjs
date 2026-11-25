import assert from 'node:assert/strict';
import test from 'node:test';
import { getCompoundProfiles, readCompoundProfiles } from '../public/compound-accounts.mjs';
import { DEFAULT_ACCOUNTS } from '../public/engine.mjs';
import { createVestAccount, VEST_ROSTER_KEY } from '../public/vest-accounts.mjs';

test('Compound shows active Vest snapshots and keeps zero room distinct from missing room', () => {
  const rosterOnly = createVestAccount('New Vest');
  const active = { ...createVestAccount('Saved Vest'), equity: 520, floor: 490, reserve: 5 };
  const inactive = { ...createVestAccount('Inactive Vest'), equity: 600, floor: 490 };
  const depleted = { ...createVestAccount('No room'), equity: 495, floor: 490, reserve: 5 };
  const riskDesk = { accounts: [...DEFAULT_ACCOUNTS, active, inactive, depleted] };
  const roster = {
    accounts: [rosterOnly, { ...active, equity: null }],
    plans: { [inactive.id]: { inactive: true } },
  };
  const profiles = getCompoundProfiles(riskDesk, roster);
  assert.deepEqual(profiles.vest, [
    { id: active.id, name: active.name, room: 25 },
    { id: depleted.id, name: depleted.name, room: 0 },
    { id: rosterOnly.id, name: rosterOnly.name, room: null },
  ]);
  assert.deepEqual(profiles.individual, []);
});

test('Compound exposes entered non-Vest profiles individually without including demo or untouched presets', () => {
  const readyPreset = { ...DEFAULT_ACCOUNTS.find(account => account.id === 'topstep'), equity: 50000, floor: 48500, reserve: 400 };
  const unfinished = { id: 'account-custom', name: 'Prop profile', platform: 'futures', equity: 80000, floor: null };
  const other = { id: 'account-personal', name: 'Stocks', platform: 'custom', equity: 1000, floor: 950 };
  const riskDesk = { accounts: [...DEFAULT_ACCOUNTS.filter(account => account.id !== readyPreset.id), readyPreset, unfinished, other] };
  assert.deepEqual(getCompoundProfiles(riskDesk, {}), {
    vest: [],
    individual: [
      { id: readyPreset.id, name: readyPreset.name, room: 1100 },
      { id: unfinished.id, name: unfinished.name, room: null },
      { id: other.id, name: other.name, room: 50 },
    ],
  });
});

test('Compound reads a roster independently of missing or corrupt calculator storage', () => {
  const account = createVestAccount('New Vest');
  const storage = {
    getItem(key) {
      return key === VEST_ROSTER_KEY ? JSON.stringify({ accounts: [account], plans: {} }) : 'bad json';
    },
  };
  assert.deepEqual(readCompoundProfiles(storage), {
    vest: [{ id: account.id, name: account.name, room: null }],
    individual: [],
  });
  assert.deepEqual(readCompoundProfiles({ getItem() { throw new Error('denied'); } }), { vest: [], individual: [] });
});
