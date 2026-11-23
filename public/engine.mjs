/** Chicken Man Risk Desk - pure, deterministic sizing engine. No trading API or auto execution. */
export const MODES = Object.freeze({
  safe: { label: 'Very Safe', fraction: 0.02, explanation: '2% of usable drawdown' },
  normal: { label: 'Normal', fraction: 0.05, explanation: '5% of usable drawdown' },
  lottery: { label: 'Risk the Biscuit', fraction: 0.60, explanation: '60% of usable drawdown — account loss likely' },
});

const PERPETUAL_VENUES = [
  { id: 'hyperliquid', name: 'Hyperliquid', quote: 'USDC', suffix: '' },
  { id: 'binance-linear', name: 'Binance USDⓈ-M', quote: 'USDT', suffix: 'USDT' },
  { id: 'bybit-linear', name: 'Bybit USDT', quote: 'USDT', suffix: 'USDT' },
];

export const ACCOUNT_STAGES = Object.freeze({
  personal: 'Personal',
  evaluation: 'Evaluation',
  'sim-funded': 'Simulated funded',
  'live-funded': 'Live funded',
});

const customPerpetual = { id: 'perp-custom', name: 'Custom perpetual', quote: 'quote currency', suffix: '' };

function accountTemplate(id, name, platform, stage, sourceUrl) {
  return { id, name, platform, stage, sourceUrl, reserve: 0, dailyRemaining: null, maxQuantity: null, verified: false };
}

const mffStages = 'https://help.myfundedfutures.com/en/articles/10101257-understanding-live-funded-account-at-myfunded-futures';
const topstepStages = 'https://www.topstep.com/our-program';
const apexStages = 'https://apextraderfunding.com/help-center/getting-started/apex-live-prop-trading-program-faq/';
const takeProfitStages = 'https://try.takeprofittrader.com/TPT-FAQs-nf40-4-0725';
const tradeDayStages = 'https://www.tradeday.com/';
const earn2tradeStages = 'https://help.earn2trade.com/en/articles/3313030-what-is-the-livesim';
const ftmoStages = 'https://ftmo.com/en/how-it-works/';
const myFundedPerpStages = 'https://myfundedperpetuals.com/disclaimer';

