import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/billing-import-ui.js',import.meta.url),'utf8');
async function setup(observedAt){
 let onClick,submitted=0;
 const elements=Object.fromEntries(['plan','currency','amount','channel','cycle','nextPayment'].map(k=>[k,{value:k==='nextPayment'?'2026-12-10':''}]));
 const form={elements,requestSubmit(){submitted++;}};
 const candidate={observedAt,plan:'Pro Monthly Subscription',currency:'USD',amount:21.99,channel:'stripe'};
 const context={Date,Number,esc:String,usd:String,s:{screen:'home',editingSubscription:'kling'},savedState:{busy:false},editSubscriptionScreen:()=>'',updateFxPreview(){},notify(){},fetch:async()=>({ok:true,json:async()=>({candidate})}),el:{querySelector:()=>form,addEventListener(type,fn){onClick=fn;}}};
 vm.runInNewContext(source,context);await new Promise(r=>setImmediate(r));
 return {elements,context,click(){onClick({target:{closest:selector=>selector==='[data-save-billing-import]'?{}:null}});},submitted:()=>submitted};
}
test('fresh billing saves through existing form validation and preserves entered date',async()=>{const x=await setup(new Date().toISOString());x.click();assert.equal(x.submitted(),1);assert.equal(x.elements.amount.value,21.99);assert.equal(x.elements.cycle.value,'monthly');assert.equal(x.elements.nextPayment.value,'2026-12-10');});
test('stale, malformed and future records never submit or change form fields',async()=>{for(const date of [new Date(Date.now()-86400001).toISOString(),'invalid',new Date(Date.now()+120000).toISOString()]){const x=await setup(date);x.click();assert.equal(x.submitted(),0);assert.equal(x.elements.amount.value,'');}});
test('busy subscription save blocks repeat submissions',async()=>{const x=await setup(new Date().toISOString());x.context.savedState.busy=true;x.click();assert.equal(x.submitted(),0);});
