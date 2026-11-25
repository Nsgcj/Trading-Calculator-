const markets = new Map([
  ['nq', { symbol: 'NDX-USD-PERP', displaySymbol: 'NQ-PERP', base: 'NDX-USD' }],
  ['es', { symbol: 'SPX-USD-PERP', displaySymbol: 'ES-PERP', base: 'SPX-USD' }],
]);

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

  try {
    const response = await fetch(`https://api-gateway.hz.vestmarkets.com/v3/exchangeInfo?symbols=${market.symbol}`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4500)]),
      redirect: 'error',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return reply({ error: 'Vest Markets specifications are unavailable.' }, 502);
    const data = await response.json();
    const spec = Array.isArray(data?.symbols) && data.symbols.length === 1 ? data.symbols[0] : null;
    if (spec?.symbol !== market.symbol || spec.displaySymbol !== market.displaySymbol
      || spec.base !== market.base || spec.quote !== 'USDC'
      || spec.tradingStatus !== 'TRADING' || spec.capitalTradingStatus !== 'TRADING') {
      return reply({ error: 'Vest Markets returned no active specifications for this USDC perpetual.' }, 503);
    }

    const tickSize = typeof spec.minTickSize === 'string' ? Number(spec.minTickSize) : NaN;
    if (!Number.isFinite(tickSize) || tickSize <= 0
      || !Number.isInteger(spec.sizeDecimals) || spec.sizeDecimals < 0 || spec.sizeDecimals > 12) {
      return reply({ error: 'Vest Markets returned invalid sizing increments.' }, 502);
    }
    // The Vest API defines the increment and minimum size as 10 ^ -sizeDecimals.
    // https://docs.vest.exchange/vest-api
    const quantityStep = Number(`1e-${spec.sizeDecimals}`);
    const fee = spec.takerFee;
    const takerFeeRate = typeof fee === 'number' || (typeof fee === 'string' && fee.trim()) ? Number(fee) : NaN;
    const hasTakerFeeRate = Number.isFinite(takerFeeRate) && takerFeeRate >= 0 && takerFeeRate < 1;
    // Vest's ES and NQ sizing guide confirms the 1 USDC point value per native unit.
    // https://docs.vestmarkets.com/trading/cross-margin-and-leverage#sizing-for-futures-traders-micro-and-e-mini-equivalents
    return reply({
      symbol: spec.displaySymbol,
      tickSize,
      quantityStep,
      minQuantity: quantityStep,
      pointValueQuote: 1,
      ...(hasTakerFeeRate ? { takerFeeRate } : {}),
      source: `Vest Markets Exchange Info and contract sizing guide (${spec.displaySymbol}, USDC)`,
    }, 200);
  } catch {
    return reply({ error: 'Vest Markets specifications are unavailable.' }, 502);
  }
}
