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
