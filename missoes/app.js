'use strict';

const CONFIG = Object.freeze({
  supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
  supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  routes: {
    login: '/login/',
    panel: '/painel-aventureiro/',
    missionRecord: '/registro-missao/'
  },
  localKeys: {
    environment: 'eq_mission_environment',
    pendingSync: 'eq_missions_pending_sync_v1'
  }
});

const SECTION_LABELS = Object.freeze({
  preparation: 'Preparação',
  combat: 'Combate',
  improvement: 'Aprimoramento',
  conclusion: 'Conclusão da Missão'
});

const state = {
  loading: true,
  error: '',
  view: 'list',
  environment: localStorage.getItem(CONFIG.localKeys.environment) || 'academia',
  user: null,
  journey: null,
  chapter: null,
  missions: [],
  activeMissionId: null,
  activeExecution: null,
  completedExercises: new Set(),
  paused: false
};

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const client = window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

function environmentDbValue() {
  return state.environment === 'academia' ? 'gym' : 'home';
}

function environmentLabel() {
  return state.environment === 'academia' ? 'Academia' : 'Casa';
}

function currentMissions() {
  return state.missions.filter(mission => mission.environment === environmentDbValue());
}

function activeMission() {
  return state.missions.find(mission => mission.id === state.activeMissionId) || null;
}

function formatDuration(minutes) {
  if (!minutes) return 'Duração não definida';
  return `${minutes} min`;
}

function formatLastRun(value) {
  if (!value) return 'Ainda não realizada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value));
}

function exercisePresentation(item) {
  const duration = item.duration_seconds ? `${item.duration_seconds}s` : null;
  return {
    id: item.exercise.id,
    name: item.exercise.name,
    mediaUrl: item.exercise.media_url || '',
    sets: item.sets ?? '—',
    reps: item.repetitions || duration || '—',
    rest: item.rest_seconds ? `${item.rest_seconds}s` : '—',
    note: item.healer_note || 'Siga a orientação prescrita pelo seu Healer.',
    alternative: item.alternative?.name || ''
  };
}

function buildMission(raw, assignment, exerciseRows, execution) {
  const orderedSections = ['preparation', 'combat', 'improvement', 'conclusion'];
  const related = exerciseRows
    .filter(row => row.mission_id === raw.id)
    .sort((a, b) => a.display_order - b.display_order);

  const phases = orderedSections
    .map(section => ({
      key: section,
      name: SECTION_LABELS[section],
      exercises: related.filter(row => row.section === section).map(exercisePresentation)
    }))
    .filter(phase => phase.exercises.length > 0);

  return {
    id: raw.id,
    assignmentId: assignment.id,
    code: `Missão ${raw.mission_type}`,
    missionCode: String(raw.code || raw.mission_type || '').toLowerCase(),
    name: raw.subtitle || raw.name,
    title: raw.name,
    subtitle: raw.subtitle || '',
    objective: raw.objective || 'Objetivo definido pelo Healer.',
    duration: formatDuration(raw.estimated_duration_minutes),
    environment: raw.environment,
    assignmentStatus: assignment.status,
    availableAt: assignment.available_at,
    phases,
    execution: execution || null,
    lastRun: formatLastRun(execution?.finished_at || execution?.exercises_finished_at || assignment.completed_at)
  };
}

async function requireAuthenticatedUser() {
  if (!client) throw new Error('Conexão segura indisponível.');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    window.location.assign(CONFIG.routes.login);
    throw new Error('Sessão não encontrada.');
  }
  state.user = data.user;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('journey_stage')
    .eq('id', state.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !['dashboard', 'checkpoint', 'feedback', 'progression'].includes(profile.journey_stage)) {
    const routes = {
      welcome: '/boas-vindas/',
      assessment: '/avaliacao-inicial/',
      waiting_healer: '/tela-espera/'
    };
    window.location.replace(routes[profile?.journey_stage] || '/painel-aventureiro/');
    throw new Error('Etapa da Jornada ainda não liberada.');
  }
}

