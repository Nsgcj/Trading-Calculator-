# CHICKEN MAN — Risk Desk

**A working, local-first, multi-platform position-sizing web app.** Built to make the stop an input, not a number invented from the account balance. Initial version contains no backend or external dependencies and makes **no live order submissions**.

## Launch

- **Local:** Open a terminal in this directory and run `python3 -m http.server 8000 --directory public`, then visit `http://localhost:8000`. Native browser ES modules require a local web server; don't double-click `index.html` under `file://`.
- **Test:** `npm test` (Node 20+; no packages required).
- **Netlify:** Connect this folder's GitHub repository. `netlify.toml` runs tests and publishes `public/`. No secrets or build packages are needed.
- **Profile storage:** Browser `localStorage` only. Data remains on that device/browser. Clearing site data removes profiles. Do **not** enter API secrets.

## Key rules (why these are correct)

**Price invalidation comes first.** Structural stop or validated volatility-based stop is chosen from the chart. A platform's drawdown allowance sets **dollar risk**, which sets the permissible order quantity. Widening/tightening the stop solely to force the desired size corrupts strategy validity. If minimum tradable quantity makes a reasonable risk budget impossible, skip the trade.

```text
RAW_HEADROOM = current_equity - CURRENT_FAILURE_FLOOR
USABLE_HEADROOM = max(0, RAW_HEADROOM - user_reserve)
MODE_BUDGET = USABLE_HEADROOM × selected_mode_percent
RISK_BUDGET = min(MODE_BUDGET, remaining_daily_loss_allowance_if_specified)
STOP_PRICE = structural_price, snapped OUTWARD to legal price tick
STOP_DISTANCE = abs(entry - STOP_PRICE)
POINT_VALUE_USD = point_value_in_quote_currency × (USD per quote_currency_unit)
LOSS_PER_NATIVE_UNIT = STOP_DISTANCE × POINT_VALUE_USD
                    + (slippage_ticks + spread_ticks) × tick_size × POINT_VALUE_USD
                    + round_trip_fee_per_native_unit_USD
QUANTITY = floor_to_exchange_quantity_increment(RISK_BUDGET / LOSS_PER_NATIVE_UNIT)
QUANTITY = min(QUANTITY, account_max_quantity_if_specified)
if QUANTITY < broker_minimum_quantity: NO TRADE
```

Conservative slippage stress is shown separately. Models may miss gaps, stop rejections, funding, conversion gaps, non-linear contracts, partial fills, liquidation, fees and real drawdown mechanics. It does **not** calculate broker margin eligibility, liquidation price, trailing floor movements, or correlated portfolio exposure. Don't use for live execution until the relevant checks and venue specs are confirmed.

## Sample workflow

1. Select profile `Vest Instant — example`, or create a new account for every separate platform/account.
2. Enter **CURRENT** equity, **CURRENT** failure floor, optional reserve, daily remaining loss limit and native quantity cap. Example $500 equity and $490 floor means only $10 raw buffer; the $500 is **not** the risk budget.
3. Choose **Very Safe**, **Normal**, or **Risk the Biscuit** and optionally edit the exact drawdown fraction. Defaults: 2%, 5%, 60% of **usable drawdown**.
4. Select instrument. Enter a real entry and the correct long/short *technical* invalidation stop, or its validated points/ticks/pips equivalent.
5. Verify current broker multiplier, minimum lot/quantity, tick, quote currency/USD conversion rate, fees and spread. Pre-filled **Vest values are deliberately NOT verified**, and must be confirmed before use.
6. Review modeled native order size, dollar loss, expected reward, stress slippage and post-stop buffer. Only select trade if platform rules, margin and live risk gates also allow it. App is not an execution signal.

### Instrument presets

- **CME futures:** ES ($50/point), MES ($5/point), NQ ($20/point), MNQ ($2/point), GC ($100/$1 gold move), MGC ($10/$1 gold move), MCL ($100/$1 oil move). Standard exchange contract sizes, not prop firm position limits or fees. Consult [CME contract info](https://www.cmegroup.com/markets/equities/sp-500-and-nasdaq-100-futures.html) and product-specific specs.
- **Vest perpetuals:** NQ-PERP and ES-PERP have **illustrative** $1 / native unit / point multipliers and an illustrative 0.01 quantity increment. These are explicitly marked **unverified**. Confirm in the live platform. Vest instant profile equity $500 and failure floor $490 are **examples**, not a promise of current terms.
- **Forex:** EURUSD uses 100k base units per standard lot and a USD quote; USDJPY requires the **current JPY→USD rate** and broker min lot setting. Beware 3-/5-digit broker 'pipette' pricing, and different instrument conventions.
- **Crypto/Stocks/CFDs:** Configurable quote-unit multiplier, native unit step and min order. A USD-quoted crypto spot contract is NOT equal to a crypto perpetual or inverse contract.

Data is **not** automatically updated. Contract specification status becomes unverified if manually edited. Account verification is a user self-attestation; not an API check. All risk modes are mathematical scenarios, not statistically validated presets.

## Validation status

- `npm test` runs deterministic regression tests (structural stops, quantity step, round-down behavior, fees/slippage sizing, long/short, quote conversions, daily limits, hard floor, and minimum tradable quantity).
- Run separate browser and broker integration checks prior to any public production use.
- The app is a functional **MVP**, not an institutionally certified risk engine. Production-readiness requires complete broker rule adapters, instrument spec governance, official data feeds, audited decimal arithmetic, automated end-to-end tests, change management, auth/tenant separation (if accounts synced), and an external review of financial calculations.

## GitHub → Netlify

1. The source repository is [Nsgcj/Trading-Calculator-](https://github.com/Nsgcj/Trading-Calculator-). Clone it to work locally.
2. In Netlify, select **Add new project → Import an existing project → GitHub**, choose the repository, and set the production branch to `main`. Netlify reads the test command and `public/` publish directory from `netlify.toml`. No API keys are required.
3. Use feature branches and pull requests for changes. Check GitHub Actions and the Netlify Deploy Preview before merging to `main`.

## Remaining work before calling it market-grade

- Verified Vest/MFF rule packs and quote specifications with change dates and source links, current drawdown floor and payout-buffer calculators, MFF micro/max-position conversion.
- Hard broker eligibility validation; real-time symbol metadata, fees, quote currency FX conversion; margin/liquidation check; spread/slippage modeling by instrument.
- Rounding via exact decimal library to eliminate floating precision artifacts, and provider-specific piecewise/quanto/inverse derivatives math.
- Multi-account aggregated exposure caps, correlated-symbol stress (ES/NQ), overlapping position sizing, portfolio total heat and daily stop-out ledger.
- Optional read-only integrations and manually verified trade confirmations; NO order submission until separate review.
- Playwright end-to-end tests on desktop and mobile; WCAG testing, security review and 100+ official contract test vectors.

The **Codex enhancement brief** is in [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md).
