const blank = value => value == null || (typeof value === 'string' && !value.trim());
const number = value => !blank(value) && (typeof value === 'number' || typeof value === 'string') ? Number(value) : NaN;
const optionalNumber = value => blank(value) ? null : number(value);
const positive = value => Number.isFinite(value) && value > 0;
const nonnegative = value => Number.isFinite(value) && value >= 0;
const positiveFraction = value => positive(value) && value <= 1;

function wilsonLower(wins, count) {
  if (wins === 0) return 0;
  const rate = wins / count;
  const z = 1.96;
  const adjustment = z * z / count;
  const center = rate + adjustment / 2;
  const halfWidth = z * Math.sqrt((rate * (1 - rate) + adjustment / 4) / count);
  return Math.max(0, (center - halfWidth) / (1 + adjustment));
}

function riskGate(minimumRisk, risk) {
  if (minimumRisk === null) return 'unknown';
  const tolerance = Math.min(1e-8, Number.EPSILON * 4 * Math.max(risk, minimumRisk));
  return minimumRisk - risk <= tolerance ? 'fits' : 'blocked';
}

function summarizeGate(rows, property) {
  if (rows.some(row => row[property] === 'blocked')) return 'blocked';
  return rows.some(row => row[property] === 'unknown') ? 'unknown' : 'fits';
}

