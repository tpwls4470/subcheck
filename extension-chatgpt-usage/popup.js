const enabled=document.querySelector('#enabled'),status=document.querySelector('#status');
async function render(){const data=await chrome.storage.local.get(['enabled','snapshot','lastCheck']);enabled.checked=data.enabled===true;const s=data.snapshot;if(!s){status.textContent=data.lastCheck?.status==='no_supported_metrics'?'지원되는 수치를 찾지 못했어요. 사용량 화면을 열고 다시 확인해주세요.':'아직 수집된 값이 없어요.';return;}const stale=Date.now()-Date.parse(s.observedAt)>86400000;status.textContent=(stale?'오래된 기록 · 현재 잔액이 아닙니다\n':'마지막으로 화면에서 읽은 값\n')+s.windows.map(x=>(x.window==='five_hour'?'5시간':'주간')+': '+x.remainingPercent+'% 남음'+(x.resetEstimatedAt?'\n초기화 예상: '+new Date(x.resetEstimatedAt).toLocaleString():'\n초기화 시간 확인 안 됨')).join('\n\n')+'\n\n수집: '+new Date(s.observedAt).toLocaleString();}
enabled.addEventListener('change',()=>chrome.storage.local.set({enabled:enabled.checked}));document.querySelector('#clear').addEventListener('click',async()=>{await chrome.storage.local.remove(['snapshot','lastCheck']);render();});chrome.storage.onChanged.addListener(render);render();

const syncToggle=document.querySelector('#syncEnabled');
async function showSync(){const d=await chrome.storage.local.get(['syncEnabled','syncStatus']);syncToggle.checked=d.syncEnabled===true;document.querySelector('#syncStatus').textContent=!d.syncEnabled?'계정 동기화 꺼짐':({synced:'계정에 동기화했어요.',needs_tab:'PC에서 서브체크 연결 탭을 열어주세요.',needs_login:'서브체크 탭에서 같은 계정으로 로그인하거나 새로고침해주세요.'}[d.syncStatus?.state]||'다음 수집 기록부터 동기화해요.');}
syncToggle.addEventListener('change',async()=>{await chrome.storage.local.set({syncEnabled:syncToggle.checked});await chrome.runtime.sendMessage({type:'SUBCHECK_SYNC_NOW'});showSync();});
document.querySelector('#connect').addEventListener('click',()=>chrome.tabs.create({url:'https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site/?extensionSync=1'}));
chrome.storage.onChanged.addListener(showSync);showSync();

function billingTime(value){return value?new Date(value).toLocaleString('ko-KR'):'아직 없음';}
async function showBilling(){
 const d=await chrome.storage.local.get(['billingEnabled','billingCandidate','billingSyncStatus','billingCaptureStatus']);
 document.querySelector('#billingEnabled').checked=d.billingEnabled===true;
 document.querySelector('#extensionVersion').textContent='버전 '+chrome.runtime.getManifest().version;
 const candidate=d.billingCandidate,raw=d.billingSyncStatus,status=typeof raw==='string'?{state:raw}:raw||{};
 const capture=d.billingCaptureStatus?.state;
 const age=candidate?Date.now()-Date.parse(candidate.observedAt):Infinity;
 const stale=!Number.isFinite(age)||age>=86400000||age < -60000;
 const captureLabels={page_hidden:'클링 탭이 뒤에 있어 새 정보를 읽지 않고 있어요.',needs_dialog:'클링의 구독 관리 창을 열어주세요.',unsupported_display:'창은 찾았지만 플랜·다음 청구금액을 읽지 못했어요.',captured:'화면에서 읽었어요.'};
 const labels={disabled:'수집·전송이 꺼져 있어요.',needs_capture:'먼저 클링 구독 관리 창을 열어주세요.',stale_record:'기록이 오래됐어요. 클링을 새로고침하고 구독 관리 창을 다시 열어주세요.',sending:'서브체크에 보내는 중…',needs_tab:'같은 Chrome에서 서브체크 연결 탭을 열어주세요.',needs_reload:'서브체크 탭을 새로고침한 뒤 다시 시도해주세요.',needs_login:'서브체크 탭에서 로그인한 뒤 다시 시도해주세요.',permission_denied:'접근 또는 보안 확인에 실패했어요. 서브체크 탭을 새로고침하고 다시 시도해주세요.',invalid_record:'서버가 수집 기록을 거절했어요. 클링에서 다시 수집해주세요.',rate_limited:'요청이 많아요. 잠시 후 다시 시도해주세요.',server_error:'서브체크 서버가 응답하지 못했어요. 잠시 후 다시 시도해주세요.',network_error:'통신에 실패했어요. 인터넷 연결 후 다시 시도해주세요.',rejected:'서버가 기록을 받지 못했어요. 다시 수집 후 시도해주세요.',synced:'계정의 확인 대기 기록으로 전송했어요.'};
 const lines=!d.billingEnabled?['클링 수집·동기화 꺼짐']:[
  '① 화면 읽기: '+(stale&&candidate?'마지막 기록이 오래됐어요.':captureLabels[capture]||(candidate?'마지막 읽기 기록이 있어요.':'아직 읽은 기록이 없어요.')),
  '마지막 수집: '+billingTime(candidate?.observedAt),
  '② 서버 전송: '+(stale&&candidate?labels.stale_record:labels[status.state]||'새 수집 기록을 기다리고 있어요.'),
  '마지막 전송 성공: '+billingTime(status.lastSuccessAt),
  '③ 앱 반영: '+(status.state==='synced'&&!stale?status.applied?'이 수집 기록을 내 구독에 자동 반영했어요.':'계정에 전송됐어요. 자동 업데이트를 켜거나 앱에서 확인 후 저장해주세요. 아직 구독에 자동 저장된 것은 아니에요.':'서버 전송 후 자동 업데이트 설정에 따라 반영해요.')
 ];
 document.querySelector('#billingStatus').textContent=lines.join('\n\n');
 document.querySelector('#billingRetry').disabled=!d.billingEnabled||!candidate||stale||status.state==='sending';
}
document.querySelector('#billingEnabled').addEventListener('change',e=>chrome.storage.local.set({billingEnabled:e.target.checked}));
document.querySelector('#billingConnect').addEventListener('click',()=>chrome.tabs.create({url:'https://subcheck-mobile-tpwls4470.satinyshark14.chatgpt.site/?extensionSync=1'}));
document.querySelector('#billingRetry').addEventListener('click',async()=>{const button=document.querySelector('#billingRetry');button.disabled=true;try{await chrome.runtime.sendMessage({type:'SUBCHECK_BILLING_RETRY'});}catch{document.querySelector('#billingStatus').textContent='확장을 새로고침한 뒤 다시 시도해주세요.';}finally{await showBilling();}});
chrome.storage.onChanged.addListener(showBilling);showBilling();
