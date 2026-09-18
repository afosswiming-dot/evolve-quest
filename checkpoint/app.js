'use strict';

const CONFIG={url:'https://gtmngtweohixfeajljik.supabase.co',key:'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF'};
const client=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true}});
const app=document.querySelector('#app');
const steps=['Consistência','Recuperação','Corpo','Evolução','Comunicação','Avaliação Final'];
const defaults={missions_completed_perception:'',planning_adherence:0,main_difficulty:'',main_difficulty_other:'',recovery_score:5,sleep_score:5,stress_score:5,nutrition_score:5,pain_status:'',pain_location:'',training_readiness_score:5,energy_score:5,perceived_progress:'',biggest_achievement:'',next_week_improvement:'',healer_message:'',week_rating:0};
let user=null,profile=null,checkpoint=null,currentStep=0,answers={...defaults},submitting=false,started=false;
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(value)):'—';
const storageKey=()=>`evolve-checkpoint-draft:${user.id}:${checkpoint?.assignment?.id||'eligibility'}`;

async function load(){
  const {data:{user:authUser}}=await client.auth.getUser();
  if(!authUser){location.replace('/login/');return;}
  user=authUser;
  const [profileResult,checkpointResult]=await Promise.all([
    client.from('profiles').select('preferred_name,full_name,journey_stage').eq('id',user.id).maybeSingle(),
    client.rpc('get_my_checkpoint')
  ]);
  if(profileResult.error||checkpointResult.error){console.error(profileResult.error||checkpointResult.error);renderError();return;}
  profile=profileResult.data;checkpoint=checkpointResult.data;
  restoreDraft();render();
}

function restoreDraft(){
  if(!checkpoint?.assignment?.id)return;
  try{const saved=JSON.parse(localStorage.getItem(storageKey()));if(saved?.assignmentId===checkpoint.assignment.id){answers={...defaults,...saved.answers};currentStep=Math.max(0,Math.min(5,Number(saved.step)||0));}}catch{}
}
function saveDraft(){try{localStorage.setItem(storageKey(),JSON.stringify({assignmentId:checkpoint.assignment.id,step:currentStep,answers,updatedAt:new Date().toISOString()}));}catch{}}
function clearDraft(){try{localStorage.removeItem(storageKey());}catch{}}

function render(){
  const state=checkpoint?.eligibilityState;
  if(state==='no_workout')return renderLocked(false);
  if(state==='locked')return renderLocked(true);
  if(state==='submitted'||state==='completed'||checkpoint?.response)return renderSuccess(state==='completed');
  if(state==='available')return renderForm();
  renderError();
}

function renderLocked(hasWorkout){
  const days=Number(checkpoint?.daysRemaining||0);
  app.innerHTML=`<section class="portal-card locked-card"><div class="portal-icon">◇</div><p class="eyebrow">Próximo portal</p><h1>Seu próximo Checkpoint ainda não foi desbloqueado.</h1>${hasWorkout?`<p>Seu Checkpoint estará disponível em <strong>${days} dia${days===1?'':'s'}</strong>.</p><div class="date-card"><small>Data prevista de liberação</small><strong>${esc(fmtDate(checkpoint.availableAt))}</strong></div>`:'<p>O Checkpoint será desbloqueado 15 dias após sua primeira Missão concluída.</p>'}<div class="actions single"><a class="button secondary" href="/painel-aventureiro/">Voltar ao Painel</a></div></section>`;
}

function renderSuccess(completed){
  app.innerHTML=`<section class="portal-card success-card"><div class="success-seal">✓</div><p class="eyebrow">${completed?'Análise concluída':'Respostas enviadas'}</p><h1>Checkpoint concluído!</h1><p>Parabéns, ${esc(profile?.preferred_name||profile?.full_name||'Aventureiro')}!</p><p>Seu Checkpoint foi registrado com sucesso.</p><p>${completed?'A análise do seu Healer foi concluída. Continue acompanhando sua Jornada.':'Agora o Healer analisará sua jornada para preparar o próximo desafio.'}</p><blockquote>Continue evoluindo.<br><strong>O jogo termina. Sua evolução não.</strong></blockquote><div class="actions single"><a class="button primary" href="/painel-aventureiro/">Continuar minha Jornada</a></div></section>`;
}

