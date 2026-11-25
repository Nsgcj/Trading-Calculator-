export const SESSION_PLAYBOOKS = [
  {
    id: 'asian-open',
    title: 'Asian Open',
    window: '8:00–11:00 p.m. ET execution window',
    overview: 'Focus on Asia-Pacific FX. The broader watch starts at 7:00 p.m. ET. Tokyo, Hong Kong, Shanghai, and Sydney cash opens follow their local clocks, so check the session clock before using an index opening range.',
    assets: [
      'Primary · USD/JPY, AUD/JPY, AUD/USD',
      'Secondary watch · NZD/USD, Nikkei 225, Hang Seng, China A50',
    ],
    preparation: [
      'Mark the prior session high and low and the range formed ahead of the relevant local open on the same instrument and feed.',
      'Check regional data, local exchange hours, and the venue’s spread after rollover. For JPY pairs, note the 9:55 a.m. Tokyo fixing as a timing reference.',
      'Mark the next distinct price level on each side of the range so a confirmed move has a preplanned target.',
    ],
    setups: [
      {
        name: 'Opening break and retest',
        trigger: 'After spreads settle, wait for a candle to close outside the opening range. Look for a pullback that holds the edge and a break of the pullback swing in the breakout direction.',
        invalidation: 'A close back inside the range undermines the setup. Place the stop beyond the retest swing on the far side of the edge.',
        management: 'Use the next marked swing or prior-session extreme for the first target. Reassess if follow-through fades before another local open or a scheduled release.',
      },
      {
        name: 'Liquidity sweep and reclaim',
        trigger: 'Wait for price to briefly exceed a range extreme, close back inside, and break the nearest small swing toward the range interior.',
        invalidation: 'Price accepts beyond the range or retakes the sweep extreme. Place the stop beyond the extreme.',
        management: 'Use the first clear level inside the range as the initial target. Consider the far edge only after price moves cleanly through the midpoint.',
      },
    ],
    skip: [
      'Wide spreads, repeated breaks of both edges, or an entry in the middle of an undefined range.',
      'Index setups during a local closure or lunch break, and new entries outside the planned execution window.',
    ],
  },
  {
    id: 'london-open',
    title: 'London Open',
    window: '2:00–5:00 a.m. ET execution window',
    overview: 'Use the completed Asian range to plan for European expansion. London and Frankfurt cash usually open at 3:00 a.m. ET. Their openings can shift in Eastern Time during daylight-saving transition weeks.',
    assets: [
      'Primary · EUR/USD, GBP/USD, DAX, XAU/USD',
      'Secondary watch · EUR/GBP, GBP/JPY, EUR/JPY, FTSE 100, Euro Stoxx 50, Brent',
    ],
    preparation: [
      'Mark the Asian high and low, prior-day extremes, and any nearby level that price has repeatedly defended.',
      'Check the UK and euro-area calendars, the exact cash open for index setups, and your firm’s restricted news windows.',
      'Plan both an outside hold and a failed sweep. Choose which level would confirm each scenario and where each would be invalidated.',
    ],
    setups: [
      {
        name: 'Asian range expansion',
        trigger: 'Look for a close outside the Asian range and a pullback that holds the broken edge. Wait for price to break the pullback swing in the direction of the move.',
        invalidation: 'The pullback gives back the range edge or breaks the swing that held it. Place the stop beyond that swing.',
        management: 'Plan the first exit at a prior-day level or the next distinct swing. Pass when that level is too close for the planned reward after costs.',
      },
      {
        name: 'European open sweep and reversal',
        trigger: 'Wait for a sweep of an Asian extreme or prior-day level, a close back through it, and a break of the nearest swing away from the sweep.',
        invalidation: 'Price reclaims the sweep extreme or holds outside the prior range. Place the stop beyond the sweep extreme.',
        management: 'Use the nearest defended interior level as the first target. Reassess there before looking for a move across the range.',
      },
    ],
    skip: [
      'A cash-index breakout before its relevant market opens, or a wick alone without a reclaim and confirming swing.',
      'Restricted data releases, thin execution, or several positions expressing the same EUR, GBP, or equity-index exposure.',
    ],
  },
  {
    id: 'ny-macro-open',
    title: 'New York Macro Open',
    window: '8:30–9:25 a.m. ET execution window',
    overview: 'The broader macro watch starts at 8:00 a.m. ET. Many U.S. data releases are scheduled for 8:30 a.m., but confirm the exact calendar for the date. Start preparing for the U.S. cash open at 9:15 a.m.',
    assets: [
      'Primary · XAU/USD or MGC, EUR/USD, GBP/USD, USD/JPY, USD/CAD, CL or MCL',
      'Context · Treasury futures, U.S. Dollar Index, ES and NQ',
    ],
    preparation: [
      'Review the actual release time, any next release, and the selected account’s rules on placing orders or holding positions around news.',
      'Mark the pre-release high and low, overnight extremes, and the next clear reaction level. Record the normal spread for the instrument.',
      'Observe the first release move. Rebuild the range if the release changes price structure, and reassess execution costs after spreads and depth recover.',
    ],
    setups: [
      {
        name: 'Post-release hold and retest',
        trigger: 'After all restrictions clear, wait for a close outside a defined post-release range. Look for a retest that holds and a break of the new swing in the same direction.',
        invalidation: 'Price closes back through the broken edge or takes out the retest swing. Place the stop beyond the swing that confirmed the hold.',
        management: 'Aim first for the next marked reference level. Check that there is time to manage the trade before the next release or the shift into cash-open preparation.',
      },
      {
        name: 'Failed release spike',
        trigger: 'If the first move runs a pre-release high or low, wait for a reclaim back inside the range and a break of a confirming swing away from the spike after execution normalizes.',
        invalidation: 'Price reclaims the spike extreme or holds outside the pre-release range. Place the stop beyond the spike only when position sizing can absorb the distance and execution costs.',
        management: 'Use the next pre-release level as the first target. Pass when the spike leaves a stop too wide for the smallest permissible order.',
      },
    ],
    skip: [
      'A restricted news window, spread or depth still abnormal, or a second scheduled release before confirmation.',
      'The first data print without a settled range, or an unconfirmed new macro entry after 9:25 a.m. ET.',
    ],
  },
  {
    id: 'equities-open',
    title: 'U.S. Equities Open',
    window: '9:15–10:30 a.m. ET plan · Entries 9:45–10:30 a.m.',
    overview: 'Prepare at 9:15. Observe the first five minutes after the 9:30 a.m. cash open. From 9:35 to 9:45, mark the impulse and retest areas. Consider confirmed entries only from 9:45 a.m. ET.',
    assets: [
      'Primary · MNQ and MES, with NQ and ES as full-size alternatives where permitted',
      'Additional watch · MGC, index ETFs, and qualifying U.S. Day Two stocks with a significant prior-day move',
    ],
    preparation: [
      'Mark the prior cash-session high and low, overnight extremes, and the first 15 minutes of the cash session on a consistent chart.',
      'If using VWAP, use a reported-volume chart and anchor it to the U.S. cash open. Mark the next prior-day or intraday level before entering.',
      'For a Day Two stock, identify the prior-day move or catalyst and map three to four prices at most, including the prior high, low, and clearly defended levels.',
    ],
    setups: [
      {
        name: 'Opening-range breakout and retest',
        trigger: 'After 9:45 a.m., wait for a close outside the completed 15-minute range. Look for the broken edge to hold on a retest and price to clear the retest swing.',
        invalidation: 'A return and close inside the range weakens the setup. Place the stop beyond the swing that formed on the retest.',
        management: 'Take the next marked level or session extreme as the first target. If it is too close relative to the structural stop and costs, skip the entry.',
      },
      {
        name: 'Cash-session VWAP pullback',
        trigger: 'In an established opening trend, wait for the first clean pullback to VWAP, a defended swing, and a break back in trend direction.',
        invalidation: 'Price breaks the defended swing or repeatedly crosses VWAP without direction. Place the stop beyond the defended swing.',
        management: 'Use the prior opening impulse extreme as the first target. Reassess if price stalls there or loses the sequence of trend swings.',
      },
      {
        name: 'Day Two wick rejection',
        trigger: 'On a qualifying U.S. stock, wait for a wick into a marked prior-day level, a close away from it, and a break of the wick candle in the rejection direction.',
        invalidation: 'Price breaks the wick extreme. Place the stop beyond that wick and size the position to the structural distance.',
        management: 'Plan the first target at the next clearly defended price or nearby reported-volume VWAP. Review volume and follow-through there before targeting the opposite edge.',
      },
    ],
    skip: [
      'New entries before 9:45 a.m., repeated moves through the opening range midpoint, or a breakout that has run too far to size against a structural stop.',
      'Day Two ideas on stocks that did not make a significant prior-day move, or stock setups the venue or account cannot trade.',
    ],
  },
  {
    id: 'morning-continuation',
    title: 'Morning Continuation',
    window: '10:30–11:30 a.m. ET',
    overview: 'Manage the opening trade or look for a fresh pullback in an established direction. At 11:30 a.m. ET mandatory downtime begins, with no new positions until the 1:30 p.m. window on regular trading days.',
    assets: [
      'Primary · MNQ and MES, with NQ and ES as full-size alternatives where permitted',
      'Additional watch · MGC and qualifying U.S. Day Two stocks',
    ],
    preparation: [
      'Mark the opening range, last defended swing, session VWAP where volume is reported, and the next clear target level.',
      'Check whether price still holds beyond the morning breakout point. Track existing exposure and remaining risk before considering a fresh entry.',
      'Flag scheduled releases around the window, including any relevant 10:30 a.m. EIA release. Check the actual release date and time.',
    ],
    setups: [
      {
        name: 'Opening impulse pullback',
        trigger: 'Once the opening direction holds, wait for a pullback to a broken level or VWAP, a new defended swing, and a break out of the smaller pullback range in trend direction.',
        invalidation: 'Price breaks the defended swing or settles back inside the old range. Set the stop beyond the pullback swing.',
        management: 'Use the morning high or low as the first objective. Reassess if price fails to reach it before the morning execution window ends.',
      },
      {
        name: 'Day Two hold and retest (Hitchhiker)',
        trigger: 'For a qualifying U.S. stock, wait for price to hold beyond a marked prior-day level, confirm a pullback, then break the new intraday range in the continuation direction.',
        invalidation: 'Price moves back through the broken level or takes out the confirming pullback wick. Place the stop beyond the wick.',
        management: 'Use the next defended level as the first target and reassess volume there. Stop looking for new entries when the window ends.',
      },
    ],
    skip: [
      'The opening trend has failed, the next major level leaves too little target room, or the pullback cannot confirm by 11:30 a.m. ET.',
      'All new entries during mandatory downtime from 11:30 a.m. to 1:30 p.m. ET.',
    ],
  },
  {
    id: 'afternoon-continuation',
    title: 'Afternoon Continuation',
    window: '1:30–3:00 p.m. ET on regular cash trading days',
    overview: 'Resume after mandatory downtime. Compare the morning direction with the midday range and require a fresh trigger. Check Fed events and related news restrictions before using afternoon levels.',
    assets: [
      'Primary · MNQ and MES, with NQ and ES as full-size alternatives where permitted',
      'Additional watch · Qualifying U.S. Day Two stocks. Treat oil and natural gas settlement as timing context for energy contracts.',
    ],
    preparation: [
      'Mark the midday high and low, morning breakout level, and the afternoon room to the session high or low.',
      'Check the actual Fed calendar. Scheduled decision days often have a 2:00 p.m. statement and a 2:30 p.m. press conference, which can impose separate account restrictions.',
      'Check for a U.S. cash early close and the account’s cutoff. Reset size using current equity, remaining drawdown, and existing exposure.',
    ],
    setups: [
      {
        name: 'Midday compression break',
        trigger: 'After 1:30 p.m., wait for a close past a defined midday boundary, a retest that holds, and a new swing in the morning trend direction.',
        invalidation: 'Price closes back in the midday range or breaks the retest swing. Place the stop beyond the swing.',
        management: 'Use the morning extreme if it still lies ahead, or the next clear level. Recheck reward and time to exit before a scheduled release or the close window.',
      },
      {
        name: 'Day Two afternoon backside',
        trigger: 'On a qualifying U.S. stock, confirm that an earlier push failed at prior-day resistance. Wait for the new intraday range floor to break and a retest from below to fail.',
        invalidation: 'Price reclaims the range floor or the failed-push swing. Place the stop above the retest swing that confirmed the break.',
        management: 'Use nearby VWAP if it is below entry on a reported-volume chart, or the next clear support, as the first target. Account for short availability and the account cutoff.',
      },
    ],
    skip: [
      'A Fed or other restricted window, a midday range with repeated failed breaks, or continuing a morning trade thesis after its invalidation.',
      'A shortened cash session that closes before the afternoon window or a venue cutoff that leaves insufficient exit time.',
    ],
  },
  {
    id: 'power-hour',
    title: 'New York Close / Power Hour',
    window: '3:00–4:00 p.m. ET on regular cash trading days',
    overview: 'Watch the final hour before the U.S. cash closing auction. Establish the account’s trade and flatten cutoffs first. Leave time for execution when prices move quickly near the close.',
    assets: [
      'Primary · MNQ and MES, with NQ and ES as full-size alternatives where permitted',
      'Secondary watch · YM or MYM, RTY or M2K, liquid U.S. stocks and ETFs',
    ],
    preparation: [
      'Mark the session extremes, the afternoon consolidation, and cash-session VWAP where volume is reported.',
      'Confirm the official cash close, the venue’s final order time, and the account’s flatten cutoff. An early close may remove the window.',
      'Decide when you will stop opening positions and leave time to cancel unfilled orders and verify exits before your cutoff.',
    ],
    setups: [
      {
        name: 'Closing-range break and hold',
        trigger: 'Wait for a defined range early in the final hour, a close outside it, and a retest that holds with enough time to exit by the account cutoff.',
        invalidation: 'Price closes back inside the range or breaks the retest swing. Place the stop beyond that swing.',
        management: 'Target the next clear level or the day’s extreme when it still lies ahead. Exit by the planned cutoff if price has yet to reach the target.',
      },
      {
        name: 'Failed push at a session extreme',
        trigger: 'Wait for a move through the day’s high or low to close back inside, then for a retest of the level from inside the range to fail.',
        invalidation: 'Price retakes the extreme and holds beyond it. Place the stop beyond the sweep extreme.',
        management: 'Use the nearest interior level as the first target and plan to be flat within the account’s required time. Reassess if the sweep gives way to consolidation.',
      },
    ],
    skip: [
      'The account cutoff is near, auction-related flow makes fills unpredictable, or spreads and depth no longer fit the plan.',
      'A late breakout with no retest or too little time to enter, manage, and exit.',
    ],
  },
];
