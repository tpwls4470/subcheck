import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';
import {occurrences,dueItems,calendar,validEndpoint,sendPush,seoulDay} from '../reminders.mjs';
import {dispatchReminders} from '../reminder-api.mjs';
import worker from '../worker/index.js';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
test('monthly anchors clamp to month end without drifting, leap years and Seoul date',()=>{
 assert.deepEqual(occurrences({nextPayment:'2026-01-31',cycle:'monthly'},'2026-02-01',3),['2026-02-28','2026-03-31','2026-04-30']);
 assert.deepEqual(occurrences({nextPayment:'2024-02-29',cycle:'yearly'},'2025-01-01',4),['2025-02-28','2026-02-28','2027-02-28','2028-02-29']);
 assert.equal(seoulDay(new Date('2026-10-26T16:00:00Z')),'2026-10-27');
 assert.equal(dueItems([{nextPayment:'2026-10-30',cycle:'monthly',reminder3:true}], '2026-10-27').length,1);
 assert.equal(dueItems([{nextPayment:'2026-10-30',reminder3:false}], '2026-10-27').length,0);
});
test('calendar contains stable opaque UIDs and selected alarms, escapes injected lines',async()=>{
 const input=[{serviceId:'test',name:'x\nBEGIN:VEVENT',nextPayment:'2026-10-30',reminder3:true,reminderDay:true}];
 const one=await calendar(input,'private-user',new Date('2026-10-27T00:00:00Z')),two=await calendar(input,'private-user',new Date('2026-10-27T01:00:00Z'));
 assert.match(one,/TRIGGER:-P3D/);assert.match(one,/TRIGGER:PT0S/);assert.match(one,/DTSTART:20261030T000000Z/);
 assert.equal(one.match(/UID:.+/)[0],two.match(/UID:.+/)[0]);assert.ok(!one.includes('private-user'));
 assert.equal(one.split('\r\n').filter(x=>x==='BEGIN:VEVENT').length,1);
 assert.equal((await calendar([{...input[0],reminder3:false,reminderDay:false}],'user')).includes('BEGIN:VEVENT'),false);
});
test('push targets disallow internal hosts, credentials, redirects and VAPID signature verifies',async()=>{
 for(const url of ['http://fcm.googleapis.com/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x'])assert.equal(validEndpoint(url),false);
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.privateKey);const raw=await crypto.subtle.exportKey('raw',keys.publicKey);
 const env={PUSH_PRIVATE_JWK:JSON.stringify(jwk),PUSH_PUBLIC_KEY:Buffer.from(raw).toString('base64url')},old=globalThis.fetch;
 globalThis.fetch=async(url,o)=>{assert.equal(o.redirect,'manual');assert.equal(o.body.length,0);const token=o.headers.authorization.match(/t=([^,]+)/)[1];const parts=token.split('.');assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).aud,'https://fcm.googleapis.com');assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.publicKey,Buffer.from(parts[2],'base64url'),Buffer.from(parts.slice(0,2).join('.'))));return new Response(null,{status:201});};
 try{assert.equal(await sendPush('https://fcm.googleapis.com/test',env),201);}finally{globalThis.fetch=old;}
});
test('reminders isolate owners, reject CSRF and dispatch once per day; retry failed delivery',async()=>{
 const db=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const env={KLING_CLIENT_ID:'test',SUBCHECK_SEAL_KEY:'test',DB:{prepare(sql){return{bind(...args){return{async all(){return{results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}}};
 db.prepare('INSERT INTO subscriptions(user_id,service_id,name,next_payment,cycle,channel,updated_at,reminder_day) VALUES(?,?,?,?,?,?,?,?)').run('A','test','Test',seoulDay(),'monthly','unknown','now',1);
 db.prepare('INSERT INTO push_devices(user_id,device_id,endpoint,updated_at) VALUES(?,?,?,?)').run('A','device','https://fcm.googleapis.com/test','now');
 const old=globalThis.fetch,key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);env.PUSH_PRIVATE_JWK=JSON.stringify(await crypto.subtle.exportKey('jwk',key.privateKey));env.PUSH_PUBLIC_KEY='test';let calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:201});};
 try{assert.equal((await dispatchReminders(env,'B')).accepted,0);assert.equal((await dispatchReminders(env,'A')).accepted,1);assert.equal((await dispatchReminders(env,'A')).accepted,0);assert.equal(calls,1);
 const req=new Request(origin+'/api/reminders',{headers:{'oai-authenticated-user-id':'B'}});assert.deepEqual((await(await worker.fetch(req,env)).json()).items,[]);
 const denied=await worker.fetch(new Request(origin+'/api/push/subscribe',{method:'POST',headers:{'oai-authenticated-user-id':'A'},body:'{}'}),env);assert.equal(denied.status,403);
 db.prepare('UPDATE push_devices SET last_sent=NULL').run();globalThis.fetch=async()=>new Response(null,{status:503});assert.equal((await dispatchReminders(env,'A')).failed,1);assert.equal(db.prepare('SELECT last_sent FROM push_devices').get().last_sent,null);
 }finally{globalThis.fetch=old;db.close();}
});
