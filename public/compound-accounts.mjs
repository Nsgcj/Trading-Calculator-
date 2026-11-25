import { DEFAULT_ACCOUNTS, getHeadroom } from './engine.mjs';
import { isTrackedVestAccount, mergeVestAccounts, readVestRoster } from './vest-accounts.mjs';

const riskDeskStorageKey = 'chicken-man-riskdesk-v1';
const demoIds = new Set(['vest', 'mff', 'custom']);
const presetIds = new Set(DEFAULT_ACCOUNTS.map(account => account.id));

export function getCompoundProfiles(riskDesk, roster) {
  const profiles = { vest: [], individual: [] };
  const accounts = mergeVestAccounts(riskDesk?.accounts, roster);

  for (const account of accounts) {
    if (typeof account?.id !== 'string' || !account.id.trim() || typeof account.name !== 'string' || !account.name.trim()
      || demoIds.has(account.id) || account.stage === 'contest' || account.contestId) continue;
    const room = getHeadroom(account)?.usable ?? null;
    const profile = { id: account.id, name: account.name, room };
    if (account.platform === 'vest') {
      if (isTrackedVestAccount(account) && roster?.plans?.[account.id]?.inactive !== true) profiles.vest.push(profile);
    } else if (typeof account.platform === 'string' && account.platform && (!presetIds.has(account.id) || room !== null)) {
      profiles.individual.push(profile);
    }
  }

  return profiles;
}

export function readCompoundProfiles(storage) {
  let riskDesk = null;
  try {
    riskDesk = JSON.parse((storage ?? globalThis.localStorage).getItem(riskDeskStorageKey));
  } catch {}
  return getCompoundProfiles(riskDesk, readVestRoster(storage));
}
