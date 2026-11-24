const markets = new Map([
  ['nq', { label: 'NQ', symbol: 'NDX-USD-PERP' }],
  ['es', { label: 'ES', symbol: 'SPX-USD-PERP' }],
]);
const venueOrigin = 'https://api-gateway.hz.vestmarkets.com';
const maxAgeMs = 120_000;

function reply(body, status, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return reply({ error: 'This endpoint accepts GET only.' }, 405, { Allow: 'GET' });
  }
  const keys = new URL(request.url).searchParams.getAll('market');
  const market = keys.length === 1 ? markets.get(keys[0]) : null;
  if (!market) return reply({ error: 'Select NQ or ES on Vest Markets.' }, 400);

  const options = {
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(4500)]),
    redirect: 'error',
    headers: { Accept: 'application/json' },
  };
  try {
    const [statusResponse, tradeResponse] = await Promise.all([
      fetch(`${venueOrigin}/v3/ticker/latest?symbols=${market.symbol}`, options),
      fetch(`${venueOrigin}/v3/trades?symbol=${market.symbol}&limit=1`, options),
    ]);
    if (!statusResponse.ok || !tradeResponse.ok) {
      return reply({ error: 'Vest Markets quote unavailable.' }, 502);
    }
    const [statusData, tradeData] = await Promise.all([statusResponse.json(), tradeResponse.json()]);
    const ticker = Array.isArray(statusData?.tickers) && statusData.tickers.length === 1
      ? statusData.tickers[0]
      : null;
    if (ticker?.symbol !== market.symbol || ticker.status !== 'TRADING') {
      return reply({ error: 'Vest Markets has no active quote for this market.' }, 503);
    }

    const trade = Array.isArray(tradeData) && tradeData.length === 1 ? tradeData[0] : null;
    const rawPrice = trade?.price;
    const price = typeof rawPrice === 'string' || typeof rawPrice === 'number' ? Number(rawPrice) : NaN;
    const time = trade?.time;
    if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(time)) {
      return reply({ error: 'Vest Markets returned an invalid trade.' }, 502);
    }
    const age = Date.now() - time;
    if (age < -5_000 || age > maxAgeMs) {
      return reply({ error: 'Vest Markets has no recent trade for this market.' }, 503);
    }

    return reply({ price, time, source: `Vest Markets ${market.label} perpetual last trade (USDC)` }, 200);
  } catch {
    return reply({ error: 'Vest Markets quote unavailable.' }, 502);
  }
}
