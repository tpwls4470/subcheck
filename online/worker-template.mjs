import {reminderApi,reminderMcp,checkUsageAlert} from '../reminder-api.mjs';
const ORIGIN='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const CALLBACK=ORIGIN+'/oauth/kling/callback';
const AUTH='https://kling.ai/auth';
const RESOURCE='https://kling.ai/mcp';
const HTML=__APP_HTML__;
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const encoder=new TextEncoder();
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function unb64(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),x=>x.charCodeAt(0));}
function cookies(req){return Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')));}
async function key(env){return crypto.subtle.importKey('raw',unb64(env.SUBCHECK_SEAL_KEY),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,user,env){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(user)},await key(env),encoder.encode(JSON.stringify(value)));
  return b64(iv)+'.'+b64(new Uint8Array(data));
}
export async function unseal(value,user,env){
  try{const [iv,data]=value.split('.');const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode(user)},await key(env),unb64(data));return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
function cookie(name,value,age){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;}
function response(data,status=200,type='application/json; charset=utf-8',extra={}){
  const headers=new Headers({'content-type':type,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",...extra});
  return new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers});
}
function redirect(path){return response('',303,'text/plain',{location:path});}
async function official(url,options={}){
  if(![AUTH+'/token',AUTH+'/revoke',AUTH+'/authorize',RESOURCE].includes(url))throw Error('upstream');
  try{
    // Workers supports manual redirects; never follow provider redirects with tokens.
    const timeout=typeof AbortSignal.timeout==='function'?AbortSignal.timeout(20000):undefined;
    const res=await fetch(url,{...options,redirect:'manual',...(timeout?{signal:timeout}:{})});
    return res;
  }catch(error){console.error('[subcheck upstream]',String(error.message).slice(0,240));throw Error('provider_unreachable');}
}
async function tokenExchange(body){
  const r=await official(AUTH+'/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
  if(!r.ok)throw Error('token_'+r.status);
  const value=await r.json();
  if(typeof value.access_token!=='string'||!value.access_token)throw Error('token');
  return value;
}
function applyToken(session,token){
  session.accessToken=token.access_token;
  if(token.refresh_token)session.refreshToken=token.refresh_token;
  const seconds=Number(token.expires_in);
  session.expiresAt=Date.now()+(Number.isFinite(seconds)&&seconds>0?seconds:300)*1000;
  session.initialized=false;session.sessionId=null;
}
async function sessionCookie(session,user,env){
  let value=await seal(session,user,env);
  if(value.length>3700){delete session.refreshToken;value=await seal(session,user,env);}
  if(value.length>3700)throw Error('cookie_size');
  return cookie('__Host-subcheck-kling',value,7*24*3600);
}
async function rpc(session,method,params,id){
  if(method==='tools/call'&&!['who_am_i','query_membership_and_credits'].includes(params?.name))throw Error('forbidden_tool');
  const headers={'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+session.accessToken};
  if(session.sessionId)headers['Mcp-Session-Id']=session.sessionId;
  if(session.protocolVersion)headers['MCP-Protocol-Version']=session.protocolVersion;
  const r=await official(RESOURCE,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(id===null?{}:{id}),method,params})});
  if(!r.ok)throw Error(r.status===401?'expired':'upstream');
  if(r.headers.get('mcp-session-id'))session.sessionId=r.headers.get('mcp-session-id');
  if(id===null){await r.body?.cancel();return null;}
  let data;
  if((r.headers.get('content-type')||'').includes('text/event-stream')){
    const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
    try{while(!data){const part=await reader.read();if(part.done)break;buffer=(buffer+decoder.decode(part.value,{stream:true})).replaceAll('\r\n','\n');let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);const text=event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');if(text){const obj=JSON.parse(text);if(obj.id===id){data=obj;break;}}}}}finally{await reader.cancel();}
  }else data=await r.json();
  if(!data||data.error)throw Error('rpc');
  return data.result;
}
function unpack(result){
  if(result?.isError)throw Error('tool');
  const value=result?.structuredContent??JSON.parse(result?.content?.find(x=>x.type==='text')?.text);
  if(value?.ok===false)throw Error('tool');
  return value?.body??value;
}
export function normalize(result){
  const value=unpack(result),credits=value?.availableRemainCredits;
  if(typeof credits!=='number'||!Number.isFinite(credits)||credits<0)throw Error('balance');
  return {service:'kling',credits,plan:typeof value.membershipTypeDescription==='string'?value.membershipTypeDescription:null,observedAt:new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST',total:null,resetAt:null,expiresAt:null};
}
async function readBalance(session,env){
  if(!session?.accessToken)throw Error('expired');
  if(session.expiresAt<Date.now()+30000){
    if(!session.refreshToken)throw Error('expired');
    applyToken(session,await tokenExchange({grant_type:'refresh_token',client_id:env.KLING_CLIENT_ID,refresh_token:session.refreshToken}));
  }
  if(Date.now()-(session.lastRefresh||0)<5000)throw Error('cooldown');
  session.lastRefresh=Date.now();
  if(!session.initialized){const init=await rpc(session,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'subcheck-mobile-readonly',version:'0.2.0'}},1);session.protocolVersion=init.protocolVersion;await rpc(session,'notifications/initialized',{},null);session.initialized=true;}
  const tools=(await rpc(session,'tools/list',{},2)).tools;
  const tool=tools?.find(x=>x.name==='query_membership_and_credits');if(!tool)throw Error('no_balance_tool');
  const args={};
  const required=tool.inputSchema?.required||[];
  if(required.length){
    const identityTool=tools.find(x=>x.name==='who_am_i');if(!identityTool||identityTool.inputSchema?.required?.length)throw Error('identity');
    const identity=unpack(await rpc(session,'tools/call',{name:'who_am_i',arguments:{}},3));
    for(const field of required){if(!['userId','user_id'].includes(field))throw Error('identity');const value=identity.user?.userId??identity.user?.user_id??identity.user?.id??identity.userId??identity.user_id;if(value==null)throw Error('identity');args[field]=value;}
  }
  session.balance=normalize(await rpc(session,'tools/call',{name:tool.name,arguments:args},4));
}
export function validateSubscription(value){
  if(!value||typeof value!=='object')throw Error('invalid');
  const serviceId=value.serviceId;
  if(typeof serviceId!=='string'||!/^[-a-z0-9]{1,48}$/.test(serviceId))throw Error('invalid');
  const name=typeof value.name==='string'?value.name.trim():'';
  const plan=typeof value.plan==='string'?value.plan.trim():'';
  if(!name||name.length>80||plan.length>80)throw Error('invalid');
  const currency=value.currency||'KRW';if(!['USD','KRW'].includes(currency))throw Error('invalid');
  const amount=value.amount==null?null:value.amount;
  if(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100000000||!Number.isSafeInteger(Math.round(amount*(currency==='USD'?100:1)))||Math.abs(amount*(currency==='USD'?100:1)-Math.round(amount*(currency==='USD'?100:1)))>0.000001))throw Error('invalid');
  const nextPayment=value.nextPayment||null;
  if(nextPayment&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextPayment)||Number.isNaN(Date.parse(nextPayment))||new Date(nextPayment).toISOString().slice(0,10)!==nextPayment))throw Error('invalid');
  const cycle=value.cycle||'unknown',channel=value.channel||'unknown';
  if(!['monthly','yearly','unknown'].includes(cycle)||!["unknown","website","appstore","googleplay","creditcard","debitcard","naverpay","kakaopay","tosspay","paypal","applepay","samsungpay","banktransfer","other","stripe"].includes(channel))throw Error('invalid');
  for(const k of ['reminder3','reminderDay'])if(value[k]!==undefined&&typeof value[k]!=='boolean')throw Error('invalid');
  return {serviceId,name,plan:plan||null,amount,currency,nextPayment,cycle,channel,reminder3:value.reminder3===true,reminderDay:value.reminderDay===true};
}
function publicSubscription(row){return {serviceId:row.service_id,name:row.name,plan:row.plan,amount:row.amount==null?null:(row.currency==='USD'?row.amount/100:row.amount),currency:row.currency||'KRW',nextPayment:row.next_payment,cycle:row.cycle,channel:row.channel,updatedAt:row.updated_at,reminder3:!!row.reminder_3,reminderDay:!!row.reminder_day};}
async function subscriptionApi(req,env,user,jar,url){
  if(!env.DB)return response({message:'구독 저장 기능을 준비 중이에요.'},503);
  if(req.method==='GET'){
    const result=await env.DB.prepare('SELECT service_id,name,plan,amount,currency,next_payment,cycle,channel,updated_at,reminder_3,reminder_day FROM subscriptions WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200').bind(user).all();
    return response({items:result.results.map(publicSubscription)});
  }
  if(req.method!=='POST')return response({message:'지원하지 않는 요청이에요.'},405);
  if(req.headers.get('origin')!==ORIGIN||req.headers.get('sec-fetch-site')==='cross-site'||!jar['__Host-subcheck-csrf']||req.headers.get('x-subcheck-csrf')!==jar['__Host-subcheck-csrf'])return response({message:'화면을 다시 열고 시도해주세요.'},403);
  let payload;
  try{const text=await req.text();if(text.length>4096)throw Error('invalid');payload=JSON.parse(text);}catch{return response({message:'입력한 구독 정보를 확인해주세요.'},400);}
  if(url.pathname==='/api/subscriptions/remove'){
    if(typeof payload.serviceId!=='string'||!/^[-a-z0-9]{1,48}$/.test(payload.serviceId))return response({message:'구독 항목을 확인해주세요.'},400);
    await env.DB.prepare('UPDATE subscriptions SET deleted_at=?,updated_at=? WHERE user_id=? AND service_id=?').bind(new Date().toISOString(),new Date().toISOString(),user,payload.serviceId).run();
    return response({removed:true});
  }
  let value;try{value=validateSubscription(payload);}catch{return response({message:'서비스명·금액·결제일을 확인해주세요.'},400);}
  const updatedAt=new Date().toISOString();
  await env.DB.prepare('INSERT INTO subscriptions(user_id,service_id,name,plan,amount,next_payment,cycle,channel,updated_at,deleted_at,reminder_3,reminder_day,currency) VALUES(?,?,?,?,?,?,?,?,?,NULL,?,?,?) ON CONFLICT(user_id,service_id) DO UPDATE SET name=excluded.name,plan=excluded.plan,amount=excluded.amount,next_payment=excluded.next_payment,cycle=excluded.cycle,channel=excluded.channel,updated_at=excluded.updated_at,deleted_at=NULL,reminder_3=excluded.reminder_3,reminder_day=excluded.reminder_day,currency=excluded.currency').bind(user,value.serviceId,value.name,value.plan,value.amount==null?null:Math.round(value.amount*(value.currency==='USD'?100:1)),value.nextPayment,value.cycle,value.channel,updatedAt,Number(value.reminder3),Number(value.reminderDay),value.currency).run();
  return response({item:{...value,updatedAt}});
}

