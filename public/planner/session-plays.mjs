const asia = [
  {
    name: 'Asian range breakout and retest',
    watchFor: 'Mark the range formed ahead of the local cash open. Look for a close outside it and a retest that holds the broken edge after the spread settles.',
    invalidatedBy: 'Price returns inside the range or breaks through the retest swing.',
  },
  {
    name: 'Range sweep and reclaim',
    watchFor: 'Watch for a brief move past an established range high or low, followed by a close back inside and a break of the nearest swing toward the range midpoint.',
    invalidatedBy: 'Price holds outside the range or breaks the sweep extreme again.',
  },
];

const lateAsia = [
  asia[1],
  {
    name: 'Local cash reopening range',
    watchFor: 'Where the cash exchange pauses for lunch, let the market reopen and form a range. Watch for a confirmed break that lines up with the morning structure.',
    invalidatedBy: 'The market is still closed, or price returns inside the reopening range after the break.',
  },
];

const europe = [
  {
    name: 'London break of the Asian range',
    watchFor: 'Mark the completed Asian high and low. Around the European open, look for a close beyond either edge and a retest that holds it as support or resistance.',
    invalidatedBy: 'Price closes back inside the Asian range or breaks the retest swing.',
  },
  {
    name: 'European open sweep and reversal',
    watchFor: 'Look for a move through an Asian extreme or prior-day level, followed by a reclaim and a break of the nearest swing in the opposite direction.',
    invalidatedBy: 'Price holds beyond the swept level or retakes the sweep extreme.',
  },
];

const europeanContinuation = [
  {
    name: 'European trend pullback',
    watchFor: 'After the open establishes a trend, look for a pullback to the last broken range edge and a new swing in the trend direction.',
    invalidatedBy: 'The last higher low or lower high breaks, or price settles back inside the earlier range.',
  },
  {
    name: 'Mid-session consolidation break',
    watchFor: 'Mark a tight range that forms after the first move. Watch for a close through its edge and a retest before the next scheduled release.',
    invalidatedBy: 'The break fails back into the range, or a news restriction begins before confirmation.',
  },
];

const macro = [
  {
    name: 'Post-release break and retest',
    watchFor: 'Check the calendar and account rules first. After the release and any restricted period, wait for spreads to settle and for the first break to hold on a retest.',
    invalidatedBy: 'Price returns through the broken level or execution conditions have yet to normalize.',
  },
  {
    name: 'Post-release reversal',
    watchFor: 'If the initial move stalls beyond a pre-release high or low, look for a reclaim of the level followed by a break of the nearest swing in the other direction.',
    invalidatedBy: 'Price returns past the news spike extreme, or a new restricted period starts.',
  },
];

const openingBreakout = {
  name: 'Opening-range breakout and retest',
  watchFor: 'Mark a completed opening range using a fixed interval, such as 15 minutes. Look for a close outside the range and a retest that holds its edge during the entry phase.',
  invalidatedBy: 'Price closes back inside the opening range or breaks the retest swing.',
};

const vwap = {
  name: 'Session VWAP pullback',
  watchFor: 'On a stock or futures chart with reported volume, use VWAP anchored at the cash open. Look for a trend, a pullback to VWAP and a confirming swing back in the trend direction.',
  invalidatedBy: 'The pullback breaks the prior trend swing or price repeatedly crosses VWAP without establishing direction.',
};

const opening = [openingBreakout, vwap];

const afternoon = [
  {
    name: 'Afternoon trend pullback',
    watchFor: 'Check whether the morning trend still holds. Look for the first clean pullback to the morning breakout level or session VWAP, followed by a new swing in the trend direction.',
    invalidatedBy: 'Price breaks the last trend swing or remains in the midday range without confirming a direction.',
  },
  {
    name: 'Midday range break',
    watchFor: 'Mark the midday high and low. Once the entry window opens, watch for a close beyond an edge and a retest that holds. Check for scheduled afternoon releases.',
    invalidatedBy: 'Price closes back inside the range after the break, or the retest falls in a restricted news window.',
  },
];

const energy = [
  {
    name: 'Inventory release range break',
    watchFor: 'Check the EIA release time for the contract. Once any account restriction ends and spreads settle, mark the post-release range and watch for a break and retest.',
    invalidatedBy: 'Price returns through the broken range edge or the contract is too close to the account’s exit cutoff.',
  },
  {
    name: 'Energy session pullback',
    watchFor: 'Look for a defined intraday trend and a pullback that holds the prior breakout level. Check settlement timing before considering a new position.',
    invalidatedBy: 'The prior trend swing breaks or settlement timing leaves too little time for the planned exit.',
  },
];

