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
 const r=sizePosition({...base,instrument:DEFAULT_INSTRUMENTS.find(x=>x.symbol==='USDJPY'),riskFraction:.6});
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
