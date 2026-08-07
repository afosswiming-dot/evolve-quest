(() => {
  'use strict';

  const CONFIG = Object.freeze({
    supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
    supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
    routes: {
      login: '/login/',
      missions: '/missoes/',
      missionRecord: '/registro-missao/',
      manual: '/manual/',
      journey: '/jornada/',
      checkpoint: '/checkpoint/',
      records: '/registros/',
      profile: '/perfil/'
    }
  });

  const client = window.supabase?.createClient
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const STAGE_ROUTES = Object.freeze({
    welcome: '/boas-vindas/',
    assessment: '/avaliacao-inicial/',
    waiting_healer: '/tela-espera/',
    dashboard: '/painel-aventureiro/',
    checkpoint: '/checkpoint/',
    feedback: '/feedback-evolucao/',
    progression: '/progressao/'
  });

  function enforceDashboardStage(profile) {
    const allowed = ['dashboard', 'checkpoint', 'feedback', 'progression'];
    if (!profile || allowed.includes(profile.journey_stage)) return;
    window.location.replace(STAGE_ROUTES[profile.journey_stage] || '/boas-vindas/');
    throw new Error('ROUTE_STAGE_REDIRECT');
  }

  const state = {
    user: null,
    profile: null,
    journey: null,
    assignment: null,
    checkpoint: null,
    subscription: null,
    healer: null,
    evaluation: null,
    records: [],
    assignments: [],
    pending: []
  };

  const toast = document.querySelector('#toast');
  const pendingSection = document.querySelector('#pending-section');
  const pendingList = document.querySelector('#pending-list');
  const openMissionButton = document.querySelector('#open-mission-button');
  let toastTimer;

  const iconAlert = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 4.7 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z"/></svg>';
  const iconChevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function setGreeting(name) {
    const hour = new Date().getHours();
    const label = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    document.querySelector('#greeting').textContent = `${label}, ${name || 'Aventureiro'}.`;
  }

  function dateLabel(value) {
    if (!value) return 'Não disponível';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não disponível';
    const diff = Math.ceil((date.getTime() - Date.now()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff > 1) return `Em ${diff} dias`;
    return date.toLocaleDateString('pt-BR');
  }

  function initials(name) {
    return String(name || 'EV').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();
  }

  async function loadDashboard(userId) {
    const { data, error } = await client.rpc('get_my_adventurer_dashboard');
    if (error) throw error;
    if (!data?.profile) throw new Error('Perfil do Aventureiro não encontrado.');

    state.profile = data.profile;
    enforceDashboardStage(state.profile);
    state.journey = data.journey || null;
    state.assignments = Array.isArray(data.assignments) ? data.assignments.map(item => ({
      ...item,
      missions: item.mission || null
    })) : [];
    state.records = Array.isArray(data.records) ? data.records : [];
    state.checkpoint = data.checkpoint || null;
    state.subscription = data.subscription || null;
    state.evaluation = data.evaluation || null;
    state.healer = data.healer || null;

    state.profile.adventurer_classes = state.profile.class_name
      ? { name: state.profile.class_name }
      : null;

    const chapter = state.journey?.chapter_title
      ? { title: state.journey.chapter_title, chapter_number: state.journey.chapter_number }
      : state.profile.chapter_title
        ? { title: state.profile.chapter_title, chapter_number: state.profile.chapter_number }
        : null;

    state.profile.chapters = chapter;
    if (state.journey) state.journey.chapters = chapter;

    state.assignment =
      state.assignments.find(item => item.status === 'in_progress') ||
      state.assignments.find(item => item.status === 'available') ||
      null;
  }

  function calculatePending() {
    const pending = [];
    const evaluationIncomplete = !state.evaluation || ['draft','returned_for_editing'].includes(state.evaluation.status);
    if (evaluationIncomplete) pending.push({ id: 'assessment', title: 'Avaliação incompleta', detail: 'Conclua sua Avaliação Inicial para continuar.' });

    const pendingRecord = state.records.find(record => record.status === 'completed' && !record.submitted_at);
    if (pendingRecord) pending.push({ id: 'mission-record', title: 'Registro da Missão pendente', detail: 'Finalize o registro da última Missão.' });

    if (state.checkpoint?.status === 'available') pending.push({ id: 'checkpoint', title: 'Checkpoint disponível', detail: 'Seu próximo Checkpoint já pode ser iniciado.' });

    if (state.subscription && (state.subscription.payment_status !== 'paid' || state.subscription.status !== 'active')) {
      pending.push({ id: 'payment', title: 'Pagamento pendente', detail: 'Regularize sua Jornada para manter o acesso.' });
    }

    state.pending = pending;
  }

  function renderPending() {
    if (!state.pending.length) {
      pendingSection.hidden = true;
      return;
    }
    pendingSection.hidden = false;
    pendingList.innerHTML = state.pending.map(item => `
      <button class="pending-item" type="button" data-pending="${item.id}">
        <span class="pending-item__icon">${iconAlert}</span>
        <span class="pending-item__copy"><strong>${item.title}</strong><span>${item.detail}</span></span>
        ${iconChevron}
      </button>
    `).join('');
  }

  function renderDashboard() {
    const profile = state.profile || {};
    const journey = state.journey || {};
    const assignment = state.assignment;
    const mission = assignment?.missions || {};
    const displayName = profile.preferred_name || profile.full_name || 'Aventureiro';
    const fullName = profile.full_name || displayName;
    const className = profile.adventurer_classes?.name || 'Classe não definida';
    const level = journey.current_level || profile.current_level;
    const chapter = journey.chapters || profile.chapters;

    setGreeting(displayName);
    document.querySelector('#welcome-title').textContent = fullName;
    document.querySelector('.avatar').textContent = initials(displayName);
    document.querySelector('#class-name').textContent = className;
    document.querySelector('#level-name').textContent = level ? `Nível ${level}` : 'Nível não definido';
    document.querySelector('#chapter-name').textContent = chapter
      ? `Capítulo ${chapter.chapter_number || ''} · ${chapter.title}`.replace(/\s+/g,' ').trim()
      : 'Capítulo não definido';

    if (assignment) {
      document.querySelector('#mission-type').textContent = `Missão ${assignment.mission_type}`;
      document.querySelector('#next-mission-title').textContent = mission.subtitle || mission.name || 'Missão disponível';
      document.querySelector('#mission-objective').textContent = mission.objective || 'Abra a Missão para consultar as orientações.';
      document.querySelector('#mission-duration').lastChild.textContent = mission.estimated_duration_minutes ? ` ${mission.estimated_duration_minutes} min` : ' —';
      openMissionButton.disabled = false;
    } else if (profile.journey_stage === 'dashboard') {
      document.querySelector('#mission-type').textContent = 'Missões do Capítulo';
      document.querySelector('#next-mission-title').textContent = 'Capítulo em andamento';
      document.querySelector('#mission-objective').textContent = 'Consulte suas Missões prescritas para continuar sua Jornada.';
      openMissionButton.disabled = false;
    } else {
      document.querySelector('#mission-type').textContent = 'Próxima Missão';
      document.querySelector('#next-mission-title').textContent = 'Aguardando liberação';
      document.querySelector('#mission-objective').textContent = 'Seu Healer definirá a próxima ação da sua Jornada.';
      openMissionButton.disabled = true;
    }

    const progress = Number(journey.chapter_progress || 0);
    document.querySelector('#chapter-progress-text').textContent = `${progress}%`;
    document.querySelector('#chapter-progress').setAttribute('aria-valuenow', String(progress));
    document.querySelector('#chapter-progress-bar').style.width = `${progress}%`;
    document.querySelector('#xp-total').textContent = journey.xp_enabled === false ? 'XP desativado' : `${Number(journey.total_xp || 0).toLocaleString('pt-BR')} XP`;

    const completed = state.assignments.filter(item => item.completed_at || item.status === 'completed').length;
    const total = state.assignments.length;
    document.querySelector('#weekly-missions').textContent = `${completed} de ${total}`;
    document.querySelector('#checkpoint-date').textContent = dateLabel(state.checkpoint?.due_at || state.checkpoint?.available_at);
    document.querySelector('#streak-value').textContent = `${Number(journey.current_streak || 0)} dias`;

    calculatePending();
    renderPending();
  }

  async function registerAccess() {
    if (!state.user) return;
    const { error } = await client.from('adventurer_activity').upsert({
      adventurer_id: state.user.id,
      last_dashboard_access_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'adventurer_id' });
    if (error) console.warn('EVOLVE Dashboard access:', error);
  }

  function navigate(path, params = {}) {
    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    window.location.assign(url.pathname + url.search);
  }

  function handleAction(action) {
    if (action === 'open-mission') {
      if (state.assignment) return navigate(CONFIG.routes.missions, { mission: state.assignment.mission_id });
      return navigate(CONFIG.routes.missions);
    }
    if (action === 'profile') return navigate(CONFIG.routes.profile);
    if (action === 'missions') return navigate(CONFIG.routes.missions);
    if (action === 'register') {
      const pending = state.records.find(record => record.status === 'completed' && !record.submitted_at);
      return pending ? navigate(CONFIG.routes.missionRecord, { assignment: pending.mission_assignment_id }) : showToast('Nenhum Registro da Missão está pendente.');
    }
    if (action === 'manual') return navigate(CONFIG.routes.manual, { level: state.journey?.current_level || state.profile?.current_level });
    if (action === 'scroll') return navigate(CONFIG.routes.journey, { journey: state.journey?.id });
    if (action === 'checkpoint') return state.checkpoint ? navigate(CONFIG.routes.checkpoint, { checkpoint: state.checkpoint.id }) : showToast('Nenhum Checkpoint está disponível.');
    if (action === 'healer') {
      if (state.healer?.contact_url) return window.location.assign(state.healer.contact_url);
      if (state.healer?.whatsapp_number) return window.location.assign(`https://wa.me/${state.healer.whatsapp_number.replace(/\D/g,'')}`);
      return showToast('O canal do seu Healer ainda não foi configurado.');
    }
  }

  function handlePending(id) {
    if (id === 'assessment') return navigate('/avaliacao-inicial/');
    if (id === 'mission-record') return handleAction('register');
    if (id === 'checkpoint') return handleAction('checkpoint');
  }

  document.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton && !actionButton.disabled) handleAction(actionButton.dataset.action);

    const pendingButton = event.target.closest('[data-pending]');
    if (pendingButton) handlePending(pendingButton.dataset.pending);

    const navButton = event.target.closest('[data-nav]');
    if (!navButton) return;
    const destination = {
      home: null,
      missions: CONFIG.routes.missions,
      journey: CONFIG.routes.journey,
      records: CONFIG.routes.records,
      profile: CONFIG.routes.profile
    }[navButton.dataset.nav];
    if (!destination) return window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(destination);
  });

  async function initialize() {
    if (!client) {
      showToast('Não foi possível iniciar a conexão segura.');
      return;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) return window.location.replace(CONFIG.routes.login);
      state.user = data.session.user;
      await loadDashboard(state.user.id);
      renderDashboard();
      registerAccess();
    } catch (error) {
      console.error('EVOLVE Dashboard:', error);
      showToast('Não foi possível carregar seu Painel agora.');
    }
  }

  initialize();
})();
