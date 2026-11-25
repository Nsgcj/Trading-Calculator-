export const MARKET_MEMORY_PLAYBOOKS = [
  {
    id: 'daily',
    label: 'Daily',
    description: 'The original day-two setup for U.S. stocks uses a significant move from the prior trading day.',
    steps: [
      {
        title: 'Find a day-two candidate',
        body: 'Look for a large prior-day move, ideally with a catalyst such as earnings, news, or a clear break or failure at a key range.',
      },
      {
        title: 'Keep the map to at most four prices',
        body: 'Draw the prior day’s high and low. Add up to two clear intraday levels that held for the rest of the session or held on a later test.',
      },
      {
        title: 'Wait at a meaningful level',
        body: 'Avoid the middle of the range. Avoid buying into the prior high or selling into the prior low before price shows a sustained move beyond it.',
      },
      {
        title: 'Confirm rejection or continuation',
        body: 'For a rejection, wait for a wick, a close away from the level, then a break in that direction. Place the stop beyond the wick. For continuation, wait for price to hold outside the range, then look for a confirmed retest.',
      },
      {
        title: 'Plan the first target',
        body: 'Identify the next clear level or nearby session VWAP on a chart with reported volume. Reassess the move there before looking to the opposite edge of the range.',
      },
    ],
  },
  {
    id: 'weekly',
    label: 'Weekly',
    description: 'Use the last completed week for context and target room. This adapts the day-two framework to a longer lookback.',
    steps: [
      {
        title: 'Map the prior week',
        body: 'Mark the prior week’s high, low and one or two clearly defended prices. Note any catalyst or major range break that shaped the week.',
      },
      {
        title: 'Check your room on the daily chart',
        body: 'Locate price relative to those levels. A nearby weekly high or low may leave little room for a session setup. Skip a trade in the middle when structure is unclear.',
      },
      {
        title: 'Wait for session confirmation',
        body: 'Use a confirmed rejection or a hold and retest beyond the level during your selected execution window. Size from the actual setup’s stop and use the next clear level to assess the target.',
      },
    ],
  },
  {
    id: 'monthly',
    label: 'Monthly',
    description: 'This longer-lookback adaptation uses the last completed month to map larger boundaries. Intraday entries still follow the selected execution window.',
    steps: [
      {
        title: 'Map the prior month',
        body: 'Mark the prior month’s high, low and any clearly defended level. Give those prices priority when reviewing weekly and daily charts.',
      },
      {
        title: 'Check acceptance and target room',
        body: 'When price approaches a monthly boundary, look for a confirmed hold outside it before treating the move as continuation. Check the room to the next clear level.',
      },
      {
        title: 'Use the intraday setup for risk',
        body: 'Wait for session confirmation and use the setup’s own invalidation price. The monthly map provides context and potential targets.',
      },
    ],
  },
  {
    id: 'session',
    label: 'Session',
    description: 'For Day Two stocks, start with the previous U.S. cash session. For a session-to-session review, use the same venue and chart hours when marking the last completed range.',
    steps: [
      {
        title: 'Prepare before the open',
        body: 'Mark the prior high, low and defended prices. Check the current rotation window and your account’s news restrictions before looking for entries.',
      },
      {
        title: 'Let the open establish structure',
        body: 'In the New York plan, look for a confirmed wick rejection from 9:45 a.m. ET. During the 10:30–11:30 a.m. continuation window, look for a hold beyond the level and a confirmed retest.',
      },
      {
        title: 'Use nearby targets',
        body: 'Mark VWAP or the next clear level and watch price and volume there. Around 10–10:30 a.m. ET, add defended intraday levels if a clear range has formed.',
      },
      {
        title: 'Confirm the later failed push',
        body: 'The New York afternoon window begins at 1:30 p.m. ET on regular trading days. If an earlier push failed at prior-day resistance, wait for a break below the new intraday range. During mandatory downtime, manage existing positions.',
      },
    ],
  },
];
