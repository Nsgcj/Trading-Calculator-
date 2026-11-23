import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACCOUNTS, DEFAULT_INSTRUMENTS, MODES, sizePosition, roundQuantityDown } from '../public/engine.mjs';
const account={...DEFAULT_ACCOUNTS[0], verified:true};
const instrument={...DEFAULT_INSTRUMENTS[0], verified:true};
const base={account,instrument,side:'long',entry:25000,stopMode:'price',stopInput:24970,rr:5,slippageTicks:0,spreadTicks:0,feePerUnit:0,stressExtraTicks:2};
test('vest illustrative $10 headroom / 60% / 30 point stop = 0.20 units',()=>{
  const r=sizePosition({...base,riskFraction:MODES.lottery.fraction});
  assert.equal(r.status,'CALCULATED');
  assert.equal(r.quantity,0.2);assert.equal(r.risk,6);assert.equal(r.expectedReward,30);
});
test('slippage reduces quantity, never exceed budget',()=>{
 const r=sizePosition({...base,riskFraction:.60,slippageTicks:2});
 assert.equal(r.quantity,.19);assert.ok(r.risk<=r.budget);assert.ok(r.risk>5.7);
});
test('price stop rounds outward to tick, not inward',()=>{
 const r=sizePosition({...base,stopInput:24970.14,riskFraction:.6});
 assert.equal(r.stop,24970);assert.equal(r.stopDistance,30);
});
test('short trade requires stop higher than entry',()=>{
 const r=sizePosition({...base,side:'short',stopInput:25020,riskFraction:.6});
 assert.equal(r.stop,25020);assert.equal(r.target,24900);
});
test('wrong-sided stop blocked',()=>{
 const r=sizePosition({...base,stopInput:25010,riskFraction:.6}); assert.equal(r.status,'BLOCKED');
});
test('MFF MNQ 10-point stop, normal 5% of $1000 = 2 micros',()=>{
 const r=sizePosition({...base,account:{...DEFAULT_ACCOUNTS[1],verified:true},instrument:DEFAULT_INSTRUMENTS.find(x=>x.symbol==='MNQ'),entry:24000,stopInput:23990,rr:3,riskFraction:.05});
 assert.equal(r.quantity,2);assert.equal(r.risk,40);assert.equal(r.target,24030);
});
test('not enough budget to trade 1 micro contract -> blocked',()=>{
 const r=sizePosition({...base,account:{...DEFAULT_ACCOUNTS[1],verified:true},instrument:DEFAULT_INSTRUMENTS.find(x=>x.symbol==='MNQ'),entry:24000,stopInput:23990,riskFraction:.01});
 assert.equal(r.status,'BLOCKED');
});
test('manual USDJPY quote-to-USD rate required',()=>{
 const r=sizePosition({...base,account:DEFAULT_ACCOUNTS[2],instrument:DEFAULT_INSTRUMENTS.find(x=>x.symbol==='USDJPY'),riskFraction:.6});
 assert.equal(r.status,'BLOCKED');
});
test('EURUSD pip distance converts into USD risk',()=>{
 const r=sizePosition({...base,account:{...DEFAULT_ACCOUNTS[2],verified:true},instrument:{...DEFAULT_INSTRUMENTS.find(x=>x.symbol==='EURUSD'),verified:true},entry:1.1,stopMode:'pips',stopInput:20,riskFraction:.6,rr:2});
 assert.equal(r.status,'CALCULATED');assert.equal(r.stop,1.098);assert.equal(r.quantity,.3);assert.ok(Math.abs(r.risk-60)<.00001);
});
test('safety reserve, daily cap, and max quantity constrain size',()=>{
 const r=sizePosition({...base,account:{...account,reserve:5,dailyRemaining:1,maxQuantity:.02},riskFraction:.6});
 assert.equal(r.quantity,.02);assert.equal(r.risk,.6);
});
test('floor reached -> no trade',()=>{
 const r=sizePosition({...base,account:{...account,equity:490},riskFraction:.6});assert.equal(r.status,'BLOCKED');
});
test('no rounding up quantity',()=>{
 assert.equal(roundQuantityDown(.1999,.01),.19);
 assert.equal(roundQuantityDown(2.9,1),2);
});
test('negative/zero stop is blocked',()=>{
 const r=sizePosition({...base,stopMode:'points',stopInput:30000,riskFraction:.6});
 assert.equal(r.status,'BLOCKED');
});
test('unverified account or contract cannot be marked calculated',()=>{
 const r=sizePosition({...base,account:DEFAULT_ACCOUNTS[0],riskFraction:.6});
 assert.equal(r.status,'VERIFY');
});