function renderForm(){
  const progress=((currentStep+1)/steps.length)*100;
  app.innerHTML=`<section class="checkpoint-card"><header class="intro"><p class="eyebrow">Primeiro portal de evolução</p><h1>Você chegou ao seu primeiro Checkpoint.</h1><p>Vamos revisar como foram essas primeiras semanas da sua Jornada e preparar os próximos desafios.</p></header><div class="progress-copy"><strong>Etapa ${currentStep+1} de 6</strong><span>${esc(steps[currentStep])}</span></div><div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${currentStep+1}"><span style="width:${progress}%"></span></div><nav class="stepper" aria-label="Etapas">${steps.map((s,i)=>`<span class="${i===currentStep?'active':i<currentStep?'done':''}" title="${esc(s)}">${i<currentStep?'✓':i+1}</span>`).join('')}</nav><form id="checkpointForm" novalidate><div id="stepBody">${stepTemplate()}</div><div id="formError" class="form-error" role="alert"></div><div class="actions">${currentStep?'<button class="button secondary" type="button" id="backBtn">Voltar</button>':'<a class="button secondary" href="/painel-aventureiro/">Sair</a>'}<button class="button primary" type="submit" ${submitting?'disabled':''}>${currentStep===5?(submitting?'Enviando...':'Enviar Checkpoint'):'Continuar'}</button></div></form></section>`;
  bindForm();
  if(!started){started=true;client.rpc('start_my_checkpoint',{p_checkpoint_id:checkpoint.assignment.id}).catch(()=>{});}
}

function stepTemplate(){
  if(currentStep===0)return `<fieldset><legend>Consistência</legend>${choice('Quantas missões você concluiu neste período?','missions_completed_perception',[['all','Todas'],['almost_all','Quase todas'],['half','Cerca da metade'],['few','Poucas'],['none','Nenhuma']])}${stars('Você conseguiu seguir o planejamento?','planning_adherence')}${choice('Qual foi sua maior dificuldade?','main_difficulty',[['lack_time','Falta de tempo'],['lack_energy','Falta de energia'],['pain','Dor'],['work','Trabalho'],['family','Família'],['forgot','Esqueci'],['lack_motivation','Falta de motivação'],['other','Outro']])}${answers.main_difficulty==='other'?textInput('Conte qual foi a dificuldade','main_difficulty_other'):''}</fieldset>`;
  if(currentStep===1)return `<fieldset><legend>Recuperação</legend>${range('Como foi sua recuperação?','recovery_score')}${range('Como foi seu sono?','sleep_score')}${range('Como esteve seu nível de estresse?','stress_score')}${range('Como esteve sua alimentação?','nutrition_score')}</fieldset>`;
  if(currentStep===2)return `<fieldset><legend>Corpo</legend>${choice('Como estão suas dores?','pain_status',[['improved','Melhoraram'],['same','Permaneceram iguais'],['worsened','Pioraram'],['no_pain','Não senti dores']])}${answers.pain_status==='worsened'?textInput('Onde?','pain_location'):''}${range('Como está sua disposição para treinar?','training_readiness_score')}${range('Como está sua energia?','energy_score')}</fieldset>`;
  if(currentStep===3)return `<fieldset><legend>Evolução</legend>${choice('Você sente que evoluiu neste período?','perceived_progress',[['improved_a_lot','Evoluí muito'],['improved','Evoluí'],['a_little','Pouco'],['no_progress','Não percebi evolução']])}${textarea('Qual foi sua maior conquista?','biggest_achievement')}${textarea('O que você gostaria de melhorar no próximo período?','next_week_improvement')}</fieldset>`;
  if(currentStep===4)return `<fieldset><legend>Comunicação</legend><div class="message-intro"><span>✦</span><p>Este espaço é seu. Compartilhe qualquer contexto que possa ajudar seu Healer a compreender melhor sua Jornada.</p></div>${textarea('Gostaria de deixar alguma mensagem para seu Healer?','healer_message',true)}</fieldset>`;
  return `<fieldset><legend>Avaliação Final</legend><div class="final-rating"><span class="portal-icon small">◇</span><p>Como você avaliaria este início de Jornada como Aventureiro?</p>${stars('Sua avaliação','week_rating')}</div><div class="review-note"><strong>Pronto para enviar?</strong><p>Depois do envio, suas respostas ficarão disponíveis para análise do Healer e não poderão ser reenviadas.</p></div></fieldset>`;
}

