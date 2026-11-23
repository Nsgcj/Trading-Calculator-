# CODEX IMPLEMENTATION PROMPT — CHICKEN MAN RISK DESK

You are the lead quantitative product engineer, senior frontend engineer, fintech risk-control architect, and QA lead. Work inside this existing repository. Do not destroy, rename, or overwrite unrelated projects.

## Product mission

Build a professional-grade, mobile-first, audit-friendly **multi-broker, multi-asset position sizing engine** for a trader switching between Vest perpetual contracts, My Funded Futures (MFF) futures, FX platforms, gold, crypto, stock brokers and user-defined CFDs. User should see precisely what **native quantity to type into their platform** (contracts, micros, lots, units, shares, coins), conditional on current account drawdown rules and a valid chart stop.

PRIMARY PRINCIPLE: **A trade's structural/volatility-validated invalidation price determines stop distance; risk budget determines position size. Never move the stop merely to fit a desired size. If no legal minimum order meets budget, output NO TRADE.**

## Current foundation

An initial working offline web app and deterministic risk calculator exist in `public/` and `tests/`, deployed as static assets through `netlify.toml`. Read all existing files and run `npm test` before editing. Preserve working behavior and clean UI; iterate in PR-sized commits. Current demo profiles and Vest multiplier values must not be represented as verified live platform rules. No automatic trading.

## Functional specs

1. **Risk source of truth:** account equity, CURRENT hard or trailing drawdown floor, high-water mark/EOD snapshot when applicable, daily loss remaining, safety reserve, max native positions, account type, contract eligibility. Treat stale/unknown policy as BLOCKED/VERIFY, never silently authorize.
2. **Risk modes:** Very Safe (2%), Normal (5%), Risk the Biscuit (60%) as editable fractions of usable drawdown, with clear extreme risk warnings. Risk mode must never bypass broker hard limits or transform unverified assumptions into approvals. User can create custom presets and enable a manual maximum dollar risk cap.
3. **Price level math:** choose long/short, true structural stop, optionally stop distance in points, ticks, pips or ATR-based *validated* stop; snap stop outward to tick; calculate monetary risk inclusive of fees/spread/slippage; floor quantity to broker step; calculate TP1/TP2/TP3 and net R; display exact input size and stopped-out drawdown buffer, as well as stress gap analysis.
4. **Native contract adapters:** CME futures (exchange tick/multiplier; micros vs minis; prop contract limits), Vest perpetuals (confirm actual unit point value, allowed step, max leverage and any capital requirement), spot FX pairs and lot conventions including JPY currency conversions, crypto spot, linear crypto perps, inverse/quanto derivatives only when explicitly implemented, spot equities/fractional shares, broker CFDs. Never assume all broker 'units' mean the same thing. No fake live FX/market prices.
5. **Policy updates:** sourced and dated contract metadata and broker drawdown rule catalog; schema for `InstrumentSpec`, `BrokerRuleSet`, `AccountState`, `RiskBudget`, `TradeSetup`, `ExecutionCostEstimate`, `PositionResult`, `RiskDecision`. Support hand-verification, source links and provenance, with expiry timestamps.
6. **Account portfolio layer:** multiple separate accounts, copy-size across accounts **by equal dollar risk** rather than same contracts; portfolio gross/net risk and correlated symbol risk; pending orders + open-position exposure; hard stop-out and daily limits; configurable kill switches. Same-day/account exposure should be conservative.
7. **UI/UX:** preserve current premium dark terminal visual language. Build dashboard tabs for Risk Calculator, Account Manager, Contract/Unit Converter, Trade Scenarios, Risk Ledger and Broker Rules. Live-validation badges without misrepresenting stale data. Keyboard accessible, responsive mobile, inline explanations of cash-per-point and unit increments. Export plan/CSV/JSON.
8. **Integration:** Netlify Git-connected builds, Deploy Previews, automated CI, optional Auth/DB only if needed. Read-only account adapters preferred. Don't store credentials client-side; secrets remain server-side. No trade execution in V1/V2.
9. **Quant correctness:** Use audited decimal math (e.g., decimal.js) or rational ticks and integer minor-currency handling; no float rounding that can accidentally over-size. Test stale data, outliers, extreme volatility, negative inputs, invalid FX quote rate, zero or crossed stop, partial closes, inverse product payoff, and venue-level min/max lot steps.
10. **MFF/prop rules:** derive and verify actual program-specific current floor/trailing EOD/high-water mechanics rather than assuming the 'advertised account size' is spendable risk capital. Include payout resets and safety buffers and distinguish hard liquidations vs realized loss.

## Delivery phases

**Phase 1 — Hardening:** inspect provided app, document model invariants, refactor math into clear units, add 50+ deterministic test vectors, unit safety and precise decimal rounding. Produce a concise architecture ADR + risk model docs.

**Phase 2 — Broker truth:** official source-verified Vest and MFF rule profiles, CME tick value data, FX spot lot rules, manual conversion expiry. Add confidence/provenance and warnings; never scrape private accounts or guess data.

**Phase 3 — Product:** robust account and custom instrument management, stop/target ladder, per-account dollar allocation comparison, portfolio heat, event-related risk flags, export/import profiles, trade journal, loss-limits and advanced stress testing. Preserve simple fast calculator home screen.

**Phase 4 — Deploy and audit:** GitHub PR, tests/linters/e2e/security scan, Netlify Deploy Preview, visually inspect on 375px iPhone and desktop, verify all math, document missing features, merge after review.

## Non-negotiable acceptance cases

- Vest **illustration**: equity $500 / static floor $490 / no reserve / 60% mode / 30 NQ point structural stop / $1 per point per hypothetical Vest unit / zero modeled costs → 0.20 units, $6 loss. With 2 ticks of stop slippage (0.25 point tick) → 0.19 units; risk must not exceed $6.
- MFF **illustration**: equity $25,000 / CURRENT floor $24,000 / normal 5% mode / MNQ / 10 point stop / $2 per point and zero costs → 2 micro contracts, $40 risk, not 2.5 contracts; if available drawdown falls, resize accordingly.
- USDJPY: fail closed until quote→USD conversion is provided or verified. Quote-currency values must be converted to account currency correctly.
- Stop wrong side of entry / nonpositive stop / budget below minimum contract risk / breached floor → NO TRADE.
- Mismatched or stale policy → VERIFY / BLOCKED. Never call a trade live-eligible based only on a calculator.

## Working style

First audit, test and understand the code. Present a small change plan. Make high-value changes directly without breaking existing behavior. Write tests for each change and run the suite. Do not silently replace existing contract assumptions with guesses. Make reproducible commits and prepare a PR; include screenshots and a Netlify preview URL when actually created.
