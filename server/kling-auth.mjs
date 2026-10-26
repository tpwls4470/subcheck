import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {returnDestination,clearConnection} from './session-flow.mjs';

const folder=path.dirname(fileURLToPath(import.meta.url));
const base='http://127.0.0.1:4319';
const callback=base+'/oauth/callback';
const issuer='https://kling.ai/auth';
const resource='https://kling.ai/mcp';
const publicConfig=path.join(folder,'public-client.json');
const sessions=new Map(),states=new Map();
const random=()=>crypto.randomBytes(32).toString('base64url');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowedOrigin=h=>(!h.origin||h.origin==='null'||h.origin===base)&&h['sec-fetch-site']!=='cross-site';
let metadata,client;

async function official(url,options={}){
  if(![issuer,new URL(resource).origin].map(x=>new URL(x).origin).includes(new URL(url).origin))throw Error('Unapproved upstream');
  return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});
}
async function prepare(register=false){
  const r=await official('https://kling.ai/.well-known/oauth-authorization-server/auth');
  if(!r.ok)throw Error('OAuth metadata HTTP '+r.status);
  metadata=await r.json();
  if(metadata.issuer!==issuer||!metadata.code_challenge_methods_supported?.includes('S256'))throw Error('Unsupported issuer or PKCE');
  for(const key of ['authorization_endpoint','token_endpoint','registration_endpoint'])if(new URL(metadata[key]).origin!==new URL(issuer).origin)throw Error('Unexpected '+key);
  try{client=JSON.parse(await fs.readFile(publicConfig,'utf8'));if(client.redirect_uri!==callback||!client.client_id)throw Error('Client mismatch');}
  catch(e){if(!register)throw Error('Run once with --register before starting the probe');
    const registration=await official(metadata.registration_endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'SubCheck local read-only credit test',redirect_uris:[callback],response_types:['code'],grant_types:['authorization_code'],token_endpoint_auth_method:'none',scope:'account.credit.read'})});
    const data=await registration.json();
    if(!registration.ok||!data.client_id)throw Error('Registration HTTP '+registration.status+' '+String(data.error||'failed'));
    if(data.token_endpoint_auth_method&&data.token_endpoint_auth_method!=='none')throw Error('Unexpected confidential client; no secret saved');
    client={client_id:data.client_id,redirect_uri:callback,registered_at:new Date().toISOString(),token_endpoint_auth_method:'none'};
    await fs.writeFile(publicConfig,JSON.stringify(client,null,2));
  }
}
function session(req,res){
  const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
  let id=cookies.subcheck_kling_probe;
  if(!id||!sessions.has(id)){id=random();sessions.set(id,{csrf:random(),accessToken:null,expiresAt:0,sessionId:null,lastResult:null,lastRefresh:0,status:''});res.setHeader('set-cookie',`subcheck_kling_probe=${id}; HttpOnly; SameSite=Lax; Path=/`);}
  return {id,s:sessions.get(id)};
}
function page(s,message=''){
  message=message||s.status;
  const value=s.lastResult;
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>subcheck · 실제 연동 테스트</title><style>body{margin:0;background:#f4f8ff;color:#213b56;font:16px/1.7 system-ui,sans-serif}main{max-width:520px;margin:40px auto;padding:24px}h1{font-size:26px}section{background:white;border:1px solid #dce9f7;border-radius:20px;padding:24px;margin:20px 0}p{color:#58718b}button,a.action{display:block;box-sizing:border-box;text-decoration:none;text-align:center;background:#c4e0ff;color:#224568;border:0;border-radius:12px;padding:13px;width:100%;font:inherit;margin-top:12px;cursor:pointer}.number{font-size:42px;font-weight:700}small{font-size:13px;color:#5e748d}.status{padding:12px;border-radius:12px;background:#e7f0ff}button.secondary{background:#edf2f8}dt{color:#657b92}dd{margin:0 0 12px}</style><main><b>subcheck</b><h1>Kling 개인 유료 크레딧<br>실제 연동 테스트</h1><p>서브체크 전용 연결을 검증하는 로컬 테스트입니다. 코덱스에 연결된 로그인 정보는 복사하거나 재사용하지 않습니다.</p>${message?`<p class="status" role="status">${escape(message)}</p>`:''}<section>${value?`<small>Kling에서 조회한 개인 유료 크레딧 · 보너스·팀 미포함</small><div class="number">${escape(value.credits)} <small>크레딧</small></div><dl><dt>플랜</dt><dd>${escape(value.plan??'제공되지 않음')}</dd><dt>조회 시각</dt><dd>${escape(value.observedAt)}</dd><dt>전체 크레딧·초기화·만료일</dt><dd>응답에 없음 · 퍼센트를 계산하지 않습니다.</dd></dl>`:'<h2>1. 개인 계정 연결</h2><p>아래 버튼으로 Kling 공식 로그인 화면에서 계정을 선택하고 연결을 허용해주세요.</p>'}${s.accessToken?`<form method="post" action="/refresh"><input type="hidden" name="csrf" value="${s.csrf}"><button>실제 잔액 새로고침</button></form><form method="post" action="/disconnect"><input type="hidden" name="csrf" value="${s.csrf}"><button class="secondary">테스트 연결 지우기</button></form>`:'<a class="action" href="/connect">Kling 로그인하고 연결하기</a>'}</section><section><b>이 테스트에서 하는 일</b><p>공식 로그인과 잔액 조회만 실행합니다. 이미지·영상 생성, 크레딧 구매, 플랜 변경은 실행하지 않습니다.</p><small>인증 정보는 이 로컬 프로그램의 메모리에만 보관합니다. 프로그램을 종료하면 다시 로그인해야 합니다. 공개 서비스 출시 전에는 다른 사용자 연결과 권한 만료도 검증해야 합니다.</small></section></main></html>`;
}
function send(res,status,body,type='text/html; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'x-content-type-options':'nosniff'});res.end(body);
}
async function rpc(s,method,params,id=1){
  const headers={'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+s.accessToken};
  if(s.sessionId)headers['Mcp-Session-Id']=s.sessionId;
  if(s.protocolVersion)headers['MCP-Protocol-Version']=s.protocolVersion;
  const r=await official(resource,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(id===null?{}:{id}),method,params})});
  if(r.headers.get('mcp-session-id'))s.sessionId=r.headers.get('mcp-session-id');
  if(r.status===401){s.accessToken=null;s.expiresAt=0;throw Error('로그인 권한이 만료됐어요. 다시 연결해주세요.');}
  if(!r.ok)throw Error('Kling 조회 응답 HTTP '+r.status);
  if(id===null){await r.body?.cancel();return null;}
  let data;
  if((r.headers.get('content-type')||'').includes('text/event-stream')){
    const reader=r.body.getReader(),decoder=new TextDecoder();let buf='';
    try{while(true){const part=await reader.read();if(part.done)break;buf=(buf+decoder.decode(part.value,{stream:true})).replace(/\r\n/g,'\n');let boundary;while((boundary=buf.indexOf('\n\n'))>=0){const event=buf.slice(0,boundary);buf=buf.slice(boundary+2);const lines=event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');if(!lines)continue;const parsed=JSON.parse(lines);if(parsed.id===id){data=parsed;break;}}if(data)break;}}finally{await reader.cancel();}
  }else data=await r.json();
  if(!data||data.error)throw Error('Kling의 조회 응답을 처리하지 못했어요.');
  return data.result;
}
function unpack(result){
  if(result?.isError)throw Error('공식 조회 도구가 오류를 반환했어요.');
  let data=result?.structuredContent;
  if(!data){try{data=JSON.parse(result?.content?.find(x=>x.type==='text')?.text);}catch{throw Error('조회 응답 형식을 확인할 수 없어요.');}}
  if(data?.ok===false)throw Error('공식 조회가 실패했어요.');
  return data?.body??data;
}
function normalize(result){
  const data=unpack(result);
  const credits=data?.availableRemainCredits;
  if(typeof credits!=='number'||!Number.isFinite(credits)||credits<0)throw Error('숫자 잔액이 응답에 없어요.');
  return {service:'kling',credits,plan:data.membershipTypeDescription??null,observedAt:new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST',total:null,resetAt:null,expiresAt:null};
}
async function balance(s){
  if(!s.accessToken)throw Error('먼저 Kling에 연결해주세요.');
  if(Date.now()>=s.expiresAt){s.accessToken=null;throw Error('로그인이 만료됐어요. 다시 연결해주세요.');}
  if(Date.now()-s.lastRefresh<5000)throw Error('잠시 뒤 새로고침해주세요.');
  s.lastRefresh=Date.now();
  if(!s.initialized){const init=await rpc(s,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'subcheck-readonly-credit-probe',version:'0.1.0'}});s.protocolVersion=init.protocolVersion;await rpc(s,'notifications/initialized',{},null);s.initialized=true;}
  const tools=await rpc(s,'tools/list',{},2);
  const tool=tools.tools?.find(t=>t.name==='query_membership_and_credits');
  if(!tool)throw Error('크레딧 읽기 권한으로 조회 도구를 찾지 못했어요.');
  const args={};
  const required=tool.inputSchema?.required??[];
  if(required.length){
    const identityTool=tools.tools?.find(t=>t.name==='who_am_i');
    if(!identityTool)throw Error('조회에 필요한 공식 계정 확인 도구가 없어요.');
    if(identityTool.inputSchema?.required?.length)throw Error('지원하지 않는 계정 확인 입력 형식이에요.');
    const identity=unpack(await rpc(s,'tools/call',{name:identityTool.name,arguments:{}},4));
    for(const key of required){
      if(!['userId','user_id'].includes(key))throw Error('지원하지 않는 필수 입력이에요.');
      const value=identity.user?.userId??identity.user?.user_id??identity.user?.id??identity.userId??identity.user_id;
      if(value==null)throw Error('공식 계정 식별 응답을 확인할 수 없어요.');
      args[key]=value;
    }
  }
  s.lastResult=normalize(await rpc(s,'tools/call',{name:tool.name,arguments:args},3));
}
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(b.length>2048)throw Error('Request too large');}return new URLSearchParams(b);}
if(process.argv.includes('--register')){await prepare(true);console.log(JSON.stringify({registered:true,publicClient:true,callback,scope:'account.credit.read',credentialsSaved:false}));process.exit(0);}
if(process.argv.includes('--test')){
  const assert=(v,m)=>{if(!v)throw Error(m);};
  assert(normalize({structuredContent:{availableRemainCredits:0}}).credits===0,'zero rejected');
  assert(normalize({content:[{type:'text',text:JSON.stringify({availableRemainCredits:1192,membershipTypeDescription:'Pro'})}]}).credits===1192,'JSON balance');
  for(const n of [-1,'1192',null,undefined]){let rejected=false;try{normalize({structuredContent:{availableRemainCredits:n}});}catch{rejected=true;}assert(rejected,'invalid accepted');}
  assert(!allowedOrigin({origin:'https://foreign.example'}),'foreign origin accepted');
  assert(!allowedOrigin({'sec-fetch-site':'cross-site'}),'cross-site accepted');
  console.log('Verified zero/invalid balance handling and request origin checks');process.exit(0);
}

