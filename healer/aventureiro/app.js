'use strict';

const SUPABASE_URL='https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const configured=!SUPABASE_URL.startsWith('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const supabaseClient=configured
  ? window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storage:window.localStorage,
        storageKey:'evolve-quest-healer-auth'
      }
    })
  : null;

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));

let adventurerId=null;

function setStatus(type,msg){
  const el=$('#statusRegion');
  if(!el) return;
  el.innerHTML=`<div class="${type} panel"><strong>${esc(msg)}</strong></div>`;
}

async function authorize(){
  if(!configured){
    setStatus('empty','Configure o Supabase para carregar este perfil.');
    return false;
  }

  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error||!session){
    location.href='/healer/login/';
    return false;
  }

  const {data:profile,error:profileError}=await supabaseClient
    .from('profiles')
    .select('role,account_status')
    .eq('id',session.user.id)
    .single();

  if(
    profileError ||
    !profile ||
    !['healer','admin'].includes(profile.role) ||
    profile.account_status!=='active'
  ){
    await supabaseClient.auth.signOut();
    location.href='/healer/login/';
    return false;
  }

  return true;
}

function fmtDate(v){
  if(!v) return 'Não informado';
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(d);
}

async function fallbackDetail(){
  const [
    profileRes,
    journeyRes,
    registrationsRes,
    alertsRes,
    checkpointRes,
    missionsRes
  ]=await Promise.all([
    supabaseClient.from('profiles')
      .select('id,full_name,preferred_name,email,journey_stage,account_status,city,state,class_id,current_level,current_chapter_id')
      .eq('id',adventurerId)
      .maybeSingle(),

    supabaseClient.from('adventurer_journeys')
      .select('id,current_level,current_chapter_id,chapter_progress,current_streak,started_at,status')
      .eq('adventurer_id',adventurerId)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle(),

    supabaseClient.from('mission_registrations')
      .select('id,mission_id,submitted_at,perceived_effort,pain_status,completion_status')
      .eq('adventurer_id',adventurerId)
      .order('submitted_at',{ascending:false})
      .limit(5),

    supabaseClient.from('healer_alerts')
      .select('id,title,severity,created_at,status')
      .eq('adventurer_id',adventurerId)
      .in('status',['new','viewed','in_progress'])
      .order('created_at',{ascending:false}),

    supabaseClient.from('checkpoint_assignments')
      .select('id,status,due_at,available_at')
      .eq('adventurer_id',adventurerId)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle(),

    supabaseClient.from('mission_assignments')
      .select('id,mission_id,mission_type,status,missions(name,environment)')
      .eq('adventurer_id',adventurerId)
      .order('available_at',{ascending:true})
  ]);

  if(profileRes.error) throw profileRes.error;
  const p=profileRes.data;
  if(!p) return null;

  let classData=null;
  let chapterData=null;

  if(p.class_id){
    const r=await supabaseClient.from('adventurer_classes').select('id,name').eq('id',p.class_id).maybeSingle();
    if(!r.error) classData=r.data;
  }

  const chapterId=journeyRes.data?.current_chapter_id||p.current_chapter_id;
  if(chapterId){
    const r=await supabaseClient.from('chapters').select('id,title').eq('id',chapterId).maybeSingle();
    if(!r.error) chapterData=r.data;
  }

  const registrations=(registrationsRes.data||[]).map(r=>({
    ...r,
    mission_name:'Missão'
  }));

  return {
    profile:p,
    journey:journeyRes.data||{},
    class:classData||{},
    chapter:chapterData||{},
    missions:(missionsRes.data||[]).map(m=>({
      name:m.missions?.name||m.mission_type||'Missão',
      environment:m.missions?.environment||'',
      status:m.status,
      mission_type:m.mission_type
    })),
    recentRegistrations:registrations,
    alerts:alertsRes.data||[],
    checkpoint:checkpointRes.data||null,
    recentTimeline:[],
    recommendedAction:null
  };
}

async function load(){
  setStatus('loading','Carregando a Jornada deste Aventureiro...');

  if(!adventurerId){
    setStatus('error','Aventureiro não encontrado.');
    return;
  }

  if(!(await authorize())) return;

  let data=null;
  const rpc=await supabaseClient.rpc('get_healer_adventurer_detail',{
    p_adventurer_id:adventurerId
  });

  if(!rpc.error && rpc.data){
    data=rpc.data;
  }else{
    console.warn('[EVOLVE Aventureiro] RPC fallback:',rpc.error);
    try{
      data=await fallbackDetail();
    }catch(error){
      console.error('[EVOLVE Aventureiro] fallback:',error);
      setStatus('error','Não foi possível carregar os dados agora.');
      return;
    }
  }

  if(!data){
    setStatus('empty','Aventureiro não encontrado.');
    return;
  }

  const status=$('#statusRegion');
  if(status) status.innerHTML='';
  render(data);
}

