"use strict";

const db = window.supabase.createClient(
  "https://gtmngtweohixfeajljik.supabase.co",
  "sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: localStorage,
      storageKey: "evolve-quest-healer-auth"
    }
  }
);

const $ = s => document.querySelector(s);

const esc = v =>
  String(v ?? "").replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]
  );

const STAGES = {
  new: "Novo lead",
  contacted: "Contatado",
  payment_sent: "Pagamento enviado",
  negotiation: "Negociação",
  customer: "Aventureiro ativo",
  not_interested: "Sem interesse"
};

const ACTIVE_STAGES = [
  "dashboard",
  "checkpoint",
  "feedback",
  "progression"
];

let rows = [];
let profiles = new Map();

function wa(phone) {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";

  if ((n.length === 10 || n.length === 11) && !n.startsWith("55")) {
    n = "55" + n;
  }

  return `https://wa.me/${n}`;
}

function dateInput(v) {
  if (!v) return "";

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toISOString().slice(0, 10);
}

function isActiveProfile(p) {
  return Boolean(
    p &&
      p.accountStatus === "active" &&
      ACTIVE_STAGES.includes(p.journeyStage)
  );
}

async function authorize() {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) {
    location.href = "/healer/login/";
    return false;
  }

  const { data: p, error } = await db
    .from("profiles")
    .select("role,account_status")
    .eq("id", session.user.id)
    .maybeSingle();

  if (
    error ||
    !p ||
    !["healer", "admin"].includes(p.role) ||
    p.account_status !== "active"
  ) {
    location.href = "/healer/login/";
    return false;
  }

  return true;
}

async function loadHealerProfiles() {
  const { data, error } = await db.rpc("get_healer_adventurers_v2", {
    p_search: null,
    p_stage: null,
    p_status: null,
    p_class_id: null,
    p_level: null,
    p_has_alert: null,
    p_page: 1,
    p_page_size: 500,
    p_order: "priority_desc"
  });

  if (error) {
    console.error("[EVOLVE CRM] Erro ao buscar nomes:", error);
    return [];
  }

  return Array.isArray(data?.items) ? data.items : [];
}

async function load() {
  if (!(await authorize())) return;

  $("#status").textContent = "Carregando CRM...";

  const [{ data: crm, error: crmError }, healerProfiles] = await Promise.all([
    db.from("adventurer_crm").select("*"),
    loadHealerProfiles()
  ]);

  if (crmError) {
    console.error("[EVOLVE CRM]", crmError);
    $("#status").textContent = "Não foi possível carregar o CRM.";
    return;
  }

  profiles = new Map(
    healerProfiles.map(p => [
      String(p.id),
      {
        id: p.id,
        displayName: p.displayName || "",
        fullName: p.fullName || "",
        journeyStage: p.journeyStage || "",
        accountStatus: p.accountStatus || "",
        className: p.className || "",
        currentLevel: p.currentLevel ?? null,
        chapterTitle: p.chapterTitle || ""
      }
    ])
  );

  const crmRows = crm || [];
  const crmMap = new Map(
    crmRows.map(r => [String(r.adventurer_id), r])
  );

  const ids = new Set([
    ...crmRows.map(r => String(r.adventurer_id)),
    ...healerProfiles.map(p => String(p.id))
  ]);

  rows = [...ids].map(id => {
    const p = profiles.get(id);
    const c = crmMap.get(id);
    const active = isActiveProfile(p);

    return {
      adventurer_id: id,
      pipeline_stage: active ? "customer" : c?.pipeline_stage || "new",
      next_follow_up_at: c?.next_follow_up_at || null,
      notes: c?.notes || "",
      created_at: c?.created_at || null,
      isActive: active,
      last_contact_at: c?.last_contact_at || null,
      payment_options_sent_at: c?.payment_options_sent_at || null,
      payment_status: c?.payment_status || null
    };
  });

  $("#status").textContent = `${rows.length} contatos no CRM`;

  metrics();
  render();
}

function metrics() {
  const now = new Date();

  $("#mAll").textContent = rows.length;

  $("#mNew").textContent = rows.filter(
    r => !r.isActive && r.pipeline_stage === "new"
  ).length;

  $("#mContacted").textContent = rows.filter(
    r => !r.isActive && r.pipeline_stage === "contacted"
  ).length;

  $("#mNegotiation").textContent = rows.filter(
    r =>
      !r.isActive &&
      ["payment_sent", "negotiation"].includes(r.pipeline_stage)
  ).length;

  $("#mActive").textContent = rows.filter(r => r.isActive).length;

  $("#mOverdue").textContent = rows.filter(
    r =>
      r.next_follow_up_at &&
      !r.isActive &&
      new Date(r.next_follow_up_at) < now
  ).length;
}

function opts(cur) {
  return Object.entries(STAGES)
    .map(
      ([v, l]) =>
        `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`
    )
    .join("");
}

