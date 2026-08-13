'use strict';

const SUPABASE_URL='https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}
});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let adventurerId=null;

function fmtDate(v){
  if(!v)return'Não informado';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'Não informado':new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(d);
}
function fmtPhone(v){
  const n=String(v||'').replace(/\D/g,'');
  if(n.length===11)return`(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if(n.length===10)return`(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return v||'Não informado';
}
function whatsappUrl(v){
  let n=String(v||'').replace(/\D/g,'');
  if(!n)return'';
  if(n.length===10||n.length===11)n='55'+n;
  return`https://wa.me/${n}`;
}
function setStatus(type,msg){
  const el=$('#statusRegion');
  if(el)el.innerHTML=`<div class="${type} panel"><strong>${esc(msg)}</strong></div>`;
}
async function authorize(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){location.href='/healer/login/';return false}
  const {data:p,error}=await supabaseClient.from('profiles').select('role,account_status').eq('id',session.user.id).single();
  if(error||!p||!['healer','admin'].includes(p.role)||p.account_status!=='active'){
    await supabaseClient.auth.signOut(); location.href='/healer/login/'; return false;
  }
  return true;
}


async function resolveAdventurerId(){
  const params=new URLSearchParams(location.search);
  const direct=
    params.get('adventurer_id') ||
    params.get('user_id') ||
    params.get('profile_id') ||
    params.get('id');

  if(direct){
    const probe=await supabaseClient.rpc('get_healer_adventurer_detail',{
      p_adventurer_id:direct
    });
    if(!probe.error && probe.data){
      return {id:direct,data:probe.data};
    }

    // Se o mesmo UUID for, na verdade, uma Avaliação, resolve pelo RPC administrativo.
    const assessment=await supabaseClient.rpc('get_assessment_for_healer',{
      p_evaluation_id:direct
    });
    const resolved=assessment.data?.profile?.id || assessment.data?.evaluation?.adventurer_id || null;
    if(!assessment.error && resolved){
      return {id:resolved,data:null};
    }
  }

  const evaluationId=params.get('evaluation_id');
  if(evaluationId){
    const assessment=await supabaseClient.rpc('get_assessment_for_healer',{
      p_evaluation_id:evaluationId
    });
    const resolved=assessment.data?.profile?.id || assessment.data?.evaluation?.adventurer_id || null;
    if(!assessment.error && resolved){
      return {id:resolved,data:null};
    }
  }

  return {id:null,data:null};
}

async function load(preloaded=null){
  setStatus('loading','Carregando Aventureiro...');
  if(!adventurerId){
    setStatus('error','Aventureiro não encontrado. Volte para a lista e abra o perfil novamente.');
    return;
  }
  if(!(await authorize())) return;

  let data=preloaded;

  if(!data){
    const {data:detail,error}=await supabaseClient.rpc('get_healer_adventurer_detail',{
      p_adventurer_id:adventurerId
    });

    if(error){
      console.error('[EVOLVE Perfil Healer]',error);
      setStatus('error','Não foi possível carregar este Aventureiro agora.');
      return;
    }
    data=detail;
  }

  if(!data?.profile){
    setStatus('empty','Aventureiro não encontrado.');
    return;
  }

  // A RPC retorna profiles completo (to_jsonb), incluindo phone e email.
  $('#statusRegion').innerHTML='';
  render(data);
}


function render(d){
  const p=d.profile||{},j=d.journey||{},c=d.class||{},ch=d.chapter||{};
  const wa=whatsappUrl(p.phone);
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
      <div class="section-head"><h2>Contato comercial</h2></div>
      <div class="stack">
        <div class="row-item"><div><small>Telefone / WhatsApp</small><strong>${esc(fmtPhone(p.phone))}</strong></div></div>
        <div class="row-item"><div><small>E-mail</small><strong>${esc(p.email||'Não informado')}</strong></div></div>
      </div>
      ${wa?`<div class="actions"><a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a></div>`:''}
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
          ? d.missions.map(m=>`<div class="row-item"><div><strong>${esc(m.name||m.mission_type||'Missão')}</strong><p class="muted">${esc(m.environment||'')} · ${esc(m.status||'')}</p></div></div>`).join('')
          : '<div class="empty"><strong>Nenhuma Missão prescrita no Capítulo atual.</strong></div>'
      }</div>
    </section>

    <section class="section panel" data-section="registrations">
      <div class="section-head"><h2>Registros recentes</h2></div>
      <div class="stack">${
        (d.recentRegistrations||[]).length
          ? d.recentRegistrations.map(r=>`<div class="row-item"><div><strong>${esc(r.mission_name||'Missão')}</strong><p class="muted">${fmtDate(r.submitted_at)} · esforço ${esc(r.perceived_effort??'—')} · dor ${esc(r.pain_status??'—')}</p></div><a class="btn btn-secondary" href="/healer/registros/?registration_id=${encodeURIComponent(r.id)}">Abrir</a></div>`).join('')
          : '<div class="empty"><strong>Nenhum Registro da Missão enviado.</strong></div>'
      }</div>
    </section>

    <section class="section panel" data-section="alerts">
      <div class="section-head"><h2>Alertas</h2></div>
      <div class="stack">${
        (d.alerts||[]).length
          ? d.alerts.map(a=>`<div class="row-item"><div><strong>${esc(a.title||'Alerta')}</strong><p class="muted">${esc(a.severity||'')} · ${fmtDate(a.created_at)}</p></div></div>`).join('')
          : '<div class="empty"><strong>Nenhum alerta aberto.</strong></div>'
      }</div>
    </section>

    <section class="section panel">
      <div class="section-head"><h2>Checkpoint</h2></div>
      ${
        d.checkpoint
          ? `<div class="kpi-grid"><div class="kpi"><small>Status</small><strong>${esc(d.checkpoint.status)}</strong></div><div class="kpi"><small>Vencimento</small><strong>${fmtDate(d.checkpoint.due_at)}</strong></div></div>`
          : '<div class="empty"><strong>Nenhum Checkpoint disponível.</strong></div>'
      }
    </section>

    <section class="section panel wide" data-section="history">
      <div class="section-head"><h2>Histórico resumido</h2></div>
      <div class="timeline">${
        (d.recentTimeline||[]).length
          ? d.recentTimeline.map(e=>`<div class="event"><strong>${esc(e.label||e.action)}</strong><p class="muted">${fmtDate(e.created_at)}</p></div>`).join('')
          : '<div class="empty"><strong>Nenhum evento disponível.</strong></div>'
      }</div>
    </section>`;
}

function bindTabs(){
  document.querySelectorAll('.tab').forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.querySelector(`[data-section="${b.dataset.target}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
}

async function init(){
  bindTabs();
  if(!(await authorize())) return;

  const resolved=await resolveAdventurerId();
  adventurerId=resolved.id;

  if(!adventurerId){
    setStatus('error','Aventureiro não encontrado. Volte para Aventureiros e tente novamente.');
    return;
  }

  // Normaliza a URL para o identificador oficial do Aventureiro.
  const cleanUrl=`/healer/aventureiro/?adventurer_id=${encodeURIComponent(adventurerId)}`;
  if(location.pathname+location.search!==cleanUrl){
    history.replaceState({},document.title,cleanUrl);
  }

  await load(resolved.data);
}
document.addEventListener('DOMContentLoaded',init);