/** Default broker profiles are EXAMPLES, not validated current firm rules. */
export const DEFAULT_ACCOUNTS = [
  { ...accountTemplate('vest', 'Vest Instant — example', 'vest', 'sim-funded', 'https://www.vestfunded.com/instant'), equity: 500, floor: 490 },
  { ...accountTemplate('mff', 'MFF Futures — example', 'futures', 'evaluation', mffStages), equity: 25000, floor: 24000 },
  { ...accountTemplate('custom', 'Personal account — example', 'custom', 'personal'), equity: 1000, floor: 900 },
  accountTemplate('mff-evaluation', 'My Funded Futures — Evaluation', 'futures', 'evaluation', mffStages),
  accountTemplate('mff-sim', 'My Funded Futures — Sim Funded', 'futures', 'sim-funded', mffStages),
  accountTemplate('mff-live', 'My Funded Futures — Live Funded', 'futures', 'live-funded', mffStages),
  accountTemplate('topstep', 'Topstep — Trading Combine', 'futures', 'evaluation', topstepStages),
  accountTemplate('topstep-xfa', 'Topstep — Express Funded', 'futures', 'sim-funded', topstepStages),
  accountTemplate('topstep-live', 'Topstep — Live Funded', 'futures', 'live-funded', topstepStages),
  accountTemplate('apex', 'Apex Trader Funding — Evaluation', 'futures', 'evaluation', apexStages),
  accountTemplate('apex-pa', 'Apex Trader Funding — Performance Account', 'futures', 'sim-funded', apexStages),
  accountTemplate('apex-live', 'Apex Trader Funding — Live Prop Trading', 'futures', 'live-funded', apexStages),
  accountTemplate('take-profit-trader', 'Take Profit Trader — Test', 'futures', 'evaluation', takeProfitStages),
  accountTemplate('take-profit-trader-pro', 'Take Profit Trader — PRO', 'futures', 'sim-funded', takeProfitStages),
  accountTemplate('take-profit-trader-pro-plus', 'Take Profit Trader — PRO+', 'futures', 'live-funded', takeProfitStages),
  accountTemplate('tradeday', 'TradeDay — Evaluation', 'futures', 'evaluation', tradeDayStages),
  accountTemplate('tradeday-sim', 'TradeDay — Funded Sim', 'futures', 'sim-funded', tradeDayStages),
  accountTemplate('tradeday-live', 'TradeDay — Funded Live', 'futures', 'live-funded', tradeDayStages),
  accountTemplate('earn2trade', 'Earn2Trade — Evaluation', 'futures', 'evaluation', earn2tradeStages),
  accountTemplate('earn2trade-livesim', 'Earn2Trade — LiveSim', 'futures', 'sim-funded', earn2tradeStages),
  accountTemplate('earn2trade-live', 'Earn2Trade — Live', 'futures', 'live-funded', earn2tradeStages),
  accountTemplate('ftmo', 'FTMO — Challenge', 'custom', 'evaluation', ftmoStages),
  accountTemplate('ftmo-sim', 'FTMO — FTMO Account', 'custom', 'sim-funded', ftmoStages),
  accountTemplate('my-funded-perps-evaluation', 'MyFundedPerps — Evaluation', 'perp-custom', 'evaluation', myFundedPerpStages),
  accountTemplate('my-funded-perps-sim', 'MyFundedPerps — Simulated Funded', 'perp-custom', 'sim-funded', myFundedPerpStages),
  accountTemplate('ninjatrader', 'NinjaTrader — Futures', 'futures', 'personal'),
  accountTemplate('tradovate', 'Tradovate — Futures', 'futures', 'personal'),
  accountTemplate('ibkr-futures', 'Interactive Brokers — Futures', 'futures', 'personal'),
  accountTemplate('ibkr-equities', 'Interactive Brokers — Stocks & ETFs', 'custom', 'personal'),
  accountTemplate('schwab', 'Charles Schwab — Stocks & ETFs', 'custom', 'personal'),
  accountTemplate('fidelity', 'Fidelity — Stocks & ETFs', 'custom', 'personal'),
  accountTemplate('webull', 'Webull — Stocks & ETFs', 'custom', 'personal'),
  accountTemplate('oanda', 'OANDA — Forex', 'custom', 'personal'),
  accountTemplate('forex-com', 'FOREX.com — Forex', 'custom', 'personal'),
  accountTemplate('coinbase-spot', 'Coinbase — Crypto spot', 'custom', 'personal'),
  accountTemplate('kraken-spot', 'Kraken — Crypto spot', 'custom', 'personal'),
  ...PERPETUAL_VENUES.map(({ id, name }) => accountTemplate(id, `${name} — Perpetuals`, id, 'personal')),
  accountTemplate('personal-futures', 'Personal Futures', 'futures', 'personal'),
  accountTemplate('personal-perps', 'Personal Perpetuals', 'perp-custom', 'personal'),
  accountTemplate('prop-futures-evaluation', 'Custom Futures Prop — Evaluation', 'futures', 'evaluation'),
  accountTemplate('prop-futures-sim', 'Custom Futures Prop — Simulated Funded', 'futures', 'sim-funded'),
  accountTemplate('prop-futures-live', 'Custom Futures Prop — Live Funded', 'futures', 'live-funded'),
  accountTemplate('prop-perps-evaluation', 'Custom Perpetual Prop — Evaluation', 'perp-custom', 'evaluation'),
  accountTemplate('prop-perps-sim', 'Custom Perpetual Prop — Simulated Funded', 'perp-custom', 'sim-funded'),
  accountTemplate('prop-perps-live', 'Custom Perpetual Prop — Live Funded', 'perp-custom', 'live-funded'),
];

