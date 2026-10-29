import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const origin='https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site';
const membership='https://kling.ai/app/membership/membership-plan';
function setup({enabled=true,active=false,initialRefresh,createWait}={}){
 const listeners=[],closed=[],created=[],timers=new Map(),storageEvents=[],removedEvents=[];let serial=0;
 const data={billingEnabled:enabled,billingRefreshStatus:initialRefresh};
 const context={Date,Number,URL,crypto:{randomUUID:()=> 'test-job'},setTimeout(fn,ms){timers.set(++serial,{fn,ms});return serial;},clearTimeout(id){timers.delete(id);},chrome:{runtime:{id:'own',onMessage:{addListener(fn){listeners.push(fn);}}},storage:{local:{async get(){return data;},async set(value){Object.assign(data,value);}},onChanged:{addListener(fn){storageEvents.push(fn);}}},tabs:{onRemoved:{addListener(fn){removedEvents.push(fn);}},async create(options){created.push(options);if(createWait)await createWait;return{id:77};},async get(id){return{id,active};},async remove(id){closed.push(id);},async query(){return[{id:1}];},async sendMessage(){return {ok:true,applied:true};}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../background.js',import.meta.url),'utf8'),context);
 const listener=listeners.at(-1),sender={id:'own',frameId:0,tab:{id:1},url:origin+'/'};
 const start=()=>new Promise(resolve=>listener({type:'SUBCHECK_REQUEST_KLING_REFRESH'},sender,resolve));
 return {data,created,closed,timers,listener,start,sender,storageEvents,removedEvents};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('explicit refresh opens only its own inactive tab, accepts only that tab and syncs before closing',async()=>{
 const x=setup(),result=x.start();await tick();assert.equal(x.created.length,1);assert.equal(x.created[0].active,false);assert.equal(x.created[0].url,membership);
 assert.equal(x.listener({type:'SUBCHECK_KLING_READY'},{id:'own',url:membership,tab:{id:99}},()=>assert.fail('foreign tab accepted')),undefined);
 let ready;x.listener({type:'SUBCHECK_KLING_READY'},{id:'own',url:membership,tab:{id:77}},r=>ready=r);assert.equal(ready.jobId,'test-job');
 const candidate={service:'kling',source:'visible_manage_dialog',currency:'USD',amount:21.99,plan:'Pro Monthly Subscription',channel:'stripe',observedAt:new Date().toISOString(),nextPayment:null};
 await new Promise(resolve=>x.listener({type:'SUBCHECK_KLING_REFRESH_RESULT',jobId:ready.jobId,ok:true,candidate},{id:'own',url:membership,tab:{id:77}},resolve));
 const done=await result;assert.equal(done.ok,true);assert.equal(done.applied,true);assert.deepEqual(x.closed,[77]);assert.equal(x.data.billingCandidate.amount,21.99);
});
test('timeout closes only owned tab; an activated lookup tab is preserved',async()=>{
 for(const active of [false,true]){const x=setup({active}),result=x.start();await tick();const deadline=[...x.timers.values()].find(x=>x.ms===45000);deadline.fn();assert.equal((await result).state,'timeout');assert.deepEqual(x.closed,active?[]:[77]);}
});
test('disabled capture and unauthorized frames never open a tab',async()=>{
 const x=setup({enabled:false});assert.equal((await x.start()).state,'disabled');assert.equal(x.created.length,0);
 const y=setup();assert.equal(y.listener({type:'SUBCHECK_REQUEST_KLING_REFRESH'},{...y.sender,frameId:1},()=>assert.fail()),undefined);assert.equal(y.listener({type:'SUBCHECK_REQUEST_KLING_REFRESH'},{...y.sender,url:'https://example.com/'},()=>assert.fail()),undefined);assert.equal(y.created.length,0);
});

test('two simultaneous requests create one lookup and subsequent rapid retries are throttled',async()=>{
 const x=setup(),first=x.start(),second=x.start();assert.equal((await second).state,'busy');await tick();assert.equal(x.created.length,1);
 [...x.timers.values()].find(t=>t.ms===45000).fn();await first;
 assert.equal((await x.start()).state,'cooldown');assert.equal(x.created.length,1);
});
test('closing the source tab or switching capture off stops the lookup without touching other tabs',async()=>{
 for(const action of ['close','disable']){const x=setup(),result=x.start();await tick();if(action==='close')x.removedEvents.forEach(fn=>fn(1));else{x.data.billingEnabled=false;x.storageEvents.forEach(fn=>fn({billingEnabled:{newValue:false}},'local'));}
 assert.equal((await result).state,action==='close'?'needs_reload':'disabled');assert.deepEqual(x.closed,[77]);}
});
test('a slow tab creation cannot delay the timeout and its late tab is cleaned up',async()=>{
 let release;const createWait=new Promise(resolve=>release=resolve),x=setup({createWait}),result=x.start();await tick();
 [...x.timers.values()].find(t=>t.ms===45000).fn();assert.equal((await result).state,'timeout');assert.equal(x.closed.length,0);
 release();await tick();assert.deepEqual(x.closed,[77]);
});
test('worker recovery marks interrupted lookup without fabricating a new success or closing user tabs',async()=>{
 const last='2026-10-01T00:00:00Z',x=setup({initialRefresh:{state:'reading',jobId:'old',lastSuccessAt:last}});await tick();assert.equal(x.data.billingRefreshStatus.state,'interrupted');assert.equal(x.data.billingRefreshStatus.lastSuccessAt,last);assert.equal(x.created.length,0);assert.equal(x.closed.length,0);
});

async function drive({tax=true,enabled=true,login=false}={}){
 let now=Date.now(),opened=false,manageClicks=0,cancelClicks=0,result;const timers=new Map();let serial=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const dialog={getClientRects:()=>[{}],querySelector:()=>({innerText:'Pro Monthly Subscription'}),innerText:'Current subscription:\nPro Monthly Subscription\nNext Billing Amount: $21.99\n'+(tax?'Subtotal: $19.99\nTax: $2.00\n':'')+'Billing Method: Stripe'};
 const buttons=login?[{innerText:'Login',getClientRects:()=>[{}],click(){assert.fail('must not click login');}}]:[{innerText:'Cancel',getClientRects:()=>[{}],click(){cancelClicks++;}},{innerText:'Manage',getClientRects:()=>[{}],click(){manageClicks++;opened=true;}}];
 const context={Date:Clock,Number,JSON,document:{visibilityState:'hidden',documentElement:{},addEventListener(){},querySelector:()=>opened?dialog:null,querySelectorAll:()=>buttons},MutationObserver:class{observe(){}},setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);},chrome:{runtime:{async sendMessage(message){if(message.type==='SUBCHECK_KLING_READY')return{jobId:'test-job'};if(message.type==='SUBCHECK_KLING_REFRESH_RESULT')result=message;return{ok:true};}},storage:{local:{async get(){return{billingEnabled:enabled};},async set(){}},onChanged:{addListener(){}}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../kling-billing.js',import.meta.url),'utf8'),context);
 for(let i=0;i<65&&!result;i++){await tick();now+=750;const queue=[...timers.values()];timers.clear();for(const fn of queue)fn();}
 await tick();return{result,manageClicks,cancelClicks};
}
test('managed hidden lookup clicks only Manage and reads a stable tax-inclusive total',async()=>{const x=await drive();assert.equal(x.manageClicks,1);assert.equal(x.cancelClicks,0);assert.equal(x.result.ok,true);assert.equal(x.result.candidate.amount,21.99);assert.equal(x.result.candidate.nextPayment,null);});
test('missing tax details or withdrawn consent never yields a successful hidden capture',async()=>{const tax=await drive({tax:false});assert.equal(tax.result.ok,false);assert.equal(tax.result.state,'waiting_total');const off=await drive({enabled:false});assert.equal(off.result.state,'disabled');assert.equal(off.manageClicks,0);});
test('signed-out Kling is reported without clicking login or changing account state',async()=>{const x=await drive({login:true});assert.equal(x.result.state,'needs_kling_login');assert.equal(x.manageClicks,0);assert.equal(x.result.candidate,undefined);});

test('website scripts cannot trigger a background tab with a synthetic click',async()=>{
 let click;const messages=[];
 const context={CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},document:{documentElement:{setAttribute(){}},querySelector:()=>null,dispatchEvent(){},addEventListener(type,fn){if(type==='click')click=fn;}},chrome:{runtime:{id:'own',getManifest:()=>({version:'0.5.0'}),onMessage:{addListener(){}},async sendMessage(message){messages.push(message.type);return{ok:false,state:'disabled'};}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../bridge.js',import.meta.url),'utf8'),context);
 await click({isTrusted:false,target:{closest:()=>({})}});assert.equal(messages.includes('SUBCHECK_REQUEST_KLING_REFRESH'),false);
 await click({isTrusted:true,target:{closest:()=>({})}});assert.equal(messages.filter(x=>x==='SUBCHECK_REQUEST_KLING_REFRESH').length,1);
});
