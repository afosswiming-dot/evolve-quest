'use strict';

const APP_CONFIG = Object.freeze({
  version: '1.0.1',
  supabase: {
    url: 'https://gtmngtweohixfeajljik.supabase.co',
    publishableKey: 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF'
  },
  storageKeys: {
    session: 'evolveQuest.supabase.session.v1',
    profileFallback: 'evolveQuest.profileFallback.v1',
    pendingJourney: 'evolveQuest.pendingJourney.v1'
  },
  routes: {
    registration: '/cadastro/',
    welcome: '/boas-vindas/'
  },
  paymentLinks: {
    monthly: 'https://invoice.infinitepay.io/plans/circular_brecho/3mewJM2Z7A',
    quarterly: 'https://invoice.infinitepay.io/plans/circular_brecho/hwaaRFzgpn',
    semiannual: 'https://invoice.infinitepay.io/plans/circular_brecho/ApC2ouFmbE',
    annual: 'https://invoice.infinitepay.io/plans/circular_brecho/dbaZj5RNnr'
  }
});

const PLANS = [
  { id:'monthly', name:'Jornada Mensal', price:147, months:1, duration:'1 mês', saving:0, recommended:false, cancellation:'Sem fidelidade além do ciclo mensal contratado.' },
  { id:'quarterly', name:'Jornada Trimestral', price:132, months:3, duration:'3 meses', saving:15, recommended:false, cancellation:'Cancelamento possível após o período mínimo de 3 meses.' },
  { id:'semiannual', name:'Jornada Semestral', price:124, months:6, duration:'6 meses', saving:23, recommended:true, cancellation:'Cancelamento possível após o período mínimo de 6 meses.' },
  { id:'annual', name:'Jornada Anual', price:116, months:12, duration:'12 meses', saving:31, recommended:false, cancellation:'Cancelamento possível após o período mínimo de 12 meses.' }
];

const state = {
  selectedPlan: null,
  paymentStatus: 'idle',
  adventurer: null
};

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}).format(value);
const dateBR = (date) => new Intl.DateTimeFormat('pt-BR').format(date);

const screens = {
  journey: $('#journeyScreen'),
  summary: $('#summaryScreen'),
  status: $('#statusScreen')
};

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function getStoredSession() {
  const session = readJSON(APP_CONFIG.storageKeys.session);
  if (!session?.accessToken || !session?.user?.id) return null;

  if (session.expiresAt && Number(session.expiresAt) * 1000 <= Date.now()) {
    localStorage.removeItem(APP_CONFIG.storageKeys.session);
    return null;
  }

  return session;
}

