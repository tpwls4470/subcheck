const backgroundBilling={state:'',applied:false};
const backgroundBillingMessages={reading:'클링 결제정보를 백그라운드에서 확인하고 있어요…',synced:'클링 결제정보를 새로 가져왔어요.',disabled:'확장에서 클링 결제정보 수집·동기화를 켜주세요.',busy:'클링 결제정보를 이미 확인 중이에요. 잠시 기다려주세요.',cooldown:'조회가 끝난 뒤 15초 후 다시 시도해주세요.',timeout:'클링 조회가 지연됐어요. 로그인 상태를 확인한 뒤 다시 시도해주세요.',open_failed:'백그라운드 조회 탭을 열지 못했어요.',needs_kling_login:'클링 로그인이 필요해요. 한 번 로그인한 뒤 다시 새로고침해주세요.',needs_interaction:'클링에서 추가 확인이 필요해 자동 조회를 멈췄어요.',waiting_total:'세금을 포함한 최종 청구금액을 확인하지 못했어요. 이전 기록을 유지해요.',unsupported_display:'클링 결제 화면을 읽지 못했어요. 이전 기록을 유지해요.',needs_reload:'확장과 서브체크 탭을 새로고침한 뒤 다시 시도해주세요.',needs_login:'서브체크 로그인을 확인한 뒤 다시 시도해주세요.',needs_tab:'같은 Chrome에서 서브체크 연결 탭을 열어주세요.',permission_denied:'서브체크 탭을 새로고침하고 다시 시도해주세요.',invalid_record:'읽은 결제정보를 검증하지 못했어요. 이전 기록을 유지해요.',network_error:'통신에 실패했어요. 이전 기록을 유지해요.',server_error:'서브체크 서버에 연결하지 못했어요.',rate_limited:'요청이 많아요. 잠시 후 다시 시도해주세요.',unsupported_browser:'결제정보 백그라운드 조회는 PC Chrome의 subcheck 확장 0.5.0이 필요해요. 공식 크레딧 조회는 별도로 진행돼요.'};
function paintBackgroundBilling(){
 const main=el.querySelector('main');if(!main||!backgroundBilling.state)return;
 let box=main.querySelector('[data-background-billing-status]');if(!box){main.insertAdjacentHTML('afterbegin','<aside class="sc-status-banner" data-background-billing-status role="status" aria-live="polite"></aside>');box=main.querySelector('[data-background-billing-status]');}
 const state=backgroundBilling.state,text=backgroundBillingMessages[state]||'클링 조회를 완료하지 못했어요. 이전 기록을 유지해요.';
 box.className='sc-status-banner'+(['reading','synced'].includes(state)?'':' warning');
 box.innerHTML=esc(text)+(state==='synced'?'<br>'+esc(backgroundBilling.applied?'내 구독에도 자동 반영됐어요.':'자동 업데이트가 꺼져 있으면 수집 기록을 확인해 저장해주세요.'):'')+(['needs_kling_login','needs_interaction','timeout'].includes(state)?'<br><a href="https://kling.ai/app/membership/membership-plan" target="_blank" rel="noopener noreferrer">클링 로그인·연결 확인</a>':'');
}
const renderBeforeBackgroundBilling=render;
render=function(){renderBeforeBackgroundBilling();paintBackgroundBilling();};
document.addEventListener('subcheck:kling-refresh-status',async event=>{
 let data;try{data=JSON.parse(event.detail);}catch{return;}
 if(!Object.hasOwn(backgroundBillingMessages,data.state))return;
 Object.assign(backgroundBilling,{state:data.state,applied:data.applied===true});paintBackgroundBilling();
 if(data.ok&&data.state==='synced'){await Promise.all([refreshBillingSubscriptions(),loadBillingAuto(),loadBillingImport()]);paintBackgroundBilling();}
});
el.addEventListener('click',event=>{
 if(!event.target.closest('[data-refresh],[data-live-refresh],[data-bg-kling-refresh]'))return;
 if(!document.documentElement.hasAttribute('data-subcheck-background-refresh')){backgroundBilling.state='unsupported_browser';paintBackgroundBilling();}
},true);
const autoMarkupBeforeBackground=billingAutoMarkup;
billingAutoMarkup=function(){return autoMarkupBeforeBackground().replace('클링 구독 관리 화면이 PC Chrome에서 열려 있을 때만 새 정보를 읽어요.','PC Chrome 확장 0.5.0에서는 서브체크 새로고침으로 클링을 잠깐 열어 조회해요. 클링에 로그인되어 있어야 해요.').replace('<hr>','<button type="button" class="sc-secondary" data-bg-kling-refresh>클링 결제정보 새로고침</button><hr>');};
