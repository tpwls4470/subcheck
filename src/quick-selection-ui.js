const usageBeforeQuickSelection=usageV5;
usageV5=function(){
 const html=usageBeforeQuickSelection();
 const rail=`<section class="sc-usage-picker" aria-label="사용량을 확인할 서비스"><div class="sc-heading"><h2>서비스</h2><span class="sc-small">옆으로 넘겨 선택</span></div><div class="sc-usage-rail">${usageExamples.map(x=>`<button class="sc-usage-choice" data-quick-usage="${x.id}" aria-pressed="${s.usageId===x.id}">${serviceLogo(x.id,x.name)}<strong>${esc(x.name)}</strong><small>${x.id==='kling'?'실제 연결':x.id==='chatgpt'?'확장 동기화':'예시'}</small></button>`).join('')}</div></section>`;
 return html.replace(/<label class="sc-service-select">[\s\S]*?<\/label>/,rail);
};
el.addEventListener('click',event=>{const button=event.target.closest('[data-quick-usage]');if(!button)return;const left=el.querySelector('.sc-usage-rail')?.scrollLeft||0;s.usageId=button.dataset.quickUsage;render();const rail=el.querySelector('.sc-usage-rail');if(rail)rail.scrollLeft=left;el.querySelector(`[data-quick-usage="${s.usageId}"]`)?.focus({preventScroll:true});if(s.usageId==='chatgpt')loadExtensionUsage();});
const addBeforeQuickSelection=addV4;
addV4=function(){
 let html=addBeforeQuickSelection();
 html=html.replace(/<button class="sc-add" data-open-editor="[^"]*"[\s\S]*?<\/button>/,'');
 html=html.replace(/<button class="sc-secondary" data-next>[\s\S]*?<\/button>/,'');
 if(!s.chosen)return html;
 const service=selectedService();
 return html+`<aside class="sc-add-dock" aria-label="선택한 서비스 추가"><div class="sc-dock-selection" role="status">${serviceLogo(service.id,service.name)}<span><small>선택한 서비스</small><strong>${esc(service.name)}</strong></span>${service.id==='kling'?'<button class="sc-textbtn" data-next>계정 연결</button>':''}</div><button class="sc-add" data-open-editor="${service.id}">${icon('plus')} 구독 추가하기</button></aside>`;
};
const renderBeforeQuickSelection=render;
render=function(){const left=el.querySelector('.sc-usage-rail')?.scrollLeft??0;renderBeforeQuickSelection();const rail=el.querySelector('.sc-usage-rail');if(rail)rail.scrollLeft=left;};
const homeBeforeTopAdd=homeV4;
homeV4=function(){return homeBeforeTopAdd().replace('<span class="sc-demo">결제 정보 확인 중</span>','').replace('<h1>내 구독</h1>',`<div class="sc-title-add"><h1>내 구독</h1><button data-top-add>${icon('plus')} 구독 추가</button></div>`);};
el.addEventListener('click',event=>{if(event.target.closest('[data-top-add]')){s.category='전체';s.search='';s.catalogPage=0;s.chosen=null;change('add');}});