const venueInput = 'Enter the venue tick, quantity step, minimum size and current quote-to-USD rate';
const perpAssets = [
  { coin: 'BTC', name: 'Bitcoin' },
  { coin: 'ETH', name: 'Ether' },
  { coin: 'SOL', name: 'Solana' },
  { coin: 'XRP', name: 'XRP' },
  { coin: 'DOGE', name: 'Dogecoin' },
  { coin: 'ADA', name: 'Cardano' },
  { coin: 'LINK', name: 'Chainlink' },
  { coin: 'AVAX', name: 'Avalanche' },
  { coin: 'SUI', name: 'Sui' },
];

function linearPerpetuals({ id, name, quote, suffix }) {
  return perpAssets.map(({ coin, name: asset }) => ({
    id: `${id}-${coin.toLowerCase()}`, platform: id, symbol: `${coin}${suffix}`,
    name: `${asset} linear perpetual · ${name}`, asset: 'Crypto linear perpetual',
    tickSize: null, pointValueQuote: 1, quoteToUSD: null, quantityStep: null, minQuantity: null,
    unit: coin, pipSize: null, verified: false, reference: coin,
    source: `${venueInput} (${quote}→USD). Verify cash per point and order quantity in ${coin}.`,
  }));
}

const equitySource='https://www.cmegroup.com/markets/equities/sp-500-and-nasdaq-100-futures.html';
const goldSource='https://www.cmegroup.com/education/courses/event-contracts-underlying-markets/product-gold';
const oilSource='https://www.cmegroup.com/education/articles-and-reports/micro-wti-crude-oil-futures-faq';
const gasSource='https://www.cmegroup.com/articles/faqs/micro-henry-hub-natural-gas-futures-and-options-frequently-asked-questions.html';
const futuresSources={
  MNQ:equitySource,NQ:equitySource,MES:equitySource,ES:equitySource,M2K:equitySource,RTY:equitySource,MYM:equitySource,YM:equitySource,
  MGC:goldSource,GC:goldSource,MCL:oilSource,CL:oilSource,MNG:gasSource,NG:gasSource,
  SI:'https://www.cmegroup.com/trading/metals/files/fact-card-silver-futures-options.pdf',
  SIL:'https://www.cmegroup.com/content/dam/cmegroup/rulebook/COMEX/1a/121.pdf',
  '6E':'https://www.cmegroup.com/markets/fx/g10/euro-fx/specs',
  M6E:'https://www.cmegroup.com/markets/fx/g10/e-micro-euro/specs',
  MBT:'https://www.cmegroup.com/markets/cryptocurrencies/bitcoin/micro-bitcoin/specs',
  MET:'https://www.cmegroup.com/markets/cryptocurrencies/ether/micro-ether/specs',
};

function futuresTemplate(symbol, name, reference, tickSize, pointValueQuote) {
  return {
    id: `f-${symbol.toLowerCase()}`, platform: 'futures', symbol, name, asset: 'Futures',
    tickSize, pointValueQuote, quoteToUSD: 1, quantityStep: 1, minQuantity: 1,
    unit: 'contracts', pipSize: null, verified: true, reference,
    source: 'CME Group published outright specifications. Prop firm rules and fees are separate.', sourceUrl:futuresSources[symbol],
  };
}

function fxTemplate(symbol, quote, tickSize, pipSize) {
  return {
    id: `fx-${symbol.toLowerCase()}`, platform: 'custom', symbol,
    name: `${symbol.slice(0, 3)}/${quote} spot FX — standard lots`, asset: 'Spot FX',
    tickSize, pointValueQuote: 100000, quoteToUSD: quote === 'USD' ? 1 : null,
    quantityStep: 0.01, minQuantity: 0.01, unit: 'lots', pipSize, verified: false, reference: symbol,
    source: `Illustrative standard lot; verify broker units and ${quote}→USD conversion`,
  };
}

