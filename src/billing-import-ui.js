const billingImport={candidate:null,loaded:false,loading:false,error:''};
function refreshBillingBox(){if(s.screen!=='editSubscription'||s.editingSubscription!=='kling')return;const block=el.querySelector('[data-billing-import-box]');if(block){block.innerHTML=billingImportMarkup();globalThis.lucide?.createIcons();}}
async function loadBillingImport(){if(billingImport.loading)return;billingImport.loading=true;billingImport.error='';refreshBillingBox();try{const r=await fetch('/api/billing-candidate',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error('수집 기록을 확인하지 못했어요. 잠시 후 다시 눌러주세요.');billingImport.candidate=d.candidate;}catch(error){billingImport.error=error.message||'수집 기록을 확인하지 못했어요.';}finally{billingImport.loaded=true;billingImport.loading=false;refreshBillingBox();}}
function freshBillingCandidate(c){const age=Date.now()-Date.parse(c?.observedAt);return Number.isFinite(age)&&age>=-60000&&age<86400000;}
function billingImportMarkup(){
 const c=billingImport.candidate,old=c&&!freshBillingCandidate(c);
 const check=`<button type="button" class="sc-secondary" data-check-billing-import ${billingImport.loading?'disabled':''}>${billingImport.loading?'수집 기록 확인 중…':'새 수집 기록 확인'}</button>`;
 const error=billingImport.error?`<p class="sc-form-message" role="alert">${esc(billingImport.error)}</p>`:'';
 if(!c)return `<h2>클링 결제정보 가져오기</h2><p class="sc-footnote">PC 확장 0.4.1에서 클링 수집을 켠 뒤, 클링의 ‘구독 관리’ 창을 열어주세요. 같은 Chrome에 서브체크 연결 탭도 열어두세요.</p>${check}${error}`;
 return `<h2>${old?'이전에 읽은 결제정보':'클링에서 읽은 결제정보'}</h2><p class="sc-footnote"><strong>${esc(c.plan)} · ${usd(c.amount)}</strong><br>수집 ${esc(new Date(c.observedAt).toLocaleString('ko-KR'))}</p>${old?'<p class="sc-footnote" role="status">수집 후 하루가 지나 저장할 수 없어요. PC Chrome에서 클링 페이지를 새로고침하고 ‘구독 관리’ 창을 다시 연 뒤, 아래에서 새 기록을 확인해주세요.</p>':`<button type="button" class="sc-add" data-save-billing-import ${billingImport.loading||savedState.busy?'disabled':''}>이 정보로 내 구독에 저장</button><button type="button" class="sc-textbtn" data-apply-billing-import>입력란에서 먼저 수정하기</button>`}${check}${error}<p class="sc-footnote">세금을 포함한 다음 청구금액이에요. 저장해도 실제 클링 결제·구독은 변경되지 않아요. 정확한 결제일은 제공되지 않아 비워두며, 이미 저장한 결제일은 유지해요.</p>`;
}
const editorBeforeBillingImport=editSubscriptionScreen;
editSubscriptionScreen=function(){let html=editorBeforeBillingImport();if(s.editingSubscription!=='kling')return html;html=html.replace('<legend>다음 결제 예정일</legend>','<legend>다음 결제 예정일</legend><p class="sc-footnote">클링은 결제 시점을 만료일 1~2일 전으로 안내하며 정확한 날짜는 제공하지 않아요. 날짜 없이 금액·플랜만 저장할 수 있어요. 결제 알림은 날짜를 확인해 입력한 뒤 설정해주세요.</p>');return html.replace('<form data-subscription-form',`<section class="sc-card sc-inner sc-section" data-billing-import-box>${billingImportMarkup()}</section><form data-subscription-form`);};
el.addEventListener('click',e=>{
 if(e.target.closest('[data-check-billing-import]')){loadBillingImport();return;}
 const save=e.target.closest('[data-save-billing-import]'),edit=e.target.closest('[data-apply-billing-import]');if(!save&&!edit)return;
 const c=billingImport.candidate,form=el.querySelector('[data-subscription-form]');if(!c||!form||savedState.busy||billingImport.loading)return;
 if(!freshBillingCandidate(c)){refreshBillingBox();notify('오래된 기록이에요. 새 수집 기록을 확인해주세요.');return;}
 form.elements.plan.value=c.plan;form.elements.currency.value=c.currency;form.elements.amount.value=c.amount;form.elements.channel.value=c.channel;form.elements.cycle.value=/Monthly/.test(c.plan)?'monthly':/Yearly|Annual/.test(c.plan)?'yearly':'unknown';updateFxPreview();
 if(save)form.requestSubmit();else notify('입력란에 적용했어요. 수정 후 아래의 내 계정에 저장을 눌러주세요.');
});
loadBillingImport();
