'use strict';
const db=window.supabase.createClient(
  'https://gtmngtweohixfeajljik.supabase.co',
  'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(v)):'';
(async()=>{
  try{
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError||!user)return location.replace('/login/');
    const {data,error}=await db.rpc('get_my_journey_map');
    if(error)throw error;
    render(data||{});
  }catch(error){
    console.error('[EVOLVE Jornada]',error);
    $('status').innerHTML='<strong>Não foi possível carregar sua Jornada.</strong><br>Tente novamente em alguns instantes.';
  }
})();
function render(data){
  const p=data.profile||{},j=data.journey||{},c=data.chapter||{},s=data.summary||{};
  const weekly=Array.isArray(data.weeklyProgress)?data.weeklyProgress:[];
  const achievements=Array.isArray(data.achievements)?data.achievements:[];
  const records=Array.isArray(data.records)?data.records:[];
  const progress=Math.max(0,Math.min(100,Number(j.chapterProgress||0)));

  $('status').hidden=true;$('journeyContent').hidden=false;
  $('adventurerName').textContent=p.preferredName||p.fullName||'Aventureiro';
  $('className').textContent=p.className||'Classe';
  $('levelName').textContent=p.currentLevel?`Nível ${p.currentLevel}`:'Nível';
  $('progressSeal').textContent=`${progress}%`;
  $('chapterTitle').textContent=`Capítulo ${c.number||''} · ${c.title||'Jornada Atual'}`;
  $('chapterObjective').textContent=c.objective||'Continue avançando em sua Jornada.';
  $('sessionsLabel').textContent=`${j.completedSessions||0} de ${j.plannedSessions||0} sessões`;
  $('progressText').textContent=`${progress}%`;
  $('progressBar').style.width=`${progress}%`;
  $('frequency').textContent=j.prescribedFrequency?`${j.prescribedFrequency}x / semana`:'—';
  $('duration').textContent=`${j.chapterDurationWeeks||4} semanas`;
  $('streak').textContent=j.currentStreak?`${j.currentStreak} dias`:'0 dias';
  $('nextMilestone').textContent=s.nextMilestone||'Continue avançando';

  renderWeeks(weekly,j);
  renderAchievements(achievements);
  renderRecords(records);
  renderCheckpoint(data.checkpoint,progress);
}
function renderWeeks(weekly,j){
  const duration=Number(j.chapterDurationWeeks||4);
  const freq=Number(j.prescribedFrequency||0);
  const currentWeek=Math.min(duration,Math.max(1,Math.ceil(((Date.now()-new Date(j.startedAt||Date.now()).getTime())/86400000)/7)));
  const byWeek=new Map(weekly.map(w=>[Number(w.weekNumber),w]));
  $('weekMap').innerHTML=Array.from({length:duration},(_,i)=>{
    const n=i+1,w=byWeek.get(n)||{};
    const done=Number(w.missionsCompleted||0),goal=Number(w.weeklyGoal||freq||0);
    const pct=goal?Math.min(100,Math.round(done/goal*100)):0;
    const cls=pct>=100?'complete':n===currentWeek?'current':'';
    const detail=goal?`${done} de ${goal} sessões registradas`:'Aguardando início';
    return `<div class="week-node ${cls}">
      <div class="node-dot">${pct>=100?'✓':n}</div>
      <div class="week-copy">
        <strong>Semana ${n}</strong><span>${detail}</span>
        <div class="week-bar"><i style="width:${pct}%"></i></div>
      </div>
    </div>`;
  }).join('');
}
function renderAchievements(items){
  $('achievements').innerHTML=items.map(a=>`<article class="achievement ${a.unlocked?'':'locked'}">
    <span class="achievement-status">${a.unlocked?'DESBLOQUEADA':'EM PROGRESSO'}</span>
    <div class="achievement-icon">${a.unlocked?'◆':'◇'}</div>
    <h3>${esc(a.title)}</h3><p>${esc(a.description)}</p>
  </article>`).join('');
}
function renderRecords(items){
  const visible=items.slice(0,5);
  if(!visible.length){$('recentRecords').innerHTML='<div class="card empty">Sua primeira realização aparecerá aqui depois do primeiro Registro da Missão.</div>';return;}
  $('recentRecords').innerHTML=visible.map(r=>`<article class="record">
    <div class="record-mark">${r.completionStatus==='completed'?'✓':'•'}</div>
    <div><strong>${esc(r.missionName)}</strong>
    <span>${esc(r.missionSubtitle||'')} · ${r.environment==='gym'?'Academia':r.environment==='home'?'Casa':'Missão'}${r.submittedAt?` · ${date(r.submittedAt)}`:''}</span></div>
  </article>`).join('');
}
function renderCheckpoint(cp,progress){
  if(!cp){
    $('checkpointText').textContent=progress>=100?'Seu ciclo está completo. Aguarde a liberação do Checkpoint.':'Seu Checkpoint será liberado ao final do ciclo de quatro semanas.';
    return;
  }
  const labels={available:'Seu Checkpoint está disponível.',in_progress:'Seu Checkpoint está em andamento.',completed:'Checkpoint concluído. Sua evolução está pronta para análise.'};
  $('checkpointText').textContent=labels[cp.status]||'Acompanhe aqui o próximo Checkpoint da Jornada.';
}
