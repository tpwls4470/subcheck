chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!['SUBCHECK_SYNC','SUBCHECK_BILLING_SYNC'].includes(message?.type))return;
 (async()=>{try{const settings=await chrome.storage.local.get(['syncEnabled','billingEnabled']);const billing=message.type==='SUBCHECK_BILLING_SYNC';if(!(billing?settings.billingEnabled:settings.syncEnabled))return respond({ok:false});
 const csrf=document.querySelector('meta[name="app-csrf"]')?.content;if(!csrf||csrf==='APP_CSRF_TOKEN')return respond({ok:false});
 const response=await fetch(billing?'/api/billing-candidate':'/api/usage-snapshot',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-subcheck-csrf':csrf},body:JSON.stringify(billing?message.candidate:message.snapshot)});respond({ok:response.ok});
 }catch{respond({ok:false});}})();return true;
});
chrome.runtime.sendMessage({type:'SUBCHECK_BRIDGE_READY'}).catch(()=>{});
