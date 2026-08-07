/*
 * EVOLVE Quest — Login do Healer v0.1
 * Integração oficial com Supabase.
 */
const SUPABASE_URL = 'https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const DASHBOARD_ROUTE = '/healer/painel/';
const PASSWORD_REDIRECT_ROUTE = `${window.location.origin}/healer/login/`;

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);

const elements = {
  form: document.querySelector('#login-form'),
  email: document.querySelector('#email'),
  password: document.querySelector('#password'),
  remember: document.querySelector('#remember'),
  submit: document.querySelector('#submit-button'),
  status: document.querySelector('#status'),
  togglePassword: document.querySelector('#toggle-password'),
  forgotPassword: document.querySelector('#forgot-password'),
  dialog: document.querySelector('#recovery-dialog'),
  closeModal: document.querySelector('#close-modal'),
  recoveryForm: document.querySelector('#recovery-form'),
  recoveryEmail: document.querySelector('#recovery-email'),
  recoveryButton: document.querySelector('#recovery-button'),
  recoveryStatus: document.querySelector('#recovery-status')
};

function setStatus(target, message = '', type = 'info') {
  target.textContent = message;
  target.dataset.type = type;
  target.hidden = !message;
}

function setLoading(button, active) {
  button.disabled = active;
  button.classList.toggle('is-loading', active);
  button.setAttribute('aria-busy', String(active));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAuthError(error) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de acessar o Painel.';
  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Não foi possível conectar ao sistema. Verifique sua internet e tente novamente.';
  }
  return 'Não foi possível validar seu acesso. Tente novamente.';
}

async function signOutSafely() {
  try { await supabaseClient.auth.signOut(); } catch (error) {
    console.error('Falha ao encerrar sessão:', error);
  }
}

async function validateAdministrativeAccess(userId) {
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('id,email,full_name,preferred_name,role,account_status,updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    await signOutSafely();
    return { allowed: false, message: 'Não foi possível validar sua autorização administrativa.' };
  }

  if (!['healer', 'admin'].includes(profile.role)) {
    await signOutSafely();
    return { allowed: false, message: 'Este acesso é exclusivo para Healers autorizados.' };
  }

  if (profile.account_status !== 'active') {
    await signOutSafely();
    return { allowed: false, message: 'Seu acesso administrativo está temporariamente indisponível.' };
  }

  return { allowed: true, profile };
}

async function redirectAuthorizedUser(userId) {
  const authorization = await validateAdministrativeAccess(userId);

  if (!authorization.allowed) {
    setStatus(elements.status, authorization.message, 'error');
    return false;
  }

  setStatus(elements.status, 'Acesso autorizado. Preparando seu Painel...', 'success');
  window.setTimeout(() => window.location.assign(DASHBOARD_ROUTE), 550);
  return true;
}

async function handleLogin(event) {
  event.preventDefault();
  setStatus(elements.status);

  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value;

  if (!email || !password) {
    setStatus(elements.status, 'Preencha seu e-mail e sua senha.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    setStatus(elements.status, 'Informe um e-mail válido.', 'error');
    elements.email.focus();
    return;
  }

  setLoading(elements.submit, true);
  setStatus(elements.status, 'Validando acesso administrativo...', 'info');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session?.user?.id) throw new Error('Sessão administrativa inválida.');

    localStorage.setItem(
      'evolveHealerRememberPreference',
      String(Boolean(elements.remember?.checked))
    );

    await redirectAuthorizedUser(data.session.user.id);
  } catch (error) {
    console.error('Erro de autenticação:', error);
    await signOutSafely();
    setStatus(elements.status, normalizeAuthError(error), 'error');
  } finally {
    setLoading(elements.submit, false);
  }
}

async function handleRecovery(event) {
  event.preventDefault();
  setStatus(elements.recoveryStatus);

  const email = elements.recoveryEmail.value.trim().toLowerCase();

  if (!isValidEmail(email)) {
    setStatus(elements.recoveryStatus, 'Informe um e-mail válido.', 'error');
    elements.recoveryEmail.focus();
    return;
  }

  setLoading(elements.recoveryButton, true);

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_REDIRECT_ROUTE
    });

    if (error) throw error;

    setStatus(
      elements.recoveryStatus,
      'Se existir uma conta autorizada para este e-mail, enviaremos as instruções de recuperação.',
      'success'
    );
  } catch (error) {
    console.error('Erro na recuperação:', error);
    setStatus(
      elements.recoveryStatus,
      'Não foi possível enviar as instruções agora. Tente novamente.',
      'error'
    );
  } finally {
    setLoading(elements.recoveryButton, false);
  }
}

async function validateExistingSession() {
  setStatus(elements.status, 'Validando acesso administrativo...', 'info');

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    const userId = data?.session?.user?.id;

    if (!userId) {
      setStatus(elements.status);
      return;
    }

    await redirectAuthorizedUser(userId);
  } catch (error) {
    console.error('Erro ao validar sessão existente:', error);
    await signOutSafely();
    setStatus(elements.status, 'Não foi possível validar a sessão existente.', 'error');
  }
}

function initializeInterface() {
  elements.form.addEventListener('submit', handleLogin);
  elements.recoveryForm.addEventListener('submit', handleRecovery);

  elements.togglePassword.addEventListener('click', () => {
    const show = elements.password.type === 'password';
    elements.password.type = show ? 'text' : 'password';
    elements.togglePassword.setAttribute('aria-pressed', String(show));
    elements.togglePassword.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });

  elements.forgotPassword.addEventListener('click', () => {
    elements.recoveryEmail.value = elements.email.value.trim();
    setStatus(elements.recoveryStatus);
    elements.dialog.showModal();
    window.setTimeout(() => elements.recoveryEmail.focus(), 50);
  });

  elements.closeModal.addEventListener('click', () => elements.dialog.close());

  elements.dialog.addEventListener('click', (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  if (elements.remember) {
    elements.remember.checked =
      localStorage.getItem('evolveHealerRememberPreference') === 'true';
  }
}

initializeInterface();
validateExistingSession();