async function loadJourneyContext() {
  const { data: journey, error: journeyError } = await client
    .from('adventurer_journeys')
    .select('id, adventurer_id, status, current_chapter_id, current_level, chapter_progress')
    .eq('adventurer_id', state.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (journeyError) throw journeyError;
  state.journey = journey;
  if (!journey?.current_chapter_id) return;

  const { data: chapter, error: chapterError } = await client
    .from('chapters')
    .select('id, title, chapter_number, objective, estimated_duration_weeks, status')
    .eq('id', journey.current_chapter_id)
    .maybeSingle();

  if (chapterError) throw chapterError;
  state.chapter = chapter;
}

async function loadMissionData() {
  if (!state.journey || !state.chapter) {
    state.missions = [];
    return;
  }

  const { data: assignments, error: assignmentsError } = await client
    .from('mission_assignments')
    .select('id, mission_id, status, available_at, completed_at')
    .eq('adventurer_id', state.user.id)
    .eq('journey_id', state.journey.id)
    .eq('chapter_id', state.chapter.id)
    .order('created_at', { ascending: true });

  if (assignmentsError) throw assignmentsError;
  if (!assignments?.length) {
    state.missions = [];
    return;
  }

  const missionIds = assignments.map(item => item.mission_id);
  const [missionsResponse, exercisesResponse, executionsResponse] = await Promise.all([
    client.from('missions')
      .select('id, chapter_id, code, environment, name, subtitle, objective, estimated_duration_minutes, mission_type, status')
      .in('id', missionIds),
    client.from('mission_exercises')
      .select('id, mission_id, section, sets, repetitions, duration_seconds, rest_seconds, healer_note, display_order, exercise:exercises!mission_exercises_exercise_id_fkey(id,name,media_url), alternative:exercises!mission_exercises_alternative_exercise_id_fkey(id,name,media_url)')
      .in('mission_id', missionIds),
    client.from('mission_executions')
      .select('id, mission_assignment_id, journey_id, chapter_id, mission_id, environment, status, current_exercise_id, started_at, paused_at, resumed_at, exercises_finished_at, record_completed_at, finished_at, updated_at')
      .eq('adventurer_id', state.user.id)
      .in('mission_id', missionIds)
      .order('updated_at', { ascending: false })
  ]);

  if (missionsResponse.error) throw missionsResponse.error;
  if (exercisesResponse.error) throw exercisesResponse.error;
  if (executionsResponse.error) throw executionsResponse.error;

  const rawById = new Map((missionsResponse.data || []).map(item => [item.id, item]));
  const latestExecution = new Map();
  for (const execution of executionsResponse.data || []) {
    if (!latestExecution.has(execution.mission_id)) latestExecution.set(execution.mission_id, execution);
  }

  state.missions = assignments
    .map(assignment => {
      const raw = rawById.get(assignment.mission_id);
      return raw ? buildMission(raw, assignment, exercisesResponse.data || [], latestExecution.get(raw.id)) : null;
    })
    .filter(Boolean);
}

async function initialize() {
  try {
    await requireAuthenticatedUser();
    await loadJourneyContext();
    await loadMissionData();
  } catch (error) {
    console.error('EVOLVE Missões:', error);
    state.error = error.message || 'Não foi possível carregar suas Missões.';
  } finally {
    state.loading = false;
    render();
  }
}

function render(options = {}) {
  if (state.loading) {
    app.innerHTML = '<section class="chapter-hero"><p class="eyebrow">EVOLVE Quest</p><h1>Carregando suas Missões</h1><p class="lead">Consultando sua Jornada e as orientações do Healer…</p></section>';
    return;
  }

  if (state.error) {
    app.innerHTML = `<section class="chapter-hero"><p class="eyebrow">Não foi possível carregar</p><h1>Missões indisponíveis</h1><p class="lead">${state.error}</p><div style="margin-top:20px"><button class="primary-button" data-action="retry">Tentar novamente</button></div></section>`;
    bindEvents();
    return;
  }

  app.innerHTML = state.view === 'list' ? renderMissionList() : renderMissionDetail();
  bindEvents();
  if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMissionList() {
  if (!state.journey || !state.chapter) {
    return `<section class="chapter-hero"><p class="eyebrow">Jornada em preparação</p><h1>Suas Missões serão liberadas em breve</h1><p class="lead">Seu Healer ainda está definindo o Capítulo e as Missões da sua Jornada.</p><div style="margin-top:20px"><button class="primary-button" data-action="panel">Voltar ao Painel</button></div></section>`;
  }

  const allMissions = state.missions;
  const completed = allMissions.filter(mission => mission.execution?.status === 'completed').length;
  const progress = allMissions.length ? Math.round((completed / allMissions.length) * 100) : 0;
  const environmentMissions = currentMissions();

  return `
    <section class="chapter-hero">
      <p class="eyebrow">Capítulo ${state.chapter.chapter_number ?? 'atual'} · atual</p>
      <h1>${state.chapter.title}</h1>
      <p class="lead">${state.chapter.objective || 'Objetivo definido pelo seu Healer.'}</p>
      <div class="chapter-meta"><div><span class="meta-label">Duração prevista</span><strong class="meta-value">${state.chapter.estimated_duration_weeks ? `${state.chapter.estimated_duration_weeks} semanas` : 'A definir'}</strong></div><div class="progress-ring" style="--progress: ${progress}"><span>${completed}/${allMissions.length || 0}</span></div></div>
    </section>

    <nav class="environment-tabs" aria-label="Local das Missões">
      <button class="environment-tab ${state.environment === 'academia' ? 'active' : ''}" data-environment="academia" aria-pressed="${state.environment === 'academia'}"><span class="tab-icon">A</span><span><strong>Academia</strong><small>Com equipamentos</small></span></button>
      <button class="environment-tab ${state.environment === 'casa' ? 'active' : ''}" data-environment="casa" aria-pressed="${state.environment === 'casa'}"><span class="tab-icon">C</span><span><strong>Casa</strong><small>Poucos recursos</small></span></button>
    </nav>

    <div class="section-heading"><div><p class="eyebrow">${environmentLabel()}</p><h2>Missões do capítulo</h2></div><span class="section-caption">${environmentMissions.length} missões</span></div>
    ${environmentMissions.length
      ? `<section class="mission-list" aria-label="Missões para ${environmentLabel()}">${environmentMissions.map(renderMissionCard).join('')}</section>`
      : `<section class="mission-card"><h3>Nenhuma Missão disponível</h3><p class="mission-objective">O Healer ainda não liberou uma versão para ${environmentLabel()}.</p></section>`}`;
}

function missionVisualState(mission) {
  const status = mission.execution?.status;
  if (status === 'completed') return { css: 'completed', label: 'Concluída', button: 'Ver Missão' };
  if (status === 'awaiting_record') return { css: 'available', label: 'Aguardando Registro', button: 'Concluir Registro da Missão' };
  if (status === 'paused') return { css: 'available', label: 'Pausada', button: 'Retomar Missão' };
  if (status === 'in_progress') return { css: 'available', label: 'Em andamento', button: 'Continuar Missão' };
  if (mission.assignmentStatus === 'locked') return { css: 'locked', label: 'Bloqueada', button: 'Indisponível' };
  return { css: 'available', label: 'Disponível', button: 'Iniciar Missão' };
}

function renderMissionCard(mission) {
  const visual = missionVisualState(mission);
  const disabled = mission.assignmentStatus === 'locked';
  const action = mission.execution?.status === 'awaiting_record' ? 'open-record' : 'open-mission';
  return `<article class="mission-card" data-status="${visual.css}">
    <div class="card-top"><div><p class="mission-code">${mission.code}</p><h3>${mission.name}</h3><p class="mission-subtitle">${mission.subtitle}</p></div><span class="status-badge ${visual.css}">${visual.label}</span></div>
    <p class="mission-objective">${mission.objective}</p>
    <div class="card-meta"><div class="meta-box"><span>Duração</span><strong>${mission.duration}</strong></div><div class="meta-box"><span>Última execução</span><strong>${mission.lastRun}</strong></div></div>
    <button class="primary-button" data-${action}="${mission.id}" ${disabled ? 'disabled' : ''}>${visual.button}</button>
  </article>`;
}

function renderMissionDetail() {
  const mission = activeMission();
  if (!mission) {
    state.view = 'list';
    return renderMissionList();
  }

  const allIds = mission.phases.flatMap(phase => phase.exercises.map(exercise => exercise.id));
  const allDone = allIds.length > 0 && allIds.every(id => state.completedExercises.has(id));
  const executionStatus = state.activeExecution?.status;
  const started = Boolean(state.activeExecution && ['in_progress', 'paused'].includes(executionStatus));
  state.paused = executionStatus === 'paused';

  return `
    <section class="detail-header"><p class="eyebrow">${environmentLabel()} · ${mission.code}</p><h1>${mission.name}</h1><p class="lead">${mission.objective}</p><div class="detail-summary"><span class="summary-pill">${mission.duration}</span><span class="summary-pill">${allIds.length} exercícios</span></div></section>
    <section class="phase-list">${mission.phases.map((phase, phaseIndex) => `<article class="phase-card"><header class="phase-title"><span class="phase-number">${phaseIndex + 1}</span><h2>${phase.name}</h2></header>${phase.exercises.map(exercise => renderExercise(exercise, started)).join('')}</article>`).join('')}</section>
    <div class="mission-controls ${started ? '' : 'full'}">${started ? `<button class="secondary-button" data-action="pause">${state.paused ? 'Retomar missão' : 'Pausar missão'}</button>` : ''}<button class="primary-button" data-action="${started ? 'finish' : 'start'}">${started ? 'Finalizar missão' : 'Iniciar'}</button></div>`;
}

function renderExercise(exercise, started) {
  const checked = state.completedExercises.has(exercise.id);
  const media = exercise.mediaUrl
    ? `<a class="exercise-media" href="${exercise.mediaUrl}" target="_blank" rel="noopener" aria-label="Abrir demonstração de ${exercise.name}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.8l5 3.2-5 3.2z"/></svg></a>`
    : `<div class="exercise-media" role="img" aria-label="Demonstração de ${exercise.name} ainda não disponível"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.8l5 3.2-5 3.2z"/></svg></div>`;

  return `<div class="exercise" id="exercise-${exercise.id}"><div class="exercise-head"><span class="exercise-name">${exercise.name}</span></div>${media}<div class="exercise-data"><div class="data-cell"><span>Séries</span><strong>${exercise.sets}</strong></div><div class="data-cell"><span>Repetições</span><strong>${exercise.reps}</strong></div><div class="data-cell"><span>Intervalo</span><strong>${exercise.rest}</strong></div></div><p class="healer-note"><strong>Observação do Healer:</strong> ${exercise.note}</p>${exercise.alternative ? `<p class="alternative"><strong>Alternativa:</strong> ${exercise.alternative}</p>` : ''}<label class="exercise-check"><input type="checkbox" data-exercise="${exercise.id}" ${checked ? 'checked' : ''} ${!started || state.paused ? 'disabled' : ''}> Marcar exercício como concluído</label></div>`;
}

async function openMission(missionId) {
  const mission = state.missions.find(item => item.id === missionId);
  if (!mission) return;
  state.activeMissionId = missionId;
  state.activeExecution = mission.execution && ['in_progress', 'paused'].includes(mission.execution.status) ? mission.execution : null;
  state.completedExercises = new Set();

  if (state.activeExecution) await loadCompletedExercises(state.activeExecution.id);
  state.view = 'detail';
  render();
}

async function loadCompletedExercises(executionId) {
  const { data, error } = await client
    .from('execution_exercises')
    .select('exercise_id, status')
    .eq('execution_id', executionId)
    .eq('status', 'completed');
  if (error) throw error;
  state.completedExercises = new Set((data || []).map(item => item.exercise_id));
}

async function startMission() {
  const mission = activeMission();
  if (!mission) return;
  setControlLoading(true);

  try {
    let execution = mission.execution;
    if (execution && execution.status === 'paused') {
      const { data, error } = await client
        .from('mission_executions')
        .update({ status: 'in_progress', resumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', execution.id)
        .select()
        .single();
      if (error) throw error;
      execution = data;
    } else if (!execution || !['in_progress', 'paused'].includes(execution.status)) {
      const { data, error } = await client
        .from('mission_executions')
        .insert({
          adventurer_id: state.user.id,
          mission_assignment_id: mission.assignmentId,
          journey_id: state.journey.id,
          chapter_id: state.chapter.id,
          mission_id: mission.id,
          environment: mission.environment,
          status: 'in_progress'
        })
        .select()
        .single();
      if (error) throw error;
      execution = data;

      const exerciseIds = mission.phases.flatMap(phase => phase.exercises.map(exercise => exercise.id));
      if (exerciseIds.length) {
        const { error: rowsError } = await client.from('execution_exercises').insert(
          exerciseIds.map(exerciseId => ({ execution_id: execution.id, exercise_id: exerciseId, status: 'pending' }))
        );
        if (rowsError) throw rowsError;
      }
    }

    mission.execution = execution;
    state.activeExecution = execution;
    state.paused = false;
    showToast('Missão iniciada. Boa jornada, Aventureiro.');
    render();
  } catch (error) {
    console.error('EVOLVE iniciar missão:', error);
    showToast('Não foi possível iniciar a Missão. Tente novamente.');
  } finally {
    setControlLoading(false);
  }
}

async function toggleExercise(exerciseId, completed) {
  if (!state.activeExecution) return;
  if (completed) state.completedExercises.add(exerciseId);
  else state.completedExercises.delete(exerciseId);
  updateFinishButton();

  try {
    const { error } = await client
      .from('execution_exercises')
      .update({
        status: completed ? 'completed' : 'pending',
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('execution_id', state.activeExecution.id)
      .eq('exercise_id', exerciseId);
    if (error) throw error;

    await client
      .from('mission_executions')
      .update({ current_exercise_id: completed ? nextPendingExerciseId() : exerciseId, updated_at: new Date().toISOString() })
      .eq('id', state.activeExecution.id);
  } catch (error) {
    console.error('EVOLVE exercício:', error);
    storePendingSync({ executionId: state.activeExecution.id, exerciseId, completed, createdAt: new Date().toISOString() });
    showToast('Progresso salvo neste aparelho. Sincronização pendente.');
  }
}

function nextPendingExerciseId() {
  const mission = activeMission();
  const ids = mission?.phases.flatMap(phase => phase.exercises.map(exercise => exercise.id)) || [];
  return ids.find(id => !state.completedExercises.has(id)) || null;
}

async function pauseOrResumeMission() {
  if (!state.activeExecution) return;
  const pausing = state.activeExecution.status !== 'paused';
  const now = new Date().toISOString();
  try {
    const { data, error } = await client
      .from('mission_executions')
      .update(pausing
        ? { status: 'paused', paused_at: now, current_exercise_id: nextPendingExerciseId(), updated_at: now }
        : { status: 'in_progress', resumed_at: now, updated_at: now })
      .eq('id', state.activeExecution.id)
      .select()
      .single();
    if (error) throw error;
    state.activeExecution = data;
    activeMission().execution = data;
    showToast(pausing ? 'Missão pausada.' : 'Missão retomada.');
    render({ preserveScroll: true });
  } catch (error) {
    console.error('EVOLVE pausa:', error);
    showToast('Não foi possível atualizar a Missão agora.');
  }
}

async function finishMission() {
  const mission = activeMission();
  if (!mission || !state.activeExecution) return;
  const allIds = mission.phases.flatMap(
  phase => phase.exercises.map(exercise => exercise.id)
);

const pendingExercises = allIds.filter(
  id => !state.completedExercises.has(id)
);

if (pendingExercises.length > 0) {
  const confirmed = window.confirm(
    `Você ainda possui ${pendingExercises.length} exercício${
      pendingExercises.length > 1 ? 's' : ''
    } não concluído${
      pendingExercises.length > 1 ? 's' : ''
    }.\n\nDeseja encerrar a missão mesmo assim?`
  );

  if (!confirmed) return;
}  
  setControlLoading(true);
  try {
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('mission_executions')
      .update({ status: 'awaiting_record', exercises_finished_at: now, current_exercise_id: null, updated_at: now })
      .eq('id', state.activeExecution.id)
      .select()
      .single();
    if (error) throw error;

    mission.execution = data;
    state.activeExecution = data;
    localStorage.setItem('eq_pending_mission_record', JSON.stringify({ executionId: data.id, createdAt: now }));
    showToast('Exercícios finalizados. Abrindo o Registro da Missão…');
    window.setTimeout(() => {
      window.location.assign(`${CONFIG.routes.missionRecord}?execution_id=${encodeURIComponent(data.id)}`);
    }, 700);
  } catch (error) {
    console.error('EVOLVE finalizar:', error);
    showToast('Não foi possível finalizar a Missão agora.');
  } finally {
    setControlLoading(false);
  }
}

function openMissionRecord(missionId) {
  const mission = state.missions.find(item => item.id === missionId);
  const executionId = mission?.execution?.id;
  if (!executionId) return;
  window.location.assign(`${CONFIG.routes.missionRecord}?execution_id=${encodeURIComponent(executionId)}`);
}

function bindEvents() {
  document.querySelectorAll('[data-environment]').forEach(button => button.addEventListener('click', () => {
    state.environment = button.dataset.environment;
    localStorage.setItem(CONFIG.localKeys.environment, state.environment);
    render();
  }));

  document.querySelectorAll('[data-open-mission]').forEach(button => button.addEventListener('click', () => openMission(button.dataset.openMission)));
  document.querySelectorAll('[data-open-record]').forEach(button => button.addEventListener('click', () => openMissionRecord(button.dataset.openRecord)));
  document.querySelectorAll('[data-exercise]').forEach(input => input.addEventListener('change', () => toggleExercise(input.dataset.exercise, input.checked)));
  document.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => handleAction(element.dataset.action)));
}

function handleAction(action) {
  if (action === 'back') {
    if (state.view === 'detail') {
      state.view = 'list';
      state.activeMissionId = null;
      state.activeExecution = null;
      state.completedExercises = new Set();
      render();
    } else window.location.assign(CONFIG.routes.panel);
  }
  if (action === 'menu') showToast('Mais opções serão integradas ao ecossistema EVOLVE Quest.');
  if (action === 'start') startMission();
  if (action === 'pause') pauseOrResumeMission();
  if (action === 'finish') finishMission();
  if (action === 'panel') window.location.assign(CONFIG.routes.panel);
  if (action === 'retry') {
    state.loading = true;
    state.error = '';
    render();
    initialize();
  }
}

function updateFinishButton() {
  const button = document.querySelector('[data-action="finish"]');

  if (button) {
    button.disabled = false;
  }
}
function setControlLoading(isLoading) {
  document.querySelectorAll('.mission-controls button').forEach(button => {
    button.disabled = isLoading || button.disabled;
    button.setAttribute('aria-busy', String(isLoading));
  });
}

function storePendingSync(item) {
  const existing = JSON.parse(localStorage.getItem(CONFIG.localKeys.pendingSync) || '[]');
  existing.push(item);
  localStorage.setItem(CONFIG.localKeys.pendingSync, JSON.stringify(existing.slice(-50)));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

render();
initialize();
