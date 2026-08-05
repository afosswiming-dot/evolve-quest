(() => {
  'use strict';

  const CONFIG = Object.freeze({
    supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
    supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
    registrationRoute: '/cadastro/',
    evaluationRoute: '/avaliacao-inicial/',
    adventurerPanelRoute: '/avaliacao-inicial/',
    localFallbackKey: 'evolveQuest.onboarding.pendingSync'
  });

  const startButton = document.querySelector('#startEvaluation');
  const laterButton = document.querySelector('#answerLater');
  const pendingNotice = document.querySelector('#pendingNotice');
  const toast = document.querySelector('#toast');

  if (!window.supabase?.createClient) {
    showFatalError('Não foi possível iniciar a conexão segura. Atualize a página.');
    return;
  }

  const client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  let currentUser = null;
  let currentProfile = null;
  let currentOnboarding = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function showFatalError(message) {
    if (toast) {
      toast.textContent = message;
      toast.classList.add('is-visible');
    }
    if (startButton) startButton.disabled = true;
    if (laterButton) laterButton.disabled = true;
  }

  function setBusy(isBusy, activeButton = null) {
    startButton.disabled = isBusy;
    laterButton.disabled = isBusy;
    startButton.setAttribute('aria-busy', String(isBusy && activeButton === startButton));
    laterButton.setAttribute('aria-busy', String(isBusy && activeButton === laterButton));
  }

  function showPendingState() {
    pendingNotice.hidden = false;
    laterButton.textContent = 'Avaliação pendente';
  }

  function saveFallback(patch) {
    try {
      localStorage.setItem(CONFIG.localFallbackKey, JSON.stringify({
        ...patch,
        userId: currentUser?.id || null,
        savedAt: new Date().toISOString()
      }));
    } catch {
      // O armazenamento local é apenas contingência e não bloqueia o fluxo.
    }
  }

  async function loadAuthenticatedContext() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    const session = sessionData.session;
    if (!session?.user) {
      showToast('Sua sessão expirou. Faça o cadastro ou entre novamente.');
      window.setTimeout(() => window.location.assign(CONFIG.registrationRoute), 1200);
      return false;
    }

    currentUser = session.user;

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, preferred_name, email, access_status')
      .eq('id', currentUser.id)
      .single();

    if (profileError) throw profileError;
    currentProfile = profile;

    const { data: onboarding, error: onboardingError } = await client
      .from('adventurer_onboarding')
      .select('*')
      .eq('adventurer_id', currentUser.id)
      .maybeSingle();

    if (onboardingError) throw onboardingError;

    if (!onboarding) {
      const now = new Date().toISOString();
      const { data: created, error: createError } = await client
        .from('adventurer_onboarding')
        .insert({
          adventurer_id: currentUser.id,
          onboarding_status: 'welcome',
          registration_completed_at: now,
          welcome_viewed_at: now,
          assessment_status: 'not_started',
          assessment_pending: true,
          healer_analysis_status: 'pending',
          journey_status: 'locked'
        })
        .select('*')
        .single();

      if (createError) throw createError;
      currentOnboarding = created;
    } else {
      const patch = {
        onboarding_status: onboarding.assessment_status === 'in_progress'
          ? 'assessment_started'
          : onboarding.assessment_status === 'completed'
            ? 'assessment_completed'
            : 'welcome',
        welcome_viewed_at: onboarding.welcome_viewed_at || new Date().toISOString()
      };

      const { data: updated, error: updateError } = await client
        .from('adventurer_onboarding')
        .update(patch)
        .eq('adventurer_id', currentUser.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      currentOnboarding = updated;
    }

    if (
      currentOnboarding.assessment_pending ||
      currentOnboarding.assessment_status === 'in_progress'
    ) {
      showPendingState();
    }

    return true;
  }

  async function updateOnboarding(patch) {
    if (!currentUser?.id) throw new Error('Aventureiro não autenticado.');

    const { data, error } = await client
      .from('adventurer_onboarding')
      .update(patch)
      .eq('adventurer_id', currentUser.id)
      .select('*')
      .single();

    if (error) throw error;
    currentOnboarding = data;
    return data;
  }

  async function startEvaluation() {
    setBusy(true, startButton);
    const now = new Date().toISOString();

    try {
      await updateOnboarding({
        onboarding_status: 'assessment_started',
        assessment_status: 'in_progress',
        assessment_pending: true,
        assessment_started_at: currentOnboarding?.assessment_started_at || now,
        assessment_postponed_at: null
      });
      window.location.assign(CONFIG.evaluationRoute);
    } catch (error) {
      console.error('Falha ao iniciar avaliação:', error);
      saveFallback({
        action: 'assessment_started',
        onboarding_status: 'assessment_started',
        assessment_status: 'in_progress',
        assessment_pending: true,
        assessment_started_at: now
      });
      showToast('Não foi possível sincronizar agora. Tente novamente quando estiver online.');
      setBusy(false);
    }
  }

  async function answerLater() {
    setBusy(true, laterButton);
    const now = new Date().toISOString();

    try {
      await updateOnboarding({
        onboarding_status: 'assessment_pending',
        assessment_status: 'not_started',
        assessment_pending: true,
        assessment_postponed_at: now
      });
      showPendingState();
      showToast('Pendência salva no painel do Aventureiro.');
      window.setTimeout(() => window.location.assign(CONFIG.adventurerPanelRoute), 700);
    } catch (error) {
      console.error('Falha ao adiar avaliação:', error);
      saveFallback({
        action: 'assessment_postponed',
        onboarding_status: 'assessment_pending',
        assessment_status: 'not_started',
        assessment_pending: true,
        assessment_postponed_at: now
      });
      showToast('Não foi possível sincronizar agora. Tente novamente quando estiver online.');
      setBusy(false);
    }
  }

  startButton.addEventListener('click', startEvaluation);
  laterButton.addEventListener('click', answerLater);

  setBusy(true);
  loadAuthenticatedContext()
    .then((ready) => {
      if (ready) setBusy(false);
    })
    .catch((error) => {
      console.error('Falha ao carregar Boas-vindas:', error);
      showFatalError('Não foi possível carregar seus dados. Verifique a conexão e tente novamente.');
    });

  window.EvolveQuestWelcome = Object.freeze({
    getUser: () => currentUser,
    getProfile: () => currentProfile,
    getOnboarding: () => currentOnboarding,
    canUnlockMissions: () => (
      currentOnboarding?.assessment_status === 'completed' &&
      currentOnboarding?.healer_analysis_status === 'approved' &&
      currentOnboarding?.journey_status === 'released'
    )
  });
})();
