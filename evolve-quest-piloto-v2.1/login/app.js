'use strict';

const CONFIG = Object.freeze({
  supabaseUrl: 'https://gtmngtweohixfeajljik.supabase.co',
  supabaseKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  routes: {
    registration: '/cadastro/',
    journeySelection: '/escolha-jornada/',
    welcome: '/boas-vindas/',
    assessment: '/avaliacao-inicial/',
    waiting: '/tela-espera/',
    adventurerPanel: '/painel-aventureiro/'
  }
});

const loginForm = document.querySelector('#loginForm');
const loginButton = document.querySelector('#loginButton');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const rememberMeInput = document.querySelector('#rememberMe');
const statusMessage = document.querySelector('#statusMessage');
const togglePasswordButton = document.querySelector('#togglePassword');
const recoveryModal = document.querySelector('#recoveryModal');
const recoveryForm = document.querySelector('#recoveryForm');
const recoveryEmail = document.querySelector('#recoveryEmail');
const recoverySuccess = document.querySelector('#recoverySuccess');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!window.supabase?.createClient) {
  showStatus('Não foi possível iniciar a conexão segura. Atualize a página.', 'error');
  loginButton.disabled = true;
}

const client = window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: rememberMeInput?.checked ? window.localStorage : window.sessionStorage
      }
    })
  : null;

function setFieldError(input, message) {
  const errorElement = document.querySelector(`#${input.id}Error`);
  input.closest('.field-shell')?.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (errorElement) errorElement.textContent = message;
}

function clearStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = '';
  statusMessage.className = 'status-message';
}

function showStatus(message, type = 'error') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-message--${type}`;
  statusMessage.hidden = false;
}

function validateCredentials() {
  let isValid = true;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  setFieldError(emailInput, '');
  setFieldError(passwordInput, '');
  clearStatus();

  if (!email) {
    setFieldError(emailInput, 'Informe seu e-mail.');
    isValid = false;
  } else if (!EMAIL_PATTERN.test(email)) {
    setFieldError(emailInput, 'Digite um e-mail válido.');
    isValid = false;
  }

  if (!password) {
    setFieldError(passwordInput, 'Informe sua senha.');
    isValid = false;
  } else if (password.length < 6) {
    setFieldError(passwordInput, 'A senha deve ter pelo menos 6 caracteres.');
    isValid = false;
  }
  return isValid;
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.classList.toggle('is-loading', isLoading);
  loginButton.setAttribute('aria-busy', String(isLoading));
  emailInput.readOnly = isLoading;
  passwordInput.readOnly = isLoading;
}

async function loadContext(userId) {
  const [profileResponse, onboardingResponse] = await Promise.all([
    client.from('profiles')
      .select('id, preferred_name, email, access_status, profile_status')
      .eq('id', userId)
      .maybeSingle(),
    client.from('adventurer_onboarding')
      .select('onboarding_status, assessment_status, healer_analysis_status, journey_status, analysis_started_at, journey_released_at')
      .eq('adventurer_id', userId)
      .maybeSingle()
  ]);

  if (profileResponse.error) throw profileResponse.error;
  if (onboardingResponse.error) throw onboardingResponse.error;
  return { profile: profileResponse.data, onboarding: onboardingResponse.data };
}

function resolveDestination({ profile, onboarding }) {
  if (!profile) return CONFIG.routes.registration;

  if (onboarding?.journey_status === 'released' || profile.profile_status === 'journey_released') {
    return CONFIG.routes.adventurerPanel;
  }

  if (
    onboarding?.assessment_status === 'completed' ||
    onboarding?.onboarding_status === 'assessment_completed' ||
    profile.profile_status === 'waiting_healer_analysis' ||
    onboarding?.healer_analysis_status === 'in_review'
  ) {
    return CONFIG.routes.waiting;
  }

  if (onboarding?.assessment_status === 'in_progress' || onboarding?.onboarding_status === 'assessment_started') {
    return CONFIG.routes.assessment;
  }

  if (
    onboarding?.onboarding_status === 'welcome' ||
    onboarding?.onboarding_status === 'assessment_pending' ||
    onboarding?.assessment_status === 'not_started'
  ) {
    return CONFIG.routes.welcome;
  }

  if (profile.access_status === 'journey_selection_pending') {
    return CONFIG.routes.journeySelection;
  }

  return CONFIG.routes.journeySelection;
}

function authErrorMessage(error) {
  const text = String(error?.message || '').toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar na Guilda.';
  if (text.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  if (!navigator.onLine) return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  return 'Não foi possível entrar. Tente novamente.';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateCredentials() || !client) return;

  setLoading(true);
  showStatus('Validando seu acesso…', 'success');

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: emailInput.value.trim().toLowerCase(),
      password: passwordInput.value
    });
    if (error) throw error;

    const context = await loadContext(data.user.id);
    const destination = resolveDestination(context);
    localStorage.setItem('evolveQuestRememberPreference', String(rememberMeInput.checked));
    showStatus('Login concluído. Preparando sua jornada…', 'success');
    window.setTimeout(() => window.location.assign(destination), 500);
  } catch (error) {
    console.error('EVOLVE Login:', error);
    showStatus(authErrorMessage(error), 'error');
    setLoading(false);
  }
});

[emailInput, passwordInput].forEach((input) => {
  input.addEventListener('input', () => {
    setFieldError(input, '');
    clearStatus();
  });
});

togglePasswordButton.addEventListener('click', () => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  togglePasswordButton.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
  togglePasswordButton.setAttribute('aria-pressed', String(!isVisible));
  togglePasswordButton.querySelector('.eye-open').hidden = !isVisible;
  togglePasswordButton.querySelector('.eye-closed').hidden = isVisible;
});

function openRecoveryModal() {
  recoveryModal.hidden = false;
  document.body.style.overflow = 'hidden';
  recoveryForm.hidden = false;
  recoverySuccess.hidden = true;
  recoveryEmail.value = emailInput.value.trim();
  setFieldError(recoveryEmail, '');
  setTimeout(() => recoveryEmail.focus(), 0);
}

function closeRecoveryModal() {
  recoveryModal.hidden = true;
  document.body.style.overflow = '';
  document.querySelector('#forgotPasswordButton').focus();
}

document.querySelector('#forgotPasswordButton').addEventListener('click', openRecoveryModal);
document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeRecoveryModal));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !recoveryModal.hidden) closeRecoveryModal();
});

recoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!client) return;
  const email = recoveryEmail.value.trim().toLowerCase();
  setFieldError(recoveryEmail, '');
  if (!email) return setFieldError(recoveryEmail, 'Informe seu e-mail.');
  if (!EMAIL_PATTERN.test(email)) return setFieldError(recoveryEmail, 'Digite um e-mail válido.');

  const submitButton = recoveryForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando…';
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/`
    });
    if (error) throw error;
    recoveryForm.hidden = true;
    recoverySuccess.hidden = false;
  } catch (error) {
    console.error('EVOLVE Recovery:', error);
    setFieldError(recoveryEmail, 'Não foi possível enviar o link agora.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar link temporário';
  }
});


