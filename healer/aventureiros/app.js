
'use strict';
const SUPABASE_URL = 'https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const PAGE_SIZE = 20;
const configured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const supabase = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
const state={page:1,search:'',stage:'',status:'',level:'',classId:'',activity:'',order:'priority_desc',total:0};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const stageLabel=s=>({welcome:'Boas-vindas pendente',assessment:'Avaliação em andamento',waiting_healer:'Aguardando análise do Healer',dashboard:'Jornada ativa',checkpoint:'Checkpoint disponível',feedback:'Feedback em preparação',progression:'Progressão em andamento'}[s]||'Estado não informado');
function setStatus(type,msg){$('#statusRegion').innerHTML=`<div class="${type} panel">${type==='loading'?'<div><span class="loading-dot"></span> <span class="loading-dot"></span> <span class="loading-dot"></span></div>':''}<strong>${esc(msg)}</strong>${type==='error'?'<button class="btn btn-secondary" id="retryBtn">Tentar novamente</button>':''}</div>`;if(type==='error')$('#retryBtn')?.addEventListener('click',load);}
function clearStatus(){ $('#statusRegion').innerHTML='';}
async function authorize(){if(!configured){setStatus('empty','Configure o Supabase para carregar os Aventureiros.');return false;}const {data:{session}}=await supabase.auth.getSession();if(!session){location.href='/healer/login/';return false;}const {data:profile,error}=await supabase.from('profiles').select('role,account_status').eq('id',session.user.id).single();if(error||!profile||!['healer','admin'].includes(profile.role)||profile.account_status!=='active'){await supabase.auth.signOut();location.href='/healer/login/';return false;}return true;}
async function loadClasses(){if(!configured)return;const {data}=await supabase.from('adventurer_classes').select('id,name').order('name');(data||[]).forEach(c=>$('#classFilter').insertAdjacentHTML('beforeend',`<option value="${esc(c.id)}">${esc(c.name)}</option>`));}
async function load(){
 setStatus('loading','Carregando Aventureiros...');
 if(!(await authorize()))return;
 const {data,error}=await supabase.rpc('get_healer_adventurers',{p_search:state.search||null,p_stage:state.stage||null,p_status:state.status||null,p_class_id:state.classId||null,p_level:state.level?Number(state.level):null,p_has_alert:state.activity==='alert'?true:null,p_page:state.page,p_page_size:PAGE_SIZE,p_order:state.order});
 if(error){console.error(error);setStatus('error','Não foi possível carregar os dados agora.');return;}
 clearStatus(); const rows=Array.isArray(data)?data:(data?.items||[]); state.total=Number(data?.totalCount ?? rows[0]?.totalCount ?? 0); render(rows); renderPagination();
}
function render(rows){
 $('#resultCount').textContent=`${state.total} resultado${state.total===1?'':'s'}`;
 const el=$('#adventurerList'); if(!rows.length){el.innerHTML='<div class="empty panel"><strong>Nenhum Aventureiro encontrado.</strong><span class="muted">Ajuste os filtros ou a pesquisa.</span></div>';updateMetrics({});return;}
 el.innerHTML=rows.map(a=>`<article class="adventurer-card panel">
 <div><div class="card-top"><div class="identity"><div class="avatar">${esc((a.displayName||a.fullName||'?').slice(0,2).toUpperCase())}</div><div><h3>${esc(a.displayName||a.fullName||'Aventureiro')}</h3><p class="muted">${esc(a.fullName||'')}</p></div></div><span class="badge ${a.openAlerts>0?'alert':''}">${esc(stageLabel(a.journeyStage))}</span></div></div>
 <div class="card-grid"><div class="datum"><small>Classe e nível</small><strong>${esc(a.className||'Não definida')} · ${a.currentLevel?`Nível ${esc(a.currentLevel)}`:'Nível não definido'}</strong></div><div class="datum"><small>Capítulo</small><strong>${esc(a.chapterTitle||'Não liberado')}</strong></div><div class="datum"><small>Progresso</small><div class="progress" aria-label="${Number(a.chapterProgress||0)}%"><span style="width:${Math.max(0,Math.min(100,Number(a.chapterProgress||0)))}%"></span></div></div><div class="datum"><small>Alertas abertos</small><strong>${Number(a.openAlerts||0)}</strong></div></div>
 <div class="card-actions"><a class="btn btn-primary" href="/healer/aventureiro/?adventurer_id=${encodeURIComponent(a.id)}">Abrir Aventureiro</a></div></article>`).join('');
 updateMetrics(rows.summary||{});
}
function updateMetrics(m){$('#mTotal').textContent=state.total||0;$('#mActive').textContent=m.active??0;$('#mWaiting').textContent=m.waiting??0;$('#mAlerts').textContent=m.alerts??0;$('#mCheckpoints').textContent=m.checkpoints??0;$('#mInactive').textContent=m.inactive??0;}
function renderPagination(){const pages=Math.max(1,Math.ceil(state.total/PAGE_SIZE)),el=$('#pagination');if(pages<=1){el.innerHTML='';return;}let html=`<button ${state.page===1?'disabled':''} data-page="${state.page-1}" aria-label="Página anterior">‹</button>`;for(let p=Math.max(1,state.page-2);p<=Math.min(pages,state.page+2);p++)html+=`<button data-page="${p}" ${p===state.page?'aria-current="page"':''}>${p}</button>`;html+=`<button ${state.page===pages?'disabled':''} data-page="${state.page+1}" aria-label="Próxima página">›</button>`;el.innerHTML=html;el.querySelectorAll('button:not([disabled])').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);syncURL();load();});}
function syncURL(){const p=new URLSearchParams();Object.entries(state).forEach(([k,v])=>{if(v&&k!=='total')p.set(k,v)});history.replaceState(null,'',`${location.pathname}?${p}`)}
let timer;$('#searchInput').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{state.search=e.target.value.trim();state.page=1;syncURL();load();},350)});$('#clearSearch').onclick=()=>{$('#searchInput').value='';state.search='';state.page=1;syncURL();load();};
[['stageFilter','stage'],['statusFilter','status'],['levelFilter','level'],['classFilter','classId'],['activityFilter','activity'],['orderFilter','order']].forEach(([id,key])=>$('#'+id).addEventListener('change',e=>{state[key]=e.target.value;state.page=1;syncURL();load();}));
$('#filterToggle').onclick=()=>$('#filtersPanel').classList.toggle('open');$('#menuBtn').onclick=()=>$('#filtersPanel').classList.toggle('open');$('#refreshBtn').onclick=load;
(async()=>{await loadClasses();await load();})();
