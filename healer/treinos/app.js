'use strict';

const db = window.supabase.createClient(
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
  const q = $('#searchInput').value.toLowerCase();
  const f = $('#statusFilter').value;

  const items = board.filter(a => {
    const n = (a.preferredName || a.fullName || '').toLowerCase();

    return (
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
          + Novo treino
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
          ${(a.missions || []).length} treinos
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
            : '<div class="empty">Nenhum treino atribuído.</div>'
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

      const confirmed = window.confirm(
        `Excluir "${missionName}"?\n\n` +
        `Essa ação removerá este treino da prescrição do Aventureiro.\n\n` +
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

        alert(
          data?.message ||
          'Treino excluído com sucesso.'
        );

        await load();

      } catch (error) {

        console.error(
          'Erro ao excluir treino:',
          error
        );

        alert(
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
  currentMissionId = null;
  composition = [];

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
  current = getA(id);

  reset();

  $('#editorTitle').textContent =
    'Novo treino personalizado';

  $('#editorAdventurer').textContent =
    current.preferredName || current.fullName;

  $('#editor').classList.add('open');
}


/* =========================================================
   EDITAR TREINO
========================================================= */

async function openEdit(aid, mid) {
  current = getA(aid);

  reset();

  currentMissionId = mid;

  $('#editorTitle').textContent =
    'Editar treino';

  $('#editorAdventurer').textContent =
    current.preferredName || current.fullName;

  $('#editor').classList.add('open');

  const { data, error } = await db.rpc(
    'get_personalized_mission_editor',
    {
      p_mission_id: mid
    }
  );

  if (error || !data) {
    console.error(error);
    alert('Não foi possível carregar o treino.');
    return;
  }

  applyMissionData(data, false);
}


/* =========================================================
   APLICAR DADOS DA MISSÃO
========================================================= */

function applyMissionData(data, isTemplate) {
  const m = data.mission || {};

  if (isTemplate) {
    currentMissionId = m.id || null;
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

  composition = (data.exercises || []).map(x => ({
    exercise_id: x.exercise_id,
    name: x.exercise_name,
    section: x.section || 'combat',
    sets: x.sets,
    repetitions: x.repetitions || '',
    duration_seconds: x.duration_seconds,
    rest_seconds: x.rest_seconds ?? 0,
    healer_note: x.healer_note || ''
  }));

  renderComp();
}


/* =========================================================
   CARREGAR MODELO ALPHA / BRAVO / CHARLIE
========================================================= */

async function loadTemplate() {
  if (!current) return;

  const code =
    $('#missionType').value;

  const env =
    $('#missionEnvironment').value;

  const {
    data: templates,
    error
  } = await db
    .from('missions')
    .select(
      'id,name,code,environment,chapter_id,created_by'
    )
    .eq('code', code)
    .eq('environment', env)
    .eq('status', 'available')
    .is('created_by', null)
    .limit(10);

  if (error) {
    console.error(error);
    alert(
      'Não foi possível localizar o modelo oficial.'
    );
    return;
  }

  let template =
    (templates || []).find(
      x => x.chapter_id === current.chapterId
    ) ||
    (templates || [])[0];

  if (!template) {
    alert(
      'Ainda não existe um modelo oficial para esta combinação.'
    );
    return;
  }

  const {
    data,
    error: detailError
  } = await db.rpc(
    'get_personalized_mission_editor',
    {
      p_mission_id: template.id
    }
  );

  if (detailError || !data) {
    console.error(detailError);
    alert(
      'Não foi possível carregar o modelo.'
    );
    return;
  }

  applyMissionData(data, true);

  $('#editorTitle').textContent =
    `Modelo ${code.toUpperCase()} — personalize para ${
      current.preferredName ||
      current.fullName
    }`;
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
            ${esc(x.section)}
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
  if (!current) return;


  if (
    !$('#missionName').value.trim() ||
    !composition.length
  ) {

    alert(
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


  $('#saveMission').disabled =
    true;

  $('#saveMission').textContent =
    'Salvando...';


  const {
    data,
    error
  } = await db.rpc(
    'save_personalized_mission',
    {

      p_adventurer_id:
        current.id,

      p_mission:
        mission,

      p_exercises:
        ex
    }
  );


  $('#saveMission').disabled =
    false;

  $('#saveMission').textContent =
    'Salvar para este Aventureiro';


  if (error) {

    console.error(error);

    alert(
      error.message ||
      'Não foi possível salvar.'
    );

    return;
  }


  alert(
    data?.cloned
      ? 'Treino individual criado e atribuído sem alterar o modelo oficial.'
      : 'Treino deste Aventureiro atualizado com sucesso.'
  );


  $('#editor')
    .classList
    .remove('open');


  await load();
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


$('#loadTemplate').onclick =
  loadTemplate;


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
