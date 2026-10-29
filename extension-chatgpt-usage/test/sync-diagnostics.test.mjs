import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const background=fs.readFileSync(new URL('../background.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../bridge.js',import.meta.url),'utf8');
async function runSync({tabs=[{id:1}],reply={ok:true},candidate={observedAt:new Date().toISOString()},previous,fail=false}={}){
 const data={billingEnabled:true,billingCandidate:candidate,billingSyncStatus:previous};let sent=0;
 const context={Date,Number,chrome:{storage:{local:{async get(){return data;},async set(value){Object.assign(data,value);}},onChanged:{addListener(){}}},runtime:{id:'own',onMessage:{addListener(){}}},tabs:{async query(){return tabs;},async sendMessage(){sent++;if(fail)throw Error('no bridge');return reply;}}}};
 vm.runInNewContext(background,context);await context.syncBilling();return {data,sent};
}
test('billing distinguishes missing tab, unloaded bridge and server failures',async()=>{
 assert.equal((await runSync({tabs:[]})).data.billingSyncStatus.state,'needs_tab');
 assert.equal((await runSync({fail:true})).data.billingSyncStatus.state,'needs_reload');
 for(const state of ['needs_login','permission_denied','invalid_record','network_error','server_error'])assert.equal((await runSync({reply:{ok:false,state}})).data.billingSyncStatus.state,state);
});
test('stale record is not transmitted; failures retain last confirmed success',async()=>{
 const stale=await runSync({candidate:{observedAt:new Date(Date.now()-86400001).toISOString()}});assert.equal(stale.sent,0);assert.equal(stale.data.billingSyncStatus.state,'stale_record');
 const previous={lastSuccessAt:'2026-10-01T00:00:00Z',lastSuccessObservedAt:'2026-10-01T00:00:00Z'};
 const failed=await runSync({reply:{ok:false,state:'server_error'},previous});assert.equal(failed.data.billingSyncStatus.lastSuccessAt,previous.lastSuccessAt);
 const success=await runSync();assert.equal(success.data.billingSyncStatus.state,'synced');assert.ok(success.data.billingSyncStatus.lastSuccessAt);
});
async function runBridge(status,{type='application/json',redirected=false,networkError=false}={}){
 let listener,requests=0;const context={document:{querySelector:()=>({content:'test-csrf'})},fetch:async()=>{requests++;if(networkError)throw Error();return {status,ok:status>=200&&status<300,redirected,headers:{get:()=>type}};},chrome:{runtime:{id:'own',onMessage:{addListener(fn){listener=fn;}},sendMessage:async()=>{}},storage:{local:{get:async()=>({billingEnabled:true})}}}};vm.runInNewContext(bridge,context);
 const result=await new Promise(resolve=>listener({type:'SUBCHECK_BILLING_SYNC',candidate:{}},{id:'own'},resolve));return {result,requests};
}
test('bridge never mistakes a login HTML page for successful synchronization',async()=>{
 assert.equal((await runBridge(200,{type:'text/html'})).result.state,'needs_login');
 assert.equal((await runBridge(200,{redirected:true})).result.ok,false);
 assert.equal((await runBridge(401)).result.state,'needs_login');
 assert.equal((await runBridge(403)).result.state,'permission_denied');
 assert.equal((await runBridge(400)).result.state,'invalid_record');
 assert.equal((await runBridge(500)).result.state,'server_error');
 assert.equal((await runBridge(200,{networkError:true})).result.state,'network_error');
 assert.equal((await runBridge(200)).result.ok,true);
});

test('popup labels server success as pending review and displays extension version',async()=>{
 const nodes=new Map();const get=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',addEventListener(){}});return nodes.get(key);};
 const context={Date,Number,document:{querySelector:get},chrome:{runtime:{getManifest:()=>({version:'0.4.0'})},storage:{local:{get:async()=>({billingEnabled:true,billingCandidate:{observedAt:new Date().toISOString()},billingSyncStatus:{state:'synced',lastSuccessAt:new Date().toISOString()},billingCaptureStatus:{state:'captured'}})},onChanged:{addListener(){}}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../popup.js',import.meta.url),'utf8'),context);await new Promise(r=>setImmediate(r));
 assert.equal(get('#extensionVersion').textContent,'버전 0.4.0');
 assert.match(get('#billingStatus').textContent,/① 화면 읽기/);assert.match(get('#billingStatus').textContent,/② 서버 전송/);assert.match(get('#billingStatus').textContent,/③ 앱 반영/);
 assert.match(get('#billingStatus').textContent,/아직 구독에 자동 저장된 것은 아니에요/);assert.equal(get('#billingRetry').disabled,false);
});
