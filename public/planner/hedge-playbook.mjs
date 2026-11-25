export const EQUITY_HEDGE_PLAYBOOK = {
  id: 'equity-hedge',
  title: 'Equity Open Hedge',
  window: 'Prepare from 9:15 a.m. ET. The cash market opens at 9:30 a.m. ET. Under the Chicken Man plan, consider a new hedge from 9:45 to 11:30 a.m. ET only when the active window and account rules permit it.',
  overview: 'A partial hedge offsets some of an existing position’s market exposure for a defined period. For a long equity book, that can mean shorting a closely matched index future. A futures short without corresponding equity exposure adds directional risk. A hedge offsets some of the upside as well as the downside.',
  assets: [
    'Broad U.S. equity exposure, such as an S&P 500 portfolio or SPY. ES is $50 per index point and MES is $5. A 0.25-point tick is $12.50 for ES and $1.25 for MES.',
    'Nasdaq-100 exposure, such as QQQ or a portfolio that tracks the index closely. NQ is $20 per index point and MNQ is $2. A 0.25-point tick is $5 for NQ and $0.50 for MNQ.',
    'Single stocks or concentrated sector positions can diverge from both indexes. Earnings, a halt or company news can dominate the index move.',
  ],
  preparation: [
    'Record the current value and direction of the existing positions. Select the benchmark that best tracks those holdings and estimate their beta to that benchmark. Beta measures sensitivity to the chosen index and can change when market conditions shift.',
    'Decide how much exposure to offset and when to end the hedge. For a long book with positive beta, rough hedge notional = equity value × beta × fraction to offset. Futures notional per contract = current futures price × contract multiplier. Round down to whole contracts to stay within the planned offset.',
    'Example using hypothetical prices. A $120,000 long portfolio with an S&P 500 beta of 1.0 and a 35% hedge target implies $42,000 of offset. At 6,000, one MES represents $30,000, so rounding down gives one short MES, or about 25% of the estimated index exposure. A 100-point rise in MES would cost the short $500 before fees. The equity holdings may move by a different amount.',
    'Check permissions to trade and short the contract, available margin, existing futures exposure, account position caps, drawdown limits and any news, hedging or cross-account restrictions. These apply independently of the hedge ratio. A separate account may receive no risk offset or margin credit for your equity holdings.',
    'Check the contract expiry, bid and ask, depth and scheduled releases. The futures price can differ from its cash index, and that difference can change. The cash opening gap may already have occurred before a new hedge can be placed.',
  ],
  setups: [
    {
      name: 'Partial broad-market hedge with ES or MES',
      trigger: 'You already hold positively correlated long equity exposure, the opening review calls for less broad-market exposure, and the cash index and futures are tracking closely enough for your plan. Use a permitted entry window and a whole-contract size within the offset and account limits.',
      invalidation: 'The underlying position is reduced or closed, the futures and holdings diverge materially, or even one contract would overhedge the planned amount.',
      management: 'Set an exit time before opening the hedge. For a morning-only hedge, use 11:30 a.m. ET or an earlier account cutoff. Recalculate the hedge after any stock sales and reduce or close it if the underlying exposure shrinks.',
    },
    {
      name: 'Partial Nasdaq-100 hedge with NQ or MNQ',
      trigger: 'Your holdings track the Nasdaq-100 closely enough to justify the selected beta, and live pricing still supports the match after the opening observation period. Choose a size that leaves the desired residual exposure.',
      invalidation: 'A single stock or sector catalyst dominates the book, tracking breaks down, or a futures move against the hedge would exceed the trading account’s risk budget.',
      management: 'Track the hedge and holdings together while monitoring drawdown and margin in each account independently. If both broad and Nasdaq hedges are considered, account for their overlapping exposure before placing either.',
    },
    {
      name: 'Trim the underlying equity position',
      trigger: 'Even the smallest futures contract exceeds the intended offset, the index is a poor fit, or trading rules or liquidity prevent a futures hedge. If permitted, reduce the existing holdings directly to lower exposure.',
      invalidation: 'A halt, poor liquidity or an account restriction prevents the planned reduction. Review the execution plan before placing an order.',
      management: 'Reassess exposure after fills. If the hedge was already open, reduce it as needed so the equity sale does not leave an unintended futures position.',
    },
  ],
  skip: [
    'Skip a new futures hedge if there is no existing exposure to offset or no defensible benchmark for the position.',
    'The Chicken Man preparation and observation stages and mandatory downtime allow no new hedge. Manage or reduce existing exposure only where the plan and account allow it.',
    'Skip when the smallest contract exceeds the planned offset, spread or depth is outside your plan, or remaining margin, drawdown or position-cap room is insufficient.',
    'Skip when permissions, holiday hours, news restrictions or the exit cutoff are unclear. A gap or thin market can cause fills beyond a planned stop.',
  ],
  sources: [
    { label: 'CME Group · Equity portfolio hedging and beta', url: 'https://www.cmegroup.com/education/whitepapers/hedging-with-e-mini-sp-500-future' },
    { label: 'CME Group · Futures notional and tick values', url: 'https://www.cmegroup.com/education/courses/introduction-to-equity-index-products/discover-equity-index-notional-value-and-price' },
    { label: 'CME Group · Micro E-mini specifications', url: 'https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html' },
    { label: 'CME Group · Equity index basis', url: 'https://www.cmegroup.com/education/courses/introduction-to-equity-index-products/what-is-equity-index-basis' },
    { label: 'NYSE · Core trading hours', url: 'https://www.nyse.com/trade/hours-calendars' },
  ],
};
