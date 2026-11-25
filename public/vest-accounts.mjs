export const VEST_ROSTER_KEY = 'chicken-man-vest-roster-v1';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isTrackedVestAccount(account) {
  return account?.platform === 'vest' && typeof account.id === 'string' && Boolean(account.id.trim())
    && typeof account.name === 'string' && Boolean(account.name.trim())
    && (account.id !== 'vest' || account.trackedVest === true);
}

function normalizeRoster(roster) {
  const accounts = Array.isArray(roster?.accounts) ? roster.accounts.filter(isTrackedVestAccount) : [];
  const plans = isRecord(roster?.plans)
    ? Object.fromEntries(Object.entries(roster.plans).filter(([, plan]) => isRecord(plan)))
    : {};
  return { accounts, plans };
}

export function readVestRoster(storage) {
  try {
    const backend = storage ?? globalThis.localStorage;
    return normalizeRoster(JSON.parse(backend.getItem(VEST_ROSTER_KEY)));
  } catch {
    return { accounts: [], plans: {} };
  }
}

export function writeVestRoster(roster, storage) {
  try {
    const backend = storage ?? globalThis.localStorage;
    backend.setItem(VEST_ROSTER_KEY, JSON.stringify(normalizeRoster(roster)));
    return true;
  } catch {
    return false;
  }
}

export function mergeVestAccounts(baseAccounts, roster) {
  const accounts = Array.isArray(baseAccounts) ? [...baseAccounts] : [];
  const ids = new Set(accounts.map(account => account?.id));
  for (const account of normalizeRoster(roster).accounts) {
    if (ids.has(account.id)) continue;
    accounts.push({ ...account });
    ids.add(account.id);
  }
  return accounts;
}

export function createVestAccount(name) {
  const label = typeof name === 'string' ? name.trim().slice(0, 70) : '';
  if (!label) return null;
  const id = globalThis.crypto.randomUUID();
  return {
    id: `vest-account-${id}`,
    name: label,
    platform: 'vest',
    stage: 'sim-funded',
    instrumentId: 'vest-nq',
    equity: null,
    floor: null,
    reserve: 0,
    dailyRemaining: null,
    maxQuantity: null,
    verified: false,
  };
}
