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
3. Choose **Very Safe** (2%), **Normal** (5%), or **Risk the Biscuit** (15%, 30%, or 60%). Each preset has an editable percentage of **usable drawdown**.
4. Select instrument. Enter a real entry and the correct long/short *technical* invalidation stop, or its validated points/ticks/pips equivalent.
5. Review the applied tick and order rules. Use the account’s quote currency conversion, fees and spread for any values the public contract feed does not supply.
6. Review modeled native order size, dollar loss, expected reward, stress slippage and post-stop buffer. Only select trade if platform rules, margin and live risk gates also allow it. App is not an execution signal.

### Stops and targets from drawdown

- Under **Stop expressed as**, choose **From drawdown budget** when you know your planned quantity. Enter the quantity in the instrument's native units. The desk uses the selected mode's loss budget after any daily cap, deducts estimated costs, and rounds the stop toward entry. If that size cannot fit an adverse tick within budget, the result is **NO TRADE**.
- Under **Take-profit method**, choose **From drawdown budget** to target the selected budget times your chosen multiple in modeled net profit. A $25 budget at 2× targets at least $50 net after estimated costs. This works with a structural stop or a budget-based stop. **From stop distance** keeps the original price-distance calculation.
- The comparison table shows stop and target prices for each mode. A budget-based price is a modeled loss or profit level. Check market structure and the venue's liquidation rules separately.

### Trade Planner

Open **Trade Planner** for the Chicken Man execution windows, the broader 24-hour asset rotation, and exchange market hours. Each view shows the last completed session, the current window and what to prepare for next. Common setups include what to watch for and when to skip a play. The execution view follows the New York opening steps and midday pause on new entries. Times default to Eastern Time. Select a linked asset to open it in the Risk Calculator with the current sizing account.

Select **Browse playbooks** for the detailed session guides, including preparation, entry confirmation, invalidation, and trade management. Relevant session cards link directly to the guides.

Use **Hedge Sizer** to model a partial offset for long or short equity exposure with ES, MES, NQ, or MNQ. It compares rising, flat, and falling benchmark scenarios after entered costs and can size toward an optional dollar protection target within the entered loss, position, margin, and coverage limits. Week-end and month-end dates use scheduled U.S. cash closes. Verify your futures contract’s last trading date, overnight permissions, and margin for the holding period.

