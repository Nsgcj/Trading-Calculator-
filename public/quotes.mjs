const cryptoMarkets = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'SUI'];
const spotProducts = new Map(cryptoMarkets.map(coin => [`c-${coin.toLowerCase()}`, coin]));
const hyperliquidPerps = new Map(cryptoMarkets.map(coin => [`hyperliquid-${coin.toLowerCase()}`, coin]));
const freshWindowMs = 120_000;
const vestPerps = new Map([
  ['vest-nq', 'NQ'],
  ['vest-es', 'ES'],
]);

function quoteMarket(instrument) {
  const vest = vestPerps.get(instrument?.id);
  if (vest && instrument.symbol === `${vest}-PERP` && instrument.platform === 'vest') {
    return { coin: vest, venue: 'vest' };
  }
  const spot = spotProducts.get(instrument?.id);
  if (spot && instrument.symbol === `${spot}USD` && instrument.platform === 'custom') {
    return { coin: spot, venue: 'coinbase' };
  }
  const perp = hyperliquidPerps.get(instrument?.id);
  if (perp && instrument.symbol === perp && instrument.platform === 'hyperliquid') {
    return { coin: perp, venue: 'hyperliquid' };
  }
  return null;
}

export function supportsCurrentPrice(instrument) {
  return quoteMarket(instrument) !== null;
}

export async function getCurrentPrice(instrument, { signal } = {}) {
  const market = quoteMarket(instrument);
  if (!market) throw new Error('Current price is unavailable for this instrument. Enter the price from your platform.');

  const { coin, venue } = market;
  const isSpot = venue === 'coinbase';
  const isVest = venue === 'vest';
  const url = isSpot
    ? `https://api.exchange.coinbase.com/products/${coin}-USD/ticker`
    : isVest
      ? `/.netlify/functions/vest-quote?market=${coin.toLowerCase()}`
      : 'https://api.hyperliquid.xyz/info';
  const response = await fetch(url, {
    signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    cache: 'no-store',
    credentials: 'omit',
    ...(venue === 'hyperliquid' ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    } : {}),
  });
  if (!response.ok) throw new Error('Price feed unavailable. Enter the price from your platform.');
  const data = await response.json();
  const rawPrice = isSpot || isVest ? data?.price : data?.[coin];
  const price = typeof rawPrice === 'string' || typeof rawPrice === 'number' ? Number(rawPrice) : NaN;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price feed did not return a usable price.');

  if (isSpot || isVest) {
    const time = isSpot && typeof data.time === 'string' ? Date.parse(data.time) : data.time;
    const age = Date.now() - time;
    if (!Number.isSafeInteger(time) || time <= 0 || age < -5000) {
      throw new Error('Price feed did not return a valid trade time. Enter the price from your platform.');
    }
    const source = isVest
      ? `Vest Markets ${coin} perpetual last trade (USDC)`
      : `Coinbase ${coin}-USD last trade`;
    return { price, source, time, lastKnown: data.lastKnown === true || age > freshWindowMs };
  }

  return { price, source: `Hyperliquid ${coin} perpetual midpoint` };
}
