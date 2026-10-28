(()=>{
 let timer,lastFingerprint='',lastCapture=0;
 async function collect(){
  const {billingEnabled}=await chrome.storage.local.get('billingEnabled');if(!billingEnabled||document.visibilityState!=='visible')return;
  const dialog=document.querySelector('[role="dialog"][aria-label="Manage"], [role="dialog"][aria-label="구독 관리"]');if(!dialog||!dialog.getClientRects().length)return;
  const text=dialog.innerText,rawPlan=dialog.querySelector('h4')?.innerText?.trim();
  const koreanPlans={'프로':'Pro','스탠다드':'Standard','프리미어':'Premier','울트라+':'Ultra+'};
  const koreanPlan=rawPlan?.match(/^(프로|스탠다드|프리미어|울트라\+)\s+(월간|연간)\s+구독$/);
  const plan=koreanPlan?`${koreanPlans[koreanPlan[1]]} ${koreanPlan[2]==='월간'?'Monthly':'Yearly'} Subscription`:rawPlan;
  const amount=text.match(/(?:Next Billing Amount|다음 결제 비용)\s*[:：]\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])/);
  if(!plan||!/^[-A-Za-z0-9 +]{1,80}$/.test(plan)||!amount||!/(?:Current subscription\s*:|이미 개통한 자동 결제 갱신 세트\s*:)/i.test(text))return;
  const candidate={service:'kling',source:'visible_manage_dialog',plan,amount:Number(amount[1]),currency:'USD',channel:/(?:Billing Method|결제 방식)\s*[:：]\s*Stripe\b/.test(text)?'stripe':'unknown',observedAt:new Date().toISOString(),nextPayment:null};
  const fingerprint=JSON.stringify({...candidate,observedAt:null});if(fingerprint===lastFingerprint&&Date.now()-lastCapture<60000)return;lastFingerprint=fingerprint;lastCapture=Date.now();await chrome.storage.local.set({billingCandidate:candidate});
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>collect().catch(()=>{}),300);};
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.billingEnabled)queue();});document.addEventListener('visibilitychange',queue);queue();
})();
