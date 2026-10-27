import test from 'node:test';import assert from 'node:assert/strict';
await import('../parser.js');const {snapshot,parseMetric}=globalThis.SubcheckUsageParser;
const at=Date.parse('2026-10-27T03:00:00Z');
test('observed Korean usage cards map to shared allowance windows',()=>{
 const s=snapshot([{label:'5시간 단위 한도',value:'42',max:'100',resetText:'2시간 20분 후 초기화됩니다'},{label:'주간 사용 한도',value:'68',max:'100',resetText:'6일 2시간 후 초기화됩니다'}],at);
 assert.equal(s.scope,'codex_work_shared');assert.equal(s.windows[0].remainingPercent,42);assert.equal(s.windows[0].resetEstimatedAt,'2026-10-27T05:20:00.000Z');assert.equal(s.windows[1].window,'weekly');assert.equal(s.windows[1].resetEstimatedAt,'2026-11-02T05:00:00.000Z');
});
test('missing, duplicate, out of range or unrelated content does not invent usage',()=>{
 for(const x of [{label:'대화 중 47% 남음',value:'42',max:'100'},{label:'주간 사용 한도',value:null,max:'100'},{label:'주간 사용 한도',value:'101',max:'100'},{label:'주간 사용 한도',value:'42',max:'200'}])assert.equal(parseMetric(x,at),null);
 assert.equal(snapshot([],at),null);const x={label:'주간 사용 한도',value:'0',max:'100'};assert.equal(snapshot([x,x],at),null);assert.equal(parseMetric(x,at).remainingPercent,0);assert.equal(parseMetric(x,at).resetEstimatedAt,null);
});
test('english values and unrecognized reset text retain truthful unknown time',()=>{
 assert.equal(parseMetric({label:'Weekly limit',value:'100',max:'100',resetText:'Resets in 6 days 2 hours'},at).remainingPercent,100);
 assert.equal(parseMetric({label:'5-hour limit',value:'42',max:'100',resetText:'next Tuesday'},at).resetEstimatedAt,null);
});