function shareTemplate(symbol, name, asset) {
  return {
    id: `c-${symbol.toLowerCase()}`, platform: 'custom', symbol, name, asset,
    tickSize: 0.01, pointValueQuote: 1, quoteToUSD: 1, quantityStep: 1, minQuantity: 1,
    unit: 'shares', pipSize: null, verified: false, reference: 'STOCK',
    source: 'Illustrative USD whole-share sizing; verify broker price and share increments',
  };
}

// pointValueQuote: monetary value in the instrument's quote currency of a 1.0 price move for one native quantity.
// quoteToUSD: units of USD per one quote-currency unit. FX crosses and non-USD quotes require a manual current rate.
export const DEFAULT_INSTRUMENTS = [
  { id:'vest-nq', platform:'vest', symbol:'NQ-PERP', name:'Vest Nasdaq perpetual (illustrative)', asset:'Index perpetual', tickSize:0.25, pointValueQuote:1, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'units', pipSize:null, verified:false, source:'Broker contract specification must be checked', reference:'NQ' },
  { id:'vest-es', platform:'vest', symbol:'ES-PERP', name:'Vest S&P perpetual (illustrative)', asset:'Index perpetual', tickSize:0.25, pointValueQuote:1, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'units', pipSize:null, verified:false, source:'Broker contract specification must be checked', reference:'ES' },
  futuresTemplate('MNQ', 'Micro E-mini Nasdaq-100', 'NQ', 0.25, 2),
  futuresTemplate('NQ', 'E-mini Nasdaq-100', 'NQ', 0.25, 20),
  futuresTemplate('MES', 'Micro E-mini S&P 500', 'ES', 0.25, 5),
  futuresTemplate('ES', 'E-mini S&P 500', 'ES', 0.25, 50),
  futuresTemplate('MGC', 'Micro Gold Futures', 'GC', 0.1, 10),
  futuresTemplate('GC', 'Gold Futures', 'GC', 0.1, 100),
  futuresTemplate('MCL', 'Micro WTI Crude Oil', 'CL', 0.01, 100),
  { id:'fx-eur', platform:'custom', symbol:'EURUSD', name:'EUR/USD spot FX — standard lots', asset:'Spot FX', tickSize:0.00001, pointValueQuote:100000, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:0.0001, verified:false, source:'Illustrative 100,000 EUR/lot — verify broker', reference:'EURUSD' },
  { id:'fx-jpy', platform:'custom', symbol:'USDJPY', name:'USD/JPY spot FX — standard lots', asset:'Spot FX', tickSize:0.001, pointValueQuote:100000, quoteToUSD:0, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:0.01, verified:false, source:'Quote JPY→USD conversion required; verify broker', reference:'USDJPY' },
  { id:'c-btc', platform:'custom', symbol:'BTCUSD', name:'Bitcoin spot — quantity in BTC', asset:'Crypto spot', tickSize:0.01, pointValueQuote:1, quoteToUSD:1, quantityStep:0.0001, minQuantity:0.0001, unit:'BTC', pipSize:null, verified:false, source:'Illustrative spot BTC; perpetual contract multipliers vary', reference:'BTC' },
  { id:'c-stock', platform:'custom', symbol:'STOCK', name:'U.S. stock — whole shares', asset:'Equity', tickSize:0.01, pointValueQuote:1, quoteToUSD:1, quantityStep:1, minQuantity:1, unit:'shares', pipSize:null, verified:false, source:'Generic whole share stock; fractional settings vary', reference:'STOCK' },
  { id:'c-cfd', platform:'custom', symbol:'CFD-CUSTOM', name:'Custom CFD / other derivative', asset:'CFD', tickSize:0.01, pointValueQuote:0, quoteToUSD:1, quantityStep:0.01, minQuantity:0.01, unit:'lots', pipSize:null, verified:false, source:'MUST input correct broker cash value per price point per lot', reference:'OTHER' },
  futuresTemplate('M2K', 'Micro E-mini Russell 2000', 'RTY', 0.1, 5),
  futuresTemplate('RTY', 'E-mini Russell 2000', 'RTY', 0.1, 50),
  futuresTemplate('MYM', 'Micro E-mini Dow', 'YM', 1, 0.5),
  futuresTemplate('YM', 'E-mini Dow', 'YM', 1, 5),
  futuresTemplate('CL', 'WTI Crude Oil', 'CL', 0.01, 1000),
  futuresTemplate('SI', 'Silver Futures', 'SI', 0.005, 5000),
  futuresTemplate('SIL', 'Micro Silver Futures', 'SI', 0.005, 1000),
  futuresTemplate('NG', 'Natural Gas Futures', 'NG', 0.001, 10000),
  futuresTemplate('MNG', 'Micro Henry Hub Natural Gas', 'NG', 0.001, 1000),
  futuresTemplate('6E', 'Euro FX Futures', 'EURUSD', 0.00005, 125000),
  futuresTemplate('M6E', 'Micro EUR/USD Futures', 'EURUSD', 0.0001, 12500),
  futuresTemplate('MBT', 'Micro Bitcoin Futures', 'BTC', 5, 0.1),
  futuresTemplate('MET', 'Micro Ether Futures', 'ETH', 0.5, 0.1),
  fxTemplate('GBPUSD', 'USD', 0.00001, 0.0001),
  fxTemplate('AUDUSD', 'USD', 0.00001, 0.0001),
  fxTemplate('USDCAD', 'CAD', 0.00001, 0.0001),
  fxTemplate('EURJPY', 'JPY', 0.001, 0.01),
  fxTemplate('NZDUSD', 'USD', 0.00001, 0.0001),
  fxTemplate('USDCHF', 'CHF', 0.00001, 0.0001),
  fxTemplate('EURGBP', 'GBP', 0.00001, 0.0001),
  fxTemplate('GBPJPY', 'JPY', 0.001, 0.01),
  shareTemplate('SPY', 'SPDR S&P 500 ETF', 'ETF'),
  shareTemplate('QQQ', 'Invesco QQQ ETF', 'ETF'),
  shareTemplate('IWM', 'iShares Russell 2000 ETF', 'ETF'),
  shareTemplate('DIA', 'SPDR Dow Jones Industrial Average ETF', 'ETF'),
  shareTemplate('VOO', 'Vanguard S&P 500 ETF', 'ETF'),
  shareTemplate('VTI', 'Vanguard Total Stock Market ETF', 'ETF'),
  shareTemplate('GLD', 'SPDR Gold Shares', 'ETF'),
  shareTemplate('SLV', 'iShares Silver Trust', 'ETF'),
  shareTemplate('TLT', 'iShares 20+ Year Treasury Bond ETF', 'ETF'),
  shareTemplate('AAPL', 'Apple', 'Equity'),
  shareTemplate('MSFT', 'Microsoft', 'Equity'),
  shareTemplate('NVDA', 'NVIDIA', 'Equity'),
  shareTemplate('AMZN', 'Amazon', 'Equity'),
  shareTemplate('META', 'Meta Platforms', 'Equity'),
  shareTemplate('GOOGL', 'Alphabet Class A', 'Equity'),
  shareTemplate('TSLA', 'Tesla', 'Equity'),
  shareTemplate('AMD', 'Advanced Micro Devices', 'Equity'),
  ...perpAssets.filter(({ coin }) => coin !== 'BTC').map(({ coin, name }) => ({
    id: `c-${coin.toLowerCase()}`, platform: 'custom', symbol: `${coin}USD`,
    name: `${name} spot`, asset: 'Crypto spot', tickSize: null, pointValueQuote: 1,
    quoteToUSD: 1, quantityStep: null, minQuantity: null, unit: coin, pipSize: null,
    verified: false, reference: coin, source: 'Enter the venue tick, quantity step and minimum size',
  })),
  {
    id: 'c-xau', platform: 'custom', symbol: 'XAUUSD', name: 'Gold CFD', asset: 'CFD',
    tickSize: null, pointValueQuote: null, quoteToUSD: 1, quantityStep: null, minQuantity: null,
    unit: 'lots', pipSize: null, verified: false, reference: 'GC', source: 'Enter broker cash per point, tick, size step and minimum lot',
  },
  ...PERPETUAL_VENUES.flatMap(linearPerpetuals),
  ...linearPerpetuals(customPerpetual),
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
  const [coefficient, exponent='0'] = String(step).split('e');
  const precision = Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
  const units = Math.floor((value / step) + nearly);
  return Math.max(0, Number((units * step).toFixed(Math.min(100, precision))));
}
export function getHeadroom(account) {
  if ([account.equity,account.floor].some(value=>value==null || (typeof value==='string' && !value.trim()))) return null;
  const equity = numeric(account.equity), floor = numeric(account.floor), reserve = numeric(account.reserve ?? 0);
  if (!Number.isFinite(equity) || !Number.isFinite(floor) || !finiteNonnegative(reserve)) return null;
  const raw = equity - floor;
  if (!Number.isFinite(raw)) return null;
  return {raw, usable: Math.max(0, raw - reserve)};
}
export function getRiskBudget(account, riskFraction) {
  const h = getHeadroom(account);
  if (!h || !finitePositive(riskFraction) || riskFraction > 1) return null;
  let budget = h.usable * riskFraction;
  if (!account.noDailyLimit && account.dailyRemaining !== null && account.dailyRemaining !== '' && account.dailyRemaining !== undefined) {
    const remaining = numeric(account.dailyRemaining);
    if (!finiteNonnegative(remaining)) return null;
    budget = Math.min(budget, remaining);
  }
  return Math.max(0, budget);
}
/**
 * Budget stops use a fixed plannedQuantity. Other stop modes size from stopInput.
 * With targetMode 'budget', rr multiplies the selected dollar budget for the net profit goal.
 */
