s.subscriptionFilter='전체';
function subscriptionRecord(app){
  const kling=app.id==='kling';
  return {...app,example:!kling,plan:kling?(live.balance?.plan||'연결 후 확인'):app.plan,amount:kling||app.priceUnknown?null:app.price,nextPayment:kling?null:app.date,cycle:kling?'미확인':'매월 · 예시',channel:'미확인'};
}
function subscriptionRecords(){return s.apps.map(subscriptionRecord);}
function subscriptionDate(value){if(!value)return '미확인';const [year,month,day]=value.split('-');return `${year}. ${Number(month)}. ${Number(day)}.`;}
function subscriptionAmount(record){return record.amount===null?'미확인':fmt(record.amount)+'원';}
function subscriptionTile(record){return `<article class="sc-subscription-tile"><button class="sc-subscription-title" data-detail="${esc(record.id)}" aria-label="${esc(record.name)} 구독 상세 보기"><span class="sc-avatar ${record.cat==='AI'?'':'neutral'}">${esc(record.letter)}</span><span class="sc-rowtext"><h3>${esc(record.name)}</h3><span class="sc-small">${esc(record.plan)}</span></span>${icon('chevron-right')}</button><div class="sc-subscription-source"><span class="sc-pill">${record.example?'예시 정보':live.connected?'실제 연결':'연결 필요'}</span><span>${record.example?'결제 일정·금액 예시':'결제 예정일·금액 미확인'}</span></div><dl class="sc-subscription-facts"><div><dt>결제 예정일</dt><dd>${subscriptionDate(record.nextPayment)}</dd></div><div><dt>결제금액</dt><dd>${subscriptionAmount(record)}</dd></div></dl><div class="sc-subscription-footer"><span>${esc(record.cycle)}</span><button class="sc-textbtn" data-usage="${esc(record.id)}">남은 사용량 보기 ${icon('arrow-right')}</button></div></article>`;}
homeV4=function(){
  const all=subscriptionRecords(),records=all.filter(x=>s.subscriptionFilter==='전체'||x.cat===s.subscriptionFilter);
  const examples=records.filter(x=>x.example).sort((a,b)=>(a.nextPayment||'9999').localeCompare(b.nextPayment||'9999'));
  const connected=records.filter(x=>!x.example);
  const previewTotal=all.filter(x=>x.example&&x.amount!==null).reduce((n,x)=>n+x.amount,0);
  return `<div class="sc-kicker"><span>MY SUBSCRIPTIONS</span><span class="sc-demo">결제 정보 확인 중</span></div><h1>내 구독</h1><p class="sc-subtitle">결제일, 금액, 플랜을 한곳에서 챙겨요.</p><div class="sc-subscription-summary"><div><span>등록한 서비스</span><strong>${all.length}<small>개</small></strong></div><div><span>월 구독료 합계 · 예시</span><strong>${fmt(previewTotal)}<small>원</small></strong></div><p>예시 구독만 합산했어요. 실제 월 구독료는 아직 확인되지 않았습니다.</p></div><div class="sc-filters" aria-label="내 구독 분류">${['전체','AI','영상·음악','멤버십'].map(t=>`<button class="sc-filter" data-subscription-filter="${t}" aria-pressed="${s.subscriptionFilter===t}">${t}</button>`).join('')}</div>${connected.length?`<section class="sc-section"><div class="sc-heading"><h2>연동 서비스</h2><span class="sc-small">${connected.length}개</span></div>${connected.map(subscriptionTile).join('')}</section>`:''}${examples.length?`<section class="sc-section"><div class="sc-heading"><h2>구독 정보 둘러보기</h2><span class="sc-small">결제일순 · 예시 ${examples.length}개</span></div>${examples.map(subscriptionTile).join('')}</section>`:''}${records.length?'':'<p class="sc-empty">이 분류에 등록된 구독이 없어요.</p>'}<button class="sc-add" data-screen="add">${icon('plus')} 구독 추가하기</button><p class="sc-footnote">연결된 서비스가 알려주는 정보만 실제 값으로 표시해요. 결제 예정일·금액은 서비스별 연동이 필요합니다.</p>`;
};
detailV4=function(){
  const app=s.apps.find(x=>x.id===s.selected)||s.apps[0],record=subscriptionRecord(app);
  return `<button class="sc-back" data-screen="home">${icon('arrow-left')} 내 구독</button><div class="sc-kicker"><span>SUBSCRIPTION DETAILS</span><span class="sc-demo">${record.example?'예시 정보':'연결한 서비스'}</span></div><h1>${esc(record.name)}</h1><p class="sc-subtitle">구독과 결제 정보를 확인해요.</p><div class="sc-card sc-inner"><dl class="sc-facts"><dt>이용 플랜</dt><dd>${esc(record.plan)}</dd><dt>결제 예정일</dt><dd>${subscriptionDate(record.nextPayment)}</dd><dt>결제금액</dt><dd>${subscriptionAmount(record)}</dd><dt>결제 주기</dt><dd>${esc(record.cycle)}</dd><dt>결제 경로</dt><dd>${record.channel}</dd><dt>정보 출처</dt><dd>${record.example?'디자인용 예시':'플랜: 클링 공식 조회 / 결제 정보: 미확인'}</dd></dl></div><button class="sc-secondary" data-usage="${record.id}">${icon('chart-pie')} 남은 사용량 보기</button>${actionsV4(record.id)}<p class="sc-footnote">${record.example?'이 서비스의 금액과 날짜는 예시입니다.':'클링에서 받은 플랜을 표시합니다. 결제금액·예정일은 현재 조회 응답에 없어 미확인으로 표시해요.'} 해지·업그레이드 버튼은 관리 경로 안내이며 실제 구독을 변경하지 않아요.</p>`;
};
billingV3=homeV4;
const navigateScreen=change;
change=function(screen){navigateScreen(screen);root.scrollIntoView({block:'start',behavior:'auto'});};
el.addEventListener('click',event=>{
  const button=event.target.closest('[data-usage]');
  if(button&&!usageExamples.some(x=>x.id===button.dataset.usage)){
    const app=s.apps.find(x=>x.id===button.dataset.usage);
    if(app)usageExamples.push({id:app.id,name:app.name,letter:app.letter,plan:app.plan,remaining:null,total:null});
  }
},true);
el.addEventListener('click',event=>{const button=event.target.closest('[data-subscription-filter]');if(button){s.subscriptionFilter=button.dataset.subscriptionFilter;render();}});