await prepare();
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!=='127.0.0.1:4319')return send(res,403,'Invalid host');
    const url=new URL(req.url,base),{id,s}=session(req,res);
    if(req.method==='GET'&&url.pathname==='/')return send(res,200,page(s));
    if(req.method==='GET'&&url.pathname==='/status')return send(res,200,JSON.stringify({connected:!!s.accessToken,balance:s.lastResult}), 'application/json');
    if(req.method==='GET'&&url.pathname==='/csrf')return send(res,200,JSON.stringify({csrf:s.csrf}),'application/json');
    if(req.method==='GET'&&url.pathname==='/connect'){
      const state=random(),verifier=random();states.set(state,{session:id,verifier,created:Date.now(),returnTo:returnDestination(url.searchParams.get('return'))});
      const auth=new URL(metadata.authorization_endpoint);auth.search=new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',scope:'account.credit.read',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',resource}).toString();res.writeHead(302,{'location':auth.toString(),'cache-control':'no-store','referrer-policy':'no-referrer'});return res.end();
    }
    if(req.method==='GET'&&url.pathname==='/oauth/callback'){
      const state=url.searchParams.get('state'),pending=states.get(state);states.delete(state);
      if(!pending||pending.session!==id||Date.now()-pending.created>10*60*1000)return send(res,400,page(s,'로그인 요청이 만료되었거나 일치하지 않아요. 다시 연결해주세요.'));
      if(url.searchParams.get('error'))return send(res,400,page(s,'계정 연결이 승인되지 않았어요.'));
      if(url.searchParams.has('iss')&&url.searchParams.get('iss')!==issuer)return send(res,400,page(s,'인증 서버가 일치하지 않아요.'));
      const code=url.searchParams.get('code');if(!code)return send(res,400,page(s,'로그인 확인 코드가 없어요.'));
      const r=await official(metadata.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:callback,code,code_verifier:pending.verifier})});
      const token=await r.json();if(!r.ok||!token.access_token)return send(res,400,page(s,'서브체크 전용 로그인 연결이 완료되지 않았어요.'));
      s.accessToken=token.access_token;s.expiresAt=Date.now()+Number(token.expires_in??300)*1000;s.initialized=false;
      try{await balance(s);s.status='조회 성공';}catch{s.status='로그인은 성공했지만 잔액 조회는 아직 완료되지 않았어요.';}
      res.writeHead(303,{'location':pending.returnTo||'/','cache-control':'no-store'});return res.end();
    }
    if(req.method==='POST'&&['/refresh','/disconnect'].includes(url.pathname)){
      // The synchronizer token remains mandatory when an embedded browser omits Origin.
      if(!allowedOrigin(req.headers))return send(res,403,'Invalid origin');
      const form=await body(req);if(form.get('csrf')!==s.csrf)return send(res,403,'Invalid request');
      if(url.pathname==='/disconnect'){clearConnection(s);for(const [key,value] of states)if(value.session===id)states.delete(key);return send(res,200,page(s,'이 기기의 연결 정보와 조회 잔액을 지웠어요. 클링 계정의 승인 권한 해제는 별도입니다.'));}
      try{await balance(s);return send(res,200,page(s,'Kling에서 실제 잔액을 다시 조회했어요.'));}catch(e){return send(res,400,page(s,e.message));}
    }
    return send(res,404,'Not found');
  }catch{return send(res,500,'테스트 요청을 처리하지 못했어요. 인증 정보는 표시하지 않습니다.');}
});
setInterval(()=>{const cutoff=Date.now()-10*60*1000;for(const [k,v]of states)if(v.created<cutoff)states.delete(k);for(const s of sessions.values())if(s.accessToken&&Date.now()>=s.expiresAt)s.accessToken=null;},60000).unref();
server.listen(4319,'127.0.0.1',()=>console.log('SubCheck read-only integration test: '+base));
