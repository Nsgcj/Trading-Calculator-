import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../netlify/functions/vest-specs.mjs';
import { fetchContractSpec } from '../public/contract-specs.mjs';

const venueSpec = {
  symbol: 'NDX-USD-PERP', displaySymbol: 'NQ-PERP', base: 'NDX-USD', quote: 'USDC',
  tradingStatus: 'TRADING', capitalTradingStatus: 'TRADING', minTickSize: '0.25', sizeDecimals: 4,
};
const endpoint = 'https://desk.example/.netlify/functions/vest-specs';

test('Vest reads tick and quantity increments from the requested market', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).searchParams.get('symbols'), venueSpec.symbol);
    return Response.json({ symbols: [venueSpec] });
  });

  const response = await handler(new Request(`${endpoint}?market=nq`));
  assert.equal(response.status, 200);
  const spec = await response.json();
  assert.equal(spec.symbol, 'NQ-PERP');
  assert.equal(spec.tickSize, 0.25);
  assert.equal(spec.quantityStep, 0.0001);
  assert.equal(spec.minQuantity, 0.0001);
  assert.equal(spec.pointValueQuote, 1);
  assert.equal(spec.minNotionalQuote, undefined);
  assert.equal(spec.takerFeeRate, undefined);
});

test('Vest publishes a valid taker fee fraction and omits unusable rates', async t => {
  let takerFee;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ symbols: [{ ...venueSpec, takerFee }] }));

  for (const [input, expected] of [['0.000025', 0.000025], ['0', 0], ['', undefined], [null, undefined], ['Infinity', undefined], ['-0.001', undefined], ['1', undefined]]) {
    takerFee = input;
    const response = await handler(new Request(`${endpoint}?market=nq`));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).takerFeeRate, expected);
  }
});

test('Vest browser lookup retains optional valid fees without blocking contract specifications', async t => {
  const instrument = { id: 'vest-nq', symbol: 'NQ-PERP', platform: 'vest', unit: 'units' };
  let takerFeeRate;
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    symbol: instrument.symbol,
    tickSize: 0.25,
    quantityStep: 0.0001,
    minQuantity: 0.0001,
    pointValueQuote: 1,
    takerFeeRate,
  }));

  for (const [input, expected] of [[0.000025, 0.000025], [0, 0], [undefined, undefined], [null, undefined], [-0.001, undefined], [1, undefined]]) {
    takerFeeRate = input;
    assert.equal((await fetchContractSpec(instrument)).takerFeeRate, expected);
  }
});

test('Vest rejects a different contract or invalid precision', async t => {
  const venue = t.mock.method(globalThis, 'fetch', async () => Response.json({ symbols: [venueSpec] }));
  assert.equal((await handler(new Request(`${endpoint}?market=es`))).status, 503);

  venue.mock.mockImplementation(async () => Response.json({ symbols: [{ ...venueSpec, sizeDecimals: -1 }] }));
  assert.equal((await handler(new Request(`${endpoint}?market=nq`))).status, 502);
  assert.equal((await handler(new Request(`${endpoint}?market=gc`))).status, 400);
  assert.equal(venue.mock.callCount(), 2);
});