export function sizePosition(p) {
  const warnings=[], errors=[];
  const a=p.account||{}, s=p.instrument||{};
  const h=getHeadroom(a), riskFraction=numeric(p.riskFraction), budget=getRiskBudget(a,riskFraction);
  const entry=numeric(p.entry), requested=numeric(p.stopInput), rr=numeric(p.rr);
  const budgetStop=p.stopMode==='budget', budgetTarget=p.targetMode==='budget';
  const plannedQuantity=numeric(p.plannedQuantity);
  const noStop=p.stopMode==='none', noTarget=p.targetMode==='none';
  const assumedMovePercent=numeric(p.assumedMovePercent);
  const tick=numeric(s.tickSize), pointQuote=numeric(s.pointValueQuote), fx=numeric(s.quoteToUSD), step=numeric(s.quantityStep), minQ=numeric(s.minQuantity);
  const slip=numeric(p.slippageTicks ?? 0), spread=numeric(p.spreadTicks ?? 0), fees=numeric(p.feePerUnit ?? 0), stressExtra=numeric(p.stressExtraTicks ?? 2);
  if (a.platform && s.platform && a.platform!==s.platform) errors.push('Choose an instrument available for the selected account platform.');
  if (!h) errors.push('Enter valid account equity, failure floor and safety reserve.');
  else if (h.raw <= 0) errors.push('Account equity is at/below the failure floor. No trade.');
  else if (h.usable <= 0) errors.push('No usable drawdown remains after the safety reserve.');
  if (budget === null) errors.push('Risk fraction or daily-loss allowance is invalid.');
  else if (budget <= 0) errors.push('Risk allowance is zero. No trade.');
  if (!finitePositive(entry)) errors.push('Entry price must be positive.');
  if (!noStop && !budgetStop && !finitePositive(requested)) errors.push('Stop must be a positive number.');
  if (noStop && (!finitePositive(assumedMovePercent) || assumedMovePercent>=100)) errors.push('Enter an assumed adverse move greater than 0% and below 100%.');
  if (budgetStop && !finitePositive(plannedQuantity)) errors.push('Enter your planned position quantity in native units.');
  if (!finitePositive(tick) || !finitePositive(pointQuote) || !finitePositive(fx)) errors.push('Instrument tick size, point value and quote→USD rate must all be positive.');
  if (!finitePositive(step) || !finitePositive(minQ) || minQ < step - nearly) errors.push('Instrument quantity step/minimum are invalid.');
  if (!noTarget && !finitePositive(rr)) errors.push('Reward multiple must be positive.');
  if (![slip,spread,fees,stressExtra].every(finiteNonnegative)) errors.push('Trading costs and stress ticks cannot be negative.');
  if (!['long','short'].includes(p.side)) errors.push('Choose long or short.');
  if (!['price','points','ticks','pips','budget','none'].includes(p.stopMode)) errors.push('Invalid stop unit.');
  if (p.targetMode!==undefined && !['stop','budget','none'].includes(p.targetMode)) errors.push('Invalid take-profit method.');
  if (p.stopMode==='pips' && !finitePositive(numeric(s.pipSize))) errors.push('Pips require a verified pip size in the instrument settings.');
  const maxQ=(a.maxQuantity===null||a.maxQuantity===''||a.maxQuantity===undefined)?null:numeric(a.maxQuantity);
  if (maxQ!==null && !finiteNonnegative(maxQ)) errors.push('Max account quantity cannot be negative.');
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget};
  const pointUSD=pointQuote*fx;
  const costsPerUnit=(slip+spread)*tick*pointUSD+fees;
  const blocked=message=>({status:'BLOCKED',warnings,errors:[message],headroom:h,budget});
  if (!finitePositive(pointUSD) || !finiteNonnegative(costsPerUnit)) return blocked('Instrument value or execution costs are outside the supported range.');
  const direction = p.side==='long' ? -1 : 1;
  let stopRaw, stop;
  if (budgetStop) {
    const increments=plannedQuantity/step;
    if (!Number.isSafeInteger(Math.round(increments)) || Math.abs(increments-Math.round(increments))>nearly) {
      return blocked('Planned quantity must match the instrument quantity increment.');
    }
    if (plannedQuantity<minQ || (maxQ!==null && plannedQuantity>maxQ)) {
      return blocked('Planned quantity is outside the instrument minimum or account maximum.');
    }
    const distance=(budget/plannedQuantity-costsPerUnit)/pointUSD;
    if (!finitePositive(distance)) return blocked('Estimated costs exhaust the risk budget at this quantity.');
    stopRaw=entry+direction*distance;
    stop=tickRound(stopRaw,tick,p.side==='long'?'up':'down');
    if (p.side==='long') stop=Math.max(tick,stop);
    if (!(direction*(stop-entry)>0) || !finitePositive(stop)) {
      return blocked('The risk budget cannot fit an adverse price tick at this quantity.');
    }
    warnings.push('Budget stop is a modeled loss limit. Check the price against market structure and venue liquidation rules.');
  } else if (noStop) {
    stopRaw=entry+direction*entry*(assumedMovePercent/100);
    warnings.push('Sizing scenario only. Without a stop, actual losses can exceed the modeled loss and account limits.');
  } else if (p.stopMode==='price') stopRaw=requested;
  else {
    const distance = requested * (p.stopMode==='ticks'?tick:p.stopMode==='pips'?numeric(s.pipSize):1);
    stopRaw = entry + direction * distance;
  }
  if (!budgetStop) stop=tickRound(stopRaw,tick,p.side==='long'?'down':'up');
  const distance=Math.abs(entry-stop);
  if (p.stopMode==='price' && !(direction*(stopRaw-entry)>0)) errors.push('Entered stop must be beyond entry in the loss direction.');
  if (stop <= 0) errors.push('Stop price must remain positive.');
  if (p.side==='long' && !(stop<entry) || p.side==='short' && !(stop>entry)) errors.push('Stop must be beyond entry in the loss direction.');
  if (!finitePositive(distance)) errors.push('Stop distance is zero.');
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget};
  const minNotional=numeric(s.minNotionalQuote ?? 0);
  if (!finiteNonnegative(minNotional)) return blocked('Minimum order value must be nonnegative.');
  const lossPerUnit=distance*pointUSD+costsPerUnit;
  const qtyRisk=budgetStop?plannedQuantity:roundQuantityDown(budget/lossPerUnit,step);
  const qty=budgetStop || maxQ===null?qtyRisk:Math.min(qtyRisk,roundQuantityDown(maxQ,step));
  if (qty+nearly<minQ) errors.push(`Minimum size ${minQ} ${s.unit} would exceed the risk allowance; skip the trade or use a smaller contract.`);
  if (errors.length) return {status:'BLOCKED',warnings,errors,headroom:h,budget,minimumUnitRisk:lossPerUnit*minQ};
  if (qty*entry*pointQuote<minNotional) return blocked('Order value at entry is below the entered venue minimum.');
  const risk=qty*lossPerUnit;
  if (!finitePositive(risk) || risk-budget>budget*1e-10) return blocked('Modeled loss exceeds the risk budget at this quantity.');
  const targetDistance=budgetTarget?(budget*rr/qty+costsPerUnit)/pointUSD:distance*rr;
  const targetDirection=budgetTarget?-direction:direction;
  const target=noTarget?undefined:tickRound(entry-direction*targetDistance,tick,targetDirection>0?'up':'down');
  if (!noTarget && (!finitePositive(target) || !(direction*(entry-target)>0))) return blocked('Target price is outside the valid price range; adjust the target multiple.');
  const grossTarget=noTarget?undefined:Math.abs(target-entry)*pointUSD*qty;
  const roundTripCosts=qty*costsPerUnit;
  const reward=noTarget?undefined:grossTarget-roundTripCosts;
  const stressRisk=risk+qty*stressExtra*tick*pointUSD;
  if (!a.verified) warnings.push('Account floor and drawdown rules are not confirmed. Enter the live broker floor before trading.');
  const specCurrent=s.verified && (!s.lookupAt || Date.now()-s.lookupAt<86400000) && s.platform!=='hyperliquid';
  if (s.platform==='hyperliquid') warnings.push('Hyperliquid price precision changes with price and asset. The entered fixed tick is an estimate.');
  if (!specCurrent) warnings.push('Instrument unit/lot/contract specification NOT verified. Confirm the platform specification.');
  if (fees===0) warnings.push('Modeled commission is $0. Estimated costs can differ from actual execution.');
  if (stressRisk > h.usable + nearly) warnings.push('Stress slippage could penetrate the safety reserve / failure floor.');
  if (riskFraction>=0.25) warnings.push('High-risk mode: one adverse move could consume a large share of available drawdown.');
  if (!a.noDailyLimit && a.stage!=='personal' && (a.dailyRemaining==null || a.dailyRemaining==='')) warnings.push('Daily loss allowance is unknown. Enter today’s remaining amount or select no daily cap if it applies.');
  const verified=Boolean(a.verified && specCurrent);
  return {
    status:verified?'CALCULATED':'VERIFY',warnings,errors,headroom:h,budget,
    quantity:qty,risk,expectedReward:reward,rrNet:noTarget?undefined:reward/risk,
    maxLossFraction: risk/h.raw, reservePostStop: h.raw-risk,
    postStopEquity: numeric(a.equity)-risk, postTargetEquity:noTarget?undefined:numeric(a.equity)+reward,
    stop:noStop?undefined:stop,target,scenarioPrice:noStop?stop:undefined,notionalUSD:entry*pointUSD*qty,stopDistance:distance,stopTicks:distance/tick,
    perUnitLoss:lossPerUnit,pointValueUSD:pointUSD,tickValueUSD:pointUSD*tick,
    grossTarget,roundTripCosts,stressRisk,stressPostEquity:numeric(a.equity)-stressRisk,
    riskFraction, originalStop:noStop?undefined:stopRaw,entry,stopMode:p.stopMode,targetMode:p.targetMode??'stop'
  };
}

export const usd = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
export const fmt = (v,max=5) => Number.isFinite(v) ? Number(v.toFixed(max)).toLocaleString('en-US',{maximumFractionDigits:max}):'—';