const budgetStop = {
  ...base,
  stopMode: 'budget',
  stopInput: undefined,
  plannedQuantity: 0.13,
  riskFraction: MODES.lottery.fraction,
  slippageTicks: 2,
  spreadTicks: 1,
  feePerUnit: 0.10,
  rr: 2,
};

test('budget stop keeps the entered size and accounts for costs on longs and shorts', () => {
  for (const [side, stop] of [['long', 24954.75], ['short', 25045.25]]) {
    const result = sizePosition({ ...budgetStop, side });
    assert.equal(result.status, 'CALCULATED');
    assert.equal(result.quantity, budgetStop.plannedQuantity);
    assert.equal(result.stop, stop);
    assert.ok(result.risk <= result.budget);
    assert.ok(result.risk + result.quantity * instrument.tickSize > result.budget);
  }
});

test('budget stop uses the selected drawdown mode and daily cap', () => {
  const normal = sizePosition({ ...budgetStop, riskFraction: MODES.normal.fraction });
  const lottery = sizePosition(budgetStop);
  const capped = sizePosition({ ...budgetStop, account: { ...account, dailyRemaining: 0.5 } });
  assert.equal(normal.status, 'CALCULATED');
  assert.equal(normal.budget, 0.5);
  assert.ok(normal.stop > lottery.stop);
  assert.equal(capped.status, 'CALCULATED');
  assert.equal(capped.budget, normal.budget);
  assert.equal(capped.stop, normal.stop);
});

test('budget stop blocks missing, off-step, below-minimum and over-cap quantities', () => {
  for (const plannedQuantity of [undefined, 0.005, 0.133, 0.14]) {
    const result = sizePosition({
      ...budgetStop,
      account: { ...account, maxQuantity: 0.13 },
      plannedQuantity,
    });
    assert.equal(result.status, 'BLOCKED', `quantity ${plannedQuantity}`);
  }
});

test('budget stop blocks when the next tick and costs exceed the budget', () => {
  const result = sizePosition({
    ...budgetStop,
    account: { ...account, dailyRemaining: 0.14 },
  });
  assert.equal(result.status, 'BLOCKED');
});

test('budget take profit covers costs and meets the net drawdown-derived goal', () => {
  for (const [side, target] of [['long', 25093.25], ['short', 24906.75]]) {
    const result = sizePosition({ ...budgetStop, targetMode: 'budget', side });
    assert.equal(result.status, 'CALCULATED');
    assert.equal(result.target, target);
    const goal = result.budget * budgetStop.rr;
    assert.ok(result.expectedReward >= goal);
    assert.ok(result.expectedReward - result.quantity * instrument.tickSize < goal);
  }
});

test('automatic take profit can use a manual stop and scales with the drawdown budget', () => {
  const setup = { ...base, targetMode: 'budget', plannedQuantity: undefined, rr: 2 };
  const full = sizePosition({ ...setup, riskFraction: MODES.lottery.fraction });
  const capped = sizePosition({
    ...setup,
    riskFraction: MODES.lottery.fraction,
    account: { ...account, dailyRemaining: 0.5 },
  });
  assert.equal(full.status, 'CALCULATED');
  assert.equal(capped.status, 'CALCULATED');
  assert.equal(full.stop, base.stopInput);
  assert.equal(capped.stop, base.stopInput);
  assert.ok(full.expectedReward >= 12);
  assert.ok(capped.expectedReward >= 1 && capped.expectedReward < full.expectedReward);
});

test('short budget take profit blocks a target that would require a nonpositive price', () => {
  const result = sizePosition({
    ...budgetStop,
    targetMode: 'budget',
    side: 'short',
    entry: 10,
  });
  assert.equal(result.status, 'BLOCKED');
});

