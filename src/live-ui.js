const live={connected:false,balance:null,busy:false,error:'',loaded:false};
const originalCard=usageCard,originalConnect=connect;
async function disconnectLive(){
  if(live.busy||!window.confirm('이 기기에서 클링 연결 정보와 조회 잔액을 지울까요? 클링 구독은 해지되지 않으며, 클링 계정에 승인한 권한 취소는 별도로 진행해야 해요.'))return;
  live.busy=true;live.error='';render();
  try{
    const response=await fetch('/api/kling/disconnect',{method:'POST',headers:{'x-subcheck-csrf':document.querySelector('meta[name="app-csrf"]').content},cache:'no-store'});
    if(!response.ok)throw Error('연결을 해제하지 못했어요. 다시 시도해주세요.');
    live.connected=false;live.balance=null;
    notify('이 기기의 클링 연결 정보와 잔액을 지웠어요.');
  }catch(error){live.error=error.message;}finally{live.busy=false;render();}
}
const liveValue=()=>live.balance?fmt(live.balance.credits):'—';
const liveBadge=()=>`<span class="sc-pill">${live.busy?'확인 중':live.connected?'실제 연결':'연결 필요'}</span>`;
function creditReference(balance){
  if(!balance||String(balance.plan).toLowerCase()!=='pro'||typeof balance.credits!=='number'||!Number.isFinite(balance.credits)||balance.credits<0)return null;
  return {monthly:3000,percent:Math.round(balance.credits/3000*1000)/10};
}
function referenceRing(){
  const ref=creditReference(live.balance);
  if(!ref)return '';
  return `<div class="sc-reference"><div class="sc-reference-ring" style="--reference-fill:${Math.min(ref.percent,100)}%" role="img" aria-label="월 지급량 대비 현재 잔액 ${ref.percent}퍼센트"><span><strong>${ref.percent}%</strong><small>월 지급량 대비</small></span></div><div><strong>Pro 월 3,000크레딧 기준</strong><p>현재 잔액이 월 지급량의<br>${ref.percent}%에 해당해요.</p></div></div><p class="sc-footnote">플랜 기준 참고 비율이에요. 추가 구매분 등이 포함될 수 있어 이번 달 구독 크레딧의 정확한 잔여율과는 다를 수 있어요. <a href="https://kling.ai/blog/kling-video-3-0-credit-cost-guide?tab=all" target="_blank" rel="noopener noreferrer">기준 보기</a></p>`;
}
function liveCard(){return `<div class="sc-card sc-inner sc-live-card"><div class="sc-inline"><span class="sc-avatar">K</span><span><h2>클링</h2><span class="sc-small">개인 유료 크레딧</span></span><div class="sc-live-header-actions">${liveBadge()}${live.connected?`<button class="sc-card-refresh" data-live-refresh aria-label="클링 잔액 새로고침" title="잔액 새로고침" aria-busy="${live.busy}" ${live.busy?'disabled':''}>${icon('refresh-cw')}</button>`:''}</div></div>${referenceRing()}<div class="sc-live-value">${liveValue()}<small>크레딧 남음</small></div><p class="sc-caption">${live.balance?'플랜 '+esc(live.balance.plan||'미제공'):'클링 계정을 연결하면 남은 잔액을 가져와요.'}</p>${live.error?`<p class="sc-status-banner warning" role="alert">${esc(live.error)}${live.balance?' 마지막 확인 잔액을 표시합니다.':''}</p>`:''}<div class="sc-live-facts"><span>월 지급 기준<b>${creditReference(live.balance)?'Pro · 3,000크레딧':'확인 필요'}</b></span><span>초기화·만료일<b>제공되지 않음</b></span></div><p class="sc-footnote">보너스·팀 크레딧은 포함하지 않아요.<br>플랜 기준 비율과 실제 조회 잔액을 함께 표시합니다.</p><div class="sc-refresh-line"><span role="status" aria-live="polite">${live.busy?'클링에서 조회 중…':live.balance?'마지막 확인 '+esc(live.balance.observedAt):'아직 조회하지 않았어요'}</span></div>${live.connected?'':'<a class="sc-live-link" href="/connect">클링 연결하기</a>'}</div>`;}
usageCard=function(a){return a.id==='kling'?liveCard():`<div class="sc-status-banner">이 서비스의 정보는 디자인 예시이며 실제 조회되지 않았어요.</div>`+originalCard(a);};
usageV5=function(){const a=usageExamples.find(x=>x.id===s.usageId)||usageExamples[0];return `<div class="sc-kicker"><span>MY USAGE</span><span class="sc-demo">${a.id==='kling'?'실제 계정 조회':'디자인 예시'}</span></div><h1>남은 사용량, 한눈에.</h1><p class="sc-subtitle">서비스별로 남은 혜택을 확인해요.</p><label class="sc-service-select">서비스<select data-usage-select aria-label="사용량 서비스 선택">${usageExamples.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${esc(x.name)}${x.id==='kling'?' · 실제 연결':' · 예시'}</option>`).join('')}</select></label>${usageCard(a)}<button class="sc-secondary" data-screen="home">구독 정보 보기</button>`;};
homeV4=function(){return `<div class="sc-kicker"><span>나의 구독 대시보드</span><span class="sc-demo">개발 중</span></div><h1>내 구독, 새는 돈 없이.</h1><p class="sc-subtitle">결제일도, 남은 사용량도 챙겨요.</p><section class="sc-section"><div class="sc-heading"><h2>내 사용량</h2><button class="sc-textbtn" data-usage="kling">자세히 보기 ${icon('arrow-right')}</button></div><button class="sc-live-summary" data-usage="kling"><span class="sc-avatar">K</span><span><strong>클링</strong><small>개인 유료 크레딧</small></span><span class="sc-live-summary-value">${liveValue()}<small>${live.balance?'크레딧 남음':'연결 후 확인'}</small></span></button><p class="sc-footnote">${live.connected?'실제 연결됨 · 결제 정보는 아직 가져오지 않았어요.':'클링에 연결하면 실제 잔액을 확인할 수 있어요.'}</p></section><section class="sc-section"><div class="sc-heading"><h2>다가오는 결제</h2><span class="sc-demo">예시 일정</span></div><div class="sc-card">${s.apps.filter(x=>!x.paid&&x.id!=='kling').slice(0,2).map(row).join('')}${remainingLink('kling')}</div><p class="sc-footnote">결제 금액·일정은 화면 구성을 위한 예시예요.</p></section><button class="sc-add" data-screen="add">${icon('plus')} 구독 추가하기</button>`;};
connectionsV3=function(){return `<button class="sc-back" data-screen="settings">${icon('arrow-left')} 마이페이지</button><h1>연결한 서비스</h1>${liveCard()}<p class="sc-footnote">이 컴퓨터에서만 사용하는 테스트 연결이에요. 서브체크 회원 로그인과는 별개입니다.</p>`;};
connect=function(){if(s.chosen!=='kling')return originalConnect();return `<button class="sc-back" data-screen="add">${icon('arrow-left')} 서비스 선택</button><h1>클링 계정 연결</h1><p class="sc-subtitle">공식 로그인 화면에서 연결을 승인해주세요.</p><div class="sc-card sc-inner"><h2>가져오는 정보</h2><p>개인 유료 크레딧 잔액과 플랜</p><p class="sc-footnote">이미지·영상 생성 권한을 요청하지 않아요. 보너스·팀 크레딧, 결제일, 초기화일은 이번 조회에 포함되지 않습니다.</p></div><a class="sc-live-link" href="/connect">클링 공식 로그인으로 이동</a><p class="sc-footnote">승인 후 별도 확인 화면으로 돌아옵니다. 이 앱 주소로 돌아오면 연결 결과가 반영돼요.</p>`;};
catalog.find(x=>x.id==='kling').support='개인 유료 크레딧과 플랜 조회를 검증했어요. 보너스·팀 크레딧과 초기화일·만료일은 제공되지 않아요.';
catalog.find(x=>x.id==='kling').tag='실제 잔액 연동';
const originalRefresh=refresh;
refresh=function(){if(s.screen==='home'||s.usageId==='kling'||s.screen==='connections')return fetchLive(true);notify('이 서비스의 새로고침은 디자인 예시예요.');};
const connectedCard=liveCard;
liveCard=function(){const card=connectedCard();return live.connected?card.replace('</div><div class="sc-live-facts">','</div><div class="sc-live-facts">').replace(/<\/div>$/,`<button class="sc-secondary" data-live-disconnect ${live.busy?'disabled':''}>이 기기에서 연결 해제</button><p class="sc-footnote">기기에 보관된 연결 정보를 지웁니다. 구독 해지와 클링 계정의 승인 권한 취소는 별도예요.</p></div>`):card;};
el.addEventListener('click',e=>{if(e.target.closest('[data-live-refresh]'))fetchLive(true);if(e.target.closest('[data-live-disconnect]'))disconnectLive();});
async function fetchLive(refresh=false){
  if(live.busy)return;
  live.busy=true;live.error='';render();
  try{
    const response=await fetch(refresh?'/api/kling/refresh':'/api/kling/status',{method:refresh?'POST':'GET',headers:refresh?{'x-subcheck-csrf':document.querySelector('meta[name="app-csrf"]').content}:{},cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.message||'잔액을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
    live.connected=data.connected;
    if(data.balance)live.balance=data.balance;
    if(!data.connected&&live.balance)live.error='연결이 만료됐어요. 다시 연결해주세요.';
  }catch(error){live.error=error.message;}finally{live.busy=false;live.loaded=true;render();}
}
s.screen='home';s.usageId='kling';
fetchLive();
