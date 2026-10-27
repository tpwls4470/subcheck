(function(root){
 const labels=[{id:'five_hour',pattern:/^(5시간(?: 단위)? 한도|5[- ]hour(?: usage)? limit)$/i},{id:'weekly',pattern:/^(주간 사용 한도|weekly(?: usage)? limit)$/i}];
 function parseMetric({label,value,max,resetText},observedAt=Date.now()){
  const kind=labels.find(x=>x.pattern.test(String(label).trim()));
  if(!kind||value===null||value===''||max===null||max==='')return null;
  const number=Number(value),total=Number(max);if(!Number.isFinite(number)||total!==100||number<0||number>100)return null;
  const text=String(resetText||'').trim();let minutes=0,found=false;
  if(/초기화|resets? in/i.test(text))for(const [regex,multiplier] of [[/(\d+)\s*(?:일|days?)/i,1440],[/(\d+)\s*(?:시간|hours?|hrs?)/i,60],[/(\d+)\s*(?:분|minutes?|mins?)/i,1]]){const m=text.match(regex);if(m){minutes+=Number(m[1])*multiplier;found=true;}}
  return {window:kind.id,remainingPercent:number,resetEstimatedAt:found&&minutes<=14*1440?new Date(observedAt+minutes*60000).toISOString():null,resetIsEstimate:true};
 }
 function snapshot(metrics,observedAt=Date.now()){
  const parsed=metrics.map(x=>parseMetric(x,observedAt)).filter(Boolean),seen=new Set();
  if(parsed.some(x=>seen.has(x.window)||!seen.add(x.window)))return null;
  if(!parsed.length)return null;
  return {version:1,service:'chatgpt',scope:'codex_work_shared',source:'visible_settings_page',observedAt:new Date(observedAt).toISOString(),windows:parsed};
 }
 const api={parseMetric,snapshot};root.SubcheckUsageParser=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
