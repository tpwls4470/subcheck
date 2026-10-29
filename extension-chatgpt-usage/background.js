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

let billingRunning=false,billingAgain=false;
async function writeBillingStatus(state,observedAt){
 const {billingSyncStatus:previous}=await chrome.storage.local.get('billingSyncStatus');
 const at=new Date().toISOString();
 await chrome.storage.local.set({billingSyncStatus:{state,at,observedAt:observedAt||null,lastSuccessAt:state==='synced'?at:previous?.lastSuccessAt||null,lastSuccessObservedAt:state==='synced'?observedAt:previous?.lastSuccessObservedAt||null}});
}
async function syncBilling(){
 if(billingRunning){billingAgain=true;return;}billingRunning=true;
 try{do{billingAgain=false;await sendBilling();}while(billingAgain);}finally{billingRunning=false;}
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
  const tabs=await chrome.tabs.query({url:origin+'/*'});
  if(!tabs.length){await writeBillingStatus('needs_tab',candidate.observedAt);return;}
  let state='needs_reload';
  for(const tab of tabs){
   try{const r=await chrome.tabs.sendMessage(tab.id,{type:'SUBCHECK_BILLING_SYNC',candidate});if(r?.ok){await writeBillingStatus('synced',candidate.observedAt);return;}if(r?.state)state=r.state;}catch{}
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