function getAuthUrlState() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return {
    confirmed: query.get('confirmed') === '1' || hash.get('type') === 'signup',
    error: hash.get('error') || query.get('error'),
    errorDescription:
      hash.get('error_description') ||
      query.get('error_description') ||
      ''
  };
}

async function routeAuthenticatedUser(userId) {
  const context = await loadContext(userId);
  const destination = resolveDestination(context);
  showStatus('E-mail confirmado. Preparando sua jornada…', 'success');
  window.setTimeout(() => window.location.assign(destination), 650);
}

async function initializeAuthenticationReturn() {
  if (!client) return;

  const authState = getAuthUrlState();

  if (authState.error) {
    showStatus(
      authState.errorDescription
        ? decodeURIComponent(authState.errorDescription.replace(/\+/g, ' '))
        : 'Não foi possível confirmar o e-mail. Solicite um novo acesso.',
      'error'
    );
    return;
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await routeAuthenticatedUser(data.session.user.id);
      return;
    }

    if (authState.confirmed) {
      showStatus('E-mail confirmado. Entre com sua senha para continuar.', 'success');
      history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (error) {
    console.error('EVOLVE Auth callback:', error);
    if (authState.confirmed) {
      showStatus('E-mail confirmado. Entre com sua senha para continuar.', 'success');
    }
  }
}

rememberMeInput.checked = localStorage.getItem('evolveQuestRememberPreference') === 'true';
document.querySelector('.brand')?.setAttribute('href', '/');
document.querySelector('.button--secondary')?.setAttribute('href', '/cadastro/');
initializeAuthenticationReturn();
