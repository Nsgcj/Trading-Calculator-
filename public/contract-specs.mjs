const supportedCoins = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'SUI']);
const vestMarkets = new Map([['vest-nq', 'NQ-PERP'], ['vest-es', 'ES-PERP']]);

function venueFor(instrument) {
  const venue = instrument?.platform;
  if (venue === 'vest') {
    const symbol = vestMarkets.get(instrument.id);
    return symbol && instrument.symbol === symbol && instrument.unit === 'units' ? venue : null;
  }
  if (venue !== 'binance-linear' && venue !== 'bybit-linear') return null;
  const coin = instrument.unit;
  if (!supportedCoins.has(coin) || instrument.id !== `${venue}-${coin.toLowerCase()}`) return null;
  return instrument.symbol === `${coin}USDT` ? venue : null;
}

export function supportsContractLookup(instrument) {
  return venueFor(instrument) !== null;
}

function number(value) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim())
    ? Number(value)
    : NaN;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function isAligned(quantity, step) {
  const increments = quantity / step;
  return Math.abs(increments - Math.round(increments)) <= 1e-9;
}

function parseBinance(data, instrument) {
  const market = Array.isArray(data?.symbols) && data.symbols.find(item => item.symbol === instrument.symbol);
  if (!market || market.status !== 'TRADING' || market.contractType !== 'PERPETUAL'
    || market.baseAsset !== instrument.unit || market.quoteAsset !== 'USDT' || market.marginAsset !== 'USDT'
    || !Array.isArray(market.filters)) return null;

  const filter = type => market.filters.find(item => item.filterType === type);
  const price = filter('PRICE_FILTER');
  const limitLot = filter('LOT_SIZE');
  const marketLot = filter('MARKET_LOT_SIZE');
  const limitStep = number(limitLot?.stepSize);
  const marketStep = number(marketLot?.stepSize);
  const limitMin = number(limitLot?.minQty);
  const marketMin = number(marketLot?.minQty);
  if (![limitStep, marketStep, limitMin, marketMin].every(positive)
    || !isAligned(limitMin, limitStep) || !isAligned(marketMin, marketStep)) return null;

  const quantityStep = Math.max(limitStep, marketStep);
  if (!isAligned(quantityStep, Math.min(limitStep, marketStep))) return null;
  return {
    tickSize: number(price?.tickSize),
    quantityStep,
    minQuantity: Math.max(limitMin, marketMin),
    minNotionalQuote: number(filter('MIN_NOTIONAL')?.notional),
    source: 'Binance USDⓈ-M exchange information (market and limit order increments)',
  };
}

function parseBybit(data, instrument) {
  const result = data?.result;
  if (data?.retCode !== 0 || result?.category !== 'linear' || !Array.isArray(result.list)) return null;
  const market = result.list.find(item => item.symbol === instrument.symbol);
  if (!market || market.status !== 'Trading' || market.contractType !== 'LinearPerpetual' || market.isPreListing === true
    || market.baseCoin !== instrument.unit || market.quoteCoin !== 'USDT' || market.settleCoin !== 'USDT') return null;
  return {
    tickSize: number(market.priceFilter?.tickSize),
    quantityStep: number(market.lotSizeFilter?.qtyStep),
    minQuantity: number(market.lotSizeFilter?.minOrderQty),
    minNotionalQuote: number(market.lotSizeFilter?.minNotionalValue),
    source: 'Bybit V5 instruments information (USDT linear perpetual)',
  };
}

function parseVest(data, instrument) {
  if (data?.symbol !== instrument.symbol || data.pointValueQuote !== 1) return null;
  const takerFeeRate = number(data.takerFeeRate);
  const hasTakerFeeRate = Number.isFinite(takerFeeRate) && takerFeeRate >= 0 && takerFeeRate < 1;
  return {
    tickSize: number(data.tickSize),
    quantityStep: number(data.quantityStep),
    minQuantity: number(data.minQuantity),
    pointValueQuote: data.pointValueQuote,
    ...(hasTakerFeeRate ? { takerFeeRate } : {}),
    source: `Vest Markets Exchange Info and contract sizing guide (${instrument.symbol}, USDC)`,
  };
}

export async function fetchContractSpec(instrument, { signal } = {}) {
  const venue = venueFor(instrument);
  if (!venue) throw new Error('Official contract lookup is unavailable for this instrument.');

  const binance = venue === 'binance-linear';
  const vest = venue === 'vest';
  const url = binance
    ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
    : vest
      ? `/.netlify/functions/vest-specs?market=${instrument.id.slice('vest-'.length)}`
      : `https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${instrument.symbol}`;
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new Error('Official specifications are unavailable. Check the venue and enter the values manually.');
  const data = await response.json();
  const spec = binance ? parseBinance(data, instrument) : vest ? parseVest(data, instrument) : parseBybit(data, instrument);
  if (!spec || ![spec.tickSize, spec.quantityStep, spec.minQuantity].every(positive)
    || (!vest && !positive(spec.minNotionalQuote))) {
    throw new Error('The venue did not return usable specifications for this perpetual.');
  }
  // An order must meet the tighter minimum while remaining on both quantity grids.
  if (!isAligned(spec.minQuantity, spec.quantityStep)) {
    spec.minQuantity = Number((Math.ceil(spec.minQuantity / spec.quantityStep) * spec.quantityStep).toPrecision(15));
  }
  return spec;
}
