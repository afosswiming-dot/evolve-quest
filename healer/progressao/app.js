'use strict';

const SUPABASE_URL='https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const configured=!SUPABASE_URL.startsWith('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const supabase=configured?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}}):null;
const PAGE_SIZE=20;
const state={page:1,search:'',status:'',level:'',order:'priority_desc',total:0};
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

function setStatus(type,message){
  $('#statusRegion').innerHTML=`<div class="${type} panel"><strong>${esc(message)}</strong>${type==='error'?'<button id="retryBtn" class="btn btn-secondary">Tentar novamente</button>':''}</div>`;
  $('#retryBtn')?.addEventListener('click',load);
}

async function authorize(){
  if(!configured){setStatus('empty','Configure o Supabase para carregar as Progressões.');return false;}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/healer/login/';return false;}
  const {data:profile,error}=await supabase.from('profiles').select('role,account_status').eq('id',session.user.id).single();
  if(error||!profile||!['healer','admin'].includes(profile.role)||profile.account_status!=='active'){
    await supabase.auth.signOut();location.href='/healer/login/';return false;
  }
  return true;
}

async function load(){
  setStatus('loading','Carregando Jornadas...');
  if(!(await authorize()))return;
  const {data,error}=await supabase.rpc('get_healer_progressions',{p_search:state.search||null,p_status:state.status||null,p_level:state.level?Number(state.level):null,p_page:state.page,p_page_size:PAGE_SIZE,p_order:state.order});
  if(error){console.error(error);setStatus('error','Não foi possível carregar as Progressões agora.');return;}
  $('#statusRegion').innerHTML='';
  const rows=data?.items||[];
  state.total=Number(data?.totalCount||0);
  renderSummary(data?.summary||{});renderLevels(rows);renderRows(rows);paginate();
}

function renderSummary(summary){
  $('#mActive').textContent=summary.activeAdventurers??0;
  $('#mInProgress').textContent=summary.inProgress??0;
  $('#mCheckpoint').textContent=summary.checkpointReady??0;
  $('#mProgression').textContent=summary.awaitingProgression??0;
}

function renderLevels(rows){
  const select=$('#levelFilter');
  const known=new Map([...select.options].filter(option=>option.value).map(option=>[Number(option.value),option.textContent]));
  rows.forEach(row=>{if(row.currentLevel)known.set(Number(row.currentLevel),`Nível ${roman(row.currentLevel)}${row.levelName?` — ${row.levelName}`:''}`);});
  const selected=select.value;
  select.innerHTML='<option value="">Todos os níveis</option>'+[...known.entries()].sort((a,b)=>a[0]-b[0]).map(([number,label])=>`<option value="${number}">${esc(label)}</option>`).join('');
  select.value=selected;
}

function renderRows(rows){
  $('#resultCount').textContent=`${state.total} resultado${state.total===1?'':'s'}`;
  const list=$('#progressionList');
  if(!rows.length){list.innerHTML='<div class="empty panel"><strong>Nenhuma Jornada encontrada.</strong><p>Os filtros atuais não retornaram Aventureiros em acompanhamento.</p></div>';return;}
  list.innerHTML=rows.map(card).join('');
}

function card(row){
  const progress=Math.max(0,Math.min(100,Number(row.chapterProgress)||0));
  const name=row.displayName||row.preferredName||row.fullName||'Aventureiro';
  const checkpoint=checkpointLabel(row.checkpoint);
  const next=row.nextChapter?`Capítulo ${roman(row.nextChapter.chapterNumber)} — ${row.nextChapter.title}`:'Último capítulo ativo da Jornada';
  const checkpointHref=row.checkpoint?.id?`/healer/checkpoints/?checkpoint_id=${encodeURIComponent(row.checkpoint.id)}`:'/healer/checkpoints/';
  const journeyHref=`/healer/aventureiro/?adventurer_id=${encodeURIComponent(row.adventurerId)}`;
  return `<article class="progression-card panel">
    <div class="card-head"><div class="identity"><div class="avatar">${esc(initials(name))}</div><div><p class="preferred">${esc(row.preferredName||name)}</p><h3>${esc(row.fullName||name)}</h3></div></div><span class="badge ${esc(row.status)}">${esc(row.statusLabel)}</span></div>
    <div class="journey-path"><div><small>Nível atual</small><strong>Nível ${esc(roman(row.currentLevel))}${row.levelName?` — ${esc(row.levelName)}`:''}</strong></div><span aria-hidden="true">↓</span><div><small>Capítulo atual</small><strong>Capítulo ${esc(roman(row.chapterNumber))}${row.chapterTitle?` — ${esc(row.chapterTitle)}`:''}</strong></div></div>
    <div class="progress-block"><div class="progress-copy"><strong>Progresso</strong><span>${progress}%</span></div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><div class="session-row"><strong>${Number(row.completedSessions)||0} / ${Number(row.plannedSessions)||0} sessões</strong><span>Início: ${esc(date(row.chapterStartedAt))}</span><span>Último registro: ${esc(date(row.lastActivityAt))}</span></div></div>
    <div class="next-step"><small>Próxima etapa</small><strong>${esc(next)}</strong><span class="checkpoint-state">Checkpoint: ${esc(checkpoint)}</span></div>
    <div class="actions"><a class="btn btn-secondary" href="${journeyHref}">Ver Jornada</a><a class="btn btn-secondary" href="${checkpointHref}">Checkpoint</a><a class="btn btn-primary" href="${journeyHref}">Gerenciar Progressão</a></div>
  </article>`;
}

function checkpointLabel(checkpoint){const labels={none:'nenhum',locked:'pendente',available:'disponível',sent:'enviado',awaiting_analysis:'aguardando análise',completed:'concluído'};return labels[checkpoint?.state]||'nenhum';}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';}
function roman(value){const number=Number(value);if(!Number.isInteger(number)||number<1)return '—';const map=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let rest=number,result='';for(const [amount,symbol] of map){while(rest>=amount){result+=symbol;rest-=amount;}}return result;}
function date(value){if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(parsed);}

function paginate(){const pages=Math.max(1,Math.ceil(state.total/PAGE_SIZE)),element=$('#pagination');if(pages<=1){element.innerHTML='';return;}element.innerHTML=`<button ${state.page===1?'disabled':''} data-page="${state.page-1}">‹</button><button aria-current="page">${state.page}</button><button ${state.page===pages?'disabled':''} data-page="${state.page+1}">›</button>`;element.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{state.page=Number(button.dataset.page);load();});}

let searchTimer;
$('#searchInput').addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=event.target.value.trim();state.page=1;load();},350);});
$('#statusFilter').onchange=event=>{state.status=event.target.value;state.page=1;load();};
$('#levelFilter').onchange=event=>{state.level=event.target.value;state.page=1;load();};
$('#orderFilter').onchange=event=>{state.order=event.target.value;state.page=1;load();};
$('#filterToggle').onclick=()=>$('#filtersPanel').classList.toggle('open');
$('#refreshBtn').onclick=load;
load();
