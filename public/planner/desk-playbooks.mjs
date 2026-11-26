const executiveSop = 'Adapted from the supplied Institutional Trading Desk SOP.';
const decisionSop = 'Adapted from the supplied Proprietary Trading and Institutional Trading Desk SOPs.';
const equityEntryGate = 'During the planner’s U.S. equities window, new entries start at 9:45 a.m. ET and pause from 11:30 a.m. to 1:30 p.m. ET on regular cash-session days. Follow earlier account cutoffs.';

export const DESK_PLAYBOOKS = [
  {
    id: 'stock-in-play',
    title: 'Stock in Play and Trade Selection',
    window: 'Premarket watchlist and pre-entry desk check',
    overview: 'Qualify the stock first. Then name the market context, trade mechanism, price location, entry trigger and risk plan in that order.',
    assets: ['U.S. stocks with material news, earnings, sector activity or a clear structural repricing'],
    preparation: [
      'Verify the catalyst, available liquidity and relative volume. The SOP uses relative volume of at least 1.5× its 14-session baseline and room for an expanded move as example stock filters.',
      'Use the daily and 65-minute charts to classify the context as a trend, range breakout, overextension or news reaction. Mark higher-timeframe supply and demand.',
      'Name the momentum mechanism, then choose its location. For example, a pullback continuation may form near the 9 EMA or VWAP. The reference gives a price area while the defended swing and renewed trend movement supply the trigger.',
    ],
    setupsLabel: 'Desk checks',
    setups: [
      {
        name: 'Confirm before sizing',
        trigger: 'At the mapped level, wait for the expected price response. When your feed shows trades and depth, look for price to advance through offers, bids to reprice, or the opposing side to fail to move price.',
        invalidation: 'The mapped level fails, the apparent confirmation does not hold, or a spread change prevents the planned stop from fitting.',
        management: 'Record the entry trigger, thesis stop, next target and estimated costs. Size from the stop and current account limits after all six checks pass.',
      },
    ],
    skip: [
      'The catalyst is unclear, liquidity is inadequate or the next structural level leaves too little room after costs.',
      'A level touch or chart pattern appears before the expected behavior confirms.',
    ],
    sourceNote: decisionSop,
  },
  {
    id: 'asset-protocol',
    title: 'ASSET Protocol and Position Management',
    window: 'Before entry, before adding, and at a planned exit',
    overview: 'Use the SOP’s allocation, stop, entry and target sequence. Define what would invalidate the idea, then size for that distance and the expected execution costs.',
    assets: ['Any permitted market with known order increments, costs and account loss limits'],
    preparation: [
      'Grade the setup using your reviewed criteria. The SOP illustrates A+ as the highest planned tier, A as baseline risk, and B as a starter tier. Cap every tier by today’s usable drawdown, daily room and existing exposure.',
      'Place the stop at the price that breaks the thesis. A defended retest, a failed break and a reversal at a session extreme can have different invalidation points.',
      'Identify the price or tape behavior that confirms entry and map the first realistic target. Compare net reward with the modeled loss after fees and slippage.',
    ],
    setupsLabel: 'Risk checks',
    setups: [
      {
        name: 'Entry and stop check',
        trigger: 'The setup confirms and the smallest order fits the account’s current loss budget at the planned stop.',
        invalidation: 'Price or new information breaks the thesis. Reassess or exit according to the recorded rule and avoid widening the stop to preserve the position.',
        management: 'If fill price or spread changes the planned reward or loss, recalculate before proceeding. On a scalp, a prior two-minute bar or a two-minute 21 EMA close can be a management reference where the setup calls for it.',
      },
      {
        name: 'Core position and late add',
        trigger: 'An existing core remains valid and a fresh setup supports an add within the combined risk budget.',
        invalidation: 'The late add can fail at its own tighter level. Failure of the core thesis applies to the whole planned position.',
        management: 'Track the add and core separately. Trim the newest failed add first when the core still holds. Apply your account’s holding limits before trailing any core using a daily swing, 10 EMA, or anchored VWAP.',
      },
      {
        name: 'Risk comparison at the same target',
        context: 'An illustrative $57.82 long targeting $60.00 offers $2.18 per share before costs. A $54.00 stop risks $3.82 per share for 0.57R of potential gross reward. A $56.00 stop risks $1.82 per share for 1.20R.',
        trigger: 'Use the break or defended level that actually confirms the setup.',
        invalidation: 'Use $56.00 in the example only if a break there defeats the thesis. A turn from deeper support can require a different stop.',
        management: 'Before costs, those reward-to-risk ratios need about 63.7% and 45.5% wins respectively to break even at fixed wins and losses. Costs raise both thresholds. Check actual fills and win rates when comparing the two approaches.',
      },
    ],
    skip: [
      'The smallest order exceeds the loss budget, the stop’s actual execution risk is unclear, or the venue disallows the position or hold.',
      'Several orders share one thesis and their combined loss exceeds the cap. Follow your account’s rules on correlated positions and cross-account exposure.',
    ],
    tools: [{ label: 'Open Risk Calculator', href: '../' }, { label: 'Open Stack Planner', href: './stack/' }],
    sourceNote: decisionSop,
  },
  {
    id: 'trade-review',
    title: 'Daily, Weekly and Monthly Trade Review',
    window: 'After the session · end of week · end of month',
    overview: 'Review one setup at a time. Use real fills and net outcomes to decide which rules to keep, which need more evidence, and when a small swing trial is worth modeling.',
    assets: ['Closed trades, recent qualifying opportunities and the corresponding price charts'],
    preparation: [
      'Log the setup, market context, trigger, planned risk, fills, net result in R and any rule breach. R is the planned loss for that trade.',
      'Save the higher-timeframe and execution charts. For a potential swing, mark the daily stop and relevant earnings or account deadlines that were knowable before entry.',
      'Compare like setups and include losing trades and missed qualifying setups in the review.',
    ],
    setupsLabel: 'Review checklist',
    setups: [
      {
        name: 'Daily execution review',
        trigger: 'After the session, compare actual fills, slippage and management with the written playbook.',
        invalidation: 'A rule breach or unplanned add makes the trade a poor example of how the stated setup performs.',
        management: 'Keep the result in the journal with its rule-breach label. Save one change to test in the next session.',
      },
      {
        name: 'Weekly market and swing review',
        trigger: 'Compare setup follow-through, market breadth and sector leadership. Review whether eligible intraday entries continued over the next 10–15 sessions, where data is available.',
        invalidation: 'A future move would have failed the planned daily stop or could not have been held under the original account and event constraints.',
        management: 'Test one swing pattern at a time. Model a small overnight position and its gap loss before increasing size. Choose the share to trim and the core to hold before the close, and use breadth and setup follow-through to review how much exposure to carry.',
      },
      {
        name: 'Monthly sizing and playbook review',
        trigger: 'After enough comparable trades, compare win rate, average win and loss after costs, loss streaks and actual opportunity pace.',
        invalidation: 'A small or mixed sample cannot establish how one setup behaves. A recent winner alone is weak evidence for increasing size.',
        management: 'Record which rules you are keeping and which you are testing next month. Use the recent sample to check whether a size or target change still fits the loss budget.',
      },
    ],
    skip: [
      'Sizing up on the basis of one winner, a future move visible only in hindsight, or a strategy sample that mixes different execution rules.',
      'Carrying into the next session when holding permissions or gap loss have not been accounted for.',
    ],
    tools: [{ label: 'Open Compound Calculator', href: './compound/' }, { label: 'Open Vest Accounts', href: './vest/' }],
    sourceNote: 'The daily, weekly and monthly review adapts the historical-trade review and swing-sizing sections of the supplied Institutional Trading Desk SOP.',
  },
];

