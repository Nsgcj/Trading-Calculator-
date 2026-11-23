/** Chicken Man Risk Desk - pure, deterministic sizing engine. No trading API or auto execution. */
export const MODES = Object.freeze({
  safe: { label: 'Very Safe', fraction: 0.02, explanation: '2% of usable drawdown' },
  normal: { label: 'Normal', fraction: 0.05, explanation: '5% of usable drawdown' },
  lottery: { label: 'Risk the Biscuit', fraction: 0.60, explanation: '60% of usable drawdown — account loss likely' },
});

/** Default broker profiles are EXAMPLES, not validated current firm rules. */
export const DEFAULT_ACCOUNTS = [
  { id:'vest', name:'Vest Instant — example', platform:'vest', equity:500, floor:490, reserve:0, dailyRemaining:null, maxQuantity:null, verified:false },
  { id:'mff', name:'MFF Futures — example', platform:'futures', equity:25000, floor:24000, reserve:0, dailyRemaining:null, maxQuantity:null, verified:false },
  { id:'custom', name:'Personal account — example', platform:'custom', equity:1000, floor:900, reserve:0, dailyRemaining:null, maxQuantity:null, verified:false },
];

// pointValueQuote: monetary value in the instrument's quote currency of a 1.0 price move for one native quantity.
// quoteToUSD: units of USD per one quote-currency unit. FX crosses and non-USD quotes require a manual current rate.
export const DEFAULT_INSTRUMENTS = [
  { id:'vest-nq', platform:'vest', symbol:'NQ-PERP', name:'Vest Nasdaq perpetual (illustrative)', asset:'Index perpetual', tickSize:0.25, pointValueQuote:1, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'units', pipSize:null, verified:false, source:'Broker contract specification must be checked', reference:'NQ' },
  { id:'vest-es', platform:'vest', symbol:'ES-PERP', name:'Vest S&P perpetual (illustrative)', asset:'Index perpetual', tickSize:0.25, pointValueQuote:1, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'units', pipSize:null, verified:false, source:'Broker contract specification must be checked', reference:'ES' },
  { id:'f-mnq', platform:'futures', symbol:'MNQ', name:'Micro E-mini Nasdaq-100', asset:'Futures', tickSize:0.25, pointValueQuote:2, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME contract specification', reference:'NQ' },
  { id:'f-nq', platform:'futures', symbol:'NQ', name:'E-mini Nasdaq-100', asset:'Futures', tickSize:0.25, pointValueQuote:20, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME contract specification', reference:'NQ' },
  { id:'f-mes', platform:'futures', symbol:'MES', name:'Micro E-mini S&P 500', asset:'Futures', tickSize:0.25, pointValueQuote:5, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME contract specification', reference:'ES' },
  { id:'f-es', platform:'futures', symbol:'ES', name:'E-mini S&P 500', asset:'Futures', tickSize:0.25, pointValueQuote:50, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME contract specification', reference:'ES' },
  { id:'f-mgc', platform:'futures', symbol:'MGC', name:'Micro Gold Futures', asset:'Futures', tickSize:0.1, pointValueQuote:10, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME/COMEX contract specification', reference:'GC' },
  { id:'f-gc', platform:'futures', symbol:'GC', name:'Gold Futures', asset:'Futures', tickSize:0.1, pointValueQuote:100, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME/COMEX contract specification', reference:'GC' },
  { id:'f-mcl', platform:'futures', symbol:'MCL', name:'Micro WTI Crude Oil', asset:'Futures', tickSize:0.01, pointValueQuote:100, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'contracts', pipSize:null, verified:true, source:'CME/NYMEX contract specification', reference:'CL' },
  { id:'fx-eur', platform:'custom', symbol:'EURUSD', name:'EUR/USD spot FX — standard lots', asset:'Spot FX', tickSize:0.00001, pointValueQuote:100000, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:0.0001, verified:false, source:'Illustrative 100,000 EUR/lot — verify broker', reference:'EURUSD' },
  { id:'fx-jpy', platform:'custom', symbol:'USDJPY', name:'USD/JPY spot FX — standard lots', asset:'Spot FX', tickSize:0.001, pointValueQuote:100000, quoteToUSD:0, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:0.01, verified:false, source:'Quote JPY→USD conversion required; verify broker', reference:'USDJPY' },
  { id:'c-btc', platform:'custom', symbol:'BTCUSD', name:'Bitcoin spot — quantity in BTC', asset:'Crypto spot', tickSize:0.01, pointValueQuote:1, quoteToUSD:1, quantityStep:0.0001, minQuantity:0.0001, unit:'BTC', pipSize:null, verified:false, source:'Illustrative spot BTC; perpetual contract multipliers vary', reference:'BTC' },
  { id:'c-stock', platform:'custom', symbol:'STOCK', name:'U.S. stock — whole shares', asset:'Equity', tickSize:0.01, pointValueQuote:1, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'shares', pipSize:null, verified:false, source:'Generic whole share stock; fractional settings vary', reference:'STOCK' },
  { id:'c-cfd', platform:'custom', symbol:'CFD-CUSTOM', name:'Custom CFD / other derivative', asset:'CFD', tickSize:0.01, pointValueQuote:0, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:null, verified:false, source:'MUST input correct broker cash value per price point per lot', reference:'OTHER' },
];

const finitePositive = v => Number.isFinite(v) && v > 0;
const finiteNonnegative = v => Number.isFinite(v) && v >= 0;
const numeric = v => typeof v === 'number' ? v : Number(v);
const nearly = 1e-10;
function tickRound(v, tick, direction) {
  const ratio = v / tick;
  return (direction === 'down' ? Math.floor(ratio + nearly) : Math.ceil(ratio - nearly)) * tick;
}
export function roundQuantityDown(value, step) {
  if (!finitePositive(step) || !Number.isFinite(value)) return 0;
  const scale = 10 ** Math.min(10, Math.max(0, (String(step).split('.')[1] || '').length));
  const units = Math.floor((value / step) + nearly);
  return Math.max(0, Math.round(units * step * scale) / scale);
}
export function getHeadroom(account) {
  const equity = numeric(account.equity), floor = numeric(account.floor), reserve = numeric(account.reserve ?? 0);
  if (!Number.isFinite(equity) || !Number.isFinite(floor) || !finiteNonnegative(reserve)) return null;
  const raw = equity - floor;
  return {raw, usable: Math.max(0, raw - reserve)};
}
export function getRiskBudget(account, riskFraction) {
  const h = getHeadroom(account);
  if (!h || !finitePositive(riskFraction) || riskFraction > 1) return null;
  let budget = h.usable * riskFraction;
  if (account.dailyRemaining !== null && account.dailyRemaining !== '' && account.dailyRemaining !== undefined) {
    const remaining = numeric(account.dailyRemaining);
    if (!finiteNonnegative(remaining)) return null;
    budget = Math.min(budget, remaining);
  }
  return Math.max(0, budget);
}
/**
 * @param {object} p {account,instrument,side,entry,stopMode,stopInput,riskFraction,rr,slippageTicks,spreadTicks,feePerUnit, stressExtraTicks}
 * Calculates net stop risk INCLUDING configured costs; quantity rounded DOWN to venue step.
 */
export function sizePosition(p) {
  const warnings=[], errors=[];
  const a=p.account||{}, s=p.instrument||{};
  const h=getHeadroom(a), riskFraction=numeric(p.riskFraction), budget=getRiskBudget(a,riskFraction);
  const entry=numeric(p.entry), requested=numeric(p.stopInput), rr=numeric(p.rr);
  const tick=numeric(s.tickSize), pointQuote=numeric(s.pointValueQuote), fx=numeric(s.quoteToUSD), step=numeric(s.quantityStep), minQ=numeric(s.minQuantity);
  const slip=numeric(p.slippageTicks ?? 0), spread=numeric(p.spreadTicks ?? 0), fees=numeric(p.feePerUnit ?? 0), stressExtra=numeric(p.stressExtraTicks ?? 2);
  if (!h) errors.push('Enter valid account equity, failure floor and safety reserve.');
  else if (h.raw <= 0) errors.push('Account equity is at/below the failure floor. No trade.');
  else if (h.usable <= 0) errors.push('No usable drawdown remains after the safety reserve.');
  if (budget === null) errors.push('Risk fraction or daily-loss allowance is invalid.');
  else if (budget <= 0) errors.push('Risk allowance is zero. No trade.');
  if (!finitePositive(entry) || !finitePositive(requested)) errors.push('Entry and stop must be positive numbers.');
  if (!finitePositive(tick) || !finitePositive(pointQuote) || !finitePositive(fx)) errors.push('Instrument tick size, point value and quote→USD rate must all be positive.');
  if (!finitePositive(step) || !finitePositive(minQ) || minQ < step - nearly) errors.push('Instrument quantity step/minimum are invalid.');
  if (!finitePositive(rr)) errors.push('Reward multiple must be positive.');
  if (![slip,spread,fees,stressExtra].every(finiteNonnegative)) errors.push('Trading costs and stress ticks cannot be negative.');
  if (!['long','short'].includes(p.side)) errors.push('Choose long or short.');
  if (!['price','points','ticks','pips'].includes(p.stopMode)) errors.push('Invalid stop unit.');
  if (p.stopMode==='pips' && !finitePositive(numeric(s.pipSize))) errors.push('Pips require a verified pip size in the instrument settings.');
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget};
  let stopRaw;
  const direction = p.side==='long' ? -1 : 1;
  if (p.stopMode==='price') stopRaw=requested;
  else {
    const distance = requested * (p.stopMode==='ticks'?tick:p.stopMode==='pips'?numeric(s.pipSize):1);
    stopRaw = entry + direction * distance;
  }
  const stop = tickRound(stopRaw,tick,p.side==='long'?'down':'up');
  const distance=Math.abs(entry-stop);
  if (stop <= 0) errors.push('Stop price must remain positive.');
  if (p.side==='long' && !(stop<entry) || p.side==='short' && !(stop>entry)) errors.push('Stop must be beyond entry in the loss direction.');
  if (!finitePositive(distance)) errors.push('Stop distance is zero.');
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget};
  const pointUSD=pointQuote*fx;
  const lossPerUnit=distance*pointUSD+(slip+spread)*tick*pointUSD+fees;
  const qtyRisk=roundQuantityDown(budget/lossPerUnit,step);
  const maxQ=(a.maxQuantity===null||a.maxQuantity===''||a.maxQuantity===undefined)?null:numeric(a.maxQuantity);
  if (maxQ!==null && !finiteNonnegative(maxQ)) errors.push('Max account quantity cannot be negative.');
  const qty=maxQ===null?qtyRisk:Math.min(qtyRisk,roundQuantityDown(maxQ,step));
  if (qty+nearly<minQ) errors.push(`Minimum size ${minQ} ${s.unit} would exceed the risk allowance; skip the trade or use a smaller contract.`);
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget,minimumUnitRisk:lossPerUnit*minQ};
  const risk=qty*lossPerUnit;
  const tpRaw=entry-direction*distance*rr;
  const target=tickRound(tpRaw,tick,p.side==='long'?'down':'up');
  if (target <= 0) return {status:'BLOCKED',warnings,errors:['Target price becomes nonpositive; change the reward multiple or instrument.'],headroom:h,budget};
  const grossTarget=Math.abs(target-entry)*pointUSD*qty;
  const roundTripCosts=qty*((slip+spread)*tick*pointUSD+fees);
  const reward=grossTarget-roundTripCosts;
  const stressRisk=risk+qty*stressExtra*tick*pointUSD;
  if (!a.verified) warnings.push('Account floor and drawdown rules are not confirmed. Enter the live broker floor before trading.');
  if (!s.verified) warnings.push('Instrument unit/lot/contract specification NOT verified. Confirm the platform specification.');
  if (fees===0) warnings.push('Fee estimate is $0. Confirm commissions, spreads and other trading costs.');
  if (stressRisk > h.usable + nearly) warnings.push('Stress slippage could penetrate the safety reserve / failure floor.');
  if (riskFraction>=0.25) warnings.push('High-risk mode: one adverse move could consume a large share of available drawdown.');
  if (a.dailyRemaining===null) warnings.push('No daily remaining-loss limit entered; account-specific daily rules are not checked.');
  const verified=Boolean(a.verified && s.verified);
  return {
    status:verified?'CALCULATED':'VERIFY',warnings,errors,headroom:h,budget,
    quantity:qty,risk,expectedReward:reward,rrNet:reward/risk,
    maxLossFraction: risk/h.raw, reservePostStop: h.raw-risk,
    postStopEquity: numeric(a.equity)-risk, postTargetEquity:numeric(a.equity)+reward,
    stop,target,stopDistance:distance,stopTicks:distance/tick,
    perUnitLoss:lossPerUnit,pointValueUSD:pointUSD,tickValueUSD:pointUSD*tick,
    grossTarget,roundTripCosts,stressRisk,stressPostEquity:numeric(a.equity)-stressRisk,
    riskFraction, originalStop:stopRaw,entry,stopMode:p.stopMode
  };
}

export const usd = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
export const fmt = (v,max=5) => Number.isFinite(v) ? Number(v.toFixed(max)).toLocaleString('en-US',{maximumFractionDigits:max}):'—';
