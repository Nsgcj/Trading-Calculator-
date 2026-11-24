const topstepFees='https://help.topstep.com/en/articles/8284213-topstepx-commissions-and-fees';
const mffFees='https://help.myfundedfutures.com/en/articles/9735811-futures-instrument-list';
const tptFees='https://takeprofittraderhelp.zendesk.com/hc/en-us/articles/15172548967069-Commissions-on-Test-and-PRO-accounts';

const topstepRoundTurns={
  ES:3.78,MES:1.22,NQ:3.78,MNQ:1.22,RTY:3.78,M2K:1.22,YM:3.78,MYM:1.22,
  GC:4.32,MGC:1.92,SI:4.32,SIL:2.72,CL:4.02,MCL:1.72,NG:4.22,MNG:1.92,
  '6E':4.22,M6E:1,MBT:2.82,MET:0.72,
};
const mffRoundTurns={
  ES:4.68,MES:1.90,NQ:4.68,MNQ:1.90,RTY:4.68,M2K:1.90,YM:5.76,MYM:1.90,
  GC:5.12,MGC:2.20,SIL:2.84,CL:4.92,MCL:1.16,'6E':5.12,M6E:1.44,MBT:3.50,MET:1.16,
};

const feeReferences={
  topstep:['TopstepX publishes total USD round-turn costs by symbol across its account stages.',topstepFees],
  mff:['My Funded Futures publishes USD round-trip costs by contract. Check platform and live account differences.',mffFees],
  apex:['Commission schedules differ by platform. The linked Rithmic table lists evaluation and funded round-turn costs.','https://apextraderfunding.com/help-center/rithmic/rithmic-commissions-instruments/'],
  tradeday:['TradeDay publishes simulated all-in fees per side by instrument. Live fees depend on the broker.','https://tradeday.freshdesk.com/en/support/solutions/articles/103000008893-how-much-are-trading-commissions'],
  earn2trade:['Evaluation commissions vary by contract and account setup. Published micros range from $0.82 to $1.20 per side.','https://help.earn2trade.com/en/articles/2425493-what-is-the-commission-on-earn2trade-evaluations'],
  ftmo:['FTMO publishes commissions by symbol and lot. Use the rate for the instrument and platform.','https://ftmo.com/en/symbols/'],
  tpt:['Take Profit Trader publishes $4.50 USD per round trip per eligible contract for Test and PRO.',tptFees],
  'tpt-live':['PRO+ has a separate live commission schedule. Use the applicable all-in round-trip amount.', 'https://takeprofittraderhelp.zendesk.com/hc/en-us/articles/15172012844957-Commissions-for-PRO'],
  hyperliquid:['Native perps base tier per fill: 0.015% maker / 0.045% taker. Rates can vary by tier and market.','https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees'],
  'binance-linear':['USDⓈ-M regular-user rates per fill: 0.02% maker / 0.05% taker before discounts.','https://www.binance.com/en/support/faq/detail/360033544231'],
  'bybit-linear':['USDT linear VIP 0 rates per fill: 0.02% maker / 0.055% taker, subject to region.','https://www.bybit.com/en/help-center/article/FAQ-USDT-Perpetual-and-Expiry-Contracts'],
  'coinbase-spot':['Coinbase Exchange lowest-volume tier per fill: 0.40% maker / 0.60% taker. Coinbase Advanced has its own schedule.','https://help.coinbase.com/en/exchange/trading-and-funding/exchange-fees'],
  'kraken-spot':['Kraken Pro spot rates vary by pair and trading volume. See the applicable maker/taker tier.','https://www.kraken.com/features/fee-schedule'],
  vest:['Vest Markets per fill: 0% maker; taker is 0.0025% for indices/commodities, 0.0015% for FX and 0.01% for other markets.','https://docs.vestmarkets.com/trading/markets#fees'],
  ninjatrader:['Free, Monthly and Lifetime plans publish different all-in rates by contract.','https://ninjatrader.com/pricing/commissions/'],
  tradovate:['See the all-in contract rate for your Free, Monthly or Lifetime plan.','https://info.tradovate.com/pricing/commissions'],
  'ibkr-futures':['IBKR publishes fixed and tiered futures commissions. Exchange and regulatory fees vary by contract.','https://www.interactivebrokers.com/en/pricing/commissions-futures.php'],
  'ibkr-equities':['IBKR Lite lists $0 for eligible US listed stocks and ETFs. Pro pricing varies by plan and share count.','https://www.interactivebrokers.com/en/pricing/commissions-stocks.php'],
  schwab:['$0 online commission for eligible US-listed stocks and ETFs. Other fees can apply.','https://www.schwab.com/pricing'],
  fidelity:['$0 online commission for eligible US stocks and ETFs. Sell-side assessments can apply.','https://www.fidelity.com/trading/commissions'],
  webull:['$0 commission for eligible US-listed securities. Regulatory and other fees can apply.','https://www.webull.com/pricing'],
  oanda:['Spread-only pricing embeds costs in the spread. Core pricing charges a separate commission where offered.','https://www.oanda.com/us-en/trading/our-pricing/'],
  'forex-com':['Standard pricing uses variable spreads. RAW pricing lists $7 per $100,000 USD notional per side.','https://www.forex.com/en-us/about-us/financial-transparency/trading-costs/'],
  'my-funded-perps':['Published per-fill rates by asset class: 0.03% crypto, 0.0025% forex, 0.005% stocks, commodities and indices.','https://myfundedperpetuals.com/faq'],
};
const dailyReferences={
  vest:['Vest Instant lists max drawdown as its sole rule. Other programs can differ.','https://www.vestfunded.com/instant'],
  mff:['Rapid EOD with DLL publishes $500 for $25k and $1,000 for $50k in evaluation and sim. Standard Rapid EOD and redesigned Pro differ.','https://help.myfundedfutures.com/en/articles/18337038-rapid-eod-with-dll-a-detailed-look'],
  'mff-live':['Live daily loss rules depend on the funded plan and current account.','https://help.myfundedfutures.com/en/articles/12109396-comprehensive-faq-live-accounts-at-myfunded-futures'],
  topstep:['Combine and Express can have an optional daily limit. The checkout option is $1,000 / $2,000 / $3,000 for $50k / $100k / $150k. Program exceptions apply.','https://help.topstep.com/en/articles/10490293-daily-loss-limit-in-the-trading-combine-and-express-funded-account'],
  'topstep-live':['Live daily loss limits can change with account tier and risk adjustments.','https://help.topstep.com/en/articles/11748475-dynamic-live-risk-expansion'],
  apex:['EOD evaluations have a daily limit ($500 / $1,000 / $1,500 / $2,000 for $25k / $50k / $100k / $150k). Intraday-trailing evaluations have none. Performance accounts use tier-based limits.','https://apextraderfunding.com/help-center/additional-helpful-items/daily-loss-limit-explained/'],
  'apex-live':['Use the daily loss limit from your live program agreement.','https://apextraderfunding.com/help-center/getting-started/apex-live-prop-trading-program-faq/'],
  tpt:['EOD plans have a daily loss limit. Intraday, Classic and Legacy plans generally have none. PRO+ Development has separate rules.','https://takeprofittraderhelp.zendesk.com/hc/en-us/articles/40419036993437-Daily-Loss-Limit-DLL-Soft-Breach-vs-Hard-Breach'],
  tradeday:['TradeDay 2.0 evaluation rules list maximum drawdown. Check the rule page for your plan.','https://tradeday.freshdesk.com/en/support/solutions/articles/103000008855'],
  'tradeday-sim':['TradeDay 2.0 funded rules list maximum drawdown. Check the rule page for your plan.','https://tradeday.freshdesk.com/en/support/solutions/articles/103000008889'],
  earn2trade:['The plan-specific daily loss includes both unrealized P&L and commissions. It resets at 5 p.m. Central.','https://help.earn2trade.com/en/articles/3395926-how-is-my-daily-loss-calculated'],
  ftmo:['FTMO lists 5% for 2-Step and 3% for 1-Step, based on initial simulated capital. The daily floor resets at midnight Central European time.','https://ftmo.com/en/trading-objectives/'],
  'my-funded-perps':['Select, Prime, Signature and Elite DLL plans publish a 3% daily limit. Elite No DLL is a separate plan.','https://myfundedperpetuals.com/faq'],
};
dailyReferences['tpt-live']=dailyReferences.tpt;
dailyReferences['tradeday-live']=dailyReferences['tradeday-sim'];

