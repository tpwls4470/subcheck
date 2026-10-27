const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const seoulDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function occurrences(item,from,count=13){
 if(!item.nextPayment)return [];
 const anchor=new Date(item.nextPayment+'T00:00:00Z');if(!Number.isFinite(+anchor))return [];
 const [year,month,day]=item.nextPayment.split('-').map(Number),out=[];
 if(!['monthly','yearly'].includes(item.cycle))return item.nextPayment>=from?[item.nextPayment]:[];
 const start=new Date(from+'T00:00:00Z');
 let offset=Math.max(0,item.cycle==='monthly'?(start.getUTCFullYear()-year)*12+start.getUTCMonth()-(month-1):start.getUTCFullYear()-year);
 for(let n=0;n<count+2&&out.length<count;n++,offset++){
  const y=item.cycle==='yearly'?year+offset:year,m=item.cycle==='monthly'?month-1+offset:month-1;
  const first=new Date(Date.UTC(y,m,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(day,last))).toISOString().slice(0,10);
  if(date>=from)out.push(date);
 }
 return out;
}
export function dueItems(items,today){
 return items.flatMap(item=>{const date=occurrences(item,today,1)[0];if(!date)return [];const days=(Date.parse(date)-Date.parse(today))/86400000;return (days===0&&item.reminderDay||days===3&&item.reminder3)?[{...item,dueDate:date,days}]:[];});
}
function escapeICS(text){return String(text).replaceAll('\\','\\\\').replaceAll('\r','').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,');}
function fold(line){const out=[];let part='',size=0;for(const char of line){const n=enc.encode(char).length;if(size+n>73){out.push(part);part=' ';size=1;}part+=char;size+=n;}out.push(part);return out.join('\r\n');}
export async function calendar(items,user,now=new Date()){
 const today=seoulDay(now),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//subcheck//Payment reminders//KO','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:서브체크 결제 알림'];
 for(const item of items.filter(x=>x.reminder3||x.reminderDay))for(const date of occurrences(item,today,item.cycle==='yearly'?2:13)){
  const hash=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(user+'|'+item.serviceId+'|'+date))));
  const start=date.replaceAll('-','')+'T000000Z';
  lines.push('BEGIN:VEVENT','UID:'+hash+'@subcheck','DTSTAMP:'+now.toISOString().replace(/[-:]|\.\d{3}/g,''),'DTSTART:'+start,'DURATION:PT15M','SUMMARY:'+escapeICS(item.name+' 결제 예정'),'DESCRIPTION:'+escapeICS('서브체크에 저장한 결제 일정입니다. 실제 결제 여부는 서비스에서 확인하세요. 변경·해지 시 캘린더 일정도 직접 수정해주세요.'),'URL:'+origin);
  for(const [enabled,trigger] of [[item.reminder3,'-P3D'],[item.reminderDay,'PT0S']])if(enabled)lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:구독 결제 예정','TRIGGER:'+trigger,'END:VALARM');
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function validEndpoint(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&value.length<2048&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export async function sendPush(endpoint,env){
 if(!validEndpoint(endpoint))throw Error('invalid_endpoint');
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.PUSH_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const jwt=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:origin})));
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(jwt));
 const r=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{authorization:'vapid t='+jwt+'.'+b64(new Uint8Array(sig))+', k='+env.PUSH_PUBLIC_KEY,TTL:'3600',Urgency:'normal'},body:new Uint8Array(0),signal:AbortSignal.timeout(15000)});
 await r.body?.cancel();return r.status;
}
export const serviceWorker=`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('push',e=>e.waitUntil(self.registration.showNotification('subcheck · 결제 알림',{body:'결제 알림이 도착했어요. 앱에서 예정된 구독을 확인해주세요.',icon:'/app-icon.svg',tag:'subcheck-payment',data:{url:'/?screen=reminders'}})));self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.openWindow('/?screen=reminders'));});`;
