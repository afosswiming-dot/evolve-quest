'use strict';

const SUPABASE_URL =
  'https://gtmngtweohixfeajljik.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';

const configured =
  !SUPABASE_URL.startsWith('YOUR_') &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');

const supabaseClient = configured
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'evolve-quest-healer-auth'
        }
      }
    )
  : null;

const PAGE_SIZE = 20;

const state = {
  page: 1,
  search: '',
  period: '',
  status: '',
  order: 'priority_desc',
  total: 0
};

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
        "'": '&#039;'
      })[c]
  );


/* =========================================================
   URL / FILTROS
========================================================= */

function hydrateFromURL() {
  const p = new URLSearchParams(location.search);

  state.search = p.get('search') || '';
  state.period = p.get('period') || '';
  state.status = p.get('status') || '';
  state.order = p.get('order') || 'priority_desc';
  state.page = Math.max(
    1,
    Number(p.get('page') || 1)
  );

  if ($('#searchInput')) {
    $('#searchInput').value = state.search;
  }

  if ($('#periodFilter')) {
    $('#periodFilter').value = state.period;
  }

  if ($('#statusFilter')) {
    $('#statusFilter').value = state.status;
  }

  if ($('#orderFilter')) {
    $('#orderFilter').value = state.order;
  }
}


/* =========================================================
   STATUS DA PÁGINA
========================================================= */

function setStatus(type, msg) {
  $('#statusRegion').innerHTML = `
    <div class="${type} panel">

      <strong>
        ${esc(msg)}
      </strong>

      ${
        type === 'error'
          ? `
            <button
              id="retryBtn"
              class="btn btn-secondary"
            >
              Tentar novamente
            </button>
          `
          : ''
      }

    </div>
  `;

  $('#retryBtn')?.addEventListener(
    'click',
    load
  );
}


/* =========================================================
   AUTORIZAÇÃO
========================================================= */

async function authorize() {
  if (!configured) {
    setStatus(
      'empty',
      'Configure o Supabase para carregar os dados.'
    );

    return false;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    location.href = '/healer/login/';
    return false;
  }

  const {
    data: profile,
    error
  } = await supabaseClient
    .from('profiles')
    .select('role,account_status')
    .eq('id', session.user.id)
    .single();

  if (
    error ||
    !profile ||
    !['healer', 'admin'].includes(profile.role) ||
    profile.account_status !== 'active'
  ) {
    await supabaseClient.auth.signOut();

    location.href = '/healer/login/';

    return false;
  }

  return true;
}


/* =========================================================
   CARREGAR REGISTROS
========================================================= */

async function load() {
  setStatus(
    'loading',
    'Carregando Registros...'
  );

  if (!(await authorize())) {
    return;
  }

  let {
    data,
    error
  } = await supabaseClient.rpc(
    'get_healer_registrations_v2',
    {
      p_search:
        state.search || null,

      p_period:
        state.period || null,

      p_status:
        state.status || null,

      p_page:
        state.page,

      p_page_size:
        PAGE_SIZE,

      p_order:
        state.order
    }
  );


  /* =======================================================
     FALLBACK
  ======================================================= */

  if (error) {
    console.warn(
      '[EVOLVE Registros] RPC fallback:',
      error
    );

    let q = supabaseClient
      .from('mission_registrations')
      .select(`
        id,
        adventurer_id,
        mission_id,
        chapter_id,
        completion_status,
        submitted_at,
        created_at,
        requires_healer_attention,
        perceived_effort,
        technical_execution
      `);


    if (state.status) {
      q = q.eq(
        'completion_status',
        state.status
      );
    }


    if (state.period === '7d') {
      q = q.gte(
        'submitted_at',
        new Date(
          Date.now() -
          7 * 86400000
        ).toISOString()
      );
    }


    if (state.period === '30d') {
      q = q.gte(
        'submitted_at',
        new Date(
          Date.now() -
          30 * 86400000
        ).toISOString()
      );
    }


    if (state.period === 'today') {
      const d = new Date();

      d.setHours(
        0,
        0,
        0,
        0
      );

      q = q.gte(
        'submitted_at',
        d.toISOString()
      );
    }


    const fallback = await q
      .order(
        'submitted_at',
        {
          ascending: false
        }
      )
      .range(
        (state.page - 1) *
          PAGE_SIZE,

        state.page *
          PAGE_SIZE -
          1
      );


    if (fallback.error) {
      console.error(
        '[EVOLVE Registros] fallback:',
        fallback.error
      );

      setStatus(
        'error',
        'Não foi possível carregar os dados agora.'
      );

      return;
    }


    const rows =
      fallback.data || [];


    data = {
      items: rows.map(r => ({
        id: r.id,

        adventurerId:
          r.adventurer_id,

        adventurerName:
          'Aventureiro',

        missionName:
          'Missão registrada',

        status:
          r.completion_status,

        submittedAt:
          r.submitted_at,

        createdAt:
          r.created_at,

        requiresAttention:
          r.requires_healer_attention,

        priorityLabel:
          r.requires_healer_attention
            ? 'Atenção'
            : 'Regular',

        perceivedEffort:
          r.perceived_effort,

        technicalExecution:
          r.technical_execution,

        completedExercises: 0,

        totalExercises: 0,

        executionLabel:
          'Sem dados'
      })),

      totalCount:
        rows.length,

      summary: {
        pending:
          rows.filter(r =>
            [
              'partially_completed',
              'not_completed'
            ].includes(
              r.completion_status
            )
          ).length,

        attention:
          rows.filter(
            r =>
              r.requires_healer_attention
          ).length,

        done:
          rows.filter(
            r =>
              r.completion_status ===
              'completed'
          ).length
      }
    };
  }


  $('#statusRegion').innerHTML = '';


  const payload =
    data || {};


  const rows =
    Array.isArray(payload)
      ? payload
      : payload.items || [];


  state.total =
    Number(
      payload.totalCount ??
      payload.total_count ??
      0
    );


  render(
    rows,
    payload.summary || {}
  );


  paginate();
}


