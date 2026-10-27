import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import worker,{validateSubscription} from '../worker/index.js';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
test('subscription validation keeps unknown fields nullable and rejects invalid dates or amounts',()=>{
  assert.equal(validateSubscription({serviceId:'kling',name:'클링'}).amount,null);
  for(const input of [{amount:-1},{amount:'1000'},{nextPayment:'2026-02-30'},{cycle:'weekly'}])assert.throws(()=>validateSubscription({serviceId:'kling',name:'클링',...input}));
});
test('subscription storage persists and isolates owners using actual SQLite statements',async()=>{
  const db=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
  const env={SUBCHECK_SEAL_KEY:randomBytes(32).toString('base64url'),KLING_CLIENT_ID:'test',DB:{prepare(sql){return {bind(...values){return {async all(){return {results:db.prepare(sql).all(...values)};},async run(){return db.prepare(sql).run(...values);}};}};}}};
  const request=(path,user,options={})=>new Request(origin+path,{...options,headers:{'oai-authenticated-user-id':user,...options.headers}});
  const root=await worker.fetch(request('/','owner-A'),env);const csrf=(await root.text()).match(/name="app-csrf" content="([^"]+)"/)[1];
  const cookie=root.headers.getSetCookie()[0].split(';')[0];
  const headers={cookie,origin,'x-subcheck-csrf':csrf,'content-type':'application/json'};
  const item={serviceId:'netflix',name:'Netflix',amount:1000,nextPayment:'2026-11-01',cycle:'monthly',userId:'owner-B'};
  const denied=await worker.fetch(request('/api/subscriptions','owner-A',{method:'POST',body:JSON.stringify(item)}),env);assert.equal(denied.status,403);
  const saved=await worker.fetch(request('/api/subscriptions','owner-A',{method:'POST',headers,body:JSON.stringify(item)}),env);assert.equal(saved.status,200);
  assert.equal((await saved.json()).item.amount,1000);
  const read=await worker.fetch(request('/api/subscriptions','owner-A'),env);assert.equal((await read.json()).items.length,1);
  const other=await worker.fetch(request('/api/subscriptions','owner-B'),env);assert.deepEqual((await other.json()).items,[]);
  await worker.fetch(request('/api/subscriptions/remove','owner-A',{method:'POST',headers,body:JSON.stringify({serviceId:'netflix'})}),env);
  const removed=await worker.fetch(request('/api/subscriptions','owner-A'),env);assert.deepEqual((await removed.json()).items,[]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get().n,1);
  db.close();
});

