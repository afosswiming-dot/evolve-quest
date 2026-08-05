const STORAGE_KEY = 'evolveQuestInitialAssessmentV1';
const TOTAL_STEPS = 8;
const CONFIG = Object.freeze({
  supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
  supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  registrationRoute: '/cadastro/',
  welcomeRoute: '/boas-vindas/',
  adventurerPanelRoute: '/tela-espera/'
});

const client = window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

let currentUser = null;
let currentProfile = null;
let currentEvaluation = null;
let cloudReady = false;
let cloudSaveTimer = null;
let cloudSaving = false;

const defaultState = {
  currentStep: 0,
  status: 'draft',
  submittedAt: null,
  evaluationId: null,
  analysisStartedAt: null,
  lockedAt: null,
  viewingSubmission: false,
  profile: { fullName:'', preferredName:'', birthDate:'', height:'', weight:'', city:'', state:'' },
  goal: { primary:'', other:'', whyNow:'', sixMonths:'', consistencyBarrier:'' },
  history: { experience:'', trainingTime:'', modalities:[], frequency:'', confidence:{ squat:3, bench:3, deadlift:3, row:3, pullup:3 } },
  health: { injuries:'', surgeries:'', currentPain:'', limitations:'', medications:'', medicalRecommendations:'', relevantConditions:'' },
  routine: { availableDays:[], preferredTime:'', sessionDuration:'', trainingLocation:'', equipment:'', sleepQuality:3, stressLevel:3, workType:'', sittingTime:'' },
  habits: { water:'', nutrition:'', alcohol:'', smoking:'' },
  commitment: { healerExpectation:'', additionalInfo:'', accepted:false },
  updatedAt: null
};

let state = loadState();
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const backButton = document.getElementById('backButton');
const saveExitButton = document.getElementById('saveExitButton');
const toast = document.getElementById('toast');

function deepMerge(target, source) {
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else target[key] = source[key];
  }
  return target;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? deepMerge(structuredClone(defaultState), saved) : structuredClone(defaultState);
  } catch { return structuredClone(defaultState); }
}

function saveState(showToast = false) {
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  if (cloudReady && canEditEvaluation()) scheduleCloudSave();
  if (showToast) notify('Progresso salvo');
}

function scheduleCloudSave() {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveDraftToCloud().catch(handleCloudError), 850);
}

function handleCloudError(error) {
  console.error('Falha na sincronização da Avaliação:', error);
  notify('Salvo neste aparelho. Sincronização pendente');
}

function canEditEvaluation() {
  return state.status === 'draft' ||
    state.status === 'returned_for_editing' ||
    (state.status === 'submitted' && !state.analysisStartedAt && !state.lockedAt);
}

function completionPercentage() {
  return Math.max(0, Math.min(100, Math.round((Math.min(state.currentStep, TOTAL_STEPS) / TOTAL_STEPS) * 100)));
}

function sessionMinutes(value) {
  if (value === '30 min') return 30;
  if (value === '45 min') return 45;
  if (value === '60 min') return 60;
  if (value === '90 min ou mais') return 90;
  return null;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}


async function requireAuthenticatedContext() {
  if (!client) throw new Error('Supabase não foi carregado.');
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) {
    notify('Sua sessão expirou. Faça o cadastro novamente.');
    setTimeout(() => window.location.assign(CONFIG.registrationRoute), 1200);
    return false;
  }
  currentUser = data.session.user;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, preferred_name, birth_date, height_cm, weight_kg, city, state, profile_status')
    .eq('id', currentUser.id)
    .single();
  if (profileError) throw profileError;
  currentProfile = profile;

  let { data: evaluation, error: evaluationError } = await client
    .from('initial_evaluations')
    .select('*')
    .eq('adventurer_id', currentUser.id)
    .maybeSingle();
  if (evaluationError) throw evaluationError;

  if (!evaluation) {
    const { data: created, error: createError } = await client
      .from('initial_evaluations')
      .insert({ adventurer_id: currentUser.id, status: 'draft', current_section: 0, completion_percentage: 0 })
      .select('*')
      .single();
    if (createError) throw createError;
    evaluation = created;
  }

  currentEvaluation = evaluation;
  await loadCloudState();
  cloudReady = true;
  return true;
}

