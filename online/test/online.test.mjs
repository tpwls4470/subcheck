import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{seal,unseal,normalize} from '../worker/index.js';
import {randomBytes} from 'node:crypto';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const env={SUBCHECK_SEAL_KEY:randomBytes(32).toString('base64url'),KLING_CLIENT_ID:'test-client'};
const identity={'oai-authenticated-user-id':'test-owner'};
const req=(path,options={})=>new Request(origin+path,{...options,headers:{...identity,...options.headers}});
const parts=res=>res.headers.getSetCookie().map(x=>x.split(';')[0]);
const jar=(...items)=>items.flat().join('; ');
test('sealed credentials resist tampering and are bound to site identity',async()=>{
  const value=await seal({accessToken:'fixture-secret'},'user-A',env);
  assert.equal(value.includes('fixture-secret'),false);
  assert.equal((await unseal(value,'user-A',env)).accessToken,'fixture-secret');
  assert.equal(await unseal(value,'user-B',env),null);
  assert.equal(await unseal('broken.'+value,'user-A',env),null);
});
test('balance rejects missing/negative values and preserves zero',()=>{
  assert.equal(normalize({structuredContent:{availableRemainCredits:0}}).credits,0);
  for(const value of [null,-1,'1000'])assert.throws(()=>normalize({structuredContent:{availableRemainCredits:value}}));
});
test('anonymous access and cross-origin mutation are denied',async()=>{
  assert.equal((await worker.fetch(new Request(origin+'/'),env)).status,401);
  assert.equal((await worker.fetch(req('/api/kling/disconnect',{method:'POST',headers:{origin:'https://other.example'}}),env)).status,403);
});
test('OAuth callback, readonly balance and disconnect lifecycle with provider fixtures',async()=>{
  const root=await worker.fetch(req('/'),env);const html=await root.text();
  const csrf=html.match(/name="app-csrf" content="([^"]+)"/)[1];
  const csrfCookie=parts(root);
  const connect=await worker.fetch(req('/connect'),env);
  const auth=new URL(connect.headers.get('location'));
  assert.equal(auth.searchParams.get('scope'),'account.credit.read');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
  assert.equal(auth.searchParams.get('redirect_uri'),origin+'/oauth/kling/callback');
  const pendingCookie=parts(connect);
  const invalid=await worker.fetch(req('/oauth/kling/callback?code=fixture&state=wrong',{headers:{cookie:jar(pendingCookie)}}),env);
  assert.equal(invalid.headers.get('location'),'/?connection=expired');
  const previous=globalThis.fetch;let calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));
    if(String(url).endsWith('/token'))return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600});
    if(String(url).endsWith('/revoke'))return new Response(null,{status:200});
    assert.equal(String(url),'https://kling.ai/mcp');
    const rpc=JSON.parse(options.body);let result={};
    if(rpc.method==='initialize')result={protocolVersion:'2025-03-26'};
    else if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    else if(rpc.method==='tools/list')result={tools:[{name:'query_membership_and_credits',inputSchema:{required:['userId']}},{name:'who_am_i',inputSchema:{}}]};
    else if(rpc.method==='tools/call'&&rpc.params.name==='who_am_i')result={structuredContent:{user:{userId:'fixture-user'}}};
    else if(rpc.method==='tools/call'&&rpc.params.name==='query_membership_and_credits')result={structuredContent:{availableRemainCredits:1000,membershipTypeDescription:'Pro'}};
    else assert.fail('Unexpected provider operation');
    return Response.json({jsonrpc:'2.0',id:rpc.id,result});
  };
  try{
    const callback=await worker.fetch(req('/oauth/kling/callback?code=fixture&state='+auth.searchParams.get('state'),{headers:{cookie:jar(pendingCookie)}}),env);
    assert.equal(callback.headers.get('location'),'/?connection=ready');
    const sessionCookie=parts(callback).find(x=>x.startsWith('__Host-subcheck-kling='));
    assert.ok(sessionCookie);assert.equal(sessionCookie.includes('fixture-access'),false);
    const status=await worker.fetch(req('/api/kling/status',{headers:{cookie:sessionCookie}}),env);
    const data=await status.json();assert.equal(data.connected,true);assert.equal(data.balance.credits,1000);
    assert.equal(JSON.stringify(data).includes('fixture-access'),false);
    assert.equal(JSON.stringify(data).includes('fixture-user'),false);
    const result=await worker.fetch(req('/api/kling/disconnect',{method:'POST',headers:{origin,cookie:jar(csrfCookie,sessionCookie),'x-subcheck-csrf':csrf}}),env);
    assert.equal(result.status,200);assert.equal((await result.json()).connected,false);
    assert.ok(result.headers.getSetCookie().some(x=>x.startsWith('__Host-subcheck-kling=;')&&x.includes('Max-Age=0')));
    assert.ok(calls.some(x=>x.endsWith('/revoke')));
  }finally{globalThis.fetch=previous;}
});
