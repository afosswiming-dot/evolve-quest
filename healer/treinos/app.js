'use strict';

const db = window.HealerUI.client(
  'https://gtmngtweohixfeajljik.supabase.co',
  'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: localStorage,
      storageKey: 'evolve-quest-healer-auth'
    }
  }
);

const $ = s => document.querySelector(s);

const esc = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
  );

let board = [];
let current = null;
let currentMissionId = null;
let composition = [];
let library = [];
let templates = [];
let editorRevision = 0;
let saving = false;
let loadingMission = false;
let pendingSaveRequest = null;

function newSaveRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


/* =========================================================
   AUTENTICAÇÃO
========================================================= */

async function auth() {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) {
    location.href = '/healer/login/';
    return false;
  }

  const { data: p } = await db
    .from('profiles')
    .select('role,account_status')
    .eq('id', session.user.id)
    .maybeSingle();

  if (
    !p ||
    !['healer', 'admin'].includes(p.role) ||
    p.account_status !== 'active'
  ) {
    location.href = '/healer/login/';
    return false;
  }

  return true;
}


/* =========================================================
   CARREGAR PAINEL
========================================================= */

async function load() {
  if (!(await auth())) return;

  $('#status').textContent = 'Carregando Aventureiros...';

  const { data, error } = await db.rpc('get_healer_training_board');

  if (error) {
    console.error(error);
    $('#status').textContent = 'Erro ao carregar.';
    return;
  }

  board = data?.adventurers || [];

  $('#status').textContent = `${board.length} Aventureiros ativos`;

  render();
}


/* =========================================================
   RENDERIZAR AVENTUREIROS E TREINOS
========================================================= */

function render() {
  const focusedId = new URLSearchParams(location.search).get('adventurer_id');
  const q = $('#searchInput').value.toLowerCase();
  const f = $('#statusFilter').value;

  const items = board.filter(a => {
    const n = (a.preferredName || a.fullName || '').toLowerCase();

    return (
      (!focusedId || String(a.id) === focusedId) &&
      (!q || n.includes(q)) &&
      (!f ||
        (f === 'with'
          ? (a.missions || []).length
          : !(a.missions || []).length))
    );
  });

  $('#adventurerGrid').innerHTML = items.length
    ? items
        .map(
          a => `
    <article class="card">

      <div class="card-head">

        <div class="who">

          <div class="avatar">
            ${esc(
              (a.preferredName || a.fullName || 'A')
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>

          <div>
            <h3>${esc(a.preferredName || a.fullName)}</h3>
            <p>${esc(a.email || '')}</p>
          </div>

        </div>

        <button
          class="btn primary"
          data-new="${a.id}"
        >
          + Nova Missão
        </button>

      </div>


      <div class="tags">

        <span class="tag">
          Nível ${esc(a.currentLevel || '—')}
        </span>

        <span class="tag">
          ${esc(a.chapterTitle || 'Sem capítulo')}
        </span>

        <span class="tag">
          ${esc(a.prescribedFrequency || '—')}x/semana
        </span>

        <span class="tag">
          ${(a.missions || []).length} Missões
        </span>

      </div>


      <div class="missions">

        ${
          (a.missions || []).length
            ? (a.missions || [])
                .map(
                  m => `

          <div class="mission">

            <div>

              <strong>
                ${esc((m.code || '').toUpperCase())}
                ·
                ${esc(m.name || 'Missão')}
              </strong>

              <span>
                ${esc(m.subtitle || '')}
                ·
                ${m.environment === 'home' ? 'Casa' : 'Academia'}
                ·
                ${esc(m.exerciseCount || 0)} exercícios
              </span>

            </div>


            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                align-items:center;
              "
            >

              <button
                class="btn secondary"
                data-edit="${a.id}:${m.missionId}"
              >
                Editar / Personalizar
              </button>


              <button
                class="btn secondary"
                data-delete="${a.id}:${m.missionId}"
                data-name="${esc(m.name || 'Missão')}"
              >
                Excluir
              </button>

            </div>

          </div>

        `
                )
                .join('')
            : '<div class="empty">Nenhuma Missão atribuída.</div>'
        }

      </div>

    </article>
  `
        )
        .join('')
    : '<div class="empty">Nenhum Aventureiro encontrado.</div>';


  /* NOVO TREINO */

  document.querySelectorAll('[data-new]').forEach(b => {
    b.onclick = () => openNew(b.dataset.new);
  });


  /* EDITAR TREINO */

  document.querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () => {
      const [a, m] = b.dataset.edit.split(':');
      openEdit(a, m);
    };
  });


  /* EXCLUIR TREINO */

  document.querySelectorAll('[data-delete]').forEach(b => {
    b.onclick = async () => {
      const [adventurerId, missionId] =
        b.dataset.delete.split(':');

      const missionName =
        b.dataset.name || 'Missão';

      const confirmed = await HealerUI.confirm(
        `Excluir "${missionName}"?\n\n` +
        `Essa ação removerá esta Missão da prescrição do Aventureiro.\n\n` +
        `Deseja continuar?`
      );

      if (!confirmed) return;

      const originalText = b.textContent;

      b.disabled = true;
      b.textContent = 'Excluindo...';

      try {
        const { data, error } = await db.rpc(
          'delete_personalized_mission',
          {
            p_adventurer_id: adventurerId,
            p_mission_id: missionId
          }
        );

        if (error) {
          throw error;
        }

        HealerUI.toast(
          data?.message ||
          'Treino excluído com sucesso.'
        );

        await load();

      } catch (error) {

        console.error(
          'Erro ao excluir treino:',
          error
        );

        HealerUI.toast(
          error?.message ||
          'Não foi possível excluir o treino.'
        );

        b.disabled = false;
        b.textContent = originalText;
      }
    };
  });
}