function render() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const type = $("#typeFilter").value;
  const stage = $("#stageFilter").value;

  const filtered = rows
    .filter(r => {
      const p = profiles.get(String(r.adventurer_id)) || {};

      const searchable = `
        ${p.displayName || ""}
        ${p.fullName || ""}
        ${p.className || ""}
        ${p.chapterTitle || ""}
      `.toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (type === "lead" && r.isActive) return false;
      if (type === "active" && !r.isActive) return false;
      if (stage && r.pipeline_stage !== stage) return false;

      return true;
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? 1 : -1;
      }

      const pa = profiles.get(String(a.adventurer_id)) || {};
      const pb = profiles.get(String(b.adventurer_id)) || {};

      return String(pa.displayName || pa.fullName || "").localeCompare(
        String(pb.displayName || pb.fullName || ""),
        "pt-BR"
      );
    });

  if (!filtered.length) {
    $("#crmList").innerHTML =
      '<div class="empty">Nenhum contato encontrado.</div>';
    return;
  }

  $("#crmList").innerHTML = filtered.map(card).join("");

  document.querySelectorAll("[data-save]").forEach(
    b => (b.onclick = () => save(b.dataset.save))
  );
}

function card(r) {
  const p = profiles.get(String(r.adventurer_id)) || {};

  const name =
    p.displayName ||
    p.fullName ||
    "Nome não disponível";

  const secondaryName =
    p.fullName &&
    p.displayName &&
    p.fullName !== p.displayName
      ? p.fullName
      : "";

  const overdue =
    r.next_follow_up_at &&
    !r.isActive &&
    new Date(r.next_follow_up_at) < new Date();

  return `
    <article class="crm-card" data-card="${esc(r.adventurer_id)}">

      <div class="person">

        <div class="avatar">
          ${esc(name.slice(0, 2).toUpperCase())}
        </div>

        <div>

          <h3>${esc(name)}</h3>

          ${
            secondaryName
              ? `<p>${esc(secondaryName)}</p>`
              : ""
          }

          <div class="badges">

            <span class="badge ${r.isActive ? "active" : ""}">
              ${r.isActive ? "AVENTUREIRO ATIVO" : "LEAD"}
            </span>

            ${
              overdue
                ? '<span class="badge overdue">FOLLOW-UP VENCIDO</span>'
                : ""
            }

            ${
              p.currentLevel
                ? `<span class="badge">NÍVEL ${esc(p.currentLevel)}</span>`
                : ""
            }

            ${
              p.className
                ? `<span class="badge">${esc(p.className)}</span>`
                : ""
            }

          </div>

        </div>

      </div>

      <div class="crm-grid">

        <div class="field">

          <label>Etapa comercial</label>

          <select
            data-field="pipeline_stage"
            ${r.isActive ? "disabled" : ""}
          >
            ${opts(r.pipeline_stage)}
          </select>

        </div>

        <div class="field">

          <label>Próximo follow-up</label>

          <input
            type="date"
            data-field="next_follow_up_at"
            value="${dateInput(r.next_follow_up_at)}"
          >

        </div>

        <div class="field">

          <label>Observação comercial</label>

          <textarea
            data-field="notes"
            placeholder="Ex.: enviei mensal e trimestral"
          >${esc(r.notes)}</textarea>

          <div class="save-state" data-state></div>

        </div>

        <div class="actions">

          <button
            class="btn primary"
            data-save="${esc(r.adventurer_id)}"
            type="button"
          >
            Salvar
          </button>

        </div>

      </div>

    </article>
  `;
}

async function save(id) {
  const card = document.querySelector(
    `[data-card="${CSS.escape(id)}"]`
  );

  const r = rows.find(
    x => String(x.adventurer_id) === String(id)
  );

  if (!card || !r) return;

  const stage = r.isActive
    ? "customer"
    : card.querySelector('[data-field="pipeline_stage"]').value;

  const follow = card.querySelector(
    '[data-field="next_follow_up_at"]'
  ).value;

  const notes = card
    .querySelector('[data-field="notes"]')
    .value.trim();

  const state = card.querySelector("[data-state]");

  const now = new Date().toISOString();

  state.textContent = "Salvando...";
  state.className = "save-state";

  const {
    data: { session }
  } = await db.auth.getSession();

  const payload = {
    adventurer_id: id,
    pipeline_stage: stage,
    next_follow_up_at: follow
      ? new Date(`${follow}T12:00:00`).toISOString()
      : null,
    notes: notes || null,
    updated_at: now,
    updated_by: session?.user?.id || null
  };

  if (stage === "contacted" && !r.last_contact_at) {
    payload.last_contact_at = now;
  }

  if (stage === "payment_sent") {
    payload.payment_status = "sent";
    payload.payment_options_sent_at =
      r.payment_options_sent_at || now;
    payload.last_contact_at = now;
  }

  if (stage === "customer") {
    payload.payment_status = "paid";
  }

  const { error } = await db
    .from("adventurer_crm")
    .upsert(payload, {
      onConflict: "adventurer_id"
    });

  if (error) {
    console.error("[EVOLVE CRM]", error);
    state.textContent = "Erro ao salvar";
    state.className = "save-state error";
    return;
  }

  Object.assign(r, payload);

  state.textContent = "Salvo";
  state.className = "save-state ok";

  metrics();

  setTimeout(() => {
    state.textContent = "";
  }, 1500);
}

$("#refreshBtn").onclick = load;
$("#searchInput").oninput = render;
$("#typeFilter").onchange = render;
$("#stageFilter").onchange = render;

load();
