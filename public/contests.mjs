const EASTERN_STANDARD_OFFSET = '-05:00';
const easternTime = (date, time) => `${date}T${time}:00${EASTERN_STANDARD_OFFSET}`;

const doubleDoors = new Map([
  ['2026-12-04', 'NFP'],
  ['2026-12-09', 'FOMC'],
  ['2026-12-18', 'Quad Witching'],
]);

const sessionDates = Array.from({ length: 23 }, (_, index) => new Date(Date.UTC(2026, 11, index + 1)))
  .filter(date => date.getUTCDay() >= 1 && date.getUTCDay() <= 5);

const sessions = Object.freeze(sessionDates.map(sessionDate => {
  const date = sessionDate.toISOString().slice(0, 10);
  const priorDate = new Date(Date.UTC(2026, 11, sessionDate.getUTCDate() - 1)).toISOString().slice(0, 10);
  return Object.freeze({
    date,
    opensAt: easternTime(priorDate, '18:00'),
    closesAt: easternTime(date, '17:00'),
    doubleDoor: doubleDoors.get(date) ?? null,
  });
}));

export const PHIDIAS_ADVENT_2026 = Object.freeze({
  id: 'phidias-advent-2026',
  name: 'Phidias 10K Drawdown Challenge · Advent Edition 2026',
  sourceUrl: 'https://member.phidiaspropfirm.com/advent/rules?_lang=en',
  startingEquity: 10_000,
  floor: 0,
  maxMinis: 25,
  maxMicros: 250,
  startsAt: sessions[0].opensAt,
  endsAt: sessions.at(-1).closesAt,
  sessions,
});

export const DEFAULT_CONTEST_ACCOUNT = Object.freeze({
  id: PHIDIAS_ADVENT_2026.id,
  contestId: PHIDIAS_ADVENT_2026.id,
  name: PHIDIAS_ADVENT_2026.name,
  sourceUrl: PHIDIAS_ADVENT_2026.sourceUrl,
  platform: 'futures',
  stage: 'contest',
  instrumentId: 'f-mnq',
  equity: PHIDIAS_ADVENT_2026.startingEquity,
  floor: PHIDIAS_ADVENT_2026.floor,
  reserve: 0,
  dailyRemaining: null,
  maxQuantity: null,
  verified: false,
});

const sessionTimes = sessions.map(session => ({
  opensAt: Date.parse(session.opensAt),
  closesAt: Date.parse(session.closesAt),
}));

// This mirrors the supplied contest schedule. Exchange or organizer exceptions can change actual access.
export function getContestStatus(contestId, at = Date.now()) {
  if (contestId !== PHIDIAS_ADVENT_2026.id) return null;
  const time = typeof at === 'string' ? Date.parse(at) : at instanceof Date ? at.getTime() : at;
  if (!Number.isFinite(time)) return null;
  const index = sessionTimes.findIndex(({ closesAt }) => time < closesAt);
  if (index === -1) return { status: 'ended', session: null, nextSession: null };
  if (time < sessionTimes[index].opensAt) {
    return { status: index === 0 ? 'upcoming' : 'closed', session: null, nextSession: sessions[index] };
  }
  return { status: 'open', session: sessions[index], nextSession: sessions[index + 1] ?? null };
}

// Catalog entries listed as Authorized Products at https://phidiaspropfirm.com/rules.
// The 25-contract cap models standard and mini contracts for one order.
const exchangeBuckets = {
  CME: { mini: ['NQ', 'ES', 'RTY', '6E'], micro: ['MNQ', 'MES', 'M2K', 'MBT', 'MET'] },
  CBOT: { mini: ['YM'], micro: ['MYM'] },
  NYMEX: { mini: ['CL', 'NG'], micro: ['MCL'] },
  COMEX: { mini: ['GC', 'SI'], micro: ['MGC', 'SIL'] },
};

const knownContracts = new Map();
for (const [exchange, buckets] of Object.entries(exchangeBuckets)) {
  for (const [contractClass, symbols] of Object.entries(buckets)) {
    const maxQuantity = contractClass === 'micro' ? PHIDIAS_ADVENT_2026.maxMicros : PHIDIAS_ADVENT_2026.maxMinis;
    for (const symbol of symbols) {
      knownContracts.set(`f-${symbol.toLowerCase()}`, Object.freeze({ symbol, exchange, contractClass, maxQuantity }));
    }
  }
}

export function getContestInstrumentLimit(contestId, instrument) {
  if (contestId !== PHIDIAS_ADVENT_2026.id || instrument?.platform !== 'futures' || instrument.unit !== 'contracts') return null;
  const contract = knownContracts.get(instrument.id);
  return contract && contract.symbol === instrument.symbol ? contract : null;
}
