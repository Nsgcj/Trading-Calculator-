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

### Stops and targets from drawdown

- Under **Stop expressed as**, choose **From drawdown budget** when you know your planned quantity. Enter the quantity in the instrument's native units. The desk uses the selected mode's loss budget after any daily cap, deducts estimated costs, and rounds the stop toward entry. If that size cannot fit an adverse tick within budget, the result is **NO TRADE**.
- Under **Take-profit method**, choose **From drawdown budget** to target the selected budget times your chosen multiple in modeled net profit. A $25 budget at 2× targets at least $50 net after estimated costs. This works with a structural stop or a budget-based stop. **From stop distance** keeps the original price-distance calculation.
- The comparison table shows stop and target prices for each mode. A budget-based price is a modeled loss or profit level. Check market structure and the venue's liquidation rules separately.

### Automatic entry and exit levels

- Uncheck **Use manual stop-loss** or leave its input blank for an automatic stop. The default is a 1% adverse move from entry, adjusted to the instrument’s tick. Change the distance if you need a different scenario.
- Uncheck **Customize take-profit** or leave its multiple blank for a target based on three times the stop distance. Valid manual inputs still apply.
- With a missing entry or automatic exit, the desk fetches a quote snapshot for Vest NQ and ES perpetuals or the supported Coinbase spot and Hyperliquid perpetual instruments. **Use current price** refreshes the snapshot. For an unavailable market or feed, enter the quote from your broker. Suggested levels are for planning, and no orders are submitted.

### Instrument presets

- **Account profiles:** Topstep, Apex Trader Funding, Take Profit Trader, TradeDay, Earn2Trade, and FTMO join the existing MFF and Vest examples. New profiles require your current equity, failure floor, and any applicable limits. Firm rules are entered manually.
- **Other assets:** Russell 2000 and Dow futures and micros, WTI crude, silver, natural gas, additional FX pairs, SPY and QQQ, Ether and Solana spot, and gold CFDs.
- **Linear crypto perps:** BTC, ETH, and SOL templates for Hyperliquid, Binance USDⓈ-M, and Bybit USDT. Enter the venue's tick, size increment, minimum order, and quote-to-USD conversion. Verify the contract units. Inverse products need a different payoff model.

- **CME futures:** ES ($50/point), MES ($5/point), NQ ($20/point), MNQ ($2/point), GC ($100/$1 gold move), MGC ($10/$1 gold move), MCL ($100/$1 oil move). Standard exchange contract sizes, not prop firm position limits or fees. Consult [CME contract info](https://www.cmegroup.com/markets/equities/sp-500-and-nasdaq-100-futures.html) and product-specific specs.
- **Vest perpetuals:** NQ-PERP and ES-PERP have **illustrative** $1 / native unit / point multipliers and an illustrative 0.01 quantity increment. These are explicitly marked **unverified**. Confirm in the live platform. Vest instant profile equity $500 and failure floor $490 are **examples**, not a promise of current terms.
- **Forex:** EURUSD uses 100k base units per standard lot and a USD quote; USDJPY requires the **current JPY→USD rate** and broker min lot setting. Beware 3-/5-digit broker 'pipette' pricing, and different instrument conventions.
- **Crypto/Stocks/CFDs:** Configurable quote-unit multiplier, native unit step and min order. A USD-quoted crypto spot contract is NOT equal to a crypto perpetual or inverse contract.

Data is **not** automatically updated. Contract specification status becomes unverified if manually edited. Account verification is a user self-attestation; not an API check. All risk modes are mathematical scenarios, not statistically validated presets.

### Personal, evaluation, and funded profiles

Use the **Account profile** dropdown to choose a personal broker, evaluation, sim-funded, or live-funded profile. Select **Create Simulated funded profile** or **Create Live funded profile** to start the next stage on the same contract platform. You can choose any stage when creating a profile. The new profile starts with blank equity and floor so it uses the new account’s rules, while the earlier profile retains its own settings. Profiles are stored in this browser.

### Finding an instrument

The instrument dropdown shows the full catalog, grouped by platform and asset class. The current account's instruments appear first. Choosing a contract on another platform switches to a compatible saved account and recalculates the budget from that account's inputs. Your saved custom instruments remain in the dropdown.

### Contract specifications and execution costs

- **Load exchange specification** retrieves published tick size, quantity rules, and minimum order value for supported Binance USDⓈ-M and Bybit USDT perpetuals. If the endpoint is unavailable, existing values are kept. Reload published rules after 24 hours. The quote-to-USD conversion remains an input.
- Enter total modeled slippage and any additional spread separately in ticks. Enter both sides of fees in USD per native unit. The ticket shows the estimated round-trip cost separately. Fee tiers, actual fills, funding, margin, liquidation, and prop account rules depend on the account and order.
- Hyperliquid uses price-dependent precision. The fixed-tick calculator displays those contracts as estimates. Unverified Vest, FX, CFD and generic spot/share presets also depend on broker settings.

### Published fees and daily limits

Account presets show applicable public fee schedules and daily loss references. The calculator can apply a published flat round-trip cost for supported TopstepX, My Funded Futures and Take Profit Trader combinations. Use the number only when the schedule matches your account and platform. Fee inputs are remembered per account and instrument. Percentage fees, funding, broker-specific charges and live execution still depend on the order.

A published daily cap is different from the allowance remaining after today’s P&L. Enter the current remaining amount to include it in sizing, or select **No daily loss cap applies to this profile** if appropriate. The account’s drawdown floor still applies.
A published daily cap is different from the allowance remaining after today’s P&L. The desk auto-fills the drawdown-based allowance from equity minus the current floor and reserve. Enter a separate remaining daily amount if your plan has one. The desk applies both constraints. Clear the field to return to the automatic value.

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
