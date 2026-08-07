'use strict';

const APP_CONFIG = Object.freeze({
  version: '1.2.1',
  supabase: {
    url: 'https://gtmngtweohixfeajljik.supabase.co',
    publishableKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF'
  },
  storageKeys: {
    profileFallback: 'evolveQuest.profileFallback.v1',
    session: 'evolveQuest.supabase.session.v1'
  },
  routes: {
    login: '/login/'
  },
  autoRedirectDelay: 1500
});

const form = document.querySelector('#cadastro-form');
const submitButton = document.querySelector('#submit-button');
const statusBanner = document.querySelector('#status-banner');
const phoneInput = document.querySelector('#phone');
const birthDateInput = document.querySelector('#birthDate');
const legalDialog = document.querySelector('#legal-dialog');
const legalTitle = document.querySelector('#legal-title');
const legalContent = document.querySelector('#legal-content');

const fields = {
  fullName: document.querySelector('#fullName'),
  preferredName: document.querySelector('#preferredName'),
  email: document.querySelector('#email'),
  phone: phoneInput,
  birthDate: birthDateInput,
  password: document.querySelector('#password'),
  confirmPassword: document.querySelector('#confirmPassword'),
  terms: document.querySelector('#terms')
};

const errorMessages = {
  required: 'Este campo é obrigatório.',
  fullName: 'Informe seu nome completo.',
  email: 'Informe um e-mail válido.',
  phone: 'Informe um WhatsApp válido com DDD.',
  birthDate: 'Informe uma data de nascimento válida.',
  futureBirthDate: 'A data de nascimento não pode estar no futuro.',
  password: 'Sua senha deve ter no mínimo 8 caracteres.',
  confirmation: 'As senhas não coincidem.',
  terms: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.'
};

const legalCopy = {
  terms: {
    title: 'Termos de Uso',
    html: '<p><strong>Conteúdo provisório.</strong> O documento jurídico oficial deverá ser inserido antes da publicação do módulo.</p><p>Esta janela já está preparada para receber o texto definitivo sem alterar a estrutura do cadastro.</p>'
  },
  privacy: {
    title: 'Política de Privacidade',
    html: '<p><strong>Conteúdo provisório.</strong> A Política de Privacidade oficial deverá informar finalidade, base legal, armazenamento e direitos do titular antes da publicação.</p><p>Não publique este módulo com textos jurídicos provisórios.</p>'
  }
};

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

function formatBrazilianPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function isValidPhone(value) {
  const digits = onlyDigits(value);
  return /^(?:[1-9]{2})(?:9\d{8}|[2-8]\d{7})$/.test(digits);
}

function isValidDate(value) {
  if (!value) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime());
}

function setFieldError(name, message = '') {
  const field = fields[name];
  const error = document.querySelector(`#${name}-error`);
  if (!field || !error) return;
  error.textContent = message;
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) field.setAttribute('aria-describedby', `${name}-error`);
  else field.removeAttribute('aria-describedby');
}

function validateField(name) {
  const field = fields[name];
  const value = field.type === 'checkbox' ? field.checked : field.value.trim();
  let message = '';

  switch (name) {
    case 'fullName':
      if (!value) message = errorMessages.required;
      else if (value.split(/\s+/).filter(Boolean).length < 2) message = errorMessages.fullName;
      break;
    case 'preferredName':
      if (!value) message = errorMessages.required;
      break;
    case 'email':
      if (!value) message = errorMessages.required;
      else if (!isValidEmail(value)) message = errorMessages.email;
      break;
    case 'phone':
      if (!value) message = errorMessages.required;
      else if (!isValidPhone(value)) message = errorMessages.phone;
      break;
    case 'birthDate':
      if (!value) message = errorMessages.required;
      else if (!isValidDate(value)) message = errorMessages.birthDate;
      else if (new Date(`${value}T12:00:00`) > new Date()) message = errorMessages.futureBirthDate;
      break;
    case 'password':
      if (!value) message = errorMessages.required;
      else if (value.length < 8) message = errorMessages.password;
      break;
    case 'confirmPassword':
      if (!value) message = errorMessages.required;
      else if (value !== fields.password.value) message = errorMessages.confirmation;
      break;
    case 'terms':
      if (!value) message = errorMessages.terms;
      break;
  }

  setFieldError(name, message);
  return !message;
}

function validateForm() {
  return Object.keys(fields).map(validateField).every(Boolean);
}