export const SWING_PLAYBOOKS = [
  {
    id: 'swing-consolidation',
    title: 'Swing Consolidation Breakout',
    window: 'Multi-day plan · enter during a permitted liquid window',
    overview: 'Look for expansion out of a multi-week base after price ranges and volume contract. Align the daily trend and sector context with an intraday break of the marked boundary.',
    assets: ['Liquid U.S. stocks with relative strength in a leading sector, or relative weakness for a short where permitted'],
    preparation: [
      'Mark the daily base high and low and note the 200-day trend. Use the hourly chart to mark nearby supply and demand, then refine the pivot on the 5- or 15-minute chart.',
      'Check breadth, peer strength, recent breakout follow-through and upcoming events. Map the next daily level and compare the distance with ATR.',
      'Decide whether the account permits the hold. Plan the share to exit into initial momentum and the share to keep as a core. The SOP illustrates 50/50 for a stronger base and 80/20 when there is less room or the move is mature.',
      equityEntryGate,
    ],
    setups: [
      {
        name: 'Base compression and expansion',
        trigger: 'Price clears the base boundary with expanding volume and holds beyond it. For a long, sustained trade above intraday VWAP can support the confirmation.',
        entry: 'The SOP allows a small starter at a defended hourly 10 EMA or 20 SMA. Keep additional size contingent on the actual boundary break and combined risk.',
        invalidation: 'Price returns into the base and takes out the confirming pivot. If carrying a core, set its daily failure level before the close.',
        management: 'Use the next daily barrier as the first objective. Compare possible extensions with 1.5–2× ATR as an SOP example. Trail any planned core with daily swings or VWAP anchored at the breakout.',
      },
    ],
    skip: [
      'Repeated failed breaks, weak relative performance, a nearby daily barrier that leaves little room, or an entry dependent on moving averages alone.',
      'Earnings, overnight gaps or platform rules make the planned loss or hold unsuitable.',
    ],
    sourceNote: executiveSop,
  },
  {
    id: 'swing-backside-reversal',
    title: 'Backside Mean Reversion Short',
    window: 'Day two or later after a failed parabolic move',
    overview: 'Use a major upside extension to build the watchlist. Wait for the move to fail, then look for a weaker bounce into supply left by the reversal.',
    assets: ['Liquid, shortable U.S. stocks after a climactic advance'],
    preparation: [
      'Mark the climactic high, overhead supply, the origin of the original move and interim support. Compare the extension with the 5-, 10-, 20- and 50-day averages and daily ATR.',
      'As an example watchlist filter, the SOP describes an extension of seven or more ATRs above the 50-day average and a multi-day volume climax. Require a reversal and a later weak bounce to consider entry.',
      'Check short availability, borrow costs, the possibility of halts and the effect of an overnight squeeze on the account’s loss room.',
      equityEntryGate,
    ],
    setups: [
      {
        name: 'Lower-high bounce into supply',
        trigger: 'After the climax and initial break, an hourly or five-minute bounce stalls below the prior high on lighter demand. Price then loses the bounce pivot or intraday VWAP.',
        invalidation: 'The bounce high is reclaimed or the stock accepts back above the mapped supply. Place the planned stop beyond the swing that invalidates the short.',
        management: 'Use nearby support as the first target and the base that started the advance as a later reference if momentum follows through. Trail from daily lower highs if the account permits a hold.',
      },
    ],
    skip: [
      'Price is still making new highs with strong demand, or a short depends on the size of the extension alone.',
      'Borrow, spread, halt risk or overnight exposure makes the structural stop unsuitable.',
    ],
    sourceNote: executiveSop,
  },
  {
    id: 'swing-day-two-power-play',
    title: 'Day 2+ Power Play',
    window: 'Second or third U.S. cash session after a catalyst',
    overview: 'Look for continuation after an earnings move or another material catalyst. Wait for price to pull back into a level defined by the original move.',
    assets: ['Liquid U.S. stocks with a material catalyst and a strong first-session directional move'],
    preparation: [
      'Mark the breakout origin, Day 1 high, prior support and Day 1 or two-day anchored VWAP where the data supports it.',
      'Use the 10 EMA or 20 SMA as additional context if either lines up with the anchor. Check the next daily resistance and set the plan for a possible multi-day hold.',
      equityEntryGate,
    ],
    setups: [
      {
        name: 'Post-catalyst pull-in and resumption',
        trigger: 'On Day 2 or 3, selling volume contracts into the anchor. A five-minute reclaim or double-bar turn then confirms that buyers are defending it.',
        invalidation: 'The confirming pullback loses its anchor or breaks its session low. A later structural daily lower low invalidates the long swing thesis under this model.',
        management: 'Trim into renewed momentum at the next marked level. For a permitted runner, trail daily higher lows or the anchored VWAP from the original move.',
      },
    ],
    skip: [
      'Day 1’s move had no identifiable catalyst, the pullback is selling aggressively through the anchor, or the target sits too close to justify the stop.',
      'A scalp would have to become an overnight position just to stay open. Set the holding horizon before entry.',
    ],
    sourceNote: executiveSop,
  },
];