The **Vest Perpetuals** hedge mode uses a currently held quantity in NQ-PERP or ES-PERP. It fetches Vest’s last public price, tick, and quantity rules, and sizes an opposite position in fractional Vest units from the hedge account’s equity, failure floor, any separate limits, and selected risk fraction. Enter moves in index points and review fees, slippage, and funding for the intended holding period. Margin, leverage, and liquidation apply to each Vest account separately. [Vest Capital terms](https://next.vestmarkets.com/prop-terms-of-service)

Use **Hedge Review** for an existing hedge. Enter your chart invalidation level and last completed close. Review alerts progress from proximity to a break and then confirmed follow-through. The risk check protects the higher of peak equity minus allowed giveback and the firm floor plus reserve. It models the smallest trim that fits the entered adverse move and exit costs. Each account keeps its own drawdown room. Review results use fresh manual inputs each time.

### Automatic entry and exit levels

- Uncheck **Use manual stop-loss** or leave its input blank for an automatic stop. The default is a 1% adverse move from entry, adjusted to the instrument’s tick. Change the distance if you need a different scenario.
- Uncheck **Customize take-profit** or leave its multiple blank for a target based on three times the stop distance. Valid manual inputs still apply.
- Before you enter a price, the desk fetches the most recent public price for Vest NQ and ES perpetuals and supported Coinbase spot and Hyperliquid perpetual instruments. The source and available timestamp appear beside the entry. Older Vest or Coinbase trades are labeled as last known. **Refresh public price** reloads the quote. If a feed is unavailable, enter the price from your broker. Use **Copy SL** or **Copy TP** on the position ticket to copy the individual price as a plain number.

### Instrument presets

- **Account profiles:** Topstep, Apex Trader Funding, Take Profit Trader, TradeDay, Earn2Trade, and FTMO join the existing MFF and Vest examples. New profiles require your current equity, failure floor, and any applicable limits. Firm rules are entered manually.
- **Other assets:** Russell 2000 and Dow futures and micros, WTI crude, silver, natural gas, additional FX pairs, SPY and QQQ, Ether and Solana spot, and gold CFDs.
- **Linear crypto perps:** BTC, ETH, and SOL templates for Hyperliquid, Binance USDⓈ-M, and Bybit USDT. Enter the venue's tick, size increment, minimum order, and quote-to-USD conversion. Verify the contract units. Inverse products need a different payoff model.

- **CME futures:** ES ($50/point), MES ($5/point), NQ ($20/point), MNQ ($2/point), GC ($100/$1 gold move), MGC ($10/$1 gold move), MCL ($100/$1 oil move). Standard exchange contract sizes, not prop firm position limits or fees. Consult [CME contract info](https://www.cmegroup.com/markets/equities/sp-500-and-nasdaq-100-futures.html) and product-specific specs.
- **Vest perpetuals:** NQ-PERP and ES-PERP load current order increments from Vest. The point value is 1 USDC per native unit per point. The $500 equity and $490 failure floor are example account values.
- **Forex:** EURUSD uses 100k base units per standard lot and a USD quote; USDJPY requires the **current JPY→USD rate** and broker min lot setting. Beware 3-/5-digit broker 'pipette' pricing, and different instrument conventions.
- **Crypto/Stocks/CFDs:** Configurable quote-unit multiplier, native unit step and min order. A USD-quoted crypto spot contract is NOT equal to a crypto perpetual or inverse contract.

Published contract data is refreshed for supported venues. Manually edited contract rules require confirmation. Account verification is a user self-attestation. Risk modes are mathematical scenarios.

### Personal, evaluation, and funded profiles

Use the **Account profile** dropdown to choose a personal broker, evaluation, sim-funded, or live-funded profile. Select **Create Simulated funded profile** or **Create Live funded profile** to start the next stage on the same contract platform. You can choose any stage when creating a profile. The new profile starts with blank equity and floor so it uses the new account’s rules, while the earlier profile retains its own settings. Profiles are stored in this browser.

### Contest accounts

Select **Use contest profile** for the Phidias 10K Drawdown Challenge Advent Edition 2026. It starts at $10,000 simulated equity with a fixed $0 floor. Sizing uses the selected contract’s contest cap and any lower remaining cap you enter. Update equity and enter the capacity remaining on your platform when holding other positions. Outside the published contest session, the ticket labels valid sizing **Plan only**. [Phidias Advent rules](https://member.phidiaspropfirm.com/advent/rules?_lang=en)

### Finding an instrument

The instrument dropdown shows the full catalog, grouped by platform and asset class. Instruments in the selected account's default platform group appear first. Selecting any instrument keeps your sizing account and its risk limits. When the instrument comes from another platform group, the result is marked for verification so you can check broker availability and contract units. Your saved custom instruments remain in the dropdown.

### Contract specifications and execution costs

- Selecting supported Vest, Binance USDⓈ-M, or Bybit USDT perpetuals loads published tick and quantity rules automatically. Binance and Bybit also supply a minimum order value. Successful lookups are reused for up to 24 hours. Use **Load exchange specification** to refresh on demand. If the endpoint is unavailable, the desk uses existing values and marks expired rules for verification. Quote-to-USD conversion remains an input.
- Enter total modeled slippage and any additional spread separately in ticks. Enter both sides of fees in USD per native unit. The ticket shows the estimated round-trip cost separately. Fee tiers, actual fills, funding, margin, liquidation, and prop account rules depend on the account and order.
- Hyperliquid uses price-dependent precision. The fixed-tick calculator displays those contracts as estimates. Generic FX, CFD and spot/share presets depend on broker settings. CME futures use published exchange ticks. When a position is too small to meet the venue’s quantity minimum, the ticket shows the risk of the minimum order alongside the selected budget.

### Published fees and daily limits

Account presets show applicable public fee schedules and daily loss references. The calculator can apply a published flat round-trip cost for supported TopstepX, My Funded Futures and Take Profit Trader combinations. Use the number only when the schedule matches your account and platform. Fee inputs are remembered per account and instrument. Percentage fees, funding, broker-specific charges and live execution still depend on the order.

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
