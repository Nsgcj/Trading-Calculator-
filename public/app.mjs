import {getCurrentPrice,supportsCurrentPrice} from './quotes.mjs';
import {MODES,DEFAULT_ACCOUNTS,DEFAULT_INSTRUMENTS,sizePosition,getHeadroom,getRiskBudget,usd,fmt} from './engine.mjs';
const STORAGE_KEY='chicken-man-riskdesk-v1';
const $=id=>document.getElementById(id);
const clone=o=>structuredClone(o);
const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inputNumber=id=>$(id).value.trim()===''?NaN:Number($(id).value);
const optionalNumber=id=>$(id).value.trim()===''?null:Number($(id).value);
const pct=v=>Number((100*v).toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
function addMissingPresets(saved, presets) {
 const savedIds = new Set(saved.map(item => item.id));
 return [...saved, ...clone(presets.filter(item => !savedIds.has(item.id)))];
}
let state=(()=>{
 try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.accounts?.length && Array.isArray(saved.accounts) && saved?.instruments?.length && Array.isArray(saved.instruments) && saved.modeFractions) {
   return {
    ...saved,
    accounts: addMissingPresets(saved.accounts, DEFAULT_ACCOUNTS),
    instruments: addMissingPresets(saved.instruments, DEFAULT_INSTRUMENTS),
   };
  }
 } catch {}
 return { accounts:clone(DEFAULT_ACCOUNTS), instruments:clone(DEFAULT_INSTRUMENTS), accountId:'vest', instrumentId:'vest-nq', mode:'normal', modeFractions:{safe:.02,normal:.05,lottery:.60}, side:'long' };
})();
let currentResult=null,lastStopMode='price',quoteRequest,exampleEntry=true;
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
 const notes = {
  vest: 'Verify Vest contract multipliers and account floor. The $500/$490 profile is an illustration.',
  futures: 'Enter the current failure floor, daily loss allowance and position limits for your prop firm program.',
 };
 $('accountNote').textContent = notes[a.platform] ?? 'Enter your current equity, loss floor and any venue or account limits. Keep these values up to date.';
}
function syncSpecFields(){
 const s=selectedInstrument();
 quoteRequest?.abort();
 updateQuoteControl();
 exampleEntry=true;
 const pairs={tickSize:s.tickSize,pointValue:s.pointValueQuote,conversion:s.quoteToUSD,pipSize:s.pipSize,qtyStep:s.quantityStep,minQty:s.minQuantity};
 for(const [id,v] of Object.entries(pairs))$(id).value=v??'';
 $('specVerified').checked=Boolean(s.verified);
 $('specSource').textContent=`${s.source||'Custom broker specification'} · Native order size: ${s.unit} · ${s.symbol}. Price feed is NOT live.`;
 const refPrice={NQ:25000,ES:6000,GC:4000,CL:80,RTY:2200,YM:42000,SI:35,NG:3,EURUSD:1.1,USDJPY:150,GBPUSD:1.3,AUDUSD:0.65,USDCAD:1.4,EURJPY:165,BTC:90000,ETH:3000,SOL:150,STOCK:100,OTHER:100};
 const price=refPrice[s.reference]??100;
 $('entry').value=$('useStop').checked?price:'';
 const dist={NQ:30,ES:10,GC:10,CL:1,RTY:5,YM:50,SI:0.1,NG:0.05,EURUSD:0.002,USDJPY:0.2,GBPUSD:0.002,AUDUSD:0.002,USDCAD:0.002,EURJPY:0.2,BTC:500,ETH:25,SOL:2,STOCK:2,OTHER:2}[s.reference]??2;
 $('stopInput').value=Number((price+(state.side==='short'?dist:-dist)).toPrecision(11));
 if ($('stopMode').value!=='budget') $('stopMode').value='price';
 $('plannedQuantity').value='';
 $('plannedQuantityUnit').textContent=s.unit;
 lastStopMode='price';setStopLabel();
}
function setStopLabel(){
 const mode=$('stopMode').value;
 $('stopLabel').textContent=({price:'Structural stop price',points:'Stop distance (price points)',ticks:'Stop distance (ticks)',pips:'Stop distance (pips)'})[mode]??'Structural stop price';
 const includeStop=$('useStop').checked;
 const budgetStop=includeStop && mode==='budget';
 $('stopModeField').hidden=!includeStop;
 $('assumedMoveField').hidden=includeStop;
 $('scenarioHelp').hidden=includeStop;
 $('manualStopField').hidden=!includeStop || budgetStop;
 $('plannedQuantityField').hidden=!budgetStop;
 $('budgetStopNote').hidden=!budgetStop;
 $('manualStopNote').hidden=!includeStop || budgetStop;
}
function updateTargetMode(){
 const includeTarget=$('useTarget').checked;
 const budgetTarget=includeTarget && $('targetMode').value==='budget';
 $('targetModeField').hidden=!includeTarget;
 $('rrField').hidden=!includeTarget;
 $('rrLabel').textContent=budgetTarget?'Target risk-budget multiple':$('useStop').checked?'Target stop-distance multiple':'Target assumed-move multiple';
 $('budgetTargetNote').hidden=!budgetTarget;
 refresh();
}
function updateQuoteControl(){
 const supported=supportsCurrentPrice(selectedInstrument());
 $('currentPrice').hidden=!supported;
 $('currentPrice').disabled=false;
 $('quoteStatus').textContent=supported?'Enter a price or fetch a quote snapshot.':'Enter your current broker price. Quote lookup is unavailable for this instrument.';
}
async function fetchEntry(){
 quoteRequest?.abort();
 const request=new AbortController();
 quoteRequest=request;
 $('currentPrice').disabled=true;
 $('quoteStatus').textContent='Fetching a quote…';
 try {
  const {price,source}=await getCurrentPrice(selectedInstrument(),{signal:request.signal});
  if (request.signal.aborted) return;
  $('entry').value=price;
  exampleEntry=false;
  $('quoteStatus').textContent=source+' snapshot · '+new Date().toLocaleTimeString();
  refresh();
 } catch {
  if (!request.signal.aborted) $('quoteStatus').textContent='Quote unavailable. Enter the current price from your broker.';
 } finally {
  if (quoteRequest===request) $('currentPrice').disabled=false;
 }
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
 return {account:selectedAccount(),instrument:selectedInstrument(),side:state.side,entry:inputNumber('entry'),stopMode:$('useStop').checked?$('stopMode').value:'none',assumedMovePercent:inputNumber('assumedMove'),stopInput:inputNumber('stopInput'),plannedQuantity:inputNumber('plannedQuantity'),targetMode:$('useTarget').checked?$('targetMode').value:'none',rr:inputNumber('rr'),slippageTicks:inputNumber('slippageTicks'),spreadTicks:inputNumber('spreadTicks'),feePerUnit:inputNumber('feePerUnit'),stressExtraTicks:inputNumber('stressTicks'),riskFraction:fraction};
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
 $('statusChip').textContent=r?.status==='CALCULATED' && r.stopMode==='none'?'SCENARIO':r?.status??'PENDING';
 $('quantity').textContent=good?fmt(r.quantity,10):'NO TRADE';
 $('quantityUnit').textContent=s.unit;
 const noStop=!$('useStop').checked;
 const fixedSize=!noStop && $('stopMode').value==='budget';
 $('bufferLabel').textContent=noStop?'MODELED BUFFER':'POST-STOP BUFFER';
 $('lossLabel').textContent=noStop?'Modeled adverse loss':'Planned stop loss';
 $('widthLabel').textContent=noStop?'Assumed move, tick-adjusted':'Stop width';
 $('scenarioPriceRow').hidden=!noStop;
 $('scenarioPrice').textContent=good?fmt(r.scenarioPrice,10):'—';
 $('notional').textContent=good?usd(r.notionalUSD):'—';
 $('quantityCaption').textContent=fixedSize?'PLANNED SIZE · NATIVE PLATFORM UNITS':'MAX POSITION SIZE · NATIVE PLATFORM UNITS';
 $('quantityHint').textContent=good?`${s.symbol} · ${state.side.toUpperCase()} · ${fixedSize?'fixed planned quantity':'estimated maximum native quantity'}`:'Risk budget, platform minimum or setup validation prevents sizing.';
 $('actualRisk').textContent=good?'−'+usd(r.risk):'—';
 $('targetProfit').textContent=good?usd(r.expectedReward):'—';
 $('effectiveRR').textContent=good&&Number.isFinite(r.rrNet)?`1 : ${fmt(r.rrNet,2)}`:'—';
 $('stopPrice').textContent=good?fmt(r.stop,10):'—';
 $('targetPrice').textContent=good?fmt(r.target,10):'—';
 $('stopWidth').textContent=good?`${fmt(r.stopDistance,6)} pts · ${fmt(r.stopTicks,2)} ticks`:'—';
 $('stressRisk').textContent=good?'−'+usd(r.stressRisk):'—';
 $('statusMessage').className='status-message '+(r?.status==='BLOCKED'?'blocked':r?.status==='CALCULATED'?'verified':'');
 $('statusMessage').textContent=r?.status==='BLOCKED'?'BLOCKED — '+(r.errors[0]||'One or more hard risk checks failed.') :r?.status==='VERIFY'?'VERIFY BEFORE USE — numbers are illustrative; validate both the account rules and instrument specification.':noStop?'SCENARIO — size is based on the assumed adverse move and estimated costs. Losses can exceed this estimate.':'SIZED — values include entered execution costs. This is not broker permission to execute.';
 $('warningList').replaceChildren(...(r?.warnings||[]).map(message=>{const el=document.createElement('div');el.className='warning-item';el.textContent=message;return el;}));
 if(r?.errors?.length>1)for(const message of r.errors.slice(1)){const el=document.createElement('div');el.className='warning-item';el.textContent=message;$('warningList').append(el);}
 $('copyBtn').disabled=r?.status!=='CALCULATED';
}
function renderModes(){
 const body=$('modeTable');body.replaceChildren();
 for(const mode of Object.keys(MODES)){
  const fraction=state.modeFractions[mode],r=sizePosition(params(fraction));
  const tr=document.createElement('tr');if(mode===state.mode)tr.className='row-highlight';
  tr.innerHTML=`<td>${escapeHTML(MODES[mode].label)}</td><td>${escapeHTML(usd(r.budget))}</td><td>${escapeHTML(fmt(r.quantity,10))}</td><td>${escapeHTML(r.risk===undefined?'—':'−'+usd(r.risk))}</td><td>${escapeHTML(fmt(r.stop,10))}</td><td>${escapeHTML(fmt(r.target,10))}</td><td class="${r.status==='BLOCKED'?'bad-text':'good-text'}">${escapeHTML(r.status==='BLOCKED'?'NO SIZE':r.status==='VERIFY'?'VERIFY':r.stopMode==='none'?'SCENARIO':'SIZED')}</td>`;
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
 if(next!=='budget' && prev!==next && Number.isFinite(current)&&Number.isFinite(entry)&&current>0){
  const dist=prev==='price'?Math.abs(entry-current):current*(prev==='points'?1:prev==='ticks'?s.tickSize:s.pipSize||0);
  const nextVal=next==='price'?entry+(state.side==='long'?-1:1)*dist:dist/(next==='points'?1:next==='ticks'?s.tickSize:s.pipSize||NaN);
  $('stopInput').value=Number.isFinite(nextVal)?Number(nextVal.toPrecision(12)):'';
 }
 if (next!=='budget') lastStopMode=next;
 setStopLabel();refresh();
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
 $('useStop').addEventListener('change',()=>{
  if (!$('useStop').checked && exampleEntry) $('entry').value='';
  setStopLabel();
  updateTargetMode();
 });
 $('useTarget').addEventListener('change',updateTargetMode);
 $('currentPrice').addEventListener('click',fetchEntry);
 $('entry').addEventListener('input',()=>{
  quoteRequest?.abort();
  exampleEntry=false;
  updateQuoteControl();
  refresh();
 });
 $('stopMode').addEventListener('change',switchStopMode);
 $('targetMode').addEventListener('change',updateTargetMode);
 for(const id of ['assumedMove','stopInput','plannedQuantity','rr','slippageTicks','spreadTicks','feePerUnit','stressTicks'])$(id).addEventListener('input',refresh);
 for(const id of ['tickSize','pointValue','conversion','pipSize','qtyStep','minQty'])$(id).addEventListener('input',updateSpec);
 $('specVerified').addEventListener('change',()=>{selectedInstrument().verified=$('specVerified').checked;save();refresh();});
 $('addAccountBtn').addEventListener('click',()=>{$('newAccountPanel').hidden=!$('newAccountPanel').hidden;});
 $('saveAccountBtn').addEventListener('click',()=>{
  const name=$('newAccountName').value.trim();if(!name){$('newAccountName').focus();return;}
  const platform = $('newAccountPlatform').value;
  const id = 'account-' + Date.now();
  const newAccount = { id, name, platform, reserve: 0, dailyRemaining: null, maxQuantity: null, verified: false };
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
  const plan=`CHICKEN MAN — RISK DESK\nACCOUNT: ${a.name}\nINSTRUMENT: ${s.symbol}\nSIDE: ${state.side.toUpperCase()}\nMODE: ${MODES[state.mode].label} (${pct(state.modeFractions[state.mode])} of usable drawdown)\nEQUITY: ${usd(a.equity)} | FLOOR: ${usd(a.floor)} | RISK BUDGET: ${usd(r.budget)}\nENTRY: ${fmt(r.entry,10)}\nSTOP: ${fmt(r.stop,10)} (${r.stopMode==='none'?'disabled':r.stopMode==='budget'?'drawdown budget':'manual'}) | TARGET: ${fmt(r.target,10)} (${r.targetMode==='none'?'disabled':r.targetMode==='budget'?'drawdown budget':r.stopMode==='none'?'assumed move':'stop distance'})\nORDER QUANTITY: ${fmt(r.quantity,10)} ${s.unit}\nMODELED LOSS: ${usd(r.risk)} | TARGET NET: ${usd(r.expectedReward)} | STRESS LOSS: ${usd(r.stressRisk)}\nModeled remaining floor buffer: ${usd(r.reservePostStop)}\n${r.stopMode==='none'?'Assumed adverse scenario: '+fmt(r.scenarioPrice,10)+'. Actual loss can exceed the modeled loss. ':''}Execution estimates included. Not broker authorization. Stops may slip. Live rules must be checked.`;
  try{await navigator.clipboard.writeText(plan);$('copyBtn').textContent='Copied ✓';setTimeout(()=>{$('copyBtn').innerHTML='Copy position plan <span>↗</span>';},1800);}catch{const old=$('copyBtn').textContent;$('copyBtn').textContent='Clipboard unavailable — use HTTPS';setTimeout(()=>{$('copyBtn').textContent=old;},1800);}
 });
 $('resetBtn').addEventListener('click',()=>{if(!window.confirm('Reset saved accounts and instrument settings to examples?'))return;localStorage.removeItem(STORAGE_KEY);window.location.reload();});
 // Direction state survives refresh; entry and price remain illustrative until manually edited.
 for(const key of ['long','short']){$(key+'Btn').classList.toggle('active',state.side===key);$(key+'Btn').setAttribute('aria-pressed',String(state.side===key));}
 updateTargetMode();
}
init();