const closing = [
  {
    name: 'Closing-range breakout',
    watchFor: 'Mark the range at the start of the final hour. Watch for a hold beyond the range or session extreme, with enough time to exit by the account cutoff.',
    invalidatedBy: 'Price returns into the range, or the market or account cutoff leaves too little time for the planned exit.',
  },
  {
    name: 'Failed late-session breakout',
    watchFor: 'If a push beyond the day’s high or low fails, watch for a return into the day’s range and a failed retest of the extreme from inside the range.',
    invalidatedBy: 'Price breaks the extreme again and holds outside the range.',
  },
];

const crypto = [
  {
    name: 'Venue range break and retest',
    watchFor: 'Define a range using the same time zone and venue as the chart you trade. Look for a close beyond the range, a retest and a spread within your plan.',
    invalidatedBy: 'Price returns inside the range or the venue spread and depth no longer support the planned order.',
  },
  {
    name: 'Prior-day high or low reclaim',
    watchFor: 'Use a consistent day boundary, such as midnight UTC. Watch for a sweep of the prior-day high or low followed by a return inside and a confirming swing.',
    invalidatedBy: 'Price retakes the sweep extreme or forms a new range beyond it.',
  },
];

const morningContinuation = [
  vwap,
  {
    name: 'Morning trend continuation',
    watchFor: 'After a confirmed opening move, look for a pullback that holds the prior swing and a break of the smaller pullback range. Check the 11:30 a.m. ET cutoff.',
    invalidatedBy: 'Price breaks through the prior swing or the morning entry window closes.',
  },
];

const playsById = new Map([
  ['asian-kill-zone', asia],
  ['asian-expansion', asia],
  ['late-asia', lateAsia],
  ['sydney', asia],
  ['tokyo', asia],
  ['asx', asia],
  ['tse-am', asia],
  ['hkex-am', asia],
  ['sse-am', asia],
  ['tse-pm', lateAsia],
  ['hkex-pm', lateAsia],
  ['sse-pm', lateAsia],
  ['london-kill-zone', europe],
  ['european-open', europe],
  ['london', europe],
  ['xetra', europe],
  ['lse', europe],
  ['european-continuation', europeanContinuation],
  ['ny-macro', macro],
  ['macro-premarket', macro],
  ['new-york', macro],
  ['cme-metals', macro],
  ['ny-equity-window', opening],
  ['cash-open-overlap', opening],
  ['us-equities', opening],
  ['cme-equity', opening],
  ['Confirmed entries and retests', opening],
  ['Continuation and position management', morningContinuation],
  ['afternoon-continuation', afternoon],
  ['afternoon-energy', [...afternoon, energy[0]]],
  ['cme-energy', energy],
  ['ny-close', closing],
  ['power-hour', closing],
  ['crypto-spot', crypto],
]);

export function getSessionPlays(id) {
  return playsById.get(id) ?? [];
}

export const PLAY_SOURCES = [
  { label: 'CME Group · Support and resistance', url: 'https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance' },
  { label: 'IG Academy · Identifying breakouts', url: 'https://www.ig.com/uk/learn-to-trade/ig-academy/breakout-trading/identifying-breakouts' },
  { label: 'IG Academy · Tokyo session', url: 'https://www.ig.com/en-ch/learn-to-trade/ig-academy/a-look-at-forex-trading-strategies/trading-the-tokyo-session' },
  { label: 'IG Academy · London session', url: 'https://www.ig.com/au/ig-academy/a-look-at-forex-trading-strategies/trading-the-london-session' },
  { label: 'OANDA · U.S. opening-range breakout', url: 'https://ftmo.oanda.com/blog/opening-range-breakout-strategy-how-to-master-the-1530-us-session/' },
  { label: 'Charles Schwab · VWAP and volume-weighted indicators', url: 'https://www.schwab.com/learn/story/how-to-use-volume-weighted-indicators-trading' },
  { label: 'U.S. Bureau of Labor Statistics · Release schedule', url: 'https://www.bls.gov/schedule/' },
  { label: 'Federal Reserve · FOMC calendar', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' },
  { label: 'U.S. Energy Information Administration · Petroleum release schedule', url: 'https://www.eia.gov/petroleum/supply/weekly/schedule.php' },
  { label: 'U.S. Energy Information Administration · Natural gas release schedule', url: 'https://ir.eia.gov/ngs/schedule.html' },
];
