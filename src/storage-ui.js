const savedState={items:[],loading:true,error:'',busy:false};
s.exampleSelection='';s.editingSubscription='kling';
screens.push('editSubscription');
const previousRecord=subscriptionRecord;
subscriptionRecord=function(app){
  const item=savedState.items.find(x=>x.serviceId===app.id);
  if(!item)return previousRecord(app);
  return {...app,example:false,source:'saved',plan:item.plan||(app.id==='kling'?live.balance?.plan:null)||'미확인',amount:item.amount,nextPayment:item.nextPayment,cycle:{monthly:'매월',yearly:'매년',unknown:'미확인'}[item.cycle],channel:{website:'서비스 웹사이트',appstore:'App Store',googleplay:'Google Play',unknown:'미확인'}[item.channel]};
};
const previousTile=subscriptionTile;
subscriptionTile=function(record){
  let html=previousTile(record);
  if(record.source==='saved')html=html.replace(/<div class="sc-subscription-source">[\s\S]*?<\/div>/,'<div class="sc-subscription-source"><span class="sc-pill">저장한 정보</span><span>내가 확인한 구독·결제 정보</span></div>');
  return record.source!=='saved'?html:html.replace(/<\/article>$/,`<button class="sc-textbtn sc-save-inline" data-open-editor="${record.id}">${record.source==='saved'?'구독 정보 수정':'내 구독에 저장'}</button></article>`);
};
const previousHome=homeV4;
homeV4=function(){
  let html=previousHome();
  const monthly=savedState.items.filter(x=>x.cycle==='monthly'&&x.amount!==null).reduce((sum,x)=>sum+x.amount,0);
  html=html.replace(/<div class="sc-subscription-summary">[\s\S]*?<\/p><\/div>/,`<div class="sc-subscription-summary"><div><span>저장한 구독</span><strong>${savedState.items.length}<small>개</small></strong></div><div><span>월 결제 합계</span><strong>${fmt(monthly)}<small>원</small></strong></div><p>저장한 월간 구독의 원화 금액만 합산해요. 미확인 금액·연간 구독·예시는 제외합니다.</p></div>`);
  html=html.replace(/<section class="sc-section"><div class="sc-heading"><h2>구독 정보 둘러보기<\/h2>[\s\S]*?<\/section>/,'');
  const discover=`<section class="sc-discover"><div class="sc-heading"><h2>새로운 구독 찾기</h2></div><p class="sc-footnote">이용 중인 서비스를 찾아 내 구독에 추가해보세요.</p><div class="sc-discover-cards">${[['AI',['chatgpt','claude','gemini','kling'],'AI 서비스'],['영상·음악',['netflix','youtube','melon','spotify'],'영상·음악'],['멤버십',['coupang','naverplus','costco','baemin'],'멤버십']].map(([category,ids,label])=>`<button data-discover-category="${category}"><span class="sc-discover-logos" aria-hidden="true">${ids.map(id=>serviceLogo(id,catalog.find(x=>x.id===id)?.name||id)).join('')}</span><strong>${label}</strong>${icon('arrow-right')}</button>`).join('')}</div></section>`;
  html=html.replace('<button class="sc-add" data-screen="add">',discover+'<button class="sc-add" data-screen="add">');
  html=html.replace('<h2>연동 서비스</h2>','<h2>내 구독 정보</h2>');
  return (savedState.error?`<p class="sc-status-banner warning" role="alert">${esc(savedState.error)}</p>`:'')+html;
};
const previousDetail=detailV4;
detailV4=function(){
  const record=subscriptionRecord(s.apps.find(x=>x.id===s.selected)||s.apps[0]);
  let html=previousDetail();
  if(record.source==='saved')html=html.replace('플랜: 클링 공식 조회 / 결제 정보: 미확인','내가 저장한 구독·결제 정보').replace('클링에서 받은 플랜을 표시합니다. 결제금액·예정일은 현재 조회 응답에 없어 미확인으로 표시해요.','내가 저장한 정보입니다. 자동 조회된 결제 정보와는 구분합니다.');
  return record.source!=='saved'?html:html+`<button class="sc-add" data-open-editor="${record.id}">${icon('save')} ${record.source==='saved'?'구독 정보 수정':'내 구독에 저장'}</button>`;
};
function editorValue(key){const saved=savedState.items.find(x=>x.serviceId===s.editingSubscription);return saved?.[key]??'';}
function editSubscriptionScreen(){
  const service=catalog.find(x=>x.id===s.editingSubscription)||catalog[0];
  return `<button class="sc-back" data-screen="home">${icon('arrow-left')} 내 구독</button><h1>구독 정보 저장</h1><p class="sc-subtitle">${esc(service.name)} · 모르는 항목은 비워두세요.</p><p class="sc-footnote">서비스에서 자동으로 받지 못한 결제 정보만 처음 한 번 확인해 저장해요. 크레딧 잔액은 직접 입력하지 않습니다.</p><form data-subscription-form class="sc-edit-form"><label>서비스<input name="name" value="${esc(service.name)}" readonly></label><label>이용 플랜<input name="plan" maxlength="80" value="${esc(editorValue('plan')||(service.id==='kling'?live.balance?.plan||'':''))}" placeholder="미확인이면 비워두세요"></label><label>결제금액 · 원<input name="amount" type="number" min="0" max="100000000" step="1" inputmode="numeric" value="${editorValue('amount')}" placeholder="미확인이면 비워두세요"></label><label>다음 결제 예정일<input name="nextPayment" type="date" value="${esc(editorValue('nextPayment'))}"></label><label>결제 주기<select name="cycle">${[['unknown','미확인'],['monthly','매월'],['yearly','매년']].map(([id,label])=>`<option value="${id}" ${(editorValue('cycle')||'unknown')===id?'selected':''}>${label}</option>`).join('')}</select></label><label>결제 경로<select name="channel">${[['unknown','미확인'],['website','서비스 웹사이트'],['appstore','App Store'],['googleplay','Google Play']].map(([id,label])=>`<option value="${id}" ${(editorValue('channel')||'unknown')===id?'selected':''}>${label}</option>`).join('')}</select></label><p class="sc-form-message" role="alert"></p><button class="sc-add" type="submit" ${savedState.busy?'disabled':''}>${icon('save')} ${savedState.busy?'저장 중…':'내 계정에 저장'}</button></form><p class="sc-footnote">이 사이트의 본인 계정에 저장됩니다. 결제·구독 변경은 실행되지 않아요.</p>`;
}
const previousEditor=editSubscriptionScreen;
editSubscriptionScreen=function(){const html=previousEditor();return savedState.items.some(x=>x.serviceId===s.editingSubscription)?html+`<button class="sc-secondary" data-remove-subscription="${s.editingSubscription}">저장 목록에서 지우기</button><p class="sc-footnote">저장한 구독 정보만 목록에서 숨깁니다. 실제 서비스 구독은 해지되지 않아요.</p>`:html;};
const previousAdd=addV4;
addV4=function(){let html=previousAdd();html=html.replace(/<button class="sc-add cursor-interaction" data-next[\s\S]*?<\/button>/,`<button class="sc-add" data-open-editor="${s.chosen||''}" ${!s.chosen?'disabled':''}>${icon('plus')} ${s.chosen?esc(selectedService().name)+' 구독 추가하기':'서비스를 선택해주세요'}</button>`);return html+(s.chosen==='kling'?`<button class="sc-secondary" data-next>${icon('link-2')} 클링 계정 연결하기</button>`:'');};
el.addEventListener('click',event=>{const button=event.target.closest('[data-open-editor]');if(button){s.editingSubscription=button.dataset.openEditor;change('editSubscription');}});
el.addEventListener('click',event=>{const button=event.target.closest('[data-discover-category]');if(button){s.category=button.dataset.discoverCategory;s.search='';s.catalogPage=0;change('add');}});
function applyStoredItems(items){
  savedState.items=items;
  for(const item of items)if(!s.apps.some(x=>x.id===item.serviceId)){
    const service=catalog.find(x=>x.id===item.serviceId);if(service)s.apps.push({id:service.id,name:service.name,letter:service.letter,cat:service.cat,plan:item.plan||'미확인',price:0,priceUnknown:true,date:'',paid:false});
  }
}
async function loadStoredSubscriptions(){
  try{const response=await fetch('/api/subscriptions',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.message||'저장한 구독 정보를 불러오지 못했어요.');applyStoredItems(data.items);savedState.error='';}
  catch(error){savedState.error=error.message;}finally{savedState.loading=false;render();}
}
el.addEventListener('submit',async event=>{
  if(!event.target.hasAttribute('data-subscription-form'))return;event.preventDefault();if(savedState.busy)return;
  const form=event.target,values=new FormData(form),message=form.querySelector('.sc-form-message');
  const payload={serviceId:s.editingSubscription,name:values.get('name'),plan:values.get('plan'),amount:values.get('amount')===''?null:Number(values.get('amount')),nextPayment:values.get('nextPayment')||null,cycle:values.get('cycle'),channel:values.get('channel')};
  savedState.busy=true;const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='저장 중…';
  try{const response=await fetch('/api/subscriptions',{method:'POST',headers:{'content-type':'application/json','x-subcheck-csrf':document.querySelector('meta[name="app-csrf"]').content},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.message||'저장하지 못했어요.');applyStoredItems([data.item,...savedState.items.filter(x=>x.serviceId!==data.item.serviceId)]);savedState.error='';change('home');notify('내 계정에 구독 정보를 저장했어요.');}
  catch(error){message.textContent=error.message;}finally{savedState.busy=false;button.disabled=false;button.textContent='내 계정에 저장';}
});
loadStoredSubscriptions();
el.addEventListener('click',async event=>{
  const button=event.target.closest('[data-remove-subscription]');
  if(!button||savedState.busy||!window.confirm('이 구독 정보를 저장 목록에서 지울까요? 실제 서비스 구독은 해지되지 않습니다.'))return;
  savedState.busy=true;button.disabled=true;
  try{const response=await fetch('/api/subscriptions/remove',{method:'POST',headers:{'content-type':'application/json','x-subcheck-csrf':document.querySelector('meta[name="app-csrf"]').content},body:JSON.stringify({serviceId:button.dataset.removeSubscription})});if(!response.ok)throw Error('저장 목록을 변경하지 못했어요.');savedState.items=savedState.items.filter(x=>x.serviceId!==button.dataset.removeSubscription);change('home');notify('저장 목록에서 지웠어요. 서비스 구독은 그대로예요.');}
  catch(error){notify(error.message);}finally{savedState.busy=false;}
});
