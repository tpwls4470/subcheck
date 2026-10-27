(()=>{
 let timer,active=false;
 async function collect(){
  if(!active||location.origin!=='https://chatgpt.com'||location.pathname!=='/settings/usage'||document.visibilityState!=='visible')return;
  const main=document.querySelector('main');if(!main||!['사용량','Usage'].includes(main.querySelector('h1')?.innerText?.trim()))return;
  const inputs=[];
  for(const bar of main.querySelectorAll('progress[aria-label="남은 사용량"],progress[aria-label="Remaining usage"]')){
   if(!bar.getClientRects().length)continue;
   let region=bar;
   for(let n=0;n<4;n++)region=region?.parentElement;
   if(!region||region.querySelectorAll('progress').length!==1)continue;
   const lines=region.innerText.split('\n').map(x=>x.trim()).filter(Boolean);
   inputs.push({label:lines[0],value:bar.getAttribute('value'),max:bar.getAttribute('max'),resetText:lines.find(x=>/초기화|resets? in/i.test(x))||''});
  }
  const snapshot=SubcheckUsageParser.snapshot(inputs);
  if(snapshot)await chrome.storage.local.set({snapshot,lastCheck:{at:new Date().toISOString(),status:'captured'}});
  else await chrome.storage.local.set({lastCheck:{at:new Date().toISOString(),status:'no_supported_metrics'}});
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>collect().catch(()=>{}),700);};
 chrome.storage.local.get('enabled').then(x=>{active=x.enabled===true;queue();});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.enabled){active=changes.enabled.newValue===true;if(active)queue();}});
 new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','max']});
 document.addEventListener('visibilitychange',queue);setInterval(queue,60000);
})();
