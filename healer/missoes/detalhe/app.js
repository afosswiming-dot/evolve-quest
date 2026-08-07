
'use strict';
const SUPABASE_URL='https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const configured=!SUPABASE_URL.startsWith('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const supabase=configured?window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}}):null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const labels={preparation:'Preparação',combat:'Combate',improvement:'Aprimoramento',conclusion:'Conclusão',gym:'Academia',home:'Casa',alpha:'Alpha',bravo:'Bravo',charlie:'Charlie',draft:'Rascunho',available:'Disponível',archived:'Arquivada'};
function status(type,msg){$('#statusRegion').innerHTML=`<div class="${type}"><strong>${esc(msg)}</strong></div>`}
async function authorize(){
  if(!configured){status('empty','Configure o Supabase para visualizar a Missão.');return false}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/healer/login/';return false}
  const {data:p,error}=await supabase.from('profiles').select('role,account_status').eq('id',session.user.id).single();
  if(error||!p||!['healer','admin'].includes(p.role)||p.account_status!=='active'){location.href='/healer/login/';return false}
  return true
}
async function load(){
  status('loading','Carregando pré-visualização...');
  if(!(await authorize()))return;
  const id=new URLSearchParams(location.search).get('mission_id');
  if(!id){status('error','Missão não informada.');return}
  const {data,error}=await supabase.rpc('get_mission_editor_detail',{p_mission_id:id});
  if(error||!data){console.error(error);status('error','Não foi possível carregar esta Missão.');return}
  $('#statusRegion').innerHTML='';
  render(data)
}
function render(data){
  const m=data.mission||{},items=data.exercises||[];
  $('#missionContent').classList.remove('hidden');
  $('#missionMeta').textContent=`${labels[m.code]||m.code||'Missão'} · ${labels[m.environment]||m.environment||'Ambiente'}`;
  $('#missionName').textContent=m.name||'Missão';
  $('#missionSubtitle').textContent=m.subtitle||'';
  $('#missionObjective').textContent=m.objective||'';
  $('#missionDuration').textContent=m.estimated_duration_minutes?`${m.estimated_duration_minutes} min`:'—';
  $('#missionVersion').textContent=`v${m.version||1}`;
  $('#missionStatus').textContent=labels[m.status]||m.status||'—';
  const grouped={preparation:[],combat:[],improvement:[],conclusion:[]};
  items.forEach(x=>(grouped[x.section]||(grouped[x.section]=[])).push(x));
  $('#sections').innerHTML=Object.entries(grouped).filter(([,arr])=>arr.length).map(([section,arr])=>`
    <section class="mission-section">
      <div class="section-head"><h2>${esc(labels[section]||section)}</h2><span>${arr.length} exercício${arr.length===1?'':'s'}</span></div>
      ${arr.sort((a,b)=>(a.display_order||0)-(b.display_order||0)).map((x,i)=>`
        <article class="exercise">
          <div>
            <div class="exercise-title"><span class="order">${i+1}</span><div><h3>${esc(x.exercise_name||'Exercício')}</h3>${x.exercise_description?`<p>${esc(x.exercise_description)}</p>`:''}</div></div>
            ${x.healer_note?`<p class="note">${esc(x.healer_note)}</p>`:''}
            ${x.alternative_exercise_name?`<p class="alternative">Alternativa: ${esc(x.alternative_exercise_name)}</p>`:''}
          </div>
          <div class="prescription">
            ${x.sets?`<span class="pill">${esc(x.sets)} séries</span>`:''}
            ${x.repetitions?`<span class="pill">${esc(x.repetitions)} repetições</span>`:''}
            ${x.duration_seconds?`<span class="pill">${esc(x.duration_seconds)}s</span>`:''}
            ${x.rest_seconds!=null?`<span class="pill">Descanso ${esc(x.rest_seconds)}s</span>`:''}
          </div>
        </article>`).join('')}
    </section>`).join('')||'<div class="empty"><strong>Nenhum exercício nesta Missão.</strong></div>'
}
load();