function choice(label,name,options){return `<div class="field"><span class="question">${esc(label)}</span><div class="choices">${options.map(([value,text])=>`<label class="choice ${answers[name]===value?'selected':''}"><input type="radio" name="${name}" value="${value}" ${answers[name]===value?'checked':''}><span>${esc(text)}</span></label>`).join('')}</div></div>`;}
function stars(label,name){return `<div class="field"><span class="question">${esc(label)}</span><div class="stars" aria-label="${esc(label)}">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${name}" data-value="${n}" class="${Number(answers[name])>=n?'on':''}" aria-label="${n} de 5">★</button>`).join('')}<strong>${answers[name]?`${answers[name]}/5`:'Selecione'}</strong></div></div>`;}
function range(label,name){return `<label class="range-field"><span class="question">${esc(label)}</span><div class="range-head"><small>1</small><strong data-range-output="${name}">${answers[name]}</strong><small>10</small></div><input type="range" name="${name}" min="1" max="10" value="${answers[name]}"></label>`;}
function textInput(label,name){return `<label class="field"><span class="question">${esc(label)}</span><input type="text" name="${name}" maxlength="500" value="${esc(answers[name])}"></label>`;}
function textarea(label,name,optional=false){return `<label class="field"><span class="question">${esc(label)} ${optional?'<small>(opcional)</small>':''}</span><textarea name="${name}" maxlength="${optional?2000:1500}" rows="5" placeholder="Escreva com suas palavras...">${esc(answers[name])}</textarea></label>`;}

function bindForm(){
  const form=document.querySelector('#checkpointForm');
  form.querySelectorAll('input,textarea').forEach(input=>{
    input.addEventListener(input.type==='radio'?'change':'input',()=>{answers[input.name]=input.type==='range'?Number(input.value):input.value;saveDraft();if(input.type==='radio'&&['main_difficulty','pain_status'].includes(input.name))renderForm();else{const out=document.querySelector(`[data-range-output="${input.name}"]`);if(out)out.textContent=input.value;}});
  });
  form.querySelectorAll('[data-star]').forEach(button=>button.onclick=()=>{answers[button.dataset.star]=Number(button.dataset.value);saveDraft();renderForm();});
  document.querySelector('#backBtn')?.addEventListener('click',()=>{currentStep--;saveDraft();renderForm();});
  form.addEventListener('submit',async event=>{event.preventDefault();const message=validateStep();if(message){document.querySelector('#formError').textContent=message;return;}if(currentStep<5){currentStep++;saveDraft();renderForm();return;}await submit();});
}

function validateStep(){
  if(currentStep===0){if(!answers.missions_completed_perception)return'Informe quantas missões você concluiu.';if(!answers.planning_adherence)return'Avalie sua aderência ao planejamento.';if(!answers.main_difficulty)return'Informe sua maior dificuldade.';if(answers.main_difficulty==='other'&&!answers.main_difficulty_other.trim())return'Conte qual foi a outra dificuldade.';}
  if(currentStep===2){if(!answers.pain_status)return'Informe como estão suas dores.';if(answers.pain_status==='worsened'&&!answers.pain_location.trim())return'Informe onde a dor piorou.';}
  if(currentStep===3){if(!answers.perceived_progress)return'Informe sua percepção de evolução.';if(!answers.biggest_achievement.trim())return'Conte qual foi sua maior conquista.';if(!answers.next_week_improvement.trim())return'Conte o que gostaria de melhorar.';}
  if(currentStep===5&&!answers.week_rating)return'Avalie este início de Jornada.';
  return'';
}

async function submit(){
  if(submitting)return;submitting=true;renderForm();
  const {data,error}=await client.rpc('submit_my_checkpoint',{p_checkpoint_id:checkpoint.assignment.id,p_response:answers});
  if(error){console.error(error);submitting=false;renderForm();document.querySelector('#formError').textContent='Não foi possível enviar agora. Suas respostas continuam salvas neste dispositivo.';return;}
  clearDraft();checkpoint={...checkpoint,eligibilityState:'submitted',response:{id:data.responseId}};renderSuccess(false);
}

function renderError(){app.innerHTML='<section class="portal-card"><div class="portal-icon">!</div><h1>Não foi possível carregar seu Checkpoint.</h1><p>Tente novamente em alguns instantes. Nenhuma resposta foi perdida.</p><div class="actions"><a class="button secondary" href="/painel-aventureiro/">Voltar ao Painel</a><button class="button primary" onclick="location.reload()">Tentar novamente</button></div></section>';}
load();