/** Estimate compounding capacity for accounts sharing a single trade sample and opportunity stream. */
export function projectCompound(input = {}) {
  const errors = [], warnings = [];
  const target = number(input.target);
  const enteredFraction = number(input.riskFraction);
  const lossStreak = number(input.lossStreak);
  const keepFraction = number(input.keepFraction);
  const wins = target === 0 ? optionalNumber(input.wins) ?? 0 : number(input.wins);
  const losses = target === 0 ? optionalNumber(input.losses) ?? 0 : number(input.losses);
  const count = wins + losses;
  const avgWinR = optionalNumber(input.avgWinR);
  const tradesPerWeek = optionalNumber(input.tradesPerWeek);

  if (!nonnegative(target)) errors.push('Enter a nonnegative remaining net profit goal.');
  if (!positiveFraction(enteredFraction)) errors.push('Enter a risk fraction above 0% and up to 100%.');
  if (!Number.isSafeInteger(lossStreak) || lossStreak <= 0) errors.push('Enter a positive whole number of consecutive losses to test.');
  if (!positiveFraction(keepFraction)) errors.push('Enter a fraction of room to retain above 0% and up to 100%.');
  if (![wins, losses].every(value => Number.isSafeInteger(value) && value >= 0) || !Number.isSafeInteger(count)) {
    errors.push('Enter valid whole counts of closed wins and losses.');
  } else if (count === 0 && target > 0) errors.push('Enter at least one closed trade in the sample.');
  if ((target > 0 || avgWinR !== null) && !positive(avgWinR)) errors.push('Enter a positive average net winner in R.');
  if ((target > 0 || tradesPerWeek !== null) && !positive(tradesPerWeek)) errors.push('Enter a positive number of setup opportunities per week.');
  if (!Array.isArray(input.accounts) || !input.accounts.length) errors.push('Select at least one account with usable drawdown room.');

  const seen = new Set();
  const accounts = Array.isArray(input.accounts) ? input.accounts.map((account, index) => {
    const id = typeof account?.id === 'string' ? account.id.trim() : '';
    const name = typeof account?.name === 'string' && account.name.trim() ? account.name.trim() : id || `Account ${index + 1}`;
    const room = number(account?.room);
    const minimumRisk = optionalNumber(account?.minimumRisk);
    if (!id || seen.has(id)) errors.push(`${name} needs a unique account selection.`);
    seen.add(id);
    if (!positive(room)) errors.push(`${name} needs positive usable drawdown room.`);
    if (minimumRisk !== null && !nonnegative(minimumRisk)) errors.push(`${name} needs a nonnegative minimum trade risk or a blank estimate.`);
    return { id, name, room, minimumRisk };
  }) : [];
  if (errors.length) return { errors, warnings };

  const totalRoom = accounts.reduce((sum, account) => sum + account.room, 0);
  if (!positive(totalRoom) || !Number.isFinite(totalRoom + target)) {
    return { errors: ['The combined room and profit goal are outside the supported calculation range.'], warnings };
  }

  const guardFraction = Math.max(0, Math.min(1 - Number.EPSILON / 2, -Math.expm1(Math.log(keepFraction) / lossStreak)));
  const effectiveFraction = Math.min(enteredFraction, guardFraction);
  const guardApplied = effectiveFraction < enteredFraction;
  const retainedFraction = Math.exp(lossStreak * Math.log1p(-effectiveFraction));
  const firstRisk = totalRoom * effectiveFraction;
  const postStreakRoom = totalRoom * retainedFraction;
  const postStreakRisk = postStreakRoom * effectiveFraction;
  const initialTargetR = target === 0 ? 0 : firstRisk > 0 && Number.isFinite(target / firstRisk) ? target / firstRisk : null;

  const rows = accounts.map(account => {
    const firstRisk = account.room * effectiveFraction;
    const postStreakRoom = account.room * retainedFraction;
    const postStreakRisk = postStreakRoom * effectiveFraction;
    return {
      ...account, firstRisk, postStreakRoom, postStreakRisk,
      initialGate: riskGate(account.minimumRisk, firstRisk),
      postStreakGate: riskGate(account.minimumRisk, postStreakRisk),
    };
  });
  const gates = { initial: summarizeGate(rows, 'initialGate'), postStreak: summarizeGate(rows, 'postStreakGate') };
  const minimumBlocked = gates.initial === 'blocked' || gates.postStreak === 'blocked';
  if (minimumBlocked) warnings.push('A modeled account size cannot cover its entered minimum trade risk now or after the stress streak.');
  else if (gates.initial === 'unknown' || gates.postStreak === 'unknown') {
    warnings.push('Any benchmark depends on each account being able to place the modeled size. Minimum trade risk is missing for one or more accounts.');
  }

  const winRate = count > 0 ? wins / count : null;
  const cautiousWinRate = count > 0 ? wilsonLower(wins, count) : null;
  const gainLog = avgWinR === null ? null : Math.log1p(effectiveFraction * avgWinR);
  const lossLog = Math.log1p(-effectiveFraction);
  const ratio = target / totalRoom;
  const goalLog = Number.isFinite(ratio) ? Math.log1p(ratio) : Math.log(target) - Math.log(totalRoom);
  const benchmark = rate => {
    const expectedR = rate === null || avgWinR === null ? null : rate * avgWinR - (1 - rate);
    const logGrowth = rate === null || gainLog === null ? null : rate * gainLog + (1 - rate) * lossLog;
    const metrics = { winRate: rate, expectedR, logGrowth };
    if (target === 0) return { ...metrics, status: 'reached', trades: 0, weeks: 0 };
    if (minimumBlocked) return { ...metrics, status: 'minimum-risk-blocked', trades: null, weeks: null };
    if (!(logGrowth > 0)) return { ...metrics, status: 'no-growth', trades: null, weeks: null };
    const trades = Math.max(1, Math.ceil(goalLog / logGrowth));
    const weeks = trades / tradesPerWeek;
    if (!Number.isSafeInteger(trades) || !Number.isFinite(weeks)) return { ...metrics, status: 'out-of-range', trades: null, weeks: null };
    return { ...metrics, status: 'projected', trades, weeks };
  };
  const base = benchmark(winRate);
  const cautious = benchmark(cautiousWinRate);
  const scenarios = { base, cautious };
  const sample = { wins, losses, count, winRate, cautiousWinRate, avgWinR, expectedR: base.expectedR };

  const milestones = [0.25, 0.5, 0.75, 1].map(fraction => {
    const netProfit = target * fraction;
    const room = totalRoom + netProfit;
    return {
      fraction, netProfit, room, risk: room * effectiveFraction,
      accounts: accounts.map(account => {
        const room = account.room + netProfit * (account.room / totalRoom);
        return { id: account.id, room, risk: room * effectiveFraction };
      }),
    };
  });
  return {
    errors, warnings, totalRoom, target, enteredFraction, effectiveFraction, guardFraction, guardApplied,
    keepFraction, lossStreak, retainedFraction, firstRisk, postStreakRoom, postStreakRisk, initialTargetR,
    rows, gates, sample, scenarios, milestones,
  };
}
