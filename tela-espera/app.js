import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.EVOLVE_CONFIG || {};
const routes = config.routes || {};
const refreshIntervalMs = clamp(Number(config.refreshIntervalMs) || 60000, 45000, 90000);

const elements = {
  greeting: document.querySelector("#greeting"),
  statusTitle: document.querySelector("#statusTitle"),
  statusMessage: document.querySelector("#statusMessage"),
  refreshButton: document.querySelector("#refreshButton"),
  refreshLabel: document.querySelector("#refreshButton .button-label"),
  logoutButton: document.querySelector("#logoutButton"),
  logoutTextButton: document.querySelector("#logoutTextButton"),
  toast: document.querySelector("#toast")
};

let supabase = null;
let currentUser = null;
let refreshTimer = null;
let toastTimer = null;
let isChecking = false;

const stageToRoute = {
  welcome: routes.welcome,
  assessment: routes.assessment,
  waiting_healer: routes.waiting_healer,
  dashboard: routes.dashboard,
  checkpoint: routes.checkpoint,
  feedback: routes.feedback,
  progression: routes.progression
};

init();

async function init() {
  bindEvents();

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    setConnectionError("Configure o Supabase no objeto EVOLVE_CONFIG antes de publicar.");
    elements.refreshButton.disabled = true;
    return;
  }

  supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.user) {
    handleExpiredSession();
    return;
  }

  currentUser = data.session.user;
  await checkJourneyStage({ manual: false, initial: true });
  startAutoRefresh();
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => checkJourneyStage({ manual: true }));
  elements.logoutButton.addEventListener("click", logout);
  elements.logoutTextButton.addEventListener("click", logout);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoRefresh();
    else {
      checkJourneyStage({ manual: false });
      startAutoRefresh();
    }
  });

  window.addEventListener("online", () => checkJourneyStage({ manual: false }));
}

async function checkJourneyStage({ manual = false, initial = false } = {}) {
  if (!supabase || !currentUser || isChecking) return;
  isChecking = true;
  setLoading(true);

  if (manual) {
    setStatus("Verificando sua Jornada...", "Estamos consultando o estado mais recente da sua liberação.");
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, preferred_name, full_name, account_status, journey_stage, profile_status")
      .eq("id", currentUser.id)
      .single();

    if (profileError) throw profileError;

    updateGreeting(profile);
    routeByStage(profile.journey_stage, { manual, initial });
  } catch (error) {
    console.error("EVOLVE Quest — falha ao consultar journey_stage:", error);
    setConnectionError("Não foi possível atualizar sua Jornada agora.");
    if (manual) showToast("Falha de conexão. Tente novamente em instantes.", true);
  } finally {
    setLoading(false);
    isChecking = false;
  }
}

function routeByStage(stage, { manual = false } = {}) {
  if (stage === "waiting_healer") {
    setStatus(
      "Análise do Healer em andamento",
      "Você será direcionado automaticamente ao Painel do Aventureiro assim que sua Jornada for liberada."
    );
    if (manual) showToast("Sua Jornada continua em preparação.");
    return;
  }

  if (stage === "dashboard") {
    setStatus("Sua Jornada foi liberada", "Abrindo o Painel do Aventureiro...");
    stopAutoRefresh();
    window.setTimeout(() => redirect(routes.dashboard), 650);
    return;
  }

  const targetRoute = stageToRoute[stage];
  if (targetRoute) {
    stopAutoRefresh();
    redirect(targetRoute);
    return;
  }

  setConnectionError("Não foi possível identificar a etapa atual da sua Jornada.");
}

function updateGreeting(profile) {
  const preferredName = sanitizeName(profile.preferred_name || profile.full_name || "");
  elements.greeting.textContent = preferredName ? `Avaliação recebida, ${preferredName}` : "Avaliação recebida";
}

async function logout() {
  stopAutoRefresh();
  setLoading(true);

  try {
    if (supabase) await supabase.auth.signOut();
  } catch (error) {
    console.error("EVOLVE Quest — falha ao encerrar sessão:", error);
  } finally {
    redirect(routes.login || "/login/");
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (document.hidden || !supabase || !currentUser) return;
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) checkJourneyStage({ manual: false });
  }, refreshIntervalMs);
}

function stopAutoRefresh() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = null;
}

function setLoading(loading) {
  elements.refreshButton.disabled = loading;
  elements.refreshButton.classList.toggle("is-loading", loading);
  elements.refreshLabel.textContent = loading ? "Verificando sua Jornada..." : "Atualizar minha Jornada";
}

function setStatus(title, message) {
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
}

function setConnectionError(message) {
  setStatus(message, "A página continua disponível. Verifique sua conexão e tente novamente.");
}

function handleExpiredSession() {
  setStatus("Sua sessão expirou", "Você será encaminhado ao Login para entrar novamente.");
  window.setTimeout(() => redirect(routes.login || "/login/"), 900);
}

function redirect(path) {
  window.location.assign(path || "/");
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function sanitizeName(value) {
  return String(value).trim().split(/\s+/)[0].slice(0, 40);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
