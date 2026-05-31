import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchOffers } from './duffel.js';

// 45 days from now — well within Duffel's test-mode window
const departDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

describe('searchOffers (Duffel integration)', () => {
  it('returns at least one offer with a positive price for DUB→CDG', async (t) => {
    if (!process.env.DUFFEL_API_KEY) {
      t.skip('DUFFEL_API_KEY not set — skipping integration test');
      return;
    }

    const offers = await searchOffers({
      origin: 'DUB',
      destination: 'CDG',
      departDate,
    });

    assert.ok(offers.length > 0, 'Expected at least one offer');

    const first = offers[0];
    assert.ok(first.priceMinor > 0, 'Expected a positive price in minor units');
    assert.strictEqual(first.origin, 'DUB');
    assert.strictEqual(first.destination, 'CDG');
    assert.ok(first.currency.length === 3, 'Expected a 3-letter ISO currency code');
    assert.ok(typeof first.durationMinutes === 'number' && first.durationMinutes >= 0);

    console.log(
      `[test] Got ${offers.length} offer(s). Cheapest: ${first.priceMinor} ${first.currency} (${first.airline})`
    );
  });
});
