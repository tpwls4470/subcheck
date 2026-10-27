import {calendar,dueItems,seoulDay,sendPush,validEndpoint,serviceWorker} from './reminders.mjs';
const ORIGIN='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function readReminderItems(env,user){const {results}=await env.DB.prepare('SELECT service_id,name,next_payment,cycle,reminder_3,reminder_day FROM subscriptions WHERE user_id=? AND deleted_at IS NULL').bind(user).all();return results.map(x=>({serviceId:x.service_id,name:x.name,nextPayment:x.next_payment,cycle:x.cycle,reminder3:!!x.reminder_3,reminderDay:!!x.reminder_day}));}
export async function dispatchReminders(env,user){
 const items=await readReminderItems(env,user),day=seoulDay(),due=dueItems(items,day);
 if(!due.length)return {due:0,accepted:0,failed:0};
 const {results}=await env.DB.prepare('SELECT device_id,endpoint,last_sent FROM push_devices WHERE user_id=?').bind(user).all();let accepted=0,failed=0;
 for(const device of results){
  if(device.last_sent===day)continue;
  const claim=await env.DB.prepare('UPDATE push_devices SET last_sent=? WHERE user_id=? AND device_id=? AND (last_sent IS NULL OR last_sent<>?)').bind(day,user,device.device_id,day).run();
  if(!claim.meta?.changes&&!claim.changes)continue;
  let status;try{status=await sendPush(device.endpoint,env);}catch{status=503;}
  if(status===404||status===410)await env.DB.prepare('DELETE FROM push_devices WHERE user_id=? AND device_id=?').bind(user,device.device_id).run();
  else if(status>=200&&status<300)accepted++;
  else {failed++;await env.DB.prepare('UPDATE push_devices SET last_sent=? WHERE user_id=? AND device_id=? AND last_sent=?').bind(device.last_sent,user,device.device_id,day).run();}
 }
 return {due:due.length,accepted,failed};
}
export async function reminderApi(req,env,user,jar,url){
 if(req.method==='GET'&&url.pathname==='/sw.js')return new Response(serviceWorker,{headers:{'content-type':'application/javascript','cache-control':'no-cache','service-worker-allowed':'/'}});
 if(req.method==='GET'&&url.pathname==='/manifest.webmanifest')return json({id:'/',name:'subcheck · 구독 알리미',short_name:'subcheck',start_url:'/',scope:'/',display:'standalone',background_color:'#f2f5fa',theme_color:'#e8f2ff',icons:[{src:'/app-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]});
 if(req.method==='GET'&&url.pathname==='/app-icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#e8f2ff"/><text x="256" y="279" text-anchor="middle" font-family="Arial,sans-serif" font-size="85" font-weight="700" fill="#203d63">subcheck</text></svg>',{headers:{'content-type':'image/svg+xml'}});
 if(!env.DB)return json({message:'알림 설정을 준비 중이에요.'},503);
 if(req.method==='GET'&&url.pathname==='/api/reminders'){
  const items=await readReminderItems(env,user);const {results}=await env.DB.prepare('SELECT device_id FROM push_devices WHERE user_id=?').bind(user).all();
  return json({items,due:dueItems(items,seoulDay()),deviceCount:results.length,publicKey:env.PUSH_PUBLIC_KEY||null,today:seoulDay()});
 }
 if(req.method==='GET'&&url.pathname==='/api/reminders/calendar')return new Response(await calendar(await readReminderItems(env,user),user),{headers:{'content-type':'text/calendar; charset=utf-8','content-disposition':'attachment; filename="subcheck-payments.ics"','cache-control':'no-store'}});
 if(req.method!=='POST')return json({message:'지원하지 않는 요청이에요.'},405);
 if(req.headers.get('origin')!==ORIGIN||req.headers.get('sec-fetch-site')==='cross-site'||!jar['__Host-subcheck-csrf']||req.headers.get('x-subcheck-csrf')!==jar['__Host-subcheck-csrf'])return json({message:'화면을 다시 열어주세요.'},403);
 let p;try{const body=await req.text();if(body.length>4096)throw Error();p=JSON.parse(body);}catch{return json({message:'요청을 확인해주세요.'},400);}
 if(!p||typeof p.deviceId!=='string'||!/^[-a-zA-Z0-9_]{20,64}$/.test(p.deviceId))return json({message:'기기 연결을 다시 시도해주세요.'},400);
 if(url.pathname==='/api/push/subscribe'){
  if(!validEndpoint(p.endpoint))return json({message:'지원되는 브라우저에서 다시 연결해주세요.'},400);
  const {results}=await env.DB.prepare('SELECT device_id FROM push_devices WHERE user_id=?').bind(user).all();
  if(results.length>=5&&!results.some(x=>x.device_id===p.deviceId))return json({message:'최대 5대까지 연결할 수 있어요.'},400);
  await env.DB.prepare('INSERT INTO push_devices(user_id,device_id,endpoint,updated_at,last_sent) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,device_id) DO UPDATE SET endpoint=excluded.endpoint,updated_at=excluded.updated_at').bind(user,p.deviceId,p.endpoint,new Date().toISOString()).run();return json({connected:true});
 }
 if(url.pathname==='/api/push/unsubscribe'){await env.DB.prepare('DELETE FROM push_devices WHERE user_id=? AND device_id=?').bind(user,p.deviceId).run();return json({connected:false});}
 if(url.pathname==='/api/push/test'){
  const {results}=await env.DB.prepare('SELECT endpoint FROM push_devices WHERE user_id=? AND device_id=?').bind(user,p.deviceId).all();if(!results[0])return json({message:'이 기기의 푸시를 먼저 연결해주세요.'},400);
  let status;try{status=await sendPush(results[0].endpoint,env);}catch{return json({message:'푸시 발송을 완료하지 못했어요.'},502);}
  return status>=200&&status<300?json({accepted:true,message:'푸시 서버에 전달했어요. 기기에서 알림 수신을 확인해주세요.'}):json({message:'기기 연결을 해제한 뒤 다시 연결해주세요.'},502);
 }
 return json({message:'요청을 찾을 수 없어요.'},404);
}
export async function reminderMcp(req,env,user){
 let p;try{p=await req.json();}catch{return json({error:'invalid request'},400);}
 const result=value=>json({jsonrpc:'2.0',id:p.id,result:value});
 if(p.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(p.method==='initialize')return result({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'subcheck-reminders',version:'1.0.0'}});
 if(p.method?.startsWith('notifications/'))return new Response(null,{status:202});
 if(p.method==='tools/list')return result({tools:[{name:'payment_reminder_status',description:'현재 사용자의 결제 알림 설정 수와 푸시 연결 기기 수를 확인합니다. 개인정보는 반환하지 않습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'send_due_payment_reminders',description:'현재 사용자가 직접 설정한 당일·3일 전 결제 알림을 연결한 기기에 보냅니다. 서울 날짜 기준 하루 한 번만 발송하며 결제나 구독을 변경하지 않습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false}}]});
 if(p.method==='tools/call'){
  try{let value;if(p.params?.name==='send_due_payment_reminders')value=await dispatchReminders(env,user);else if(p.params?.name==='payment_reminder_status'){const items=await readReminderItems(env,user),{results}=await env.DB.prepare('SELECT device_id FROM push_devices WHERE user_id=?').bind(user).all();value={enabledSubscriptions:items.filter(x=>x.reminder3||x.reminderDay).length,devices:results.length};}else throw Error();return result({content:[{type:'text',text:JSON.stringify(value)}]});}catch{return result({isError:true,content:[{type:'text',text:'결제 알림을 처리하지 못했습니다.'}]});}
 }
 return json({jsonrpc:'2.0',id:p.id,error:{code:-32601,message:'Method not found'}});
}