/* =========================================================
   LOCALIZAR AVENTUREIRO
========================================================= */

function getA(id) {
  return board.find(a => a.id === id);
}


/* =========================================================
   RESET DO EDITOR
========================================================= */

function reset() {
  pendingSaveRequest = null;
  editorRevision++;
  loadingMission = false;
  currentMissionId = null;
  composition = [];
  $('#templateSelect').value = '';
  $('#saveMission').disabled = false;

  $('#missionName').value = 'Missão Alpha';
  $('#missionType').value = 'alpha';
  $('#missionEnvironment').value = 'gym';
  $('#missionDuration').value = 45;
  $('#missionSubtitle').value = '';
  $('#missionObjective').value = '';

  renderComp();
}


/* =========================================================
   NOVO TREINO
========================================================= */

function openNew(id) {
  if (saving) return;
  current = getA(id);

  reset();

  $('#editorTitle').textContent =
    'Nova Missão personalizada';

  $('#editorAdventurer').textContent =
    current.preferredName || current.fullName;

  $('#editor').classList.add('open');
  loadTemplates();
}


/* =========================================================
   EDITAR TREINO
========================================================= */

async function openEdit(aid, mid) {
  if (saving) return;
  current = getA(aid);

  reset();

  currentMissionId = mid;
  const revision = editorRevision;
  loadingMission = true;
  $('#saveMission').disabled = true;

  $('#editorTitle').textContent =
    'Editar Missão';

  $('#editorAdventurer').textContent =
    current.preferredName || current.fullName;

  $('#editor').classList.add('open');

  try {
    const { data, error } = await db.rpc('get_personalized_mission_editor', {
      p_mission_id: mid
    });
    if (revision !== editorRevision) return;
    if (error || !data?.mission) throw error || new Error('Treino indisponível.');
    loadingMission = false;
    $('#saveMission').disabled = false;
    applyMissionData(data, false);
    loadTemplates();
  } catch (error) {
    if (revision !== editorRevision) return;
    loadingMission = false;
    $('#saveMission').disabled = true;
    HealerUI.toast(error?.message || 'Não foi possível carregar o treino. Verifique sua conexão.');
  }
}


/* =========================================================
   APLICAR DADOS DA MISSÃO
========================================================= */