export const SCALP_PLAYBOOKS = [
  {
    id: 'scalp-rubber-band',
    title: 'Rubber Band / Offside Scalp',
    window: 'Intraday reversal · two-minute confirmation',
    overview: 'Watch for a stretched move to undercut a well-tested level, then snap back through it. The undercut can trap traders who entered after the extended move.',
    assets: ['Liquid U.S. stocks or ETFs at an established daily or intraday boundary'],
    preparation: [
      'Mark the relevant higher-timeframe support or resistance and any nearby round-number level. Look for multiple legs away from the intraday average and a test of that boundary.',
      'Set an initial target inside the prior range and mark reported-volume session VWAP if it offers a realistic later objective.',
      equityEntryGate,
    ],
    setups: [
      {
        name: 'Stretch, undercut, reclaim and snap',
        trigger: 'After the undercut, price quickly recovers the level. Look for selling pressure to fade, then for two consecutive bullish two-minute candles to clear recent bar highs as volume expands. Mirror the sequence for a short.',
        invalidation: 'Price accepts past the boundary or retakes the failed-break extreme. Use the extreme to define the stop and leave room for execution costs.',
        management: 'The SOP illustrates equity trims near 1R and 2R and a possible remainder toward VWAP. Check that the planned exits fit the spread, current volatility and time remaining.',
      },
    ],
    skip: [
      'No well-defined level, a fresh trend leg keeps making extremes, or the reclaim has already run too far to size.',
      'Liquidity cannot support a tight stop or trading outside the account’s permitted window.',
    ],
    sourceNote: executiveSop,
  },
  {
    id: 'scalp-hitchhiker',
    title: 'Hitchhiker Scalp',
    window: 'Intraday trend continuation · two-minute chart',
    overview: 'Use the first or second clean, low-volume pullback after a strong directional impulse. The nine-period EMA marks the pullback area and the 21-period EMA helps define failure.',
    assets: ['Liquid U.S. stocks with a fresh catalyst, elevated relative volume and an expanded intraday range'],
    preparation: [
      'Confirm a directional impulse and identify the first or second orderly pullback on the two-minute chart.',
      'Mark the 9 EMA, 21 EMA and nearby exhaustion levels. Compare pullback volume with the impulse and decide where to take partial profits.',
      equityEntryGate,
    ],
    setups: [
      {
        name: 'Shallow pullback and renewed impulse',
        trigger: 'Pullback volume contracts into the two-minute 9 EMA. Enter after the pullback stalls and price starts moving again in the original direction.',
        invalidation: 'The SOP exit is a two-minute close beyond the 21 EMA against the trade. Size for the structural stop and account for adverse execution while waiting for confirmation.',
        management: 'The SOP illustrates trimming 70% into the renewed push and trailing 30% against prior two-minute lows for longs or highs for shorts. Use amounts that round to permissible order increments.',
      },
    ],
    skip: [
      'Heavy counter-trend volume, broken structure or a third or later pullback.',
      'The stop does not fit current loss room, or the entry falls inside a pause or restricted period.',
    ],
    sourceNote: executiveSop,
  },
];