async function loadOne(table) {
  const { data, error } = await client.from(table).select('*').eq('evaluation_id', currentEvaluation.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadCloudState() {
  const [goal, history, health, routine, habits, commitment] = await Promise.all([
    loadOne('evaluation_goals'),
    loadOne('evaluation_training_history'),
    loadOne('evaluation_health'),
    loadOne('evaluation_routine'),
    loadOne('evaluation_habits'),
    loadOne('evaluation_commitments')
  ]);

  const remote = structuredClone(defaultState);
  remote.evaluationId = currentEvaluation.id;
  remote.currentStep = currentEvaluation.current_section || 0;
  remote.status = currentEvaluation.status || 'draft';
  remote.submittedAt = currentEvaluation.submitted_at;
  remote.analysisStartedAt = currentEvaluation.analysis_started_at;
  remote.lockedAt = currentEvaluation.locked_at;
  remote.updatedAt = currentEvaluation.updated_at;
  remote.profile = {
    fullName: currentProfile.full_name || '',
    preferredName: currentProfile.preferred_name || '',
    birthDate: currentProfile.birth_date || '',
    height: currentProfile.height_cm ?? '',
    weight: currentProfile.weight_kg ?? '',
    city: currentProfile.city || '',
    state: currentProfile.state || ''
  };
  if (goal) remote.goal = {
    primary: goal.primary_goal || '', other: goal.other_goal || '', whyNow: goal.start_reason || '',
    sixMonths: goal.six_month_expectation || '', consistencyBarrier: goal.consistency_barriers || ''
  };
  if (history) remote.history = {
    experience: history.training_status || '', trainingTime: history.experience_duration || '',
    modalities: history.modalities || [], frequency: history.current_frequency || '',
    confidence: { squat: history.squat_confidence || 3, bench: history.bench_press_confidence || 3,
      deadlift: history.deadlift_confidence || 3, row: history.row_confidence || 3, pullup: history.pull_up_confidence || 3 }
  };
  if (health) remote.health = {
    injuries: health.injuries || '', surgeries: health.surgeries || '', currentPain: health.current_pain || '',
    limitations: health.limitations || '', medications: health.medications || '',
    medicalRecommendations: health.medical_recommendations || '', relevantConditions: health.health_conditions || ''
  };
  if (routine) remote.routine = {
    availableDays: routine.available_days || [], preferredTime: routine.preferred_period || '',
    sessionDuration: routine.session_duration_minutes ? `${routine.session_duration_minutes} min${routine.session_duration_minutes >= 90 ? ' ou mais' : ''}` : '',
    trainingLocation: routine.training_location || '', equipment: routine.available_equipment || '',
    sleepQuality: routine.sleep_quality || 3, stressLevel: routine.stress_level || 3,
    workType: routine.work_type || '', sittingTime: routine.daily_sitting_hours || ''
  };
  if (habits) remote.habits = {
    water: habits.water_intake || '', nutrition: habits.perceived_nutrition || '',
    alcohol: habits.alcohol_consumption || '', smoking: habits.smoking_status || ''
  };
  if (commitment) remote.commitment = {
    healerExpectation: commitment.healer_expectations || '',
    additionalInfo: commitment.additional_information || '',
    accepted: !!commitment.commitment_accepted
  };

  const local = loadState();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();
  const localTime = new Date(local.updatedAt || 0).getTime();
  state = localTime > remoteTime && canLocalDraftOverride(local, remote) ? deepMerge(remote, local) : remote;
  state.evaluationId = currentEvaluation.id;
}

function canLocalDraftOverride(local, remote) {
  return ['draft','returned_for_editing'].includes(remote.status) && local.status !== 'waiting_healer';
}

async function upsertEvaluationTable(table, payload) {
  const { error } = await client.from(table).upsert({ evaluation_id: currentEvaluation.id, ...payload }, { onConflict: 'evaluation_id' });
  if (error) throw error;
}

async function saveDraftToCloud() {
  if (!cloudReady || cloudSaving || !currentUser || !currentEvaluation || !canEditEvaluation()) return;
  cloudSaving = true;
  try {
    const now = new Date().toISOString();
    const { error: profileError } = await client.from('profiles').update({
      full_name: state.profile.fullName,
      preferred_name: state.profile.preferredName,
      birth_date: state.profile.birthDate || null,
      height_cm: state.profile.height || null,
      weight_kg: state.profile.weight || null,
      city: state.profile.city || null,
      state: state.profile.state || null,
      profile_status: state.status === 'submitted' ? 'waiting_healer_analysis' : 'evaluation_in_progress'
    }).eq('id', currentUser.id);
    if (profileError) throw profileError;

    const { error: evalError } = await client.from('initial_evaluations').update({
      status: state.status === 'waiting_healer' ? 'submitted' : state.status,
      current_section: state.currentStep,
      completion_percentage: completionPercentage()
    }).eq('id', currentEvaluation.id);
    if (evalError) throw evalError;

    await Promise.all([
      upsertEvaluationTable('evaluation_goals', {
        primary_goal: state.goal.primary || null, other_goal: state.goal.other || null,
        start_reason: state.goal.whyNow || null, six_month_expectation: state.goal.sixMonths || null,
        consistency_barriers: state.goal.consistencyBarrier || null
      }),
      upsertEvaluationTable('evaluation_training_history', {
        training_status: state.history.experience || null, experience_duration: state.history.trainingTime || null,
        modalities: state.history.modalities || [], current_frequency: state.history.frequency || null,
        squat_confidence: state.history.confidence.squat, bench_press_confidence: state.history.confidence.bench,
        deadlift_confidence: state.history.confidence.deadlift, row_confidence: state.history.confidence.row,
        pull_up_confidence: state.history.confidence.pullup
      }),
      upsertEvaluationTable('evaluation_health', {
        injuries: state.health.injuries || null, surgeries: state.health.surgeries || null,
        current_pain: state.health.currentPain || null, limitations: state.health.limitations || null,
        medications: state.health.medications || null, medical_recommendations: state.health.medicalRecommendations || null,
        health_conditions: state.health.relevantConditions || null
      }),
      upsertEvaluationTable('evaluation_routine', {
        available_days: state.routine.availableDays || [], preferred_period: state.routine.preferredTime || null,
        session_duration_minutes: sessionMinutes(state.routine.sessionDuration),
        training_location: state.routine.trainingLocation || null, available_equipment: state.routine.equipment || null,
        sleep_quality: state.routine.sleepQuality, stress_level: state.routine.stressLevel,
        work_type: state.routine.workType || null, daily_sitting_hours: state.routine.sittingTime || null
      }),
      upsertEvaluationTable('evaluation_habits', {
        water_intake: state.habits.water || null, perceived_nutrition: state.habits.nutrition || null,
        alcohol_consumption: state.habits.alcohol || null, smoking_status: state.habits.smoking || null
      }),
      upsertEvaluationTable('evaluation_commitments', {
        healer_expectations: state.commitment.healerExpectation || null,
        additional_information: state.commitment.additionalInfo || null,
        commitment_accepted: !!state.commitment.accepted,
        commitment_accepted_at: state.commitment.accepted ? (state.commitment.acceptedAt || now) : null
      })
    ]);
  } finally { cloudSaving = false; }
}

async function submitEvaluation() {
  await saveDraftToCloud();
  const now = new Date().toISOString();
  const { error } = await client.from('initial_evaluations').update({
    status: 'submitted', current_section: 8, completion_percentage: 100, submitted_at: now
  }).eq('id', currentEvaluation.id);
  if (error) throw error;

  await client.from('profiles').update({
    profile_status: 'waiting_healer_analysis',
    journey_stage: 'waiting_healer'
  }).eq('id', currentUser.id);
  await client.from('adventurer_onboarding').update({
    onboarding_status: 'assessment_completed', assessment_status: 'completed', assessment_pending: false,
    assessment_completed_at: now, healer_analysis_status: 'pending'
  }).eq('adventurer_id', currentUser.id);

  state.status = 'submitted';
  state.submittedAt = now;
  state.currentStep = 8;
  state.viewingSubmission = false;
  state.updatedAt = now;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function render() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (['submitted','under_analysis','approved'].includes(state.status) && !state.viewingSubmission) return renderComplete();
  if (state.currentStep === 0) return renderIntro();

  topbar.classList.remove('hidden');
  const visibleStep = Math.min(state.currentStep, TOTAL_STEPS);
  progressBar.style.width = `${(visibleStep / TOTAL_STEPS) * 100}%`;
  progressLabel.textContent = state.currentStep === 8 ? 'Revisão final' : `Etapa ${state.currentStep} de 7`;
  backButton.style.visibility = state.currentStep > 1 ? 'visible' : 'hidden';
  saveExitButton.textContent = 'Sair';

  const renders = [null, renderProfile, renderGoal, renderHistory, renderHealth, renderRoutine, renderHabits, renderCommitment, renderSummary];
  renders[state.currentStep]();
  bindCommonInputs();
  applyReadOnlyState();
}

function applyReadOnlyState() {
  if (canEditEvaluation()) return;
  app.querySelectorAll('input, textarea, select, button[data-chip-path], button[data-single-chip-path], .option-card input').forEach(el => el.disabled = true);
  const next = document.getElementById('nextButton');
  if (next) { next.disabled = true; next.textContent = 'Avaliação em análise'; }
}

function renderIntro() {
  topbar.classList.add('hidden');
  const template = document.getElementById('introTemplate');
  app.replaceChildren(template.content.cloneNode(true));
  const hasDraft = state.updatedAt && state.currentStep > 0;
  const resume = app.querySelector('[data-action="resume"]');
  if (hasDraft) resume.classList.remove('hidden');
  app.querySelector('[data-action="start"]').addEventListener('click', () => {
    if (!hasDraft) state.currentStep = 1;
    else state = structuredClone(defaultState), state.currentStep = 1;
    saveState(); saveDraftToCloud().catch(handleCloudError); render();
  });
  resume.addEventListener('click', () => render());
}

function shell(title, copy, content, buttonLabel='Continuar') {
  app.innerHTML = `<section class="screen">
    <div class="section-header">
      <span class="eyebrow gold">EVOLVE Quest</span>
      <h2>${title}</h2>
      <p class="section-copy">${copy}</p>
    </div>
    ${content}
    <div class="footer-actions">
      <button class="primary-button" id="nextButton">${buttonLabel}</button>
      <div class="autosave">Salvamento automático ativo</div>
    </div>
  </section>`;
  document.getElementById('nextButton').addEventListener('click', nextStep);
}

function renderProfile() {
  const p = state.profile;
  shell('Perfil do Aventureiro', 'Vamos começar com as informações essenciais para identificar você e preparar sua análise.', `
  <div class="form-card">
    ${field('Nome completo','profile.fullName',p.fullName,'text',true)}
    ${field('Como prefere ser chamado','profile.preferredName',p.preferredName,'text',true)}
    ${field('Data de nascimento','profile.birthDate',p.birthDate,'date',true)}
    <div class="grid-2">${field('Altura (cm)','profile.height',p.height,'number',true)}${field('Peso (kg)','profile.weight',p.weight,'number',true)}</div>
    <div class="grid-2">${field('Cidade','profile.city',p.city,'text',true)}${field('Estado','profile.state',p.state,'text',true)}</div>
  </div>`);
}

function renderGoal() {
  const g = state.goal;
  const options = ['Redução de gordura','Ganho de massa muscular','Ganho de força','Saúde e qualidade de vida','Mobilidade','Condicionamento','Desempenho esportivo','Retorno aos treinos','Outro'];
  shell('Objetivo da Jornada', 'Escolha a transformação que melhor representa o motivo principal desta nova fase.', `
    <div class="form-card">
      <div class="field"><span class="field-label">Qual é a principal transformação que você busca?</span>
        <div class="option-grid two">${options.map((o,i)=>optionCard('goal.primary',o,g.primary,String(i+1).padStart(2,'0'))).join('')}</div>
      </div>
      <div class="field ${g.primary==='Outro'?'':'hidden'}" id="otherGoalField">${field('Conte um pouco mais','goal.other',g.other,'text',g.primary==='Outro')}</div>
      ${textarea('Por que decidiu começar agora?','goal.whyNow',g.whyNow,true)}
      ${textarea('Qual resultado espera alcançar nos próximos seis meses?','goal.sixMonths',g.sixMonths,true)}
      ${textarea('O que costuma dificultar sua consistência?','goal.consistencyBarrier',g.consistencyBarrier,true)}
    </div>`);
}

function renderHistory() {
  const h = state.history;
  const conditional = h.experience !== 'Nunca treinou';
  shell('Histórico de treinamento', 'Seu repertório atual ajuda o Healer a escolher um ponto de partida seguro e desafiador.', `
    <div class="form-card">
      <div class="field"><span class="field-label">Como é sua experiência com treinamento?</span>
        <div class="option-grid">${['Nunca treinou','Treinou anteriormente','Treina atualmente'].map((o,i)=>optionCard('history.experience',o,h.experience,String(i+1).padStart(2,'0'))).join('')}</div>
      </div>
      <div id="historyConditional" class="${conditional?'':'hidden'}">
        ${field('Há quanto tempo treina ou treinou?','history.trainingTime',h.trainingTime)}
        <div class="field"><span class="field-label">Modalidades praticadas</span>
          <div class="chip-grid">${['Musculação','Corrida','Natação','Cross training','Esportes coletivos','Lutas','Ciclismo','Outros'].map(o=>chip('history.modalities',o,h.modalities.includes(o))).join('')}</div>
        </div>
        ${field('Frequência atual ou mais recente','history.frequency',h.frequency)}
      </div>
      <div class="field"><span class="field-label">Nível de confiança nos exercícios básicos</span><span class="helper">1 = nenhuma confiança · 5 = muita confiança</span></div>
      ${range('Agachamento','history.confidence.squat',h.confidence.squat)}
      ${range('Supino','history.confidence.bench',h.confidence.bench)}
      ${range('Levantamento terra','history.confidence.deadlift',h.confidence.deadlift)}
      ${range('Remada','history.confidence.row',h.confidence.row)}
      ${range('Barra fixa','history.confidence.pullup',h.confidence.pullup)}
    </div>`);
}

function renderHealth() {
  const h = state.health;
  shell('Saúde', 'Compartilhe apenas o que for relevante para que sua Jornada seja planejada com segurança.', `
    <div class="form-card">
      ${textarea('Lesões anteriores ou atuais','health.injuries',h.injuries,false,'Ex.: entorse no tornozelo, lesão no ombro...')}
      ${textarea('Cirurgias','health.surgeries',h.surgeries,false)}
      ${textarea('Dores atuais','health.currentPain',h.currentPain,false,'Local, intensidade e quando costuma aparecer.')}
      ${textarea('Limitações de movimento','health.limitations',h.limitations,false)}
      ${textarea('Uso de medicamentos','health.medications',h.medications,false)}
      ${textarea('Recomendações médicas','health.medicalRecommendations',h.medicalRecommendations,false)}
      ${textarea('Condições de saúde relevantes','health.relevantConditions',h.relevantConditions,false)}
    </div>`);
}

function renderRoutine() {
  const r = state.routine;
  shell('Rotina', 'Agora vamos ajustar a Jornada ao tempo, ao local e à realidade da sua semana.', `
    <div class="form-card">
      <div class="field"><span class="field-label">Dias disponíveis</span><div class="chip-grid">${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(o=>chip('routine.availableDays',o,r.availableDays.includes(o))).join('')}</div></div>
      <div class="field"><span class="field-label">Horário preferido</span><div class="option-grid two">${['Manhã','Tarde','Noite','Flexível'].map((o,i)=>optionCard('routine.preferredTime',o,r.preferredTime,String(i+1).padStart(2,'0'))).join('')}</div></div>
      <div class="field"><span class="field-label">Tempo disponível por sessão</span><div class="chip-grid">${['30 min','45 min','60 min','90 min ou mais'].map(o=>singleChip('routine.sessionDuration',o,r.sessionDuration===o)).join('')}</div></div>
      <div class="field"><span class="field-label">Local de treino</span><div class="option-grid">${['Casa','Academia','Ambos'].map((o,i)=>optionCard('routine.trainingLocation',o,r.trainingLocation,String(i+1).padStart(2,'0'))).join('')}</div></div>
      ${textarea('Equipamentos disponíveis','routine.equipment',r.equipment,false)}
      ${range('Qualidade do sono','routine.sleepQuality',r.sleepQuality,'Muito ruim','Excelente')}
      ${range('Nível de estresse','routine.stressLevel',r.stressLevel,'Muito baixo','Muito alto')}
      <div class="field"><label for="workType">Tipo de trabalho</label><select id="workType" data-path="routine.workType" required><option value="">Selecione</option>${['Home office','Escritório','Em pé','Braçal','Misto','Outro'].map(o=>`<option ${r.workType===o?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="field"><label for="sittingTime">Tempo sentado por dia</label><select id="sittingTime" data-path="routine.sittingTime" required><option value="">Selecione</option>${['Menos de 2h','2–4h','4–6h','6–8h','Mais de 8h'].map(o=>`<option ${r.sittingTime===o?'selected':''}>${o}</option>`).join('')}</select></div>
    </div>`);
}

function renderHabits() {
  const h = state.habits;
  const block = (label,path,value,options) => `<div class="field"><span class="field-label">${label}</span><div class="option-grid two">${options.map((o,i)=>optionCard(path,o,value,String(i+1).padStart(2,'0'))).join('')}</div></div>`;
  shell('Hábitos', 'Estas respostas ajudam o Healer a entender o contexto que sustenta sua progressão.', `
    <div class="form-card">
      ${block('Consumo de água','habits.water',h.water,['Pouco','Moderado','Bom','Excelente'])}
      ${block('Como percebe sua alimentação?','habits.nutrition',h.nutrition,['Ruim','Regular','Boa','Excelente'])}
      ${block('Consumo de álcool','habits.alcohol',h.alcohol,['Nunca','Socialmente','Semanalmente','Frequentemente'])}
      ${block('Tabagismo','habits.smoking',h.smoking,['Não','Eventualmente','Sim'])}
    </div>`);
}

function renderCommitment() {
  const c = state.commitment;
  shell('Compromisso', 'A evolução depende de um acordo simples: consistência, registro e comunicação clara.', `
    <div class="form-card">
      ${textarea('O que espera do seu Healer?','commitment.healerExpectation',c.healerExpectation,true)}
      ${textarea('Existe algo importante que ainda não foi informado?','commitment.additionalInfo',c.additionalInfo,false)}
      <label class="commitment-box">
        <input type="checkbox" data-path="commitment.accepted" ${c.accepted?'checked':''} required>
        <span>Comprometo-me a manter consistência, registrar minha evolução e comunicar ao Healer qualquer mudança relevante durante a Jornada.</span>
      </label>
    </div>`,'Revisar Avaliação');
}

function renderSummary() {
  const s = [
    ['Perfil', `${state.profile.preferredName || state.profile.fullName}\n${state.profile.city}${state.profile.state ? ' · '+state.profile.state : ''}`,1],
    ['Objetivo', `${state.goal.primary}${state.goal.other ? ': '+state.goal.other : ''}\nMeta de 6 meses: ${state.goal.sixMonths}`,2],
    ['Histórico', `${state.history.experience}\nFrequência: ${state.history.frequency || 'Não informada'}`,3],
    ['Saúde', state.health.currentPain || state.health.injuries || 'Nenhuma observação registrada.',4],
    ['Rotina', `${state.routine.availableDays.join(', ')}\n${state.routine.sessionDuration} · ${state.routine.trainingLocation}`,5],
    ['Hábitos', `Água: ${state.habits.water} · Alimentação: ${state.habits.nutrition}`,6],
    ['Compromisso', state.commitment.healerExpectation,7]
  ];
  shell('Revisão da Avaliação', 'Confira suas respostas antes do envio. Você ainda pode editar qualquer seção.', `
    <div class="summary-list">${s.map(([title,text,step])=>`<article class="summary-card"><div class="summary-head"><h3>${title}</h3><button class="edit-link" data-edit-step="${step}">Editar</button></div><p>${escapeHTML(text || 'Não informado')}</p></article>`).join('')}</div>
  `,'Enviar Avaliação');
  document.querySelectorAll('[data-edit-step]').forEach(btn => btn.addEventListener('click', () => { state.currentStep = Number(btn.dataset.editStep); saveState(); render(); }));
}

function renderComplete() {
  topbar.classList.add('hidden');
  app.innerHTML = `<section class="screen status-screen">
    <img src="assets/quest-logo.png" class="status-emblem" alt="Símbolo EVOLVE Quest">
    <span class="eyebrow gold">Registro concluído</span>
    <h1>Avaliação enviada</h1>
    <p class="section-copy">Seu Healer irá analisar suas respostas e preparar sua primeira Jornada, definindo o Capítulo inicial e as primeiras Missões.</p>
    <div class="status-badge"><span class="status-dot"></span>Aguardando análise do Healer</div>
    <button class="secondary-button" id="viewSubmission">Visualizar respostas enviadas</button>
  </section>`;
  document.getElementById('viewSubmission').addEventListener('click', () => {
    state.viewingSubmission = true;
    state.currentStep = 8;
    render();
    if (!canEditEvaluation()) {
      document.getElementById('nextButton').disabled = true;
      document.getElementById('nextButton').textContent = 'Avaliação já enviada';
    }
  });
}

function showSending() {
  topbar.classList.add('hidden');
  app.innerHTML = `<section class="screen status-screen"><div class="loader"></div><span class="eyebrow gold">Preparando registro</span><h2>Enviando sua Avaliação</h2><p class="section-copy">Organizando suas respostas para a análise do Healer.</p></section>`;
  submitEvaluation()
    .then(() => render())
    .catch(error => {
      console.error('Falha ao enviar Avaliação:', error);
      notify('Não foi possível enviar. Suas respostas continuam salvas.');
      state.currentStep = 8;
      render();
    });
}

function nextStep() {
  if (!canEditEvaluation()) return notify('A avaliação está bloqueada para edição');
  if (!validateCurrentStep()) return;
  if (state.currentStep === 8) return showSending();
  state.currentStep += 1;
  saveState(); render();
}

function validateCurrentStep() {
  const required = [...app.querySelectorAll('[required]')];
  let valid = true;
  required.forEach(el => {
    const invalid = el.type === 'checkbox' ? !el.checked : !String(el.value).trim();
    const wrap = el.closest('.field') || el.closest('.commitment-box');
    if (invalid) { valid = false; wrap?.classList.add('invalid'); }
    else wrap?.classList.remove('invalid');
  });
  const customChecks = {
    2: !!state.goal.primary,
    3: !!state.history.experience,
    5: state.routine.availableDays.length > 0 && !!state.routine.preferredTime && !!state.routine.sessionDuration && !!state.routine.trainingLocation,
    6: !!state.habits.water && !!state.habits.nutrition && !!state.habits.alcohol && !!state.habits.smoking,
    7: state.commitment.accepted
  };
  if (customChecks[state.currentStep] === false) valid = false;
  if (!valid) notify('Complete os campos obrigatórios para continuar');
  return valid;
}

function bindCommonInputs() {
  app.querySelectorAll('[data-path]').forEach(el => {
    const event = el.matches('input[type="range"]') ? 'input' : 'change';
    const handler = () => {
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range' || el.type === 'number') value = value === '' ? '' : Number(value);
      setPath(el.dataset.path, value);
      if (el.type === 'range') document.querySelector(`[data-range-value="${el.dataset.path}"]`).textContent = value;
      if (el.dataset.path === 'goal.primary') document.getElementById('otherGoalField')?.classList.toggle('hidden', value !== 'Outro');
      if (el.dataset.path === 'history.experience') document.getElementById('historyConditional')?.classList.toggle('hidden', value === 'Nunca treinou');
      refreshSelections(el.dataset.path, value);
      saveState();
    };
    el.addEventListener(event, handler);
    if (event !== 'input') el.addEventListener('input', () => { setPath(el.dataset.path, el.type==='number' ? Number(el.value) : el.value); saveState(); });
  });

  app.querySelectorAll('[data-chip-path]').forEach(btn => btn.addEventListener('click', () => {
    const path = btn.dataset.chipPath;
    const value = btn.dataset.chipValue;
    const array = getPath(path) || [];
    const next = array.includes(value) ? array.filter(v=>v!==value) : [...array,value];
    setPath(path,next); btn.classList.toggle('selected'); saveState();
  }));

  app.querySelectorAll('[data-single-chip-path]').forEach(btn => btn.addEventListener('click', () => {
    const path = btn.dataset.singleChipPath;
    setPath(path,btn.dataset.singleChipValue);
    app.querySelectorAll(`[data-single-chip-path="${path}"]`).forEach(x=>x.classList.toggle('selected',x===btn));
    saveState();
  }));
}

function refreshSelections(path,value) {
  app.querySelectorAll(`[data-path="${path}"]`).forEach(el => el.closest('.option-card')?.classList.toggle('selected', el.value===value));
}

function getPath(path) { return path.split('.').reduce((o,k)=>o?.[k],state); }
function setPath(path,value) { const parts=path.split('.'); const last=parts.pop(); const obj=parts.reduce((o,k)=>o[k],state); obj[last]=value; }

function field(label,path,value='',type='text',required=false) {
  return `<div class="field"><label>${label}</label><input type="${type}" data-path="${path}" value="${escapeHTML(value)}" ${required?'required':''}></div>`;
}
function textarea(label,path,value='',required=false,placeholder='') {
  return `<div class="field"><label>${label}</label><textarea data-path="${path}" placeholder="${escapeHTML(placeholder)}" ${required?'required':''}>${escapeHTML(value)}</textarea></div>`;
}
function optionCard(path,value,selected,icon) {
  return `<label class="option-card ${selected===value?'selected':''}"><input type="radio" name="${path}" data-path="${path}" value="${escapeHTML(value)}" ${selected===value?'checked':''}><span class="option-icon">${icon}</span><span><span class="option-title">${value}</span></span></label>`;
}
function chip(path,value,selected) { return `<button type="button" class="chip ${selected?'selected':''}" data-chip-path="${path}" data-chip-value="${value}">${value}</button>`; }
function singleChip(path,value,selected) { return `<button type="button" class="chip ${selected?'selected':''}" data-single-chip-path="${path}" data-single-chip-value="${value}">${value}</button>`; }
function range(label,path,value,minLabel='',maxLabel='') {
  return `<div class="range-row"><div class="range-wrap"><label>${label}</label><input type="range" min="1" max="5" step="1" data-path="${path}" value="${value}">${minLabel||maxLabel?`<span class="helper">${minLabel} · ${maxLabel}</span>`:''}</div><span class="range-value" data-range-value="${path}">${value}</span></div>`;
}

backButton.addEventListener('click', () => { if (state.currentStep > 1) { state.currentStep--; saveState(); render(); } });
saveExitButton.addEventListener('click', () => { saveState(true); saveDraftToCloud().catch(handleCloudError); state.currentStep = Math.max(1,state.currentStep); topbar.classList.add('hidden'); renderIntro(); });

async function bootstrap() {
  app.innerHTML = `<section class="screen status-screen"><div class="loader"></div><span class="eyebrow gold">EVOLVE Quest</span><h2>Carregando sua Avaliação</h2><p class="section-copy">Recuperando seu progresso com segurança.</p></section>`;
  try {
    const ready = await requireAuthenticatedContext();
    if (ready) render();
  } catch (error) {
    console.error('Falha ao carregar Avaliação:', error);
    notify('Não foi possível carregar seus dados. Verifique a conexão.');
    state = loadState();
    render();
  }
}

bootstrap();
