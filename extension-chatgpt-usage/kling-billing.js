(()=>{
 let timer,lastFingerprint='',lastCapture=0;
 async function collect(){
  const {billingEnabled}=await chrome.storage.local.get('billingEnabled');if(!billingEnabled||document.visibilityState!=='visible')return;
  const dialog=document.querySelector('[role="dialog"][aria-label="Manage"]');if(!dialog||!dialog.getClientRects().length)return;
  const text=dialog.innerText,plan=dialog.querySelector('h4')?.innerText?.trim();
  const amount=text.match(/Next Billing Amount:\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])/);
  if(!plan||!/^[-A-Za-z0-9 +]{1,80}$/.test(plan)||!amount||!/Current subscription:/i.test(text))return;
  const candidate={service:'kling',source:'visible_manage_dialog',plan,amount:Number(amount[1]),currency:'USD',channel:/Billing Method:\s*Stripe\b/.test(text)?'stripe':'unknown',observedAt:new Date().toISOString(),nextPayment:null};
  const fingerprint=JSON.stringify({...candidate,observedAt:null});if(fingerprint===lastFingerprint&&Date.now()-lastCapture<60000)return;lastFingerprint=fingerprint;lastCapture=Date.now();await chrome.storage.local.set({billingCandidate:candidate});
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>collect().catch(()=>{}),300);};
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.billingEnabled)queue();});document.addEventListener('visibilitychange',queue);queue();
})();