function render(d){
  const p=d.profile||{};
  const j=d.journey||{};
  const c=d.class||{};
  const ch=d.chapter||{};

  $('#pageTitle').textContent=p.preferred_name||p.full_name||'Aventureiro';

  const hero=$('#profileHero');
  hero.classList.remove('hidden');
  hero.innerHTML=`
    <div class="profile-title">
      <div class="avatar">${esc((p.preferred_name||p.full_name||'?').slice(0,2).toUpperCase())}</div>
      <div>
        <h2>${esc(p.preferred_name||p.full_name||'Aventureiro')}</h2>
        <p class="muted">${esc(p.full_name||'')} · ${esc(p.email||'')}</p>
      </div>
    </div>
    <div class="meta-row">
      <span class="badge">${esc(p.journey_stage||'Estado não informado')}</span>
      <span class="badge">${esc(p.account_status||'Status não informado')}</span>
      <span class="badge">${esc([p.city,p.state].filter(Boolean).join(' · ')||'Local não informado')}</span>
    </div>`;

  $('#detailGrid').innerHTML=`
    <section class="section panel" data-section="overview">
      <div class="section-head"><h2>Estado atual</h2></div>
      <div class="kpi-grid">
        <div class="kpi"><small>Classe</small><strong>${esc(c.name||'Não definida')}</strong></div>
        <div class="kpi"><small>Nível</small><strong>${j.current_level?`Nível ${esc(j.current_level)}`:(p.current_level?`Nível ${esc(p.current_level)}`:'Não definido')}</strong></div>
        <div class="kpi"><small>Capítulo</small><strong>${esc(ch.title||'Não liberado')}</strong></div>
        <div class="kpi"><small>Progresso</small><strong>${Number(j.chapter_progress||0)}%</strong></div>
        <div class="kpi"><small>Sequência</small><strong>${Number(j.current_streak||0)} dias</strong></div>
        <div class="kpi"><small>Início da Jornada</small><strong>${fmtDate(j.started_at)}</strong></div>
      </div>
    </section>

    <section class="section panel">
      <div class="section-head"><h2>Próxima ação</h2></div>
      <p>${esc(d.recommendedAction?.label||'Nenhuma ação prioritária no momento.')}</p>
      ${d.recommendedAction?.url?`<a class="btn btn-primary" href="${esc(d.recommendedAction.url)}">Abrir módulo</a>`:''}
    </section>

    <section class="section panel wide" data-section="missions">
      <div class="section-head"><h2>Missões prescritas</h2></div>
      <div class="stack">${
        (d.missions||[]).length
          ? (d.missions||[]).map(m=>`
            <div class="row-item">
              <div>
                <strong>${esc(m.name||m.mission_type)}</strong>
                <p class="muted">${esc(m.environment||'')} · ${esc(m.status||'')}</p>
              </div>
            </div>`).join('')
          : '<div class="empty"><strong>Nenhuma Missão prescrita no Capítulo atual.</strong></div>'
      }</div>
    </section>

    <section class="section panel" data-section="registrations">
      <div class="section-head"><h2>Registros recentes</h2></div>
      <div class="stack">${
        (d.recentRegistrations||[]).length
          ? d.recentRegistrations.slice(0,5).map(r=>`
            <div class="row-item">
              <div>
                <strong>${esc(r.mission_name||'Missão')}</strong>
                <p class="muted">${fmtDate(r.submitted_at)} · esforço ${esc(r.perceived_effort??'—')} · dor ${esc(r.pain_status??'—')}</p>
              </div>
              <a class="btn btn-secondary" href="/healer/registros/?registration_id=${encodeURIComponent(r.id)}">Abrir</a>
            </div>`).join('')
          : '<div class="empty"><strong>Nenhum Registro da Missão enviado.</strong></div>'
      }</div>
    </section>

    <section class="section panel" data-section="alerts">
      <div class="section-head"><h2>Alertas</h2></div>
      <div class="stack">${
        (d.alerts||[]).length
          ? d.alerts.map(a=>`
            <div class="row-item">
              <div>
                <strong>${esc(a.title||'Alerta')}</strong>
                <p class="muted">${esc(a.severity||'')} · ${fmtDate(a.created_at)}</p>
              </div>
            </div>`).join('')
          : '<div class="empty"><strong>Nenhum alerta aberto.</strong></div>'
      }</div>
    </section>

    <section class="section panel">
      <div class="section-head"><h2>Checkpoint</h2></div>
      ${
        d.checkpoint
          ? `<div class="kpi-grid">
              <div class="kpi"><small>Status</small><strong>${esc(d.checkpoint.status)}</strong></div>
              <div class="kpi"><small>Vencimento</small><strong>${fmtDate(d.checkpoint.due_at)}</strong></div>
            </div>`
          : '<div class="empty"><strong>Nenhum Checkpoint disponível.</strong></div>'
      }
    </section>

    <section class="section panel wide" data-section="history">
      <div class="section-head"><h2>Histórico resumido</h2></div>
      <div class="timeline">${
        (d.recentTimeline||[]).length
          ? d.recentTimeline.map(e=>`
            <div class="event">
              <strong>${esc(e.label||e.action)}</strong>
              <p class="muted">${fmtDate(e.created_at)}</p>
            </div>`).join('')
          : '<div class="empty"><strong>Nenhum evento disponível.</strong></div>'
      }</div>
    </section>`;
}

function bindTabs(){
  document.querySelectorAll('.tab').forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const target=document.querySelector(`[data-section="${b.dataset.target}"]`);
      target?.scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
}

async function init(){
  const params=new URLSearchParams(location.search);
  adventurerId=params.get('adventurer_id');

  bindTabs();
  await load();
}

document.addEventListener('DOMContentLoaded',init);
