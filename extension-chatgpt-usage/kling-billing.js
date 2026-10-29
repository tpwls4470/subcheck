(()=>{
 let timer,lastFingerprint='',lastCapture=0,managedJob=null;
 async function captureState(state){const {billingCaptureStatus}=await chrome.storage.local.get('billingCaptureStatus');if(billingCaptureStatus?.state!==state)await chrome.storage.local.set({billingCaptureStatus:{state,at:new Date().toISOString()}});}
 function readCandidate(requireTotals=false){
  const dialog=document.querySelector('[role="dialog"][aria-label="Manage"], [role="dialog"][aria-label="구독 관리"]');
  if(!dialog||!dialog.getClientRects().length)return {state:'needs_dialog'};
  const text=dialog.innerText,rawPlan=dialog.querySelector('h4')?.innerText?.trim().replace(/\s+/g,' ');
  const koreanPlans={'프로':'Pro','스탠다드':'Standard','프리미어':'Premier','울트라+':'Ultra+'};
  const koreanPlan=rawPlan?.match(/^(프로|스탠다드|프리미어|울트라\+)\s+(월간|연간)\s+구독$/);
  const plan=koreanPlan?`${koreanPlans[koreanPlan[1]]} ${koreanPlan[2]==='월간'?'Monthly':'Yearly'} Subscription`:rawPlan;
  const amount=text.match(/(?:Next Billing Amount|다음 결제 비용)\s*[:：]\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])/);
  if(!plan||!/^[-A-Za-z0-9 +]{1,80}$/.test(plan)||!amount||!/(?:Current subscription\s*:|이미 개통한 자동 결제 갱신 세트\s*:)/i.test(text))return {state:'unsupported_display'};
  if(requireTotals){
   const subtotal=text.match(/(?:Subtotal|상품 금액)\s*[:：]\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])/),tax=text.match(/(?:Tax|세금)\s*[:：]\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])/);
   if(!subtotal||!tax||Math.abs(Number(amount[1])-Number(subtotal[1])-Number(tax[1]))>0.011)return {state:'waiting_total'};
  }
  return {candidate:{service:'kling',source:'visible_manage_dialog',plan,amount:Number(amount[1]),currency:'USD',channel:/(?:Billing Method|결제 방식)\s*[:：]\s*Stripe\b/.test(text)?'stripe':'unknown',observedAt:new Date().toISOString(),nextPayment:null}};
 }
 async function collect(){
  if(managedJob)return;
  const {billingEnabled}=await chrome.storage.local.get('billingEnabled');if(!billingEnabled)return;
  if(document.visibilityState!=='visible'){await captureState('page_hidden');return;}
  const result=readCandidate();if(!result.candidate){await captureState(result.state);return;}
  const candidate=result.candidate,fingerprint=JSON.stringify({...candidate,observedAt:null});
  if(fingerprint===lastFingerprint&&Date.now()-lastCapture<60000){await captureState('captured');return;}
  lastFingerprint=fingerprint;lastCapture=Date.now();await chrome.storage.local.set({billingCandidate:candidate,billingCaptureStatus:{state:'captured',at:candidate.observedAt}});
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>collect().catch(()=>{}),300);};
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.billingEnabled)queue();});document.addEventListener('visibilitychange',queue);queue();
 async function finishManaged(job,result){if(job.done)return;job.done=true;clearTimeout(job.timer);await chrome.runtime.sendMessage({type:'SUBCHECK_KLING_REFRESH_RESULT',jobId:job.id,...result}).catch(()=>{});}
 async function driveManaged(job){
  if(job.done)return;
  try{
   const {billingEnabled}=await chrome.storage.local.get('billingEnabled');if(!billingEnabled)return finishManaged(job,{ok:false,state:'disabled'});
   if(!job.lastPing||Date.now()-job.lastPing>8000){job.lastPing=Date.now();const alive=await chrome.runtime.sendMessage({type:'SUBCHECK_KLING_REFRESH_PING',jobId:job.id});if(!alive?.ok)return finishManaged(job,{ok:false,state:'needs_reload'});}
   const result=readCandidate(true);
   if(result.candidate){
    const fingerprint=JSON.stringify({...result.candidate,observedAt:null});
    if(fingerprint!==job.fingerprint){job.fingerprint=fingerprint;job.stableSince=Date.now();}
    if(Date.now()-job.stableSince>=1500)return finishManaged(job,{ok:true,candidate:result.candidate});
   }else{
    job.fingerprint=null;job.lastState=result.state;
    if(result.state==='needs_dialog'){
     const buttons=Array.from(document.querySelectorAll('button')).filter(b=>b.getClientRects().length&&!b.disabled);
     const manage=buttons.find(b=>/^(Manage|구독 관리)$/.test(b.innerText.trim()));
     if(manage&&!job.clicked){job.clicked=true;manage.click();}
     else if(!manage&&buttons.some(b=>/^(Log in|Log In|Sign in|Sign In|로그인|登录)$/.test(b.innerText.trim())))return finishManaged(job,{ok:false,state:'needs_kling_login'});
    }
   }
   if(Date.now()-job.started>38000)return finishManaged(job,{ok:false,state:job.lastState==='waiting_total'?'waiting_total':'needs_interaction'});
   job.timer=setTimeout(()=>driveManaged(job),750);
  }catch{return finishManaged(job,{ok:false,state:'unsupported_display'});}
 }
 let readyAttempts=0;
 function ready(){chrome.runtime.sendMessage({type:'SUBCHECK_KLING_READY'}).then(reply=>{
  if(reply?.jobId&&!managedJob){managedJob={id:reply.jobId,started:Date.now(),done:false,clicked:false};clearTimeout(timer);driveManaged(managedJob);}
  else if(!managedJob&&++readyAttempts<4)setTimeout(ready,1000);
 }).catch(()=>{});}
 ready();
})();
