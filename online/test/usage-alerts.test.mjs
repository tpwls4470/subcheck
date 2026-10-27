import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {checkUsageAlert} from '../reminder-api.mjs';
test('usage alerts trigger once, rearm after recovery, isolate users and ignore unsupported plans',async()=>{
 const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const env={PUSH_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',keys.privateKey)),PUSH_PUBLIC_KEY:'test',DB:{prepare(sql){return{bind(...args){return{async all(){return{results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}}};
 db.prepare('INSERT INTO usage_alerts VALUES(?,?,?,?,?,?)').run('A','kling',1,20,0,'now');db.prepare('INSERT INTO push_devices(user_id,device_id,endpoint,updated_at) VALUES(?,?,?,?)').run('A','d','https://fcm.googleapis.com/test','now');
 let count=0;const original=globalThis.fetch;globalThis.fetch=async()=>{count++;return new Response(null,{status:201});};
 try{assert.equal(await checkUsageAlert(env,'B',{plan:'Pro',credits:0}),null);assert.equal(await checkUsageAlert(env,'A',{plan:'Other',credits:0}),null);assert.equal(await checkUsageAlert(env,'A',{plan:'Pro',credits:-1}),null);
 assert.equal((await checkUsageAlert(env,'A',{plan:'Pro',credits:600})).accepted,1);assert.equal((await checkUsageAlert(env,'A',{plan:'Pro',credits:500})).accepted,0);assert.equal(count,1);
 assert.equal((await checkUsageAlert(env,'A',{plan:'Pro',credits:601})).low,false);assert.equal((await checkUsageAlert(env,'A',{plan:'Pro',credits:0})).accepted,1);assert.equal(count,2);
 db.prepare('UPDATE usage_alerts SET enabled=0').run();assert.equal(await checkUsageAlert(env,'A',{plan:'Pro',credits:0}),null);
 }finally{globalThis.fetch=original;db.close();}
});
