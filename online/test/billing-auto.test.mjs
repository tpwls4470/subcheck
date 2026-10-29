import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import worker from '../worker/index.js';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
function setup(){const db=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const env={SUBCHECK_SEAL_KEY:'test',KLING_CLIENT_ID:'test',DB:{prepare(sql){return {bind(...args){return {async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}}};
 const request=async(path,{user='A',data,csrf=true}={})=>worker.fetch(new Request(origin+path,{method:data?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(csrf?{origin,cookie:'__Host-subcheck-csrf=test','x-subcheck-csrf':'test'}:{}),'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
 const seed=user=>db.prepare("INSERT INTO subscriptions(user_id,service_id,name,plan,amount,currency,next_payment,cycle,channel,updated_at,reminder_3,reminder_day) VALUES(?,'kling','클링','Manual',1000,'KRW','2026-12-20','monthly','naverpay','old',1,1)").run(user);
 const row=user=>db.prepare("SELECT * FROM subscriptions WHERE user_id=? AND service_id='kling'").get(user);
 const candidate=(amount,offset=0)=>({service:'kling',source:'visible_manage_dialog',currency:'USD',amount,plan:'Pro Monthly Subscription',channel:'stripe',observedAt:new Date(Date.now()+offset).toISOString()});
 return {db,request,seed,row,candidate};}
test('automatic billing is opt-in, preserves payment date and alarms, isolates accounts',async()=>{const x=setup();try{x.seed('A');x.seed('B');
 assert.equal((await(await x.request('/api/billing-sync')).json()).enabled,false);
 await x.request('/api/billing-candidate',{data:x.candidate(21.99,-3000)});assert.equal(x.row('A').amount,1000);
 const enabled=await x.request('/api/billing-sync',{data:{enabled:true}});assert.equal(enabled.status,200);assert.equal((await enabled.json()).enabled,true);
 let row=x.row('A');assert.equal(row.amount,2199);assert.equal(row.currency,'USD');assert.equal(row.next_payment,'2026-12-20');assert.equal(row.reminder_3,1);assert.equal(row.reminder_day,1);assert.ok(row.billing_synced_at);assert.equal(x.row('B').amount,1000);
 await x.request('/api/billing-candidate',{data:x.candidate(22.99,-1000)});assert.equal(x.row('A').amount,2299);
 await x.request('/api/billing-candidate',{data:x.candidate(99.99,-2000)});assert.equal(x.row('A').amount,2299);
 await x.request('/api/billing-sync',{data:{enabled:false}});await x.request('/api/billing-candidate',{data:x.candidate(23.99)});assert.equal(x.row('A').amount,2299);
 }finally{x.db.close();}});
test('billing settings require authenticated same-origin consent and existing subscription',async()=>{const x=setup();try{
 assert.equal((await x.request('/api/billing-sync',{user:null})).status,401);
 assert.equal((await x.request('/api/billing-sync',{data:{enabled:true},csrf:false})).status,403);
 assert.equal((await x.request('/api/billing-sync',{data:{enabled:true}})).status,409);
 x.seed('A');assert.equal((await x.request('/api/billing-sync',{data:{enabled:'true'}})).status,400);
 assert.equal((await(await x.request('/api/billing-sync',{user:'B'})).json()).enabled,false);
 }finally{x.db.close();}});
test('enabling never applies stale records or resurrects removed subscriptions',async()=>{const x=setup();try{x.seed('A');const stale=x.candidate(99.99,-86401000);
 x.db.prepare("INSERT INTO billing_candidates VALUES(?,'kling',?,?)").run('A',stale.observedAt,JSON.stringify(stale));await x.request('/api/billing-sync',{data:{enabled:true}});assert.equal(x.row('A').amount,1000);
 x.db.prepare("UPDATE subscriptions SET deleted_at='removed' WHERE user_id='A'").run();await x.request('/api/billing-candidate',{data:x.candidate(21.99)});assert.equal(x.row('A').amount,1000);assert.equal(x.row('A').deleted_at,'removed');
 }finally{x.db.close();}});
