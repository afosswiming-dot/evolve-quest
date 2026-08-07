'use strict';

const SUPABASE_URL = 'https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const LOGIN_ROUTE = '/healer/login/';
const RECENT_DAYS = 7;

const els = {
  shell: document.querySelector('#appShell'), status: document.querySelector('#statusPanel'), content: document.querySelector('#dashboardContent'),
  greeting: document.querySelector('#greeting'), headerName: document.querySelector('#headerName'), headerEmail: document.querySelector('#headerEmail'), headerAvatar: document.querySelector('#headerAvatar'), sidebarName: document.querySelector('#sidebarName'), sidebarRole: document.querySelector('#sidebarRole'), sidebarAvatar: document.querySelector('#sidebarAvatar'),
  pendingAssessments: document.querySelector('#pendingAssessments'), activeAdventurers: document.querySelector('#activeAdventurers'), newAlerts: document.querySelector('#newAlerts'), pendingCheckpoints: document.querySelector('#pendingCheckpoints'), recentRegistrations: document.querySelector('#recentRegistrations'),
  priorityList: document.querySelector('#priorityList'), activityList: document.querySelector('#activityList'), refreshButton: document.querySelector('#refreshButton'), logoutButton: document.querySelector('#logoutButton'), mobileLogoutButton: document.querySelector('#mobileLogoutButton'), mobileMoreButton: document.querySelector('#mobileMoreButton'), mobileMenu: document.querySelector('#mobileMenu'), closeMobileMenu: document.querySelector('#closeMobileMenu')
};

let supabaseClient = null;

function configured() { return !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_'); }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function initials(name='Healer') { return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase() || 'H'; }
function greetingForHour() { const h=new Date().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }
function relativeTime(dateValue) { if(!dateValue) return ''; const diff=Date.now()-new Date(dateValue).getTime(); const min=Math.floor(diff/60000); if(min<1)return'agora'; if(min<60)return`há ${min} min`; const h=Math.floor(min/60); if(h<24)return`há ${h}h`; const d=Math.floor(h/24); return d===1?'há 1 dia':`há ${d} dias`; }

function setStatus(type, title, message, retry=false){
  els.status.className=`status-panel ${type==='error'?'error':''}`;
  els.status.innerHTML=`${type==='loading'?'<div class="spinner" aria-hidden="true"></div>':'<div class="item-symbol">'+(type==='error'?'!':'✓')+'</div>'}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>${retry?'<button class="status-action" id="retryButton" type="button">Tentar novamente</button>':''}</div>`;
  els.status.hidden=false; els.content.hidden=true;
  document.querySelector('#retryButton')?.addEventListener('click', loadDashboard);
}
function showContent(){ els.status.hidden=true; els.content.hidden=false; els.shell.setAttribute('aria-busy','false'); }

async function validateAdminSession(){
  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error||!session){ window.location.replace(LOGIN_ROUTE); return null; }
  const {data:profile,error:profileError}=await supabaseClient.from('profiles').select('id,full_name,preferred_name,email,role,account_status').eq('id',session.user.id).single();
  if(profileError||!profile){ await supabaseClient.auth.signOut(); throw new Error('PROFILE_NOT_FOUND'); }
  if(!['healer','admin'].includes(profile.role)||profile.account_status!=='active'){ await supabaseClient.auth.signOut(); throw new Error('ACCESS_DENIED'); }
  let displayName=null;
  const healerResult=await supabaseClient.from('healer_profiles').select('display_name,status').eq('id',session.user.id).maybeSingle();
  if(!healerResult.error && healerResult.data?.status!=='inactive') displayName=healerResult.data?.display_name;
  return {session,profile,displayName:displayName||profile.preferred_name||profile.full_name||'Healer'};
}

async function getSummaryFallback(){
  const since=new Date(Date.now()-RECENT_DAYS*86400000).toISOString();
  const [assessments,adventurers,alerts,checkpoints,registrations]=await Promise.all([
    supabaseClient.from('initial_evaluations').select('id',{count:'exact',head:true}).in('status',['submitted','under_analysis','returned_for_editing']),
    supabaseClient.from('profiles').select('id',{count:'exact',head:true}).eq('role','adventurer').eq('account_status','active').in('journey_stage',['dashboard','checkpoint','feedback','progression']),
    supabaseClient.from('healer_alerts').select('id',{count:'exact',head:true}).eq('status','new'),
    supabaseClient.from('checkpoint_assignments').select('id',{count:'exact',head:true}).in('status',['available','in_progress']),
    supabaseClient.from('mission_registrations').select('id',{count:'exact',head:true}).gte('submitted_at',since)
  ]);
  const errors=[assessments,adventurers,alerts,checkpoints,registrations].map(r=>r.error).filter(Boolean); if(errors.length) throw errors[0];
  return {pendingAssessments:assessments.count||0,activeAdventurers:adventurers.count||0,newAlerts:alerts.count||0,pendingCheckpoints:checkpoints.count||0,recentRegistrations:registrations.count||0};
}

async function getSummary(){
  const rpc=await supabaseClient.rpc('get_healer_dashboard_summary');
  if(!rpc.error && rpc.data){ const d=Array.isArray(rpc.data)?rpc.data[0]:rpc.data; return d; }
  return getSummaryFallback();
}

