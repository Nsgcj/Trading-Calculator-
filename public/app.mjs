import {accountReferences} from './account-references.mjs';
import {supportsContractLookup,fetchContractSpec} from './contract-specs.mjs';
import {getCurrentPrice,supportsCurrentPrice} from './quotes.mjs';
import {ACCOUNT_STAGES,MODES,DEFAULT_ACCOUNTS,DEFAULT_INSTRUMENTS,sizePosition,resolveExitInputs,getHeadroom,getRiskBudget,usd,fmt} from './engine.mjs';
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
    accounts: addMissingPresets(saved.accounts, DEFAULT_ACCOUNTS).map(account=>{
     const preset=DEFAULT_ACCOUNTS.find(item=>item.id===account.id);
     return account.stage || !preset?.stage ? account : {...account,stage:preset.stage};
    }),
    instruments: addMissingPresets(saved.instruments, DEFAULT_INSTRUMENTS).map(instrument=>{
     if(instrument.sourceUrl || instrument.platform!=='futures') return instrument;
     const official=DEFAULT_INSTRUMENTS.find(preset=>preset.id===instrument.id);
     const originalSource=/^(CME(?:\/COMEX|\/NYMEX)? contract specification|Confirm tick and point value against the exchange and confirm prop firm order limits)$/;
     const exchangeFields=['tickSize','pointValueQuote','quoteToUSD','quantityStep','minQuantity'];
     if(!official?.sourceUrl || !originalSource.test(instrument.source) || !exchangeFields.every(key=>instrument[key]===official[key])) return instrument;
     return {...instrument,source:official.source,sourceUrl:official.sourceUrl,verified:true};
    }),
   };
  }
 } catch {}
 return { accounts:clone(DEFAULT_ACCOUNTS), instruments:clone(DEFAULT_INSTRUMENTS), accountId:'vest', instrumentId:'vest-nq', mode:'normal', modeFractions:{safe:.02,normal:.05,lottery:.60}, side:'long' };
})();
let currentResult=null,lastStopMode='price',quoteRequest,specRequest,quoteAt=0,exampleEntry=true,exampleStop=true;
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
function selectedAccount(){return state.accounts.find(a=>a.id===state.accountId)||state.accounts[0];}
function selectedInstrument(){return state.instruments.find(s=>s.id===state.instrumentId)??{};}
function getApplicable(){return state.instruments.filter(s=>s.platform===selectedAccount().platform);}
function fillAccounts(){
 const groups=new Map();
 for(const account of state.accounts){
  const label=ACCOUNT_STAGES[account.stage]??'Saved profiles';
  if(!groups.has(label)){
   const group=document.createElement('optgroup');
   group.label=label;
   groups.set(label,group);
  }
  groups.get(label).append(new Option(account.name,account.id));
 }
 $('accountSelect').replaceChildren(...groups.values());
 if(!state.accounts.some(a=>a.id===state.accountId))state.accountId=state.accounts[0].id;
 $('accountSelect').value=state.accountId;
}
const platformNames={
 vest:'Vest',futures:'Futures',custom:'Personal / FX',hyperliquid:'Hyperliquid',
 vest:'Vest','perp-custom':'Custom Perpetuals',futures:'Futures',custom:'Personal / FX',hyperliquid:'Hyperliquid',
 'binance-linear':'Binance USDⓈ-M','bybit-linear':'Bybit USDT',
};
function fillInstruments(restoreAccountChoice=false){
 const account=selectedAccount();
 const available=getApplicable();
 const preferred=restoreAccountChoice?account.instrumentId:state.instrumentId;
 const chosen=available.find(instrument=>instrument.id===preferred)
  ?? available.find(instrument=>instrument.id===state.instrumentId)
  ?? available[0];
 state.instrumentId=chosen?.id??'';
 account.instrumentId=state.instrumentId;
 const groups=new Map();
 const otherInstruments=state.instruments.filter(instrument=>instrument.platform!==account.platform);
 for(const instrument of [...available,...otherInstruments]){
  const platform=platformNames[instrument.platform]??instrument.platform;
  const label=`${platform} · ${instrument.asset||'Other'}`;
  if(!groups.has(label)){
   const group=document.createElement('optgroup');
   group.label=label;
   groups.set(label,group);
  }
  groups.get(label).append(new Option(`${instrument.symbol} · ${instrument.name}`,instrument.id));
 }
 $('instrumentSelect').replaceChildren(...groups.values());
 $('instrumentSelect').value=state.instrumentId;
 $('instrumentAccount').textContent=`Sizing account: ${account.name}. Choosing a contract on another platform switches accounts.`;
}
const nextStage={evaluation:'sim-funded','sim-funded':'live-funded'};
function showReference(id, url){
 const link=$(id);
 link.hidden=!url;
 if(url) link.href=url;
}
function renderAccountReferences(){
 const account=selectedAccount();
 const {fees,daily,publishedFee}=accountReferences(account,selectedInstrument());
 $('dailyRule').textContent=daily?.[0]??(account.stage==='personal'
  ? 'Set a personal daily cap if you use one.'
  : 'Use the current daily allowance for your specific plan, if any.');
 showReference('dailySource',daily?.[1]);
 const savedFee=account.commissions?.[selectedInstrument().id];
 const feeText=fees?.[0]??'Round-trip fees depend on the broker, instrument and account. Enter them in execution costs if applicable.';
 $('feeSchedule').textContent=savedFee!==undefined && savedFee!==''?`${feeText} Modeled fee: ${usd(Number(savedFee))} per native unit.`:feeText;
 showReference('feeSource',fees?.[1]);
 const button=$('applyPublishedFee');
 button.hidden=publishedFee===undefined;
 if(!button.hidden) button.textContent=`Use published ${usd(publishedFee)} / round trip`;
}
function syncAccountCommission(){
 const account=selectedAccount(),instrument=selectedInstrument();
 $('feePerUnit').value=account.commissions?.[instrument.id]??'0';
 renderAccountReferences();
}
function syncAccountFields(){
 const a=selectedAccount();
 for(const k of ['equity','floor','reserve','maxQuantity'])$(k).value=a[k]??'';
 renderDailyRemaining();
 $('accountVerified').checked=Boolean(a.verified);
 $('noDailyLimit').checked=Boolean(a.noDailyLimit);
 $('dailyRemaining').disabled=Boolean(a.noDailyLimit);
 syncAccountCommission();
 $('accountReference').hidden=!a.sourceUrl;
 if(a.sourceUrl) $('accountReference').href=a.sourceUrl;
 $('accountFloorLabel').textContent=a.stage==='personal'?'Personal loss floor':'Current failure floor';
 const next=nextStage[a.stage];
 $('createFundedBtn').hidden=!next;
 if(next) $('createFundedBtn').textContent=`+ Create ${ACCOUNT_STAGES[next]} profile`;
 const notes = {
  vest: 'Verify Vest contract multipliers and account floor. The $500/$490 profile is an illustration.',
  futures: 'Enter the current failure floor, daily loss allowance and position limits for your prop firm program.',
 };
 $('accountNote').textContent = a.stage==='sim-funded' || a.stage==='live-funded'
  ? 'Enter this funded account’s own equity, current floor, daily loss allowance and position cap.'
  : a.stage==='personal'?'Enter equity and the minimum balance you want to keep. Add a daily loss limit or position cap if applicable.'
  : notes[a.platform] ?? 'Enter your current equity, loss floor and any venue or account limits.';
}
function syncSpecFields(){
 syncAccountCommission();
 const s=selectedInstrument();
 cancelQuote();
 quoteAt=0;
 updateQuoteControl();
 exampleEntry=true;
 specRequest?.abort();
 $('lookupSpec').disabled=false;
 $('lookupSpec').hidden=!supportsContractLookup(s);
 $('lookupStatus').hidden=true;
 renderSpec(s);
 const refPrice={NQ:25000,ES:6000,GC:4000,CL:80,RTY:2200,YM:42000,SI:35,NG:3,EURUSD:1.1,USDJPY:150,GBPUSD:1.3,AUDUSD:0.65,USDCAD:1.4,EURJPY:165,BTC:90000,ETH:3000,SOL:150,STOCK:100,OTHER:100};
 const price=refPrice[s.reference];
 const useDemo=!supportsCurrentPrice(s) && $('useStop').checked && $('useTarget').checked && price!==undefined;
 $('entry').value=useDemo?price:'';
 exampleStop=useDemo;
 const dist={NQ:30,ES:10,GC:10,CL:1,RTY:5,YM:50,SI:0.1,NG:0.05,EURUSD:0.002,USDJPY:0.2,GBPUSD:0.002,AUDUSD:0.002,USDCAD:0.002,EURJPY:0.2,BTC:500,ETH:25,SOL:2,STOCK:2,OTHER:2}[s.reference]??2;
 $('stopInput').value=!useDemo?'':Number((price+(state.side==='short'?dist:-dist)).toPrecision(11));
 if ($('stopMode').value!=='budget') $('stopMode').value='price';
 $('plannedQuantity').value='';
 $('plannedQuantityUnit').textContent=s.unit;
 lastStopMode='price';setStopLabel();
 maybeFetchEntry();
}
const specificationSources={
 'hyperliquid':'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size',
 'bybit-linear':'https://bybit-exchange.github.io/docs/v5/market/instrument',
 'binance-linear':'https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Exchange-Information',
};
function renderSpec(s){
 const pairs={tickSize:s.tickSize,pointValue:s.pointValueQuote,conversion:s.quoteToUSD,pipSize:s.pipSize,qtyStep:s.quantityStep,minQty:s.minQuantity,minNotional:s.minNotionalQuote};
 for(const [id,v] of Object.entries(pairs))$(id).value=v??'';
 const isCurrent=!s.lookupAt || Date.now()-s.lookupAt<86400000;
 $('specVerified').checked=Boolean(s.verified && isCurrent && s.platform!=='hyperliquid');
 $('specVerified').disabled=s.platform==='hyperliquid' || Boolean(s.lookupAt);
 $('manualSpecConfirmation').hidden=$('specVerified').disabled || Boolean(s.sourceUrl && s.verified);
 $('specSource').textContent=`${s.source||'Custom broker specification'} · Native order size: ${s.unit} · ${s.symbol}. Price input is independent.`;
 const reference=$('contractReference');
 const url=s.sourceUrl??specificationSources[s.platform];
 reference.hidden=!url;
 if(url) reference.href=url;
}
async function lookupSpec(){
 const instrument=selectedInstrument();
 specRequest?.abort();
 const request=new AbortController();
 specRequest=request;
 $('lookupSpec').disabled=true;
 const status=$('lookupStatus');
 status.hidden=false;
 status.textContent='Loading published order rules…';
 try {
  const rules=await fetchContractSpec(instrument,{signal:request.signal});
  if(request.signal.aborted) return;
  Object.assign(instrument,rules,{lookupAt:Date.now(),verified:true,pointValueQuote:1});
  renderSpec(instrument);
  status.textContent='Published rules loaded. Quote conversion and costs are separate estimates.';
  save();refresh();
 } catch {
  if(!request.signal.aborted) status.textContent='Exchange rules unavailable. Existing values are unchanged.';
 } finally {
  if(specRequest===request) $('lookupSpec').disabled=false;
 }
}
function setStopLabel(){
 const mode=$('stopMode').value;
 $('stopLabel').textContent=({price:'Structural stop price',points:'Stop distance (price points)',ticks:'Stop distance (ticks)',pips:'Stop distance (pips)'})[mode]??'Structural stop price';
 const includeStop=$('useStop').checked;
 const budgetStop=includeStop && mode==='budget';
 const automaticStop=exitInputs().stopMode==='auto';
 $('stopModeField').hidden=!includeStop;
 $('assumedMoveField').hidden=!automaticStop;
 $('scenarioHelp').hidden=!automaticStop;
 $('manualStopField').hidden=!includeStop || budgetStop;
 $('plannedQuantityField').hidden=!budgetStop;
 $('budgetStopNote').hidden=!budgetStop;
 $('manualStopNote').hidden=!includeStop || budgetStop;
}
function updateTargetMode(){
 const includeTarget=$('useTarget').checked;
 const automaticTarget=exitInputs().targetMode==='auto';
 const budgetTarget=exitInputs().targetMode==='budget';
 $('autoTargetNote').hidden=!automaticTarget;
 $('targetModeField').hidden=!includeTarget;
 $('rrField').hidden=!includeTarget;
 $('rrLabel').textContent=budgetTarget?'Target risk-budget multiple':exitInputs().stopMode==='auto'?'Target automatic-stop multiple':'Target stop-distance multiple';
 $('budgetTargetNote').hidden=!budgetTarget;
}
function updateQuoteControl(){
 const supported=supportsCurrentPrice(selectedInstrument());
 $('currentPrice').hidden=!supported;
 $('currentPrice').disabled=false;
 $('quoteStatus').textContent=supported?'Enter a price or fetch a quote snapshot.':'Enter your current broker price. Quote lookup is unavailable for this instrument.';
}
function cancelQuote(){
 quoteRequest?.abort();
 quoteRequest=null;
}
function maybeFetchEntry(){
 const exits=exitInputs();
 const auto=exits.stopMode==='auto' || exits.targetMode==='auto' || $('entry').value==='';
 if(!auto) return;
 if(exampleEntry) $('entry').value='';
 if(exampleStop){
  $('stopInput').value='';
  exampleStop=false;
 }
 if(supportsCurrentPrice(selectedInstrument()) && !quoteRequest && Date.now()-quoteAt>30000) void fetchEntry();
}
async function fetchEntry(){
 cancelQuote();
 const request=new AbortController();
 quoteRequest=request;
 $('currentPrice').disabled=true;
 $('quoteStatus').textContent='Fetching a quote…';
 refresh();
 try {
  const {price,source,time}=await getCurrentPrice(selectedInstrument(),{signal:request.signal});
  if (request.signal.aborted) return;
  $('entry').value=price;
  if(exampleStop) $('stopInput').value='';
  exampleStop=false;
  exampleEntry=false;
  quoteAt=Date.now();
  $('quoteStatus').textContent=source+' snapshot · '+new Date(time??quoteAt).toLocaleTimeString();
 } catch {
  if (!request.signal.aborted) $('quoteStatus').textContent=$('entry').value ? 'Quote unavailable. Levels use the entry shown.' : 'Quote unavailable. Enter the current price from your broker.';
 } finally {
  if (quoteRequest===request){
   quoteRequest=null;
   $('currentPrice').disabled=false;
   refresh();
  }
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
function exitInputs(){
 return resolveExitInputs({
  useStop:$('useStop').checked,useTarget:$('useTarget').checked,
  stopMode:$('stopMode').value,stopInput:inputNumber('stopInput'),plannedQuantity:inputNumber('plannedQuantity'),
  assumedMovePercent:inputNumber('assumedMove'),targetMode:$('targetMode').value,rr:inputNumber('rr'),
 });
}
function params(fraction=state.modeFractions[state.mode]){
 return {account:selectedAccount(),instrument:selectedInstrument(),side:state.side,entry:quoteRequest?NaN:inputNumber('entry'),...exitInputs(),slippageTicks:inputNumber('slippageTicks'),spreadTicks:inputNumber('spreadTicks'),feePerUnit:inputNumber('feePerUnit'),stressExtraTicks:inputNumber('stressTicks'),riskFraction:fraction};
}
function renderSummary(r){
 const a=selectedAccount(),h=getHeadroom(a);
 $('kEquity').textContent=usd(Number(a.equity));$('kRoom').textContent=h?usd(h.raw):'—';
 $('kBudget').textContent=usd(r?.budget);
 $('budgetAccount').textContent=a.name;
 $('kBuffer').textContent=r?.risk===undefined?'—':usd(r.reservePostStop);
 $('floorText').textContent=h?`${usd(h.usable)} usable`:'—';
 $('floorFill').style.width=h&&h.raw>0?`${Math.min(100,Math.max(0,(r?.budget??0)/h.raw*100))}%`:'0%';
}
function renderTicket(r){
 const good=r&&r.status!=='BLOCKED'&&Number.isFinite(r.quantity),s=selectedInstrument();
 $('statusChip').className='state-chip '+(r?.status==='CALCULATED'?'calculated':r?.status==='BLOCKED'?'blocked':'');
 $('statusChip').textContent=quoteRequest?'QUOTING':r?.status??'PENDING';
 $('quantity').textContent=good?fmt(r.quantity,10):'NO TRADE';
 $('quantityUnit').textContent=s.unit??'';
 $('estimatedCosts').textContent=good?usd(r.roundTripCosts):'—';
 $('allocationUsed').textContent=good?usd(Math.max(0,r.budget-r.risk)):'—';
 const exits=exitInputs();
 const fixedSize=exits.stopMode==='budget';
 $('stopPriceLabel').textContent=exits.stopMode==='auto'?'Suggested stop-loss':'Stop-loss price';
 $('targetPriceLabel').textContent=exits.targetMode==='auto'?'Suggested take-profit':'Take-profit price';
 $('notional').textContent=good?usd(r.notionalUSD):'—';
 $('quantityCaption').textContent=fixedSize?'PLANNED SIZE · NATIVE PLATFORM UNITS':'MAX POSITION SIZE · NATIVE PLATFORM UNITS';
 $('quantityHint').textContent=good?`${s.symbol} · ${state.side.toUpperCase()} · ${fixedSize?'fixed planned quantity':'estimated maximum native quantity'}`:'Risk budget, platform minimum or setup validation prevents sizing.';
 $('actualRisk').textContent=good?'−'+usd(r.risk):'—';
 $('targetProfit').textContent=good?usd(r.expectedReward):'—';
 $('effectiveRR').textContent=good&&Number.isFinite(r.rrNet)?`1 : ${fmt(r.rrNet,2)}`:'—';
 $('stopPrice').textContent=fmt(r.stop,10);
 $('targetPrice').textContent=fmt(r.target,10);
 $('stopWidth').textContent=good?`${fmt(r.stopDistance,6)} pts · ${fmt(r.stopTicks,2)} ticks`:'—';
 $('stressRisk').textContent=good?'−'+usd(r.stressRisk):'—';
 $('statusMessage').className='status-message '+(r?.status==='BLOCKED'?'blocked':r?.status==='CALCULATED'?'verified':'');
 $('statusMessage').textContent=quoteRequest?'Fetching current price before sizing…':r?.status==='BLOCKED'?'BLOCKED — '+(r.errors[0]||'One or more hard risk checks failed.') :r?.status==='VERIFY'?'VERIFY BEFORE USE — numbers are illustrative; check the account rules and any unverified contract assumptions.':'SIZED — values include entered execution costs. This is not broker permission to execute.';
 $('warningList').replaceChildren(...(r?.warnings||[]).map(message=>{const el=document.createElement('div');el.className='warning-item';el.textContent=message;return el;}));
 if(r?.errors?.length>1)for(const message of r.errors.slice(1)){const el=document.createElement('div');el.className='warning-item';el.textContent=message;$('warningList').append(el);}
 $('copyBtn').disabled=r?.status!=='CALCULATED';
}
function renderModes(){
 const body=$('modeTable');body.replaceChildren();
 for(const mode of Object.keys(MODES)){
  const fraction=state.modeFractions[mode],r=sizePosition(params(fraction));
  const tr=document.createElement('tr');if(mode===state.mode)tr.className='row-highlight';
  tr.innerHTML=`<td>${escapeHTML(MODES[mode].label)}</td><td>${escapeHTML(usd(r.budget))}</td><td>${escapeHTML(fmt(r.quantity,10))}</td><td>${escapeHTML(r.risk===undefined?'—':'−'+usd(r.risk))}</td><td>${escapeHTML(fmt(r.stop,10))}</td><td>${escapeHTML(fmt(r.target,10))}</td><td class="${r.status==='BLOCKED'?'bad-text':'good-text'}">${escapeHTML(r.status==='BLOCKED'?'NO SIZE':r.status==='VERIFY'?'VERIFY':'SIZED')}</td>`;
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
function renderDailyRemaining(){
 const account=selectedAccount(),field=$('dailyRemaining');
 const auto=account.noDailyLimit || account.dailyRemaining==null || account.dailyRemaining==='';
 const available=getHeadroom(account)?.usable;
 field.value=auto?(Number.isFinite(available)?available.toFixed(2):''):account.dailyRemaining;
 $('dailyRemainingBasis').textContent=auto
  ? (account.noDailyLimit ? 'Auto from equity minus floor and reserve.' : 'Auto from equity minus floor and reserve. Enter a separate daily allowance if one applies.')
  : 'Using the entered daily allowance alongside the account drawdown limit. Clear to return to auto.';
}
function refresh(){
 setStopLabel();updateTargetMode();
 if(document.activeElement!==$('dailyRemaining')) renderDailyRemaining();
 const r=sizePosition(params());currentResult=r;
 renderSummary(r);renderTicket(r);renderModes();renderUnits(r);
}
function updateAccount(event){
 const account=selectedAccount();
 for(const key of ['equity','floor','reserve']) account[key]=inputNumber(key);
 account.maxQuantity=optionalNumber('maxQuantity');
 if(event.target.id==='dailyRemaining') account.dailyRemaining=optionalNumber('dailyRemaining');
 account.verified=$('accountVerified').checked;
 account.noDailyLimit=$('noDailyLimit').checked;
 $('dailyRemaining').disabled=account.noDailyLimit;
 save();refresh();
}
function updateCommission(){
 const account=selectedAccount(),instrument=selectedInstrument();
 account.commissions??={};
 account.commissions[instrument.id]=$('feePerUnit').value;
 renderAccountReferences();save();refresh();
}
function updateSpec(event){
 const s=selectedInstrument();
 const fields={tickSize:'tickSize',pointValue:'pointValueQuote',conversion:'quoteToUSD',pipSize:'pipSize',qtyStep:'quantityStep',minQty:'minQuantity',minNotional:'minNotionalQuote'};
 const field=event.target.id;
 specRequest?.abort();
 $('lookupSpec').disabled=false;
 $('lookupStatus').hidden=true;
 s[fields[field]]=optionalNumber(field);
 if(field!=='conversion' || !s.lookupAt){
  s.verified=false;
  delete s.lookupAt;
  delete s.sourceUrl;
  s.source='User-edited contract specification';
 }
 $('specVerified').checked=Boolean(s.verified && (!s.lookupAt || Date.now()-s.lookupAt<86400000));
 $('specVerified').disabled=s.platform==='hyperliquid' || Boolean(s.lookupAt);
 $('manualSpecConfirmation').hidden=$('specVerified').disabled || Boolean(s.sourceUrl && s.verified);
 $('specSource').textContent=`${s.source} · ${s.symbol}`;
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
function openAccountPanel(fromAccount){
 const panel=$('newAccountPanel');
 const current=selectedAccount();
 panel.hidden=false;
 $('newAccountPlatform').value=current.platform;
 $('newAccountStage').value=fromAccount?nextStage[current.stage]:'personal';
 $('newAccountName').value=fromAccount?`${current.name.replace(/\s*[—·]\s*(Evaluation|Simulated funded|Sim Funded|Live Funded|example|setup required).*$/i,'')} · ${ACCOUNT_STAGES[nextStage[current.stage]]}`:'';
 $('newAccountName').focus();
}
function init(){
 $('newAccountStage').replaceChildren(...Object.entries(ACCOUNT_STAGES).map(([id,label])=>new Option(label,id)));
 fillAccounts();fillInstruments();syncAccountFields();syncSpecFields();setMode(state.mode||'normal');
 $('accountSelect').addEventListener('change',()=>{
  const previousInstrument=state.instrumentId;
  state.accountId=$('accountSelect').value;
  fillInstruments(true);
  syncAccountFields();
  if(previousInstrument!==state.instrumentId) syncSpecFields();
  save();refresh();
 });
 $('instrumentSelect').addEventListener('change',()=>{
  const instrument=state.instruments.find(item=>item.id===$('instrumentSelect').value);
  if(!instrument) return;
  if(instrument.platform!==selectedAccount().platform){
   const accounts=state.accounts.filter(account=>account.platform===instrument.platform);
   const account=accounts.find(item=>item.instrumentId===instrument.id)??accounts[0];
   if(!account){
    fillInstruments();
    $('instrumentAccount').textContent='Create an account profile for this platform to size this instrument.';
    return;
   }
   state.accountId=account.id;
   fillAccounts();
   syncAccountFields();
  }
  state.instrumentId=instrument.id;
  fillInstruments();
  syncSpecFields();save();refresh();
 });
 for(const mode of Object.keys(MODES))$('mode-'+mode).addEventListener('click',()=>setMode(mode));
 for(const k of ['equity','floor','reserve','dailyRemaining','maxQuantity'])$(k).addEventListener('input',updateAccount);
 $('accountVerified').addEventListener('change',updateAccount);
 $('noDailyLimit').addEventListener('change',updateAccount);
 $('dailyRemaining').addEventListener('focus',()=>{
  if(selectedAccount().dailyRemaining==null) $('dailyRemaining').select();
 });
 $('dailyRemaining').addEventListener('blur',renderDailyRemaining);
 $('riskPercent').addEventListener('input',()=>{const v=inputNumber('riskPercent');state.modeFractions[state.mode]=v/100;for(const key of Object.keys(MODES))$(key+'Percent').textContent=pct(state.modeFractions[key]);save();refresh();});
 for(const side of ['long','short'])$(side+'Btn').addEventListener('click',()=>{state.side=side;for(const k of ['long','short']){$(k+'Btn').classList.toggle('active',side===k);$(k+'Btn').setAttribute('aria-pressed',String(side===k));}save();refresh();});
 for(const id of ['useStop','useTarget','stopMode','targetMode']){
  $(id).addEventListener('change',()=>{
   if(id==='stopMode') switchStopMode();
   maybeFetchEntry();refresh();
  });
 }
 $('currentPrice').addEventListener('click',fetchEntry);
 $('entry').addEventListener('input',()=>{
  cancelQuote();quoteAt=0;
  exampleEntry=false;
  if(exampleStop) $('stopInput').value='';
  exampleStop=false;
  updateQuoteControl();refresh();
 });
 $('entry').addEventListener('change',()=>{
  if($('entry').value==='') maybeFetchEntry();
  refresh();
 });
 for(const id of ['stopInput','plannedQuantity','rr'])$(id).addEventListener('change',()=>{
  maybeFetchEntry();refresh();
 });
 $('stopInput').addEventListener('input',()=>{exampleStop=false;refresh();});
 for(const id of ['assumedMove','plannedQuantity','rr','stressTicks'])$(id).addEventListener('input',refresh);
 for(const id of ['slippageTicks','spreadTicks'])$(id).addEventListener('input',refresh);
 $('feePerUnit').addEventListener('input',updateCommission);
 $('applyPublishedFee').addEventListener('click',()=>{
  const {publishedFee}=accountReferences(selectedAccount(),selectedInstrument());
  if(publishedFee===undefined) return;
  $('feePerUnit').value=publishedFee;
  updateCommission();
 });
 for(const id of ['tickSize','pointValue','conversion','pipSize','qtyStep','minQty','minNotional'])$(id).addEventListener('input',updateSpec);
 $('lookupSpec').addEventListener('click',lookupSpec);
 $('specVerified').addEventListener('change',()=>{selectedInstrument().verified=$('specVerified').checked;save();refresh();});
 $('addAccountBtn').addEventListener('click',()=>{
  if($('newAccountPanel').hidden) openAccountPanel(false);
  else $('newAccountPanel').hidden=true;
 });
 $('createFundedBtn').addEventListener('click',()=>openAccountPanel(true));
 $('saveAccountBtn').addEventListener('click',()=>{
  const name=$('newAccountName').value.trim();if(!name){$('newAccountName').focus();return;}
  const platform = $('newAccountPlatform').value;
  const id = 'account-' + Date.now();
  const stage=$('newAccountStage').value;
  const newAccount = { id, name, platform, stage, reserve: 0, dailyRemaining: null, maxQuantity: null, verified: false };
  state.accounts.push(newAccount);state.accountId=id;
  fillAccounts();fillInstruments(true);syncAccountFields();syncSpecFields();$('newAccountPanel').hidden=true;$('newAccountName').value='';save();refresh();
 });
 $('addInstrumentBtn').addEventListener('click',()=>{$('newInstrumentPanel').hidden=!$('newInstrumentPanel').hidden;});
 $('saveInstrumentBtn').addEventListener('click',()=>{
  const symbol=$('newInstrumentSymbol').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g,'').slice(0,24),name=$('newInstrumentName').value.trim();
  if(!symbol||!name){(!symbol?$('newInstrumentSymbol'):$('newInstrumentName')).focus();return;}
  const id='instrument-'+Date.now(),s={...clone(selectedInstrument()),id,symbol,name,platform:selectedAccount().platform,verified:false,source:'Custom instrument — verify contract size, min step and currency conversion'};
  delete s.lookupAt;
  delete s.sourceUrl;
  state.instruments.push(s);state.instrumentId=id;fillInstruments();syncSpecFields();$('newInstrumentPanel').hidden=true;save();refresh();
 });
 $('copyBtn').addEventListener('click',async()=>{
  const r=currentResult;if(!r||r.status!=='CALCULATED')return;
  const a=selectedAccount(),s=selectedInstrument();
  const plan=`CHICKEN MAN — RISK DESK\nACCOUNT: ${a.name}\nINSTRUMENT: ${s.symbol}\nSIDE: ${state.side.toUpperCase()}\nMODE: ${MODES[state.mode].label} (${pct(state.modeFractions[state.mode])} of usable drawdown)\nEQUITY: ${usd(a.equity)} | FLOOR: ${usd(a.floor)} | RISK BUDGET: ${usd(r.budget)}\nENTRY: ${fmt(r.entry,10)}\nSTOP: ${fmt(r.stop,10)} (${r.stopMode==='auto'?'suggested':r.stopMode==='budget'?'drawdown budget':'manual'}) | TARGET: ${fmt(r.target,10)} (${r.targetMode==='auto'?'suggested':r.targetMode==='budget'?'drawdown budget':'stop distance'})\nORDER QUANTITY: ${fmt(r.quantity,10)} ${s.unit}\nMODELED LOSS: ${usd(r.risk)} | TARGET NET: ${usd(r.expectedReward)} | STRESS LOSS: ${usd(r.stressRisk)}\nModeled remaining floor buffer: ${usd(r.reservePostStop)}\nExecution estimates included. Not broker authorization. Stops may slip. Live rules must be checked.`;
  try{await navigator.clipboard.writeText(plan);$('copyBtn').textContent='Copied ✓';setTimeout(()=>{$('copyBtn').innerHTML='Copy position plan <span>↗</span>';},1800);}catch{const old=$('copyBtn').textContent;$('copyBtn').textContent='Clipboard unavailable — use HTTPS';setTimeout(()=>{$('copyBtn').textContent=old;},1800);}
 });
 $('resetBtn').addEventListener('click',()=>{if(!window.confirm('Reset saved accounts and instrument settings to examples?'))return;localStorage.removeItem(STORAGE_KEY);window.location.reload();});
 // Direction state survives refresh; entry and price remain illustrative until manually edited.
 for(const key of ['long','short']){$(key+'Btn').classList.toggle('active',state.side===key);$(key+'Btn').setAttribute('aria-pressed',String(state.side===key));}
 refresh();
}
init();