function applyMissionData(data, isTemplate) {
  const m = data.mission || {};

  if (isTemplate) {
    // Loading a catalogue entry always creates a new individual mission.
    currentMissionId = null;
  }

  $('#missionName').value =
    m.name || '';

  $('#missionType').value =
    (m.code || 'alpha').toLowerCase();

  $('#missionEnvironment').value =
    m.environment || 'gym';

  $('#missionDuration').value =
    m.estimated_duration_minutes || 45;

  $('#missionSubtitle').value =
    m.subtitle || '';

  $('#missionObjective').value =
    m.objective || '';

  composition = [...(data.exercises || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map(x => ({
    exercise_id: x.exercise_id,
    name: x.exercise_name,
    section: x.section || 'combat',
    sets: x.sets,
    repetitions: x.repetitions || '',
    duration_seconds: x.duration_seconds,
    rest_seconds: x.rest_seconds ?? 0,
    healer_note: x.healer_note || '',
    alternative_exercise_id: x.alternative_exercise_id || null,
    alternative_exercise_name: x.alternative_exercise_name || ''
  }));

  renderComp();
}


/* =========================================================
   CARREGAR MODELO ALPHA / BRAVO / CHARLIE
========================================================= */

async function loadTemplates() {
  const revision = editorRevision;
  $('#templateStatus').textContent = 'Carregando modelos...';
  $('#loadTemplate').disabled = true;
  try {
    const items = [];
    // Paginate rather than silently omitting models beyond the first page.
    for (let page = 0; ; page++) {
      const { data, error } = await db.from('missions')
        .select('id,name,code,environment,chapter_id,status,chapters(title)')
        .is('created_by', null).in('status', ['available', 'draft'])
        .order('name').order('id').range(page * 100, page * 100 + 99);
      if (error) throw error;
      items.push(...(data || []));
      if ((data || []).length < 100) break;
    }
    if (revision !== editorRevision) return;
    templates = items;
    renderTemplates();
  } catch (error) {
    if (revision !== editorRevision) return;
    templates = [];
    renderTemplates();
    $('#templateStatus').textContent = 'Não foi possível carregar os modelos. Verifique sua conexão e permissão e tente novamente.';
    console.error(error);
  }
}

function renderTemplates() {
  const selected = $('#templateSelect').value;
  const search = $('#templateSearch').value.trim().toLocaleLowerCase('pt-BR');
  const status = $('#templateStatusFilter').value;
  const environment = $('#templateEnvironment').value;
  const matches = templates.filter(m => (!status || m.status === status) &&
    (!environment || m.environment === environment) &&
    [m.name, m.code, m.chapters?.title].join(' ').toLocaleLowerCase('pt-BR').includes(search));
  $('#templateSelect').innerHTML = '<option value="">Selecione um modelo</option>' + matches.map(m =>
    `<option value="${esc(m.id)}">${esc(m.name)} · ${esc((m.code || '').toUpperCase())} · ${esc(m.environment === 'home' ? 'Casa' : 'Academia')} · ${esc(m.chapters?.title || 'Sem capítulo')} · ${m.status === 'draft' ? 'Rascunho' : 'Publicado'}</option>`).join('');
  if (matches.some(m => m.id === selected)) $('#templateSelect').value = selected;
  $('#templateStatus').textContent = `${matches.length} modelos encontrados. Carregar não atribui o treino; salve após personalizar.`;
  $('#loadTemplate').disabled = !$('#templateSelect').value;
}

async function loadTemplate() {
  if (!current || saving || loadingMission) return;
  const template = templates.find(m => m.id === $('#templateSelect').value);
  if (!template) return;
  if (composition.length && !(await HealerUI.confirm('Substituir a composição atual pelo modelo selecionado?'))) return;
  const revision = editorRevision;
  loadingMission = true;
  $('#loadTemplate').disabled = true;
  $('#saveMission').disabled = true;
  try {
    const { data, error } = await db.rpc('get_mission_editor_detail', { p_mission_id: template.id });
    if (revision !== editorRevision) return;
    if (error || !data?.mission || !data.exercises?.length) throw error || new Error('Modelo sem exercícios ou indisponível.');
    applyMissionData(data, true);
    $('#editorTitle').textContent = `Modelo ${(template.code || '').toUpperCase()} — personalize para ${current.preferredName || current.fullName}`;
    HealerUI.toast('Modelo carregado. Personalize e salve para atribuir ao Aventureiro.');
  } catch (error) {
    if (revision === editorRevision) HealerUI.toast(error?.message || 'Não foi possível carregar o modelo. Verifique sua conexão e permissão.');
  } finally {
    if (revision === editorRevision) {
      loadingMission = false;
      $('#loadTemplate').disabled = !$('#templateSelect').value;
      $('#saveMission').disabled = false;
    }
  }
}

/* =========================================================
   COMPOSIÇÃO DO TREINO
========================================================= */

function renderComp() {
  $('#composition').innerHTML =
    composition.length
      ? composition
          .map(
            (x, i) => `

      <div class="exercise">

        <div class="exercise-top">

          <strong>
            ${i + 1}. ${esc(x.name)}
          </strong>

          <span>
            ${esc(x.section)}${x.alternative_exercise_name ? ` · Alternativa: ${esc(x.alternative_exercise_name)}` : ''}
          </span>

        </div>


        <div class="exercise-grid">

          <label>
            Séries
            <input
              data-i="${i}"
              data-f="sets"
              type="number"
              value="${esc(x.sets ?? '')}"
            >
          </label>


          <label>
            Repetições
            <input
              data-i="${i}"
              data-f="repetitions"
              value="${esc(
                x.repetitions || ''
              )}"
            >
          </label>


          <label>
            Duração
            <input
              data-i="${i}"
              data-f="duration_seconds"
              type="number"
              value="${esc(
                x.duration_seconds ?? ''
              )}"
            >
          </label>


          <label>
            Descanso
            <input
              data-i="${i}"
              data-f="rest_seconds"
              type="number"
              value="${esc(
                x.rest_seconds ?? 0
              )}"
            >
          </label>


          <label>
            Observação
            <input
              data-i="${i}"
              data-f="healer_note"
              value="${esc(
                x.healer_note || ''
              )}"
            >
          </label>

        </div>


        <div class="exercise-actions">

          <button data-up="${i}">
            ↑
          </button>

          <button data-down="${i}">
            ↓
          </button>

          <button data-remove="${i}">
            Remover
          </button>

        </div>

      </div>

    `
          )
          .join('')
      : `
        <div class="empty">
          Carregue um modelo ou adicione exercícios da Biblioteca.
        </div>
      `;


  document
    .querySelectorAll('[data-f]')
    .forEach(e => {

      e.oninput = () => {

        let v = e.value;

        if (
          [
            'sets',
            'duration_seconds',
            'rest_seconds'
          ].includes(e.dataset.f)
        ) {
          v =
            v === ''
              ? null
              : Number(v);
        }

        composition[
          +e.dataset.i
        ][e.dataset.f] = v;
      };

    });


  document
    .querySelectorAll('[data-up]')
    .forEach(b => {

      b.onclick = () =>
        move(+b.dataset.up, -1);

    });


  document
    .querySelectorAll('[data-down]')
    .forEach(b => {

      b.onclick = () =>
        move(+b.dataset.down, 1);

    });


  document
    .querySelectorAll('[data-remove]')
    .forEach(b => {

      b.onclick = () => {

        composition.splice(
          +b.dataset.remove,
          1
        );

        renderComp();

      };

    });
}


/* =========================================================
   MOVER EXERCÍCIO
========================================================= */

function move(i, d) {
  const j = i + d;

  if (
    j < 0 ||
    j >= composition.length
  ) {
    return;
  }

  [
    composition[i],
    composition[j]
  ] = [
    composition[j],
    composition[i]
  ];

  renderComp();
}


/* =========================================================
   BIBLIOTECA DE EXERCÍCIOS
========================================================= */

async function loadLib() {
  let q = db
    .from('exercises')
    .select(
      'id,name,media_url,thumbnail_url,environment,movement_pattern,status'
    )
    .eq('status', 'active')
    .order('name')
    .limit(200);


  const t =
    $('#librarySearch').value.trim();

  if (t) {
    q = q.ilike(
      'name',
      `%${t}%`
    );
  }


  const env =
    $('#libraryEnvironment').value;

  if (env) {
    q = q.contains(
      'environment',
      [env]
    );
  }


  const {
    data,
    error
  } = await q;


  if (error) {
    console.error(error);

    $('#libraryList').innerHTML =
      '<div class="empty">Erro ao carregar Biblioteca.</div>';

    return;
  }


  library =
    data || [];


  $('#libraryList').innerHTML =
    library.length
      ? library
          .map(
            x => `

      <div class="lib-item">

        <img
          src="${esc(
            x.thumbnail_url ||
            x.media_url ||
            ''
          )}"
          alt=""
          onerror="this.style.visibility='hidden'"
        >

        <div>

          <strong>
            ${esc(x.name)}
          </strong>

          <p>
            ${esc(
              x.movement_pattern ||
              ''
            )}
          </p>

        </div>


        <button
          class="btn secondary"
          data-add="${x.id}"
        >
          Adicionar
        </button>

      </div>

    `
          )
          .join('')
      : `
        <div class="empty">
          Nenhum exercício encontrado.
        </div>
      `;


  document
    .querySelectorAll('[data-add]')
    .forEach(b => {

      b.onclick = () => {

        const x =
          library.find(
            e =>
              e.id ===
              b.dataset.add
          );

        if (!x) return;


        composition.push({
          exercise_id: x.id,
          name: x.name,
          section: 'combat',
          sets: 3,
          repetitions: '10–12',
          duration_seconds: null,
          rest_seconds: 60,
          healer_note: ''
        });


        renderComp();


        $('#libraryModal')
          .classList
          .remove('open');
      };

    });
}


/* =========================================================
   SALVAR TREINO
========================================================= */

async function save() {
  if (!current || saving || loadingMission) return;


  if (
    !$('#missionName').value.trim() ||
    !composition.length
  ) {

    HealerUI.toast(
      'Informe o nome e adicione ao menos um exercício.'
    );

    return;
  }


  const code =
    $('#missionType').value;


  const mission = {

    id:
      currentMissionId,

    name:
      $('#missionName')
        .value
        .trim(),

    subtitle:
      $('#missionSubtitle')
        .value
        .trim(),

    objective:
      $('#missionObjective')
        .value
        .trim(),

    mission_type:
      code[0].toUpperCase() +
      code.slice(1),

    code,

    environment:
      $('#missionEnvironment').value,

    estimated_duration_minutes:
      +$('#missionDuration').value ||
      45
  };


  const ex =
    composition.map(
      (x, i) => ({
        ...x,
        display_order:
          i + 1
      })
    );


  const requestPayload = JSON.stringify({ adventurerId: current.id, mission, exercises: ex });
  if (!pendingSaveRequest || pendingSaveRequest.payload !== requestPayload) {
    pendingSaveRequest = { payload: requestPayload, id: newSaveRequestId() };
  }
  mission.request_id = pendingSaveRequest.id;
  saving = true;
  $('#saveMission').disabled = true;
  $('#saveMission').textContent = 'Salvando...';
  // Freeze editor identity until the request finishes.
  $('#editor').inert = true;
  try {
    const { data, error } = await db.rpc('save_personalized_mission', {
      p_adventurer_id: current.id, p_mission: mission, p_exercises: ex
    });
    if (error || !data?.missionId) throw error || new Error('Resposta de salvamento inválida.');
    currentMissionId = data.missionId;
    pendingSaveRequest = null;
    HealerUI.toast(data.cloned
      ? 'Missão individual criada e atribuída sem alterar o modelo oficial.'
      : 'Missão deste Aventureiro atualizada com sucesso.');
    $('#editor').classList.remove('open');
    editorRevision++;
    await load();
  } catch (error) {
    console.error(error);
    HealerUI.toast(error?.message || 'Não foi possível salvar. Verifique sua conexão e permissão.');
  } finally {
    saving = false;
    $('#editor').inert = false;
    $('#saveMission').disabled = false;
    $('#saveMission').textContent = 'Salvar para este Aventureiro';
  }
}


/* =========================================================
   EVENTOS DA PÁGINA
========================================================= */

$('#refreshBtn').onclick =
  load;


$('#searchInput').oninput =
  render;


$('#statusFilter').onchange =
  render;


$('#closeEditor').onclick =
  () =>
    $('#editor')
      .classList
      .remove('open');


$('#loadTemplate').onclick = loadTemplate;
$('#templateSearch').oninput = renderTemplates;
$('#templateStatusFilter').onchange = renderTemplates;
$('#templateEnvironment').onchange = renderTemplates;
$('#templateSelect').onchange = () => { $('#loadTemplate').disabled = !$('#templateSelect').value; };
$('#reloadTemplates').onclick = loadTemplates;


$('#missionType').onchange =
  () => {

    if (!currentMissionId) {

      const type =
        $('#missionType').value;

      $('#missionName').value =
        `Missão ${
          type[0].toUpperCase() +
          type.slice(1)
        }`;

    }

  };


$('#openLibrary').onclick =
  () => {

    $('#libraryModal')
      .classList
      .add('open');

    $('#libraryEnvironment').value =
      $('#missionEnvironment').value;

    loadLib();

  };


$('#closeLibrary').onclick =
  () =>
    $('#libraryModal')
      .classList
      .remove('open');


$('#librarySearch').oninput =
  () => {

    clearTimeout(window.t);

    window.t =
      setTimeout(
        loadLib,
        220
      );

  };


$('#libraryEnvironment').onchange =
  loadLib;


$('#saveMission').onclick =
  save;


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

load();