test('missing account balances and failure floors block sizing', () => {
  for (const field of ['equity', 'floor']) {
    const incompleteAccount = { ...account, [field]: null };
    assert.equal(sizePosition({ ...base, account: incompleteAccount, riskFraction: 0.6 }).status, 'BLOCKED');
  }
});

test('rounds down quantities with scientific-notation increments', () => {
  assert.equal(roundQuantityDown(4.29e-7, 1e-8), 4.2e-7);
});

const assumedMove = {
  ...base,
  stopMode: 'none',
  stopInput: undefined,
  assumedMovePercent: 1,
  riskFraction: MODES.lottery.fraction,
};

test('with both exits off, sizes from an outward-rounded adverse move without returning exit levels', () => {
  const entry = 25010.12;
  for (const [side, modeledDistance] of [['long', 250.12], ['short', 250.13]]) {
    const result = sizePosition({ ...assumedMove, entry, side, targetMode: 'none', rr: undefined });
    assert.notEqual(result.status, 'BLOCKED');
    assert.equal(result.quantity, 0.02);
    assert.ok(Math.abs(result.risk - result.quantity * modeledDistance) < 1e-9);
    assert.ok(result.stop == null);
    assert.ok(result.target == null);
    assert.ok(result.expectedReward == null);
  }
});

test('budget take profit can be calculated independently with the stop off', () => {
  const result = sizePosition({ ...assumedMove, targetMode: 'budget', rr: 2 });
  assert.notEqual(result.status, 'BLOCKED');
  assert.ok(result.stop == null);
  assert.equal(result.quantity, 0.02);
  assert.equal(result.target, 25600);
  assert.equal(result.expectedReward, 12);
});

test('take profit can be turned off while retaining a manual stop', () => {
  const result = sizePosition({
    ...base,
    targetMode: 'none',
    rr: undefined,
    riskFraction: MODES.lottery.fraction,
  });
  assert.equal(result.status, 'CALCULATED');
  assert.equal(result.stop, base.stopInput);
  assert.equal(result.quantity, 0.2);
  assert.ok(result.target == null);
  assert.ok(result.expectedReward == null);
});

test('invalid adverse move assumptions block sizing without a stop', () => {
  for (const assumedMovePercent of [undefined, 0, -1, Infinity]) {
    const result = sizePosition({
      ...assumedMove,
      assumedMovePercent,
      targetMode: 'none',
      rr: undefined,
    });
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.quantity == null);
  }
});

test('blocks sizing with a contract from another account platform', () => {
  const result = sizePosition({ ...base, account: DEFAULT_ACCOUNTS[1], riskFraction: 0.6 });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.errors[0], /selected account platform/);
});

test('round-trip cost components are charged per unit', () => {
  const result = sizePosition({...base, riskFraction: 0.6, slippageTicks: 2, spreadTicks: 1, feePerUnit: 1});
  assert.equal(result.status, 'CALCULATED');
  assert.ok(Math.abs(result.roundTripCosts - result.quantity * 1.75) < 1e-12);
});

test('venue minimum order value is checked in the quote currency', () => {
  const result = sizePosition({...base, riskFraction: 0.6, instrument: {...instrument, quoteToUSD: 2, minNotionalQuote: 3000}});
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.errors[0], /below the entered venue minimum/);
});

test('tick alignment cannot legitimize a wrong-sided stop input', () => {
  const result = sizePosition({...base, riskFraction: 0.6, entry: 25000.10, stopInput: 25000.15});
  assert.equal(result.status, 'BLOCKED');
});

test('funded templates require their own account equity and failure floor', () => {
  const funded = DEFAULT_ACCOUNTS.filter(profile => profile.id !== 'vest' && ['sim-funded', 'live-funded'].includes(profile.stage));
  assert.ok(funded.some(profile => profile.stage === 'sim-funded'));
  assert.ok(funded.some(profile => profile.stage === 'live-funded'));
  for (const profile of funded) {
    assert.equal(profile.verified, false);
    const contract = DEFAULT_INSTRUMENTS.find(spec => spec.platform === profile.platform);
    assert.ok(contract, profile.name);
    const result = sizePosition({...base, account: profile, instrument: contract, riskFraction: 0.05});
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.errors[0], /account equity, failure floor/);
  }
});
