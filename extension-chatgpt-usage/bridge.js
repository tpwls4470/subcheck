chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!['SUBCHECK_SYNC','SUBCHECK_BILLING_SYNC'].includes(message?.type))return;
 (async()=>{try{const settings=await chrome.storage.local.get(['syncEnabled','billingEnabled']);const billing=message.type==='SUBCHECK_BILLING_SYNC';if(!(billing?settings.billingEnabled:settings.syncEnabled))return respond({ok:false,state:'disabled'});
 const csrf=document.querySelector('meta[name="app-csrf"]')?.content;if(!csrf||csrf==='APP_CSRF_TOKEN')return respond({ok:false,state:'needs_login'});
 const response=await fetch(billing?'/api/billing-candidate':'/api/usage-snapshot',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(12000),headers:{'content-type':'application/json','x-subcheck-csrf':csrf},body:JSON.stringify(billing?message.candidate:message.snapshot)});
 const json=(response.headers.get('content-type')||'').includes('application/json');
 const state=response.status===401||response.redirected||response.ok&&!json?'needs_login':response.status===403?'permission_denied':response.status===400?'invalid_record':response.status===429?'rate_limited':response.status>=500?'server_error':response.ok?'synced':'rejected';
 let applied=false;if(billing&&response.ok&&json&&!response.redirected){const data=await response.json();applied=data.applied===true;}
 respond({ok:response.ok&&json&&!response.redirected,state,applied});
 }catch{respond({ok:false,state:'network_error'});}})();return true;
});
chrome.runtime.sendMessage({type:'SUBCHECK_BRIDGE_READY'}).catch(()=>{});
// A real click in the authorized Subcheck tab is required. Page scripts cannot invoke this via an untrusted event.
let billingRefreshInFlight=false;
document.documentElement.setAttribute('data-subcheck-background-refresh',chrome.runtime.getManifest().version);
function reportBackgroundRefresh(result){document.dispatchEvent(new CustomEvent('subcheck:kling-refresh-status',{detail:JSON.stringify(result)}));}
document.addEventListener('click',async event=>{
 if(!event.isTrusted||!event.target.closest('#subcheck-design [data-refresh],#subcheck-design [data-live-refresh],#subcheck-design [data-bg-kling-refresh]')||billingRefreshInFlight)return;
 billingRefreshInFlight=true;reportBackgroundRefresh({state:'reading'});
 try{const result=await chrome.runtime.sendMessage({type:'SUBCHECK_REQUEST_KLING_REFRESH'});reportBackgroundRefresh(result||{ok:false,state:'needs_reload'});}
 catch{reportBackgroundRefresh({ok:false,state:'needs_reload'});}finally{billingRefreshInFlight=false;}
},true);