function showStatus(state, message) {
  statusBanner.hidden = false;
  statusBanner.dataset.state = state;
  statusBanner.textContent = message;
  statusBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearStatus() {
  statusBanner.hidden = true;
  statusBanner.textContent = '';
  delete statusBanner.dataset.state;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle('is-loading', isLoading);
  submitButton.setAttribute('aria-busy', String(isLoading));
}

function getPayload() {
  return {
    fullName: fields.fullName.value.trim().replace(/\s+/g, ' '),
    preferredName: fields.preferredName.value.trim(),
    email: normalizeEmail(fields.email.value),
    phone: onlyDigits(fields.phone.value),
    birthDate: fields.birthDate.value,
    password: fields.password.value,
    acceptedTerms: fields.terms.checked,
    acceptedTermsAt: new Date().toISOString()
  };
}

async function signUpAventureiro(payload) {
  const redirectUrl = `${window.location.origin}${APP_CONFIG.routes.login}?confirmed=1`;
  const signupEndpoint = new URL(`${APP_CONFIG.supabase.url}/auth/v1/signup`);
  signupEndpoint.searchParams.set('redirect_to', redirectUrl);

  const response = await fetch(signupEndpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: APP_CONFIG.supabase.publishableKey,
      Authorization: `Bearer ${APP_CONFIG.supabase.publishableKey}`
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      data: {
        full_name: payload.fullName,
        preferred_name: payload.preferredName,
        phone: payload.phone,
        birth_date: payload.birthDate,
        terms_accepted: payload.acceptedTerms,
        terms_accepted_at: payload.acceptedTermsAt
      }
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.msg || result.message || 'SIGNUP_FAILED');
    error.status = response.status;
    error.code = result.error_code || result.code || 'SIGNUP_FAILED';
    throw error;
  }

  return result;
}

function persistAuthenticatedSession(result) {
  if (!result?.access_token || !result?.user) return false;

  localStorage.setItem(APP_CONFIG.storageKeys.session, JSON.stringify({
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: result.expires_at,
    tokenType: result.token_type,
    user: {
      id: result.user.id,
      email: result.user.email
    },
    accessStatus: 'journey_selection_pending',
    createdAt: new Date().toISOString()
  }));

  return true;
}

function persistProfileFallback(payload, userId) {
  localStorage.setItem(APP_CONFIG.storageKeys.profileFallback, JSON.stringify({
    id: userId,
    fullName: payload.fullName,
    preferredName: payload.preferredName,
    email: payload.email,
    phone: payload.phone,
    birthDate: payload.birthDate,
    role: 'adventurer',
    accessStatus: 'journey_selection_pending',
    createdAt: new Date().toISOString()
  }));
}

function navigateToLogin() {
  const target = APP_CONFIG.routes.login;
  if (window.location.protocol === 'file:') {
    showStatus('success', `Acesso criado. Destino preparado: ${target}`);
    return;
  }
  window.location.assign(target);
}

function isDuplicateEmailError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 422 || message.includes('already registered') || message.includes('already been registered') || message.includes('user already registered');
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  if (!validateForm()) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    showStatus('error', 'Revise os campos destacados antes de continuar.');
    return;
  }

  setLoading(true);
  const payload = getPayload();

  try {
    const result = await signUpAventureiro(payload);
    persistProfileFallback(payload, result.user?.id || null);
    const authenticated = persistAuthenticatedSession(result);

    form.reset();

    if (authenticated) {
      showStatus('success', 'Acesso criado. Entre com sua conta para continuar.');
      window.setTimeout(navigateToLogin, APP_CONFIG.autoRedirectDelay);
    } else {
      showStatus('success', 'Acesso criado. Confirme seu e-mail para entrar na Guilda e continuar sua jornada.');
    }
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      setFieldError('email', 'Este e-mail já faz parte da Guilda.');
      fields.email.focus();
      showStatus('error', 'E-mail já cadastrado. Entre com sua conta ou utilize outro e-mail.');
    } else if (!navigator.onLine) {
      showStatus('error', 'Sem conexão com a internet. Verifique sua rede e tente novamente.');
    } else {
      showStatus('error', 'Não foi possível criar seu acesso. Tente novamente.');
      console.error('EVOLVE Cadastro:', error);
    }
  } finally {
    setLoading(false);
  }
}

function configureBirthDateLimit() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  birthDateInput.max = `${yyyy}-${mm}-${dd}`;
}

phoneInput.addEventListener('input', event => {
  event.target.value = formatBrazilianPhone(event.target.value);
});

Object.entries(fields).forEach(([name, field]) => {
  const eventName = field.type === 'checkbox' ? 'change' : 'blur';
  field.addEventListener(eventName, () => validateField(name));
  if (name === 'confirmPassword') {
    fields.password.addEventListener('input', () => {
      if (fields.confirmPassword.value) validateField('confirmPassword');
    });
  }
});

document.querySelectorAll('.visibility-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.querySelector(`#${button.dataset.target}`);
    const shouldShow = input.type === 'password';
    input.type = shouldShow ? 'text' : 'password';
    button.textContent = shouldShow ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(shouldShow));
    button.setAttribute('aria-label', `${shouldShow ? 'Ocultar' : 'Mostrar'} senha`);
  });
});

document.querySelectorAll('[data-legal]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const documentType = link.dataset.legal;
    legalTitle.textContent = legalCopy[documentType].title;
    legalContent.innerHTML = legalCopy[documentType].html;
    legalDialog.showModal();
  });
});

document.querySelector('#close-dialog').addEventListener('click', () => legalDialog.close());
legalDialog.addEventListener('click', event => {
  if (event.target === legalDialog) legalDialog.close();
});

form.addEventListener('submit', handleSubmit);
configureBirthDateLimit();
