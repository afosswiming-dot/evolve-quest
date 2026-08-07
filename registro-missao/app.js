(() => {
  'use strict';

  const CONFIG = Object.freeze({
    supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
    supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
    routes: {
      login: '/login/',
      missions: '/missoes/',
      dashboard: '/painel-aventureiro/'
    },
    formVersion: 'v1.0.1',
    pendingStorageKey: 'evolveQuest.pendingMissionRegistrations.v1'
  });

  const client = window.supabase?.createClient
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const state = {
    currentStep: 1,
    totalSteps: 4,
    execution: null,
    user: null,
    startedFormAt: Date.now(),
    submitting: false
  };

  const form = document.querySelector('#missionForm');
  const steps = [...document.querySelectorAll('.form-step')];
  const nextButton = document.querySelector('#nextButton');
  const backButton = document.querySelector('#backButton');
  const submitButton = document.querySelector('#submitButton');
  const progressLabel = document.querySelector('#progressLabel');
  const progressPercent = document.querySelector('#progressPercent');
  const progressFill = document.querySelector('#progressFill');
  const successScreen = document.querySelector('#successScreen');
  const toast = document.querySelector('#toast');
  const closeSuccessButton = document.querySelector('#closeSuccess');

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }

  function setPageLoading(isLoading) {
    document.body.classList.toggle('is-loading', isLoading);
    form.setAttribute('aria-busy', String(isLoading));
    nextButton.disabled = isLoading;
    backButton.disabled = isLoading;
    submitButton.disabled = isLoading;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    }).format(new Date(value));
  }

  function getExecutionId() {
    return new URLSearchParams(window.location.search).get('execution_id');
  }

  async function requireAuthenticatedUser() {
    if (!client) throw new Error('SUPABASE_UNAVAILABLE');
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      window.location.replace(CONFIG.routes.login);
      throw new Error('AUTH_REQUIRED');
    }
    state.user = data.user;
  }

  async function loadExecutionContext() {
    const executionId = getExecutionId();
    if (!executionId) throw new Error('EXECUTION_ID_REQUIRED');

    const { data: execution, error } = await client
      .from('mission_executions')
      .select('id, adventurer_id, mission_assignment_id, journey_id, chapter_id, mission_id, environment, status, started_at, exercises_finished_at, record_completed_at')
      .eq('id', executionId)
      .eq('adventurer_id', state.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!execution) throw new Error('EXECUTION_NOT_FOUND');

    if (execution.status === 'completed' || execution.status === 'partially_completed' || execution.status === 'not_completed') {
      throw new Error('REGISTRATION_ALREADY_EXISTS');
    }
    if (execution.status !== 'awaiting_record') throw new Error('INVALID_EXECUTION_STATUS');

    const [profileResult, missionResult, chapterResult] = await Promise.all([
      client.from('profiles').select('preferred_name, full_name, journey_stage').eq('id', state.user.id).maybeSingle(),
      client.from('missions').select('name, subtitle, mission_type, environment').eq('id', execution.mission_id).maybeSingle(),
      client.from('chapters').select('title, chapter_number').eq('id', execution.chapter_id).maybeSingle()
    ]);

    if (profileResult.error) throw profileResult.error;
    if (missionResult.error) throw missionResult.error;
    if (chapterResult.error) throw chapterResult.error;

    if (profileResult.data?.journey_stage !== 'dashboard') {
      window.location.replace(CONFIG.routes.dashboard);
      throw new Error('JOURNEY_STAGE_NOT_ALLOWED');
    }

    state.execution = {
      ...execution,
      profile: profileResult.data,
      mission: missionResult.data,
      chapter: chapterResult.data
    };

    hydrateContext();
  }

  function hydrateContext() {
    const context = state.execution;
    const adventurerName = context.profile?.preferred_name || context.profile?.full_name || 'Aventureiro';
    const missionName = context.mission?.name || context.mission?.mission_type || 'Missão';
    const chapterTitle = context.chapter
      ? `Capítulo ${context.chapter.chapter_number} — ${context.chapter.title}`
      : 'Capítulo atual';

    document.querySelector('#adventurerName').textContent = adventurerName;
    document.querySelector('#missionName').textContent = missionName;
    document.querySelector('#chapterName').textContent = chapterTitle;
    document.querySelector('#missionDate').textContent = formatDate(context.exercises_finished_at || context.started_at);
  }

  function setupRange(id) {
    const input = document.querySelector(`#${id}`);
    const output = document.querySelector(`#${id}Output`);
    const update = () => { output.value = input.value; };
    input.addEventListener('input', update);
    update();
  }

  function setupCounter(textareaId, countId) {
    const textarea = document.querySelector(`#${textareaId}`);
    const counter = document.querySelector(`#${countId}`);
    textarea.addEventListener('input', () => { counter.textContent = textarea.value.length; });
  }

  function updateProgress() {
    const percentage = Math.round((state.currentStep / state.totalSteps) * 100);
    progressLabel.textContent = `Etapa ${state.currentStep} de ${state.totalSteps}`;
    progressPercent.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;
    backButton.hidden = state.currentStep === 1;
    nextButton.hidden = state.currentStep === state.totalSteps;
    submitButton.hidden = state.currentStep !== state.totalSteps;
  }

  function showStep(stepNumber) {
    state.currentStep = stepNumber;
    steps.forEach(step => step.classList.toggle('is-active', Number(step.dataset.step) === stepNumber));
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectedValue(name) {
    return form.querySelector(`[name="${name}"]:checked`)?.value || '';
  }

  function setError(card, hasError) {
    card.classList.toggle('has-error', hasError);
  }

  function validateStep(stepNumber) {
    const step = steps.find(item => Number(item.dataset.step) === stepNumber);
    let valid = true;

    step.querySelectorAll('[data-required]').forEach(card => {
      const field = card.dataset.required;
      let missing = false;
      if (['completion', 'difficulty', 'pain', 'feeling'].includes(field)) missing = !selectedValue(field);
      setError(card, missing);
      if (missing) valid = false;
    });

    if (stepNumber === 2) {
      const pain = selectedValue('pain');
      const detailsCard = document.querySelector('#painDetailsCard');
      const details = document.querySelector('#painDetails').value.trim();
      const needsDetails = pain && pain !== 'Não' && pain !== 'Fadiga muscular esperada';
      setError(detailsCard, needsDetails && !details);
      if (needsDetails && !details) valid = false;
    }

    if (!valid) {
      step.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Revise os campos destacados para continuar.');
    }
    return valid;
  }

  function handlePainVisibility() {
    const pain = selectedValue('pain');
    const card = document.querySelector('#painDetailsCard');
    const show = pain && pain !== 'Não' && pain !== 'Fadiga muscular esperada';
    card.hidden = !show;
    if (!show) {
      document.querySelector('#painDetails').value = '';
      document.querySelector('#painCount').textContent = '0';
      card.classList.remove('has-error');
    }
  }

  function mapCompletion(value) {
    return {
      Sim: 'completed',
      Parcialmente: 'partially_completed',
      Não: 'not_completed'
    }[value];
  }

  function buildRpcPayload() {
    const formData = new FormData(form);
    return {
      p_execution_id: state.execution.id,
      p_completion_status: mapCompletion(formData.get('completion')),
      p_perceived_effort: Number(formData.get('effort')),
      p_mission_difficulty: formData.get('difficulty'),
      p_technical_execution: Number(formData.get('technique')),
      p_pain_status: formData.get('pain'),
      p_pain_notes: formData.get('painDetails')?.trim() || '',
      p_energy_before: Number(formData.get('energyBefore')),
      p_energy_after: Number(formData.get('energyAfter')),
      p_post_mission_feeling: formData.get('feeling'),
      p_general_notes: formData.get('notes')?.trim() || '',
      p_form_duration_seconds: Math.max(0, Math.round((Date.now() - state.startedFormAt) / 1000)),
      p_form_version: CONFIG.formVersion
    };
  }

  function getPendingRecords() {
    try { return JSON.parse(localStorage.getItem(CONFIG.pendingStorageKey) || '[]'); }
    catch { return []; }
  }

  function savePendingRecord(payload) {
    const pending = getPendingRecords().filter(item => item.p_execution_id !== payload.p_execution_id);
    pending.push({ ...payload, queued_at: new Date().toISOString() });
    localStorage.setItem(CONFIG.pendingStorageKey, JSON.stringify(pending));
  }

  function removePendingRecord(executionId) {
    const pending = getPendingRecords().filter(item => item.p_execution_id !== executionId);
    localStorage.setItem(CONFIG.pendingStorageKey, JSON.stringify(pending));
  }

  async function submitPayload(payload) {
    const { data, error } = await client.rpc('register_mission_feedback', payload);
    if (error) throw error;
    removePendingRecord(payload.p_execution_id);
    return data;
  }

  async function syncPendingRecords() {
    if (!navigator.onLine || !client) return;
    const pending = getPendingRecords();
    for (const payload of pending) {
      try { await submitPayload(payload); }
      catch (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('registration_already_exists')) removePendingRecord(payload.p_execution_id);
      }
    }
  }

  function renderSuccess(result, offline = false) {
    document.querySelector('#weeklyProgressResult').textContent = offline
      ? 'Aguardando sincronização'
      : `${result.weekly_completed_missions}/${result.weekly_mission_goal} missões`;
    document.querySelector('#healerAlertResult').textContent = offline
      ? 'Será verificado ao sincronizar'
      : result.healer_alert_created ? 'Enviado ao Healer' : 'Não necessário';
    document.querySelector('#successTitle').textContent = offline ? 'Registro salvo no aparelho.' : 'Missão registrada.';
    document.querySelector('#successDescription').textContent = offline
      ? 'Assim que a conexão voltar, enviaremos suas respostas com segurança.'
      : 'Seu Healer recebeu suas respostas e acompanhará sua evolução.';
    successScreen.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function errorMessage(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('registration_already_exists')) return 'Esta Missão já possui um registro.';
    if (message.includes('invalid_execution_status')) return 'Esta execução ainda não está pronta para registro.';
    if (message.includes('execution_not_found')) return 'Não foi possível localizar esta execução.';
    if (message.includes('forbidden')) return 'Esta execução não pertence à sua conta.';
    return 'Não foi possível salvar o registro. Tente novamente.';
  }

  nextButton.addEventListener('click', () => {
    if (validateStep(state.currentStep)) showStep(state.currentStep + 1);
  });
  backButton.addEventListener('click', () => showStep(state.currentStep - 1));

  form.addEventListener('change', event => {
    event.target.closest('.question-card')?.classList.remove('has-error');
    if (event.target.name === 'pain') handlePainVisibility();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep(state.currentStep) || state.submitting) return;

    state.submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    const payload = buildRpcPayload();

    try {
      if (!navigator.onLine) {
        savePendingRecord(payload);
        renderSuccess({}, true);
      } else {
        const result = await submitPayload(payload);
        renderSuccess(result, false);
      }
    } catch (error) {
      console.error('EVOLVE Registro:', error);
      if (!navigator.onLine || error?.name === 'TypeError') {
        savePendingRecord(payload);
        renderSuccess({}, true);
      } else {
        showToast(errorMessage(error));
      }
    } finally {
      state.submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar registro';
    }
  });

  closeSuccessButton.addEventListener('click', () => {
    window.location.assign(CONFIG.routes.dashboard);
  });

  window.addEventListener('online', syncPendingRecords);

  async function initialize() {
    setPageLoading(true);
    try {
      await requireAuthenticatedUser();
      await syncPendingRecords();
      await loadExecutionContext();
    } catch (error) {
      console.error('EVOLVE Registro init:', error);
      const message = String(error.message || '');
      if (['AUTH_REQUIRED', 'JOURNEY_STAGE_NOT_ALLOWED'].includes(message)) return;
      if (message === 'REGISTRATION_ALREADY_EXISTS') {
        showToast('Esta Missão já foi registrada. Retornando ao Painel...');
        window.setTimeout(() => window.location.replace(CONFIG.routes.dashboard), 1200);
        return;
      }
      if (message === 'EXECUTION_ID_REQUIRED' || message === 'EXECUTION_NOT_FOUND') {
        showToast('Execução não encontrada. Retornando às Missões...');
        window.setTimeout(() => window.location.replace(CONFIG.routes.missions), 1500);
        return;
      }
      showToast('Não foi possível carregar o Registro da Missão.');
    } finally {
      setPageLoading(false);
    }
  }

  setupRange('effort');
  setupRange('technique');
  setupRange('energyBefore');
  setupRange('energyAfter');
  setupCounter('painDetails', 'painCount');
  setupCounter('notes', 'notesCount');
  updateProgress();
  initialize();
})();
