chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||message?.type!=='SUBCHECK_SYNC')return;
 (async()=>{try{const {syncEnabled}=await chrome.storage.local.get('syncEnabled');if(!syncEnabled)return respond({ok:false});
 const csrf=document.querySelector('meta[name="app-csrf"]')?.content;if(!csrf||csrf==='APP_CSRF_TOKEN')return respond({ok:false});
 const response=await fetch('/api/usage-snapshot',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-subcheck-csrf':csrf},body:JSON.stringify(message.snapshot)});respond({ok:response.ok});
 }catch{respond({ok:false});}})();return true;
});
chrome.runtime.sendMessage({type:'SUBCHECK_BRIDGE_READY'}).catch(()=>{});