function programId(id){
  if(id.startsWith('take-profit-trader')) return id==='take-profit-trader-pro-plus'?'tpt-live':'tpt';
  if(id.startsWith('my-funded-perps')) return 'my-funded-perps';
  if(id.startsWith('mff')) return 'mff';
  if(id.startsWith('topstep')) return 'topstep';
  if(id.startsWith('apex')) return 'apex';
  if(id.startsWith('tradeday')) return 'tradeday';
  if(id.startsWith('earn2trade')) return 'earn2trade';
  if(id.startsWith('ftmo')) return 'ftmo';
  return id;
}

export function accountReferences(account,instrument){
  const id=account.id??'';
  const program=programId(id);
  const fees=feeReferences[id]??feeReferences[program];
  const daily=dailyReferences[id]??dailyReferences[program];
  const matchesBuiltIn=instrument.platform==='futures' && instrument.id===`f-${instrument.symbol?.toLowerCase()}`;
  let publishedFee;
  if(matchesBuiltIn){
    if(program==='topstep') publishedFee=topstepRoundTurns[instrument.symbol];
    if(program==='tpt' && ['ES','MES','NQ','MNQ'].includes(instrument.symbol)) publishedFee=4.50;
    if(program==='mff' && account.stage!=='live-funded') publishedFee=mffRoundTurns[instrument.symbol];
  }
  return {fees,daily,publishedFee};
}
