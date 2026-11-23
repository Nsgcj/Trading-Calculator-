const spotProducts = new Map([
  ['c-btc', 'BTC'],
  ['c-eth', 'ETH'],
  ['c-sol', 'SOL'],
]);
const hyperliquidPerps = new Map([
  ['hyperliquid-btc', 'BTC'],
  ['hyperliquid-eth', 'ETH'],
  ['hyperliquid-sol', 'SOL'],
]);

function quoteMarket(instrument) {
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
  const url = isSpot
    ? `https://api.exchange.coinbase.com/products/${coin}-USD/ticker`
    : 'https://api.hyperliquid.xyz/info';
  const response = await fetch(url, {
    signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    cache: 'no-store',
    credentials: 'omit',
    ...(isSpot ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    }),
  });
  if (!response.ok) throw new Error('Price feed unavailable. Enter the price from your platform.');
  const data = await response.json();
  const rawPrice = isSpot ? data?.price : data?.[coin];
  const price = typeof rawPrice === 'string' || typeof rawPrice === 'number' ? Number(rawPrice) : NaN;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price feed did not return a usable price.');

  return {
    price,
    source: isSpot
      ? `Coinbase ${coin}-USD last trade`
      : `Hyperliquid ${coin} perpetual midpoint`,
  };
}