async function fetchProfile(session) {
  const response = await fetch(
    `${APP_CONFIG.supabase.url}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,preferred_name,email`,
    {
      headers: {
        apikey: APP_CONFIG.supabase.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`PROFILE_READ_FAILED_${response.status}`);
  }

  const rows = await response.json();
  if (!rows[0]) throw new Error('PROFILE_NOT_FOUND');
  return rows[0];
}

async function resolveAdventurer() {
  const session = getStoredSession();

  if (session) {
    try {
      const profile = await fetchProfile(session);
      state.adventurer = {
        id: profile.id,
        preferredName: profile.preferred_name,
        email: profile.email
      };
      return;
    } catch (error) {
      console.error('[EVOLVE Quest] Não foi possível ler o perfil autenticado.', error);
    }
  }

  // Contingência somente para prévia local do módulo.
  const fallback = readJSON(APP_CONFIG.storageKeys.profileFallback);
  if (window.location.protocol === 'file:' && fallback?.id && fallback?.email) {
    state.adventurer = {
      id: fallback.id,
      preferredName: fallback.preferredName,
      email: fallback.email
    };
    return;
  }

  state.adventurer = null;
}

function renderPlans(){
  $('#journeyGrid').innerHTML = PLANS.map(plan => `
    <article class="journey-card ${plan.recommended ? 'recommended' : ''}" data-plan="${plan.id}">
      ${plan.recommended ? '<span class="recommended-badge">RECOMENDADA</span>' : ''}
      <span class="plan-kicker">${plan.duration} de jornada</span>
      <h2>${plan.name}</h2>
      <div class="price"><strong>${money(plan.price)}</strong><span>/ mês</span></div>
      <span class="charge-pill">Cobrança recorrente mensal</span>
      <ul class="plan-details">
        <li><span>Duração mínima</span><strong>${plan.duration}</strong></li>
        <li><span>Economia mensal</span><strong class="${plan.saving ? 'saving' : ''}">${plan.saving ? money(plan.saving) : 'Plano base'}</strong></li>
        <li><span>Experiência</span><strong>Completa</strong></li>
      </ul>
      <button class="card-button" type="button" data-select-plan="${plan.id}">Escolher esta jornada</button>
    </article>`).join('');
}

function showScreen(name){
  Object.entries(screens).forEach(([key,el]) => {
    const active = key === name;
    el.hidden = !active;
    el.classList.toggle('is-active',active);
  });
  $('#backButton').hidden = name === 'journey' || name === 'status';
  window.scrollTo({top:0,behavior:'smooth'});
}

function selectPlan(planId){
  state.selectedPlan = PLANS.find(plan => plan.id === planId);
  if(!state.selectedPlan) return;
  const plan = state.selectedPlan;
  $('#summaryPlan').textContent = plan.name;
  $('#summaryPrice').textContent = `${money(plan.price)} por mês`;
  $('#summaryDuration').textContent = plan.duration;
  $('#summaryFirstCharge').textContent = dateBR(new Date());
  $('#summaryCancellation').textContent = plan.cancellation;
  $('#recurrenceConsent').checked = false;
  $('#paymentButton').disabled = true;
  showScreen('summary');
}

function setStatus(status){
  state.paymentStatus = status;
  const visual = $('#statusVisual');
  const action = $('#statusAction');
  const config = {
    processing:{eyebrow:'PAGAMENTO',title:'Abrindo ambiente de pagamento',message:'Você será direcionado ao ambiente seguro do gateway de pagamento.',className:'processing'},
    approved:{eyebrow:'JORNADA CONFIRMADA',title:'Pagamento aprovado',message:'Sua jornada foi confirmada.',className:'approved',action:'Ir para boas-vindas'},
    declined:{eyebrow:'NÃO FOI POSSÍVEL CONCLUIR',title:'Pagamento indisponível',message:'O link desta jornada ainda não foi configurado.',className:'declined',action:'Voltar ao resumo'},
    cancelled:{eyebrow:'PAGAMENTO CANCELADO',title:'Pagamento cancelado',message:'Nenhuma cobrança foi realizada. Sua jornada permanece disponível para nova tentativa.',className:'cancelled',action:'Tentar pagamento novamente'}
  }[status];

  visual.className = `status-visual ${config.className}`;
  $('#statusEyebrow').textContent = config.eyebrow;
  $('#statusTitle').textContent = config.title;
  $('#statusMessage').textContent = config.message;
  action.hidden = !config.action;
  action.textContent = config.action || '';
  showScreen('status');
}

function buildCheckoutUrl(baseUrl, plan) {
  const url = new URL(baseUrl);
  url.searchParams.set('plan_id', plan.id);
  url.searchParams.set('adventurer_id', state.adventurer.id);
  url.searchParams.set('email', state.adventurer.email);
  return url.toString();
}

function persistPendingJourney(plan) {
  sessionStorage.setItem(APP_CONFIG.storageKeys.pendingJourney, JSON.stringify({
    adventurerId: state.adventurer.id,
    preferredName: state.adventurer.preferredName,
    email: state.adventurer.email,
    planId: plan.id,
    planName: plan.name,
    monthlyAmount: plan.price,
    minimumMonths: plan.months,
    createdAt: new Date().toISOString()
  }));
}

async function startPayment(){
  if(!state.selectedPlan || !$('#recurrenceConsent').checked) return;

  if (!state.adventurer) {
    alert('Sua sessão não foi encontrada. Retorne ao Cadastro e acesse novamente.');
    if (window.location.protocol !== 'file:') window.location.assign(APP_CONFIG.routes.registration);
    return;
  }

  const paymentLink = APP_CONFIG.paymentLinks[state.selectedPlan.id];
  if (!paymentLink) {
    setStatus('declined');
    return;
  }

  persistPendingJourney(state.selectedPlan);
  setStatus('processing');
  window.location.assign(buildCheckoutUrl(paymentLink, state.selectedPlan));
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment_status');

  if (status === 'approved') setStatus('approved');
  else if (status === 'declined') setStatus('declined');
  else if (status === 'cancelled') setStatus('cancelled');
}

$('#journeyGrid').addEventListener('click',(event)=>{
  const button = event.target.closest('[data-select-plan]');
  if(button) selectPlan(button.dataset.selectPlan);
});
$('#recurrenceConsent').addEventListener('change',(event)=>{$('#paymentButton').disabled=!event.target.checked;});
$('#paymentButton').addEventListener('click',startPayment);
$('#changePlanButton').addEventListener('click',()=>showScreen('journey'));
$('#backButton').addEventListener('click',()=>showScreen('journey'));
$('#statusAction').addEventListener('click',()=>{
  if(state.paymentStatus==='approved'){
    if (window.location.protocol === 'file:') {
      alert(`Destino preparado: ${APP_CONFIG.routes.welcome}`);
      return;
    }
    window.location.assign(APP_CONFIG.routes.welcome);
    return;
  }
  showScreen('summary');
});

async function init() {
  renderPlans();
  await resolveAdventurer();
  handlePaymentReturn();
}

init();