async function getPriorityItems(){
  const rpc=await supabaseClient.rpc('get_healer_priority_items');
  if(!rpc.error&&Array.isArray(rpc.data)) return rpc.data.slice(0,5);
  return [];
}
async function getRecentActivity(){
  const rpc=await supabaseClient.rpc('get_healer_recent_activity');
  if(!rpc.error&&Array.isArray(rpc.data)) return rpc.data.slice(0,10);
  return [];
}

function renderUser(user){ const name=user.displayName; const avatar=initials(name); els.greeting.textContent=`${greetingForHour()}, ${name.split(' ')[0]}.`; [els.headerName,els.sidebarName].forEach(e=>e.textContent=name); els.headerEmail.textContent=user.profile.email||user.session.user.email||''; els.sidebarRole.textContent=user.profile.role==='admin'?'Administrador':'Healer'; [els.headerAvatar,els.sidebarAvatar].forEach(e=>e.textContent=avatar); }
function renderSummary(s){ els.pendingAssessments.textContent=s.pendingAssessments??s.pending_assessments??0; els.activeAdventurers.textContent=s.activeAdventurers??s.active_adventurers??0; els.newAlerts.textContent=s.newAlerts??s.new_alerts??0; els.pendingCheckpoints.textContent=s.pendingCheckpoints??s.pending_checkpoints??0; els.recentRegistrations.textContent=s.recentRegistrations??s.recent_registrations??0; }
function itemRoute(item){ return item.route||({alert:'/healer/alertas/',assessment:'/healer/avaliacoes/',checkpoint:'/healer/checkpoints/',registration:'/healer/registros/',adventurer:'/healer/aventureiros/'}[item.type]||'/healer/painel/'); }
function renderPriorities(items){
  if(!items.length){ els.priorityList.innerHTML='<div class="empty-state"><strong>Tudo em ordem por aqui.</strong>Nenhuma prioridade nova foi encontrada.</div>'; return; }
  els.priorityList.innerHTML=items.map(i=>`<div class="list-item"><span class="item-symbol ${i.severity==='high'||i.severity==='critical'?'high':''}">${i.severity==='high'||i.severity==='critical'?'!':'◇'}</span><div class="item-copy"><strong>${escapeHtml(i.title||i.type||'Item pendente')}</strong><span>${escapeHtml(i.adventurer_name||i.name||'Aventureiro')}</span><small>${escapeHtml(i.summary||'')} ${escapeHtml(relativeTime(i.created_at||i.date))}</small></div><a class="item-action" href="${escapeHtml(itemRoute(i))}">${escapeHtml(i.action_label||'Abrir')}</a></div>`).join('');
}
function renderActivity(items){
  if(!items.length){ els.activityList.innerHTML='<div class="empty-state"><strong>Nenhuma atividade recente.</strong>Os eventos mais recentes aparecerão aqui.</div>'; return; }
  els.activityList.innerHTML=items.map(i=>`<a class="list-item" href="${escapeHtml(itemRoute(i))}"><span class="item-symbol">${escapeHtml(i.icon||'•')}</span><div class="item-copy"><strong>${escapeHtml(i.action||i.title||'Atividade')}</strong><span>${escapeHtml(i.adventurer_name||i.name||'')}</span><small>${escapeHtml(relativeTime(i.created_at||i.date))}</small></div><span aria-hidden="true">›</span></a>`).join('');
}

async function loadDashboard(){
  setStatus('loading','Carregando seu Painel...','Validando acesso e preparando o resumo operacional.');
  if(!configured()){ setStatus('error','Configuração necessária','Insira a URL e a Publishable Key do Supabase no arquivo app.js.'); return; }
  try{
    const user=await validateAdminSession(); if(!user)return;
    renderUser(user);
    const [summary,priorities,activity]=await Promise.all([getSummary(),getPriorityItems(),getRecentActivity()]);
    renderSummary(summary); renderPriorities(priorities); renderActivity(activity); showContent();
  }catch(error){
    console.error('[EVOLVE Dashboard]',error);
    if(error.message==='ACCESS_DENIED'||error.message==='PROFILE_NOT_FOUND'){ setStatus('error','Acesso negado','Este ambiente é exclusivo para Healers autorizados.'); setTimeout(()=>window.location.replace(LOGIN_ROUTE),1800); }
    else setStatus('error','Não foi possível carregar o Painel agora.','Verifique sua conexão e tente novamente.',true);
  }
}
async function logout(){ if(supabaseClient) await supabaseClient.auth.signOut(); window.location.replace(LOGIN_ROUTE); }
function toggleMobileMenu(show){ els.mobileMenu.hidden=!show; document.body.style.overflow=show?'hidden':''; }

function init(){
  if(configured() && window.supabase) supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}});
  els.refreshButton.addEventListener('click',loadDashboard); els.logoutButton.addEventListener('click',logout); els.mobileLogoutButton.addEventListener('click',logout); els.mobileMoreButton.addEventListener('click',()=>toggleMobileMenu(true)); els.closeMobileMenu.addEventListener('click',()=>toggleMobileMenu(false)); els.mobileMenu.addEventListener('click',e=>{if(e.target===els.mobileMenu)toggleMobileMenu(false)}); document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMobileMenu(false)});
  loadDashboard();
}
document.addEventListener('DOMContentLoaded',init);
