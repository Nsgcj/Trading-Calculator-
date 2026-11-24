import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../netlify/functions/vest-specs.mjs';

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
});

test('Vest rejects a different contract or invalid precision', async t => {
  const venue = t.mock.method(globalThis, 'fetch', async () => Response.json({ symbols: [venueSpec] }));
  assert.equal((await handler(new Request(`${endpoint}?market=es`))).status, 503);

  venue.mock.mockImplementation(async () => Response.json({ symbols: [{ ...venueSpec, sizeDecimals: -1 }] }));
  assert.equal((await handler(new Request(`${endpoint}?market=nq`))).status, 502);
  assert.equal((await handler(new Request(`${endpoint}?market=gc`))).status, 400);
  assert.equal(venue.mock.callCount(), 2);
});
