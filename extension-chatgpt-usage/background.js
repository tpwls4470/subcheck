const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
let running=false;
async function sync(){
 if(running)return;running=true;
 try{const {syncEnabled,snapshot}=await chrome.storage.local.get(['syncEnabled','snapshot']);if(!syncEnabled||!snapshot)return;
 const tabs=await chrome.tabs.query({url:origin+'/*'});if(!tabs.length){await chrome.storage.local.set({syncStatus:{state:'needs_tab',at:new Date().toISOString()}});return;}
 let done=false;for(const tab of tabs){try{const result=await chrome.tabs.sendMessage(tab.id,{type:'SUBCHECK_SYNC',snapshot});if(result?.ok){done=true;break;}}catch{}}
 await chrome.storage.local.set({syncStatus:{state:done?'synced':'needs_login',at:new Date().toISOString()}});
 }finally{running=false;}
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.snapshot||changes.syncEnabled))sync();});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 const own=sender.id===chrome.runtime.id;
 if(!own)return;
 if(message?.type==='SUBCHECK_SYNC_NOW'){sync().then(()=>respond({ok:true}));return true;}
 if(message?.type==='SUBCHECK_BRIDGE_READY'&&sender.url?.startsWith(origin+'/')){sync();respond({ok:true});}
});

let billingRunning=false,billingAgain=false;const billingWaiters=[];
async function writeBillingStatus(state,observedAt,applied=false){
 const {billingSyncStatus:previous}=await chrome.storage.local.get('billingSyncStatus');
 const at=new Date().toISOString();
 await chrome.storage.local.set({billingSyncStatus:{state,at,applied,observedAt:observedAt||null,lastSuccessAt:state==='synced'?at:previous?.lastSuccessAt||null,lastSuccessObservedAt:state==='synced'?observedAt:previous?.lastSuccessObservedAt||null}});
}
async function syncBilling(){
 if(billingRunning){billingAgain=true;return new Promise(resolve=>billingWaiters.push(resolve));}billingRunning=true;
 try{do{billingAgain=false;await sendBilling();}while(billingAgain);}finally{billingRunning=false;for(const resolve of billingWaiters.splice(0))resolve();}
}
async function sendBilling(){
 let candidate;
 try{
  const d=await chrome.storage.local.get(['billingEnabled','billingCandidate']);candidate=d.billingCandidate;
  if(!d.billingEnabled){await writeBillingStatus('disabled');return;}
  if(!candidate){await writeBillingStatus('needs_capture');return;}
  const age=Date.now()-Date.parse(candidate.observedAt);
  if(!Number.isFinite(age)||age < -60000||age>=86400000){await writeBillingStatus('stale_record',candidate.observedAt);return;}
  await writeBillingStatus('sending',candidate.observedAt);
  let tabs=await chrome.tabs.query({url:origin+'/*'});
  const requestedTab=klingRefreshJob&&!klingRefreshJob.settled?tabs.find(tab=>tab.id===klingRefreshJob.sourceTabId):null;if(requestedTab)tabs=[requestedTab];
  if(!tabs.length){await writeBillingStatus('needs_tab',candidate.observedAt);return;}
  let state='needs_reload';
  for(const tab of tabs){
   try{const r=await chrome.tabs.sendMessage(tab.id,{type:'SUBCHECK_BILLING_SYNC',candidate});if(r?.ok){await writeBillingStatus('synced',candidate.observedAt,r.applied===true);return;}if(r?.state)state=r.state;}catch{}
  }
  await writeBillingStatus(state,candidate.observedAt);
 }catch{await writeBillingStatus('network_error',candidate?.observedAt);}
}
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&(c.billingCandidate||c.billingEnabled))syncBilling();});
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(m?.type==='SUBCHECK_BILLING_RETRY'){syncBilling().then(()=>respond({ok:true}));return true;}
 if(m?.type==='SUBCHECK_BRIDGE_READY'&&sender.url?.startsWith(origin+'/'))syncBilling();
});
// User-triggered, bounded read-only lookup. Never reuses or changes existing tabs.
const klingMembershipUrl='https://kling.ai/app/membership/membership-plan';
let klingRefreshJob=null,lastKlingRefreshStart=0;
function isKlingMembership(url){try{const u=new URL(url);return u.origin==='https://kling.ai'&&u.pathname==='/app/membership/membership-plan';}catch{return false;}}
async function recordRefreshStatus(state,jobId){
 const {billingRefreshStatus:old}=await chrome.storage.local.get('billingRefreshStatus');
 const at=new Date().toISOString();await chrome.storage.local.set({billingRefreshStatus:{state,jobId:jobId||null,at,lastSuccessAt:state==='synced'?at:old?.lastSuccessAt||null}});
}
async function markInterruptedRefresh(){const {billingRefreshStatus:old}=await chrome.storage.local.get('billingRefreshStatus');if(old?.state==='reading')await recordRefreshStatus('interrupted',old.jobId);}
async function closeOwnedLookup(tabId){if(tabId==null)return;try{const tab=await chrome.tabs.get(tabId);if(!tab.active)await chrome.tabs.remove(tabId);}catch{}}
async function requestKlingRefresh(sender){
 if(klingRefreshJob)return {ok:false,state:'busy'};
 // Acquire the lock before any asynchronous operation so two clicks cannot create two tabs.
 const job={sourceTabId:sender.tab.id,tabId:null,id:crypto.randomUUID(),settled:false};klingRefreshJob=job;
 const result=new Promise(resolve=>{job.resolve=resolve;});
 (async()=>{try{
  await refreshStartupCheck;
  const {billingEnabled}=await chrome.storage.local.get('billingEnabled');
  if(job.settled)return result;
  if(!billingEnabled){await finishKlingRefresh(job,{ok:false,state:'disabled'});return result;}
  if(Date.now()-lastKlingRefreshStart<15000){await finishKlingRefresh(job,{ok:false,state:'cooldown'});return result;}
  lastKlingRefreshStart=Date.now();await recordRefreshStatus('reading',job.id);
  if(job.settled)return result;
  job.timer=setTimeout(()=>finishKlingRefresh(job,{ok:false,state:'timeout'}),45000);
  const tab=await chrome.tabs.create({url:klingMembershipUrl,active:false});
  job.tabId=tab.id;if(job.settled)await closeOwnedLookup(tab.id);
 }catch{await finishKlingRefresh(job,{ok:false,state:'open_failed'});}})();
 return result;
}
async function finishKlingRefresh(job,result){
 if(job.settled)return;job.settled=true;clearTimeout(job.timer);
 await closeOwnedLookup(job.tabId);
 try{await recordRefreshStatus(result.state,job.id);}catch{}
 if(klingRefreshJob===job)klingRefreshJob=null;job.resolve(result);
}
const refreshStartupCheck=markInterruptedRefresh().catch(()=>{});
chrome.runtime.onStartup?.addListener(()=>markInterruptedRefresh().catch(()=>{}));
chrome.tabs.onRemoved?.addListener(tabId=>{const job=klingRefreshJob;if(!job||job.settled)return;if(tabId===job.tabId||tabId===job.sourceTabId)finishKlingRefresh(job,{ok:false,state:tabId===job.sourceTabId?'needs_reload':'needs_interaction'});});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.billingEnabled?.newValue===false&&klingRefreshJob)finishKlingRefresh(klingRefreshJob,{ok:false,state:'disabled'});});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(message?.type==='SUBCHECK_REQUEST_KLING_REFRESH'){
  if(sender.frameId!==0||!sender.tab?.id||!sender.url?.startsWith(origin+'/'))return;
  requestKlingRefresh(sender).then(respond).catch(()=>respond({ok:false,state:'network_error'}));return true;
 }
 const job=klingRefreshJob;if(!job||job.settled||sender.tab?.id!==job.tabId||!isKlingMembership(sender.url))return;
 if(message?.type==='SUBCHECK_KLING_READY'){respond({jobId:job.id});return;}
 if(message?.type==='SUBCHECK_KLING_REFRESH_PING'&&message.jobId===job.id){respond({ok:true});return;}
 if(message?.type==='SUBCHECK_KLING_REFRESH_RESULT'&&message.jobId===job.id){
  (async()=>{
   if(!message.ok||!message.candidate){await finishKlingRefresh(job,{ok:false,state:message.state||'unsupported_display'});respond({ok:true});return;}
   const c=message.candidate;
   if(c.service!=='kling'||c.source!=='visible_manage_dialog'||!Number.isFinite(Date.parse(c.observedAt))||Math.abs(Date.now()-Date.parse(c.observedAt))>60000){await finishKlingRefresh(job,{ok:false,state:'invalid_record'});respond({ok:false});return;}
   await chrome.storage.local.set({billingCandidate:c,billingCaptureStatus:{state:'captured',at:c.observedAt}});
   await syncBilling();
   const {billingSyncStatus:status}=await chrome.storage.local.get('billingSyncStatus');
   await finishKlingRefresh(job,{ok:status?.state==='synced',state:status?.state||'network_error',applied:status?.applied===true,observedAt:c.observedAt});respond({ok:true});
  })().catch(async()=>{await finishKlingRefresh(job,{ok:false,state:'network_error'});respond({ok:false});});return true;
 }
});
