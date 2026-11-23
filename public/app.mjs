import {MODES,DEFAULT_ACCOUNTS,DEFAULT_INSTRUMENTS,sizePosition,getHeadroom,getRiskBudget,usd,fmt} from './engine.mjs';
const STORAGE_KEY='chicken-man-riskdesk-v1';
const $=id=>document.getElementById(id);
const clone=o=>structuredClone(o);
const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inputNumber=id=>$(id).value.trim()===''?NaN:Number($(id).value);
const optionalNumber=id=>$(id).value.trim()===''?null:Number($(id).value);
const pct=v=>Number((100*v).toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
let state=(()=>{
 try {const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved&&Array.isArray(saved.accounts)&&saved.accounts.length&&Array.isArray(saved.instruments)&&saved.instruments.length&&saved.modeFractions)return saved;}catch{}
 return { accounts:clone(DEFAULT_ACCOUNTS), instruments:clone(DEFAULT_INSTRUMENTS), accountId:'vest', instrumentId:'vest-nq', mode:'normal', modeFractions:{safe:.02,normal:.05,lottery:.60}, side:'long' };
})();
let currentResult=null,lastStopMode='price';
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
function selectedAccount(){return state.accounts.find(a=>a.id===state.accountId)||state.accounts[0];}
function selectedInstrument(){return state.instruments.find(s=>s.id===state.instrumentId)||state.instruments[0];}
function getApplicable(){return state.instruments.filter(s=>s.platform===selectedAccount().platform);}
function fillAccounts(){
 $('accountSelect').replaceChildren(...state.accounts.map(a=>new Option(a.name,a.id)));
 if(!state.accounts.some(a=>a.id===state.accountId))state.accountId=state.accounts[0].id;
 $('accountSelect').value=state.accountId;
}
function fillInstruments(chooseDefault=false){
 const available=getApplicable();
 if(chooseDefault || !available.some(s=>s.id===state.instrumentId))state.instrumentId=available[0]?.id||state.instruments[0].id;
 $('instrumentSelect').replaceChildren(...available.map(s=>new Option(`${s.symbol}   ·   ${s.name}`,s.id)));
 $('instrumentSelect').value=state.instrumentId;
}
function syncAccountFields(){
 const a=selectedAccount();
 for(const k of ['equity','floor','reserve','dailyRemaining','maxQuantity'])$(k).value=a[k]??'';
 $('accountVerified').checked=Boolean(a.verified);
 $('accountNote').textContent=a.platform==='vest'?'Vest contract multipliers and account floor MUST be verified with Vest; $500/$490 is an illustration.':a.platform==='futures'?'MFF account limits, drawdown type, trailing behavior and position caps vary by program. Update the current failure floor manually.':'This account is a demo profile. Set the broker-specific drawdown and daily restrictions.';
}
function syncSpecFields(){
 const s=selectedInstrument();
 const pairs={tickSize:s.tickSize,pointValue:s.pointValueQuote,conversion:s.quoteToUSD,pipSize:s.pipSize,qtyStep:s.quantityStep,minQty:s.minQuantity};
 for(const [id,v] of Object.entries(pairs))$(id).value=v??'';
 $('specVerified').checked=Boolean(s.verified);
 $('specSource').textContent=`${s.source||'Custom broker specification'} · Native order size: ${s.unit} · ${s.symbol}. Price feed is NOT live.`;
 const refPrice={'NQ':25000,'ES':6000,'GC':4000,'CL':80,'EURUSD':1.1,'USDJPY':150,'BTC':90000,'STOCK':100,'OTHER':100};
 const price=refPrice[s.reference]??100;
 $('entry').value=price;
 const dist={'NQ':30,'ES':10,'GC':10,'CL':1,'EURUSD':.002,'USDJPY':.2,'BTC':500,'STOCK':2,'OTHER':2}[s.reference]??2;
 $('stopInput').value=Number((price-dist).toPrecision(11));
 $('stopMode').value='price';lastStopMode='price';setStopLabel();
}
function setStopLabel(){
 const mode=$('stopMode').value;
 $('stopLabel').textContent=({price:'Structural stop price',points:'Stop distance (price points)',ticks:'Stop distance (ticks)',pips:'Stop distance (pips)'})[mode];
}
function setMode(mode){
 state.mode=mode;
 for(const key of Object.keys(MODES)){
  const b=$('mode-'+key);b.classList.toggle('active',key===mode);b.setAttribute('aria-pressed',String(key===mode));
 }
 $('lotteryNotice').hidden=mode!=='lottery';
 $('riskPercent').value=Number((state.modeFractions[mode]*100).toFixed(4));
 for(const key of Object.keys(MODES))$(key+'Percent').textContent=pct(state.modeFractions[key]);
 save();refresh();
}
function params(fraction=state.modeFractions[state.mode]){
 return {account:selectedAccount(),instrument:selectedInstrument(),side:state.side,entry:inputNumber('entry'),stopMode:$('stopMode').value,stopInput:inputNumber('stopInput'),rr:inputNumber('rr'),slippageTicks:inputNumber('slippageTicks'),spreadTicks:inputNumber('spreadTicks'),feePerUnit:inputNumber('feePerUnit'),stressExtraTicks:inputNumber('stressTicks'),riskFraction:fraction};
}
function renderSummary(r){
 const a=selectedAccount(),h=getHeadroom(a);
 $('kEquity').textContent=usd(Number(a.equity));$('kRoom').textContent=h?usd(h.raw):'—';
 $('kBudget').textContent=r?.budget===undefined?'—':usd(r.budget);
 $('kBuffer').textContent=r?.risk===undefined?'—':usd(r.reservePostStop);
 $('floorText').textContent=h?`${usd(h.usable)} usable`:'—';
 $('floorFill').style.width=h&&h.raw>0?`${Math.min(100,Math.max(0,(r?.budget??0)/h.raw*100))}%`:'0%';
}
function renderTicket(r){
 const good=r&&r.status!=='BLOCKED'&&Number.isFinite(r.quantity),s=selectedInstrument();
 $('statusChip').className='state-chip '+(r?.status==='CALCULATED'?'calculated':r?.status==='BLOCKED'?'blocked':'');
 $('statusChip').textContent=r?.status??'PENDING';
 $('quantity').textContent=good?fmt(r.quantity,6):'NO TRADE';
 $('quantityUnit').textContent=s.unit;
 $('quantityHint').textContent=good?`${s.symbol} · ${state.side.toUpperCase()} · estimated maximum native quantity`:'Risk budget, platform minimum or setup validation prevents sizing.';
 $('actualRisk').textContent=good?'−'+usd(r.risk):'—';
 $('targetProfit').textContent=good?usd(r.expectedReward):'—';
 $('effectiveRR').textContent=good?`1 : ${fmt(r.rrNet,2)}`:'—';
 $('levels').textContent=good?`${fmt(r.stop,6)} / ${fmt(r.target,6)}`:'—';
 $('stopWidth').textContent=good?`${fmt(r.stopDistance,6)} pts · ${fmt(r.stopTicks,2)} ticks`:'—';
 $('stressRisk').textContent=good?'−'+usd(r.stressRisk):'—';
 $('statusMessage').className='status-message '+(r?.status==='BLOCKED'?'blocked':r?.status==='CALCULATED'?'verified':'');
 $('statusMessage').textContent=r?.status==='BLOCKED'?'BLOCKED — '+(r.errors[0]||'One or more hard risk checks failed.') :r?.status==='VERIFY'?'VERIFY BEFORE USE — numbers are illustrative; validate both the account rules and instrument specification.':'SIZED — values include entered execution costs. This is not broker permission to execute.';
 $('warningList').replaceChildren(...(r?.warnings||[]).map(message=>{const el=document.createElement('div');el.className='warning-item';el.textContent=message;return el;}));
 if(r?.errors?.length>1)for(const message of r.errors.slice(1)){const el=document.createElement('div');el.className='warning-item';el.textContent=message;$('warningList').append(el);}
 $('copyBtn').disabled=r?.status!=='CALCULATED';
}
function renderModes(){
 const body=$('modeTable');body.replaceChildren();
 for(const mode of Object.keys(MODES)){
  const fraction=state.modeFractions[mode],r=sizePosition(params(fraction));
  const tr=document.createElement('tr');if(mode===state.mode)tr.className='row-highlight';
  tr.innerHTML=`<td>${escapeHTML(MODES[mode].label)}</td><td>${escapeHTML(usd(r.budget))}</td><td>${escapeHTML(r.quantity===undefined?'—':fmt(r.quantity,6))}</td><td>${escapeHTML(r.risk===undefined?'—':'−'+usd(r.risk))}</td><td class="${r.status==='BLOCKED'?'bad-text':'good-text'}">${escapeHTML(r.status==='BLOCKED'?'NO SIZE':r.status==='VERIFY'?'VERIFY':'SIZED')}</td>`;
  body.append(tr);
 }
}
function renderUnits(r){
 const s=selectedInstrument(),point=s.pointValueQuote*s.quoteToUSD,tick=point*s.tickSize;
 $('unitPoint').textContent=point>0?`${usd(point)} / 1.0 point`:'NEEDS SPEC';
 $('unitTick').textContent=tick>0?`${usd(tick)} per tick of ${fmt(s.tickSize,6)} · 1 ${s.unit==='lots'?'lot':s.unit==='contracts'?'contract':'unit'}`:'Missing broker multiplier or FX conversion.';
 const items=[['Order unit',s.unit],['Minimum order',fmt(s.minQuantity,6)+' '+s.unit],['Increment',fmt(s.quantityStep,6)+' '+s.unit]];
 if(s.pipSize)items.push(['Pip value / 1 unit',point>0?usd(point*s.pipSize):'Add quote→USD conversion']);
 if(r?.quantity)items.push(['Modeled exposure per point',usd(r.quantity*point)]);
 const sibling=state.instruments.filter(o=>o.id!==s.id&&o.reference===s.reference&&o.pointValueQuote*o.quoteToUSD>0).slice(0,2);
 for(const other of sibling){
  const eq=r?.quantity?r.quantity*point/(other.pointValueQuote*other.quoteToUSD):0;
  items.push([`P&L equivalent in ${other.symbol}`,r?.quantity?`${fmt(eq,5)} ${other.unit}*`:'—']);
 }
 $('unitBridge').replaceChildren(...items.map(([k,v])=>{const el=document.createElement('div');el.className='unit-item';const label=document.createElement('span');label.textContent=k;const strong=document.createElement('b');strong.textContent=v;el.append(label,strong);return el;}));
}
function refresh(){
 const r=sizePosition(params());currentResult=r;
 renderSummary(r);renderTicket(r);renderModes();renderUnits(r);
}
function updateAccount(){const a=selectedAccount();for(const k of ['equity','floor','reserve'])a[k]=inputNumber(k);for(const k of ['dailyRemaining','maxQuantity'])a[k]=optionalNumber(k);a.verified=$('accountVerified').checked;save();refresh();}
function updateSpec(){
 const s=selectedInstrument();s.tickSize=inputNumber('tickSize');s.pointValueQuote=inputNumber('pointValue');s.quoteToUSD=inputNumber('conversion');s.pipSize=optionalNumber('pipSize');s.quantityStep=inputNumber('qtyStep');s.minQuantity=inputNumber('minQty');s.verified=false;$('specVerified').checked=false;s.source='User-edited contract specification — verify with your platform';$('specSource').textContent=`${s.source} · ${s.symbol}`;
 save();refresh();
}
function switchStopMode(){
 const prev=lastStopMode,next=$('stopMode').value,s=selectedInstrument(),entry=inputNumber('entry'),current=inputNumber('stopInput');
 if(Number.isFinite(current)&&Number.isFinite(entry)&&current>0){
  const dist=prev==='price'?Math.abs(entry-current):current*(prev==='points'?1:prev==='ticks'?s.tickSize:s.pipSize||0);
  const nextVal=next==='price'?entry+(state.side==='long'?-1:1)*dist:dist/(next==='points'?1:next==='ticks'?s.tickSize:s.pipSize||NaN);
  $('stopInput').value=Number.isFinite(nextVal)?Number(nextVal.toPrecision(12)):'';
 }
 lastStopMode=next;setStopLabel();refresh();
}
function init(){
 fillAccounts();fillInstruments();syncAccountFields();syncSpecFields();setMode(state.mode||'normal');
 $('accountSelect').addEventListener('change',()=>{state.accountId=$('accountSelect').value;fillInstruments(true);syncAccountFields();syncSpecFields();save();refresh();});
 $('instrumentSelect').addEventListener('change',()=>{state.instrumentId=$('instrumentSelect').value;syncSpecFields();save();refresh();});
 for(const mode of Object.keys(MODES))$('mode-'+mode).addEventListener('click',()=>setMode(mode));
 for(const k of ['equity','floor','reserve','dailyRemaining','maxQuantity'])$(k).addEventListener('input',updateAccount);
 $('accountVerified').addEventListener('change',updateAccount);
 $('riskPercent').addEventListener('input',()=>{const v=inputNumber('riskPercent');state.modeFractions[state.mode]=v/100;for(const key of Object.keys(MODES))$(key+'Percent').textContent=pct(state.modeFractions[key]);save();refresh();});
 for(const side of ['long','short'])$(side+'Btn').addEventListener('click',()=>{state.side=side;for(const k of ['long','short']){$(k+'Btn').classList.toggle('active',side===k);$(k+'Btn').setAttribute('aria-pressed',String(side===k));}save();refresh();});
 $('stopMode').addEventListener('change',switchStopMode);
 for(const id of ['entry','stopInput','rr','slippageTicks','spreadTicks','feePerUnit','stressTicks'])$(id).addEventListener('input',refresh);
 for(const id of ['tickSize','pointValue','conversion','pipSize','qtyStep','minQty'])$(id).addEventListener('input',updateSpec);
 $('specVerified').addEventListener('change',()=>{selectedInstrument().verified=$('specVerified').checked;save();refresh();});
 $('addAccountBtn').addEventListener('click',()=>{$('newAccountPanel').hidden=!$('newAccountPanel').hidden;});
 $('saveAccountBtn').addEventListener('click',()=>{
  const name=$('newAccountName').value.trim();if(!name){$('newAccountName').focus();return;}
  const platform=$('newAccountPlatform').value,id='account-'+Date.now();const newAccount={...clone(selectedAccount()),id,name,platform,verified:false};
  state.accounts.push(newAccount);state.accountId=id;
  fillAccounts();fillInstruments(true);syncAccountFields();syncSpecFields();$('newAccountPanel').hidden=true;$('newAccountName').value='';save();refresh();
 });
 $('addInstrumentBtn').addEventListener('click',()=>{$('newInstrumentPanel').hidden=!$('newInstrumentPanel').hidden;});
 $('saveInstrumentBtn').addEventListener('click',()=>{
  const symbol=$('newInstrumentSymbol').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g,'').slice(0,24),name=$('newInstrumentName').value.trim();
  if(!symbol||!name){(!symbol?$('newInstrumentSymbol'):$('newInstrumentName')).focus();return;}
  const id='instrument-'+Date.now(),s={...clone(selectedInstrument()),id,symbol,name,platform:selectedAccount().platform,verified:false,source:'Custom instrument — verify contract size, min step and currency conversion'};
  state.instruments.push(s);state.instrumentId=id;fillInstruments();syncSpecFields();$('newInstrumentPanel').hidden=true;save();refresh();
 });
 $('copyBtn').addEventListener('click',async()=>{
  const r=currentResult;if(!r||r.status!=='CALCULATED')return;
  const a=selectedAccount(),s=selectedInstrument();
  const plan=`CHICKEN MAN — RISK DESK\nACCOUNT: ${a.name}\nINSTRUMENT: ${s.symbol}\nSIDE: ${state.side.toUpperCase()}\nMODE: ${MODES[state.mode].label} (${pct(state.modeFractions[state.mode])} of usable drawdown)\nEQUITY: ${usd(a.equity)} | FLOOR: ${usd(a.floor)} | RISK BUDGET: ${usd(r.budget)}\nENTRY: ${fmt(r.entry,6)}\nSTOP: ${fmt(r.stop,6)} | TARGET: ${fmt(r.target,6)}\nORDER QUANTITY: ${fmt(r.quantity,6)} ${s.unit}\nMODELED STOP RISK: ${usd(r.risk)} | TARGET NET: ${usd(r.expectedReward)} | STRESS LOSS: ${usd(r.stressRisk)}\nRemaining floor buffer after stop: ${usd(r.reservePostStop)}\nExecution estimates included. Not broker authorization. Stops may slip. Live rules must be checked.`;
  try{await navigator.clipboard.writeText(plan);$('copyBtn').textContent='Copied ✓';setTimeout(()=>{$('copyBtn').innerHTML='Copy position plan <span>↗</span>';},1800);}catch{const old=$('copyBtn').textContent;$('copyBtn').textContent='Clipboard unavailable — use HTTPS';setTimeout(()=>{$('copyBtn').textContent=old;},1800);}
 });
 $('resetBtn').addEventListener('click',()=>{if(!window.confirm('Reset saved accounts and instrument settings to examples?'))return;localStorage.removeItem(STORAGE_KEY);window.location.reload();});
 // Direction state survives refresh; entry and price remain illustrative until manually edited.
 for(const key of ['long','short']){$(key+'Btn').classList.toggle('active',state.side===key);$(key+'Btn').setAttribute('aria-pressed',String(state.side===key));}
 refresh();
}
init();