/* =========================================================
   RENDER PRINCIPAL
========================================================= */

function render(
  rows,
  summary
) {
  $('#mTotal').textContent =
    state.total;

  $('#mPending').textContent =
    Number(
      summary.pending || 0
    );

  $('#mAttention').textContent =
    Number(
      summary.attention || 0
    );

  $('#mDone').textContent =
    Number(
      summary.done || 0
    );


  const el =
    $('#list');


  if (!rows.length) {
    el.innerHTML = `
      <div class="empty panel">
        <strong>
          Nenhum Registro encontrado.
        </strong>
      </div>
    `;

    return;
  }


  el.innerHTML =
    rows
      .map(card)
      .join('');


  el
    .querySelectorAll(
      '[data-open]'
    )
    .forEach(b => {

      b.addEventListener(
        'click',
        () =>
          openDetail(
            b.dataset.open
          )
      );

    });
}


/* =========================================================
   CARD DO REGISTRO
========================================================= */

function card(r) {
  const name =
    r.adventurerName ||
    'Aventureiro';


  const completed =
    Number(
      r.completedExercises || 0
    );


  const total =
    Number(
      r.totalExercises || 0
    );


  const executionLabel =
    r.executionLabel ||
    'Sem dados';


  const executionText =
    total > 0
      ? `${completed}/${total} exercícios · ${executionLabel}`
      : executionLabel;


  const extra = [
    r.perceivedEffort != null
      ? `Esforço ${r.perceivedEffort}/10`
      : '',

    r.technicalExecution != null
      ? `Técnica ${r.technicalExecution}/10`
      : ''
  ]
    .filter(Boolean)
    .join(' · ');


  let statusClass = '';

  if (r.requiresAttention) {
    statusClass = 'alert';
  } else if (
    executionLabel ===
    'Completa'
  ) {
    statusClass = 'success';
  }


  let statusText =
    executionLabel;


  if (
    !statusText ||
    statusText ===
    'Sem dados'
  ) {
    statusText =
      r.status === 'completed'
        ? 'Concluído'
        : r.status || 'Status';
  }


  return `
    <article class="item panel">

      <div class="item-head">

        <div class="identity">

          <div class="avatar">
            ${esc(
              name
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>

          <div>

            <h3>
              ${esc(name)}
            </h3>

            <p class="muted">

              ${esc(
                r.subtitle ||
                r.missionName ||
                r.chapterTitle ||
                ''
              )}

              ${
                extra
                  ? ` · ${esc(extra)}`
                  : ''
              }

            </p>

          </div>

        </div>


        <span
          class="badge ${statusClass}"
        >
          ${esc(statusText)}
        </span>

      </div>


      <div class="data-grid">


        <div class="datum">

          <small>
            Execução
          </small>

          <strong>
            ${esc(executionText)}
          </strong>

        </div>


        <div class="datum">

          <small>
            Data
          </small>

          <strong>
            ${esc(
              r.submittedAt ||
              r.createdAt ||
              '—'
            )}
          </strong>

        </div>


        <div class="datum">

          <small>
            Prioridade
          </small>

          <strong>
            ${esc(
              r.priorityLabel ||
              'Regular'
            )}
          </strong>

        </div>


      </div>


      <div class="actions">

        <button
          class="btn btn-primary"
          data-open="${esc(r.id)}"
        >
          Abrir detalhe
        </button>


        <a
          class="btn btn-secondary"
          href="/healer/aventureiro/?adventurer_id=${encodeURIComponent(
            r.adventurerId || ''
          )}"
        >
          Aventureiro
        </a>

      </div>

    </article>
  `;
}