export default {async fetch(req,env){
  try{
    const url=new URL(req.url);
    if(url.origin!==ORIGIN)return response({message:'허용되지 않은 주소예요.'},403);
    const user=req.headers.get('oai-authenticated-user-id');
    if(!user)return response({message:'ChatGPT 로그인이 필요해요.'},401);
    if(!env.KLING_CLIENT_ID||!env.SUBCHECK_SEAL_KEY)return response({message:'온라인 연결 설정을 준비 중이에요.'},503);
    if(req.method==='GET'&&url.pathname==='/api/account'){
      const email=req.headers.get('oai-authenticated-user-email')||'';
      const maskedEmail=email.includes('@')?email.replace(/^(.)([^@]*)(@.*)$/,(all,first,rest,domain)=>first+'***'+domain):null;
      return response({authenticated:true,provider:'ChatGPT',email:maskedEmail});
    }
    const jar=cookies(req);
    if(url.pathname==='/mcp'&&req.method==='POST')return reminderMcp(req,env,user);
    if(url.pathname.startsWith('/icons/')||['/sw.js','/manifest.webmanifest','/app-icon.svg'].includes(url.pathname)||url.pathname.startsWith('/api/reminders')||url.pathname.startsWith('/api/push/')||url.pathname==='/api/usage-alerts'||url.pathname==='/api/usage-snapshot'||url.pathname==='/api/exchange-rate'||url.pathname==='/api/billing-candidate')return reminderApi(req,env,user,jar,url);
    if(['/api/subscriptions','/api/subscriptions/remove'].includes(url.pathname))return subscriptionApi(req,env,user,jar,url);
    if(req.method==='GET'&&url.pathname==='/'){
      const csrf=jar['__Host-subcheck-csrf']||random();
      const page=HTML.replace('APP_CSRF_TOKEN',csrf);
      const res=response(page,200,'text/html; charset=utf-8');res.headers.append('set-cookie',cookie('__Host-subcheck-csrf',csrf,86400));return res;
    }
    if(req.method==='GET'&&url.pathname==='/connect'){
      const state=random(),verifier=random();const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
      const auth=new URL(AUTH+'/authorize');auth.search=new URLSearchParams({client_id:env.KLING_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'account.credit.read',state,code_challenge:challenge,code_challenge_method:'S256',resource:RESOURCE}).toString();
      const res=redirect(auth.toString());res.headers.append('set-cookie',cookie('__Host-subcheck-pending',await seal({state,verifier,created:Date.now()},user,env),600));return res;
    }
    if(req.method==='GET'&&url.pathname==='/oauth/kling/callback'){
      const pending=await unseal(jar['__Host-subcheck-pending']||'',user,env);
      if(!pending||pending.state!==url.searchParams.get('state')||Date.now()-pending.created>600000)return redirect('/?connection=expired');
      const failed=(reason='authorization')=>{const stage=/^(token_\d{3}|token|cookie_size|provider_unreachable|authorization)$/.test(reason)?reason:'internal';const res=redirect('/?connection=failed&stage='+stage);res.headers.append('set-cookie',cookie('__Host-subcheck-pending','',0));return res;};
      if(url.searchParams.get('error')||!url.searchParams.get('code')||(url.searchParams.has('iss')&&url.searchParams.get('iss')!==AUTH))return failed();
      try{
        const session={};applyToken(session,await tokenExchange({grant_type:'authorization_code',client_id:env.KLING_CLIENT_ID,redirect_uri:CALLBACK,code:url.searchParams.get('code'),code_verifier:pending.verifier}));
        try{await readBalance(session,env);}catch{session.queryFailed=true;}
        const res=redirect('/?connection=ready');res.headers.append('set-cookie',await sessionCookie(session,user,env));res.headers.append('set-cookie',cookie('__Host-subcheck-pending','',0));return res;
      }catch(error){return failed(error.message);}
    }
    const session=await unseal(jar['__Host-subcheck-kling']||'',user,env);
    if(req.method==='GET'&&url.pathname==='/api/kling/status')return response({connected:!!session?.accessToken&&(session.expiresAt>Date.now()||!!session.refreshToken),balance:session?.balance??null});
    if(req.method==='POST'&&['/api/kling/refresh','/api/kling/disconnect'].includes(url.pathname)){
      if(req.headers.get('origin')!==ORIGIN||req.headers.get('sec-fetch-site')==='cross-site'||!jar['__Host-subcheck-csrf']||req.headers.get('x-subcheck-csrf')!==jar['__Host-subcheck-csrf'])return response({message:'화면을 다시 열고 시도해주세요.'},403);
      if(url.pathname.endsWith('/disconnect')){
        let revoked=false;
        if(session?.accessToken){try{const r=await official(AUTH+'/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.KLING_CLIENT_ID,token:session.refreshToken||session.accessToken,token_type_hint:session.refreshToken?'refresh_token':'access_token'})});revoked=r.ok;await r.body?.cancel();}catch{}}
        const res=response({connected:false,balance:null,message:revoked?'클링 토큰 폐기 요청을 완료하고 이 기기의 연결 정보를 지웠어요.':'이 기기의 연결 정보를 지웠어요. 클링 계정의 승인 권한 취소는 별도로 확인해주세요.'});
        res.headers.append('set-cookie',cookie('__Host-subcheck-kling','',0));res.headers.append('set-cookie',cookie('__Host-subcheck-pending','',0));return res;
      }
      if(!session)return response({message:'클링 계정을 연결해주세요.'},401);
      try{await readBalance(session,env);let usageAlert=null;try{usageAlert=await checkUsageAlert(env,user,session.balance);}catch{}const res=response({connected:true,balance:session.balance,usageAlert});res.headers.append('set-cookie',await sessionCookie(session,user,env));return res;}
      catch(error){const message=error.message==='expired'?'클링 연결이 만료됐어요. 다시 연결해주세요.':error.message==='cooldown'?'잠시 뒤 다시 새로고침해주세요.':'클링 잔액을 조회하지 못했어요. 마지막 확인 정보를 유지합니다.';return response({message},error.message==='expired'?401:400);}
    }
    return response({message:'페이지를 찾을 수 없어요.'},404);
  }catch{return response({message:'연결 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'},500);}
}};
