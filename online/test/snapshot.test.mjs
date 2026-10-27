import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import worker from '../worker/index.js';import {validateSnapshot} from '../reminder-api.mjs';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const sample=(at=new Date().toISOString())=>({version:1,service:'chatgpt',scope:'codex_work_shared',source:'visible_settings_page',observedAt:at,windows:[{window:'five_hour',remainingPercent:40,resetEstimatedAt:null}]});
test('snapshot schema only accepts typed, recent shared limits and strips extra content',()=>{
 for(const patch of [{scope:'chat'},{observedAt:'bad'},{observedAt:new Date(Date.now()+3600000).toISOString()},{windows:[{window:'weekly',remainingPercent:101}]},{windows:[{window:'weekly',remainingPercent:30},{window:'weekly',remainingPercent:40}]}])assert.throws(()=>validateSnapshot({...sample(),...patch}));
 assert.equal(validateSnapshot({...sample(),conversation:'private'}).conversation,undefined);
});
test('snapshot sync enforces authenticated owner, csrf and monotonic observed time',async()=>{
 const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const env={KLING_CLIENT_ID:'test',SUBCHECK_SEAL_KEY:'test',DB:{prepare(sql){return{bind(...args){return{async all(){return{results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}}};
 const get=(user)=>worker.fetch(new Request(origin+'/api/usage-snapshot',{headers:{'oai-authenticated-user-id':user}}),env);
 const put=(data,headers={})=>worker.fetch(new Request(origin+'/api/usage-snapshot',{method:'POST',headers:{'oai-authenticated-user-id':'A',...headers},body:JSON.stringify(data)}),env);
 const headers={origin,cookie:'__Host-subcheck-csrf=test','x-subcheck-csrf':'test','content-type':'application/json'};
 try{assert.equal((await put(sample())).status,403);assert.equal((await worker.fetch(new Request(origin+'/api/usage-snapshot'),env)).status,401);
 const data=sample();assert.equal((await put({...data,userId:'B'},headers)).status,200);assert.equal((await(await get('A')).json()).snapshot.windows[0].remainingPercent,40);assert.equal((await(await get('B')).json()).snapshot,null);
 const older={...sample(new Date(Date.now()-3600000).toISOString()),windows:[{window:'five_hour',remainingPercent:90,resetEstimatedAt:null}]};assert.equal((await put(older,headers)).status,200);assert.equal((await(await get('A')).json()).snapshot.windows[0].remainingPercent,40);
 assert.equal((await put({...data,scope:'chat'},headers)).status,400);
 const candidate={service:'kling',source:'visible_manage_dialog',currency:'USD',amount:21.99,plan:'Pro Monthly Subscription',channel:'stripe',observedAt:new Date().toISOString(),nextPayment:'2099-01-01'};
 const bill=await worker.fetch(new Request(origin+'/api/billing-candidate',{method:'POST',headers:{...headers,'oai-authenticated-user-id':'A'},body:JSON.stringify(candidate)}),env);assert.equal(bill.status,200);
 const readBill=async user=>(await(await worker.fetch(new Request(origin+'/api/billing-candidate',{headers:{'oai-authenticated-user-id':user}}),env)).json()).candidate;
 assert.equal((await readBill('A')).amount,21.99);assert.equal((await readBill('A')).nextPayment,null);assert.equal(await readBill('B'),null);
 }finally{db.close();}
});