/* =========================================================
   ABRIR DETALHE
========================================================= */

async function openDetail(id) {
  $('#drawer')
    .classList
    .add('open');


  $('#detailTitle').textContent =
    'Carregando...';


  $('#detailBody').innerHTML = `
    <div class="loading panel">

      <strong>
        Carregando detalhe...
      </strong>

    </div>
  `;


  const {
    data,
    error
  } = await supabaseClient.rpc(
    'get_healer_registration_detail',
    {
      p_registration_id:
        id
    }
  );


  if (error) {
    console.error(error);

    $('#detailBody').innerHTML = `
      <div class="error panel">

        <strong>
          Este recurso não está disponível.
        </strong>

      </div>
    `;

    return;
  }


  renderDetail(
    data || {}
  );
}


/* =========================================================
   DETALHE DO REGISTRO
========================================================= */

function renderDetail(d) {
  $('#detailTitle').textContent =
    d.title ||
    d.missionName ||
    d.adventurerName ||
    'Detalhe';


  $('#detailBody').innerHTML = `

    <section class="detail-section panel">

      <div class="section-head">

        <h2>
          Resumo
        </h2>

      </div>


      <div class="stack">

        ${
          Object
            .entries(
              d.summary || {}
            )
            .map(
              ([k, v]) => `

                <div class="row">

                  <span>
                    ${esc(k)}
                  </span>

                  <strong>
                    ${esc(v)}
                  </strong>

                </div>

              `
            )
            .join('')

          ||

          `
            <p class="muted">
              Nenhum resumo disponível.
            </p>
          `
        }

      </div>

    </section>


    <section class="detail-section panel">

      <h2>
        Observação interna
      </h2>


      <div class="field">

        <label
          for="registrationNote"
        >
          Nota do Healer
        </label>


        <textarea
          id="registrationNote"
        ></textarea>

      </div>

    </section>
  `;
}


/* =========================================================
   PAGINAÇÃO
========================================================= */

function paginate() {
  const pages =
    Math.max(
      1,
      Math.ceil(
        state.total /
        PAGE_SIZE
      )
    );


  const el =
    $('#pagination');


  if (pages <= 1) {
    el.innerHTML = '';
    return;
  }


  el.innerHTML = `

    <button
      ${
        state.page === 1
          ? 'disabled'
          : ''
      }
      data-p="${state.page - 1}"
    >
      ‹
    </button>


    <button
      aria-current="page"
    >
      ${state.page}
    </button>


    <button
      ${
        state.page === pages
          ? 'disabled'
          : ''
      }
      data-p="${state.page + 1}"
    >
      ›
    </button>

  `;


  el
    .querySelectorAll(
      '[data-p]'
    )
    .forEach(b => {

      b.onclick = () => {

        state.page =
          Number(
            b.dataset.p
          );

        load();

      };

    });
}


/* =========================================================
   EVENTOS
========================================================= */

let timer;


function bind() {
  $('#searchInput')
    ?.addEventListener(
      'input',
      e => {

        clearTimeout(
          timer
        );


        timer =
          setTimeout(
            () => {

              state.search =
                e.target
                  .value
                  .trim();

              state.page = 1;

              load();

            },
            350
          );

      }
    );


  if ($('#periodFilter')) {
    $('#periodFilter').onchange =
      e => {

        state.period =
          e.target.value;

        state.page = 1;

        load();

      };
  }


  if ($('#statusFilter')) {
    $('#statusFilter').onchange =
      e => {

        state.status =
          e.target.value;

        state.page = 1;

        load();

      };
  }


  if ($('#orderFilter')) {
    $('#orderFilter').onchange =
      e => {

        state.order =
          e.target.value;

        state.page = 1;

        load();

      };
  }


  if ($('#filterToggle')) {
    $('#filterToggle').onclick =
      () => {

        $('#filtersPanel')
          .classList
          .toggle('open');

      };
  }


  if ($('#refreshBtn')) {
    $('#refreshBtn').onclick =
      load;
  }


  if ($('#closeDrawer')) {
    $('#closeDrawer').onclick =
      () => {

        $('#drawer')
          .classList
          .remove('open');

      };
  }


  $('#drawer')
    ?.addEventListener(
      'click',
      e => {

        if (
          e.target ===
          $('#drawer')
        ) {
          $('#drawer')
            .classList
            .remove('open');
        }

      }
    );
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {
  hydrateFromURL();

  bind();

  await load();


  const registrationId =
    new URLSearchParams(
      location.search
    ).get(
      'registration_id'
    );


  if (registrationId) {
    openDetail(
      registrationId
    );
  }
}


document.addEventListener(
  'DOMContentLoaded',
  init
);
