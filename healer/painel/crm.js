'use strict';

(() => {

  /* =========================================================
     EVOLVE QUEST — CRM DO HEALER
     ========================================================= */

  const STAGES = {
    new: 'Novo lead',
    contacted: 'Contatado',
    payment_sent: 'Pagamento enviado',
    negotiation: 'Negociação',
    customer: 'Aventureiro ativo',
    not_interested: 'Sem interesse'
  };

  const ACTIVE_JOURNEY_STAGES = [
    'dashboard',
    'checkpoint',
    'feedback',
    'progression'
  ];

  let crmRows = [];
  let profileMap = new Map();


  /* =========================================================
     HELPERS
     ========================================================= */

  const esc = (v = '') =>
    String(v).replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[c]
    );


  const wa = phone => {

    let n = String(phone || '')
      .replace(/\D/g, '');

    if (!n) return '';

    if (
      (n.length === 10 || n.length === 11) &&
      !n.startsWith('55')
    ) {
      n = '55' + n;
    }

    return `https://wa.me/${n}`;
  };


  const dateInput = v => {

    if (!v) return '';

    const d = new Date(v);

    if (Number.isNaN(d.getTime())) {
      return '';
    }

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };


  function isActiveAdventurer(profile) {

    if (!profile) return false;

    return (
      profile.role === 'adventurer' &&
      profile.account_status === 'active' &&
      ACTIVE_JOURNEY_STAGES.includes(
        profile.journey_stage
      )
    );
  }


  /* =========================================================
     INTERFACE
     ========================================================= */

  function inject() {

    const dashboard =
      document.querySelector('#dashboardContent');

    if (
      !dashboard ||
      document.querySelector('#crmSection')
    ) {
      return;
    }


    const html = `

      <section
        class="crm-section"
        id="crmSection"
      >

        <div class="section-heading">

          <div>

            <span class="eyebrow">
              COMERCIAL
            </span>

            <h2>
              Funil de Aventureiros
            </h2>

          </div>

          <span class="period-label">
            CRM EVOLVE
          </span>

        </div>


        <div class="crm-metrics">

          <div class="crm-metric">
            <small>Novos leads</small>
            <strong id="crmNew">0</strong>
          </div>

          <div class="crm-metric">
            <small>Contatados</small>
            <strong id="crmContacted">0</strong>
          </div>

          <div class="crm-metric">
            <small>Pagamento enviado</small>
            <strong id="crmPaymentSent">0</strong>
          </div>

          <div class="crm-metric">
            <small>Em negociação</small>
            <strong id="crmNegotiation">0</strong>
          </div>

          <div class="crm-metric">
            <small>Aventureiros ativos</small>
            <strong id="crmCustomers">0</strong>
          </div>

        </div>


        <article class="crm-panel">

          <div class="crm-toolbar">

            <div>

              <strong>
                Relacionamento comercial
              </strong>

              <div class="muted">
                Leads e Aventureiros da EVOLVE Quest em um único lugar.
              </div>

            </div>


            <input
              id="crmSearch"
              type="search"
              placeholder="Buscar lead ou Aventureiro..."
            >

          </div>


          <div
            class="crm-list"
            id="crmList"
          >

            <div class="crm-empty">
              Carregando CRM...
            </div>

          </div>

        </article>

      </section>
    `;


    const first =
      dashboard.querySelector('section');


    if (first) {

      first.insertAdjacentHTML(
        'afterend',
        html
      );

    } else {

      dashboard.insertAdjacentHTML(
        'afterbegin',
        html
      );
    }


    document
      .querySelector('#crmSearch')
      ?.addEventListener(
        'input',
        renderRows
      );
  }


  /* =========================================================
     OPÇÕES DO FUNIL
     ========================================================= */

  const options = cur =>
    Object.entries(STAGES)
      .map(
        ([v, l]) => `

          <option
            value="${v}"
            ${v === cur ? 'selected' : ''}
          >
            ${l}
          </option>

        `
      )
      .join('');


  /* =========================================================
     MÉTRICAS
     ========================================================= */

  function metrics() {

    const c = stage =>
      crmRows.filter(
        r => r.pipeline_stage === stage
      ).length;


    document.querySelector(
      '#crmNew'
    ).textContent = c('new');


    document.querySelector(
      '#crmContacted'
    ).textContent = c('contacted');


    document.querySelector(
      '#crmPaymentSent'
    ).textContent = c('payment_sent');


    document.querySelector(
      '#crmNegotiation'
    ).textContent = c('negotiation');


    /*
     * Aqui não dependemos somente do status comercial.
     * Contamos os profiles que realmente são Aventureiros ativos.
     */

    const activeCount =
      [...profileMap.values()]
        .filter(isActiveAdventurer)
        .length;


    document.querySelector(
      '#crmCustomers'
    ).textContent = activeCount;
  }


  /* =========================================================
     RENDER DOS REGISTROS
     ========================================================= */

  function renderRows() {

    const list =
      document.querySelector('#crmList');

    if (!list) return;


    const q =
      (
        document.querySelector('#crmSearch')
          ?.value || ''
      )
        .trim()
        .toLowerCase();


    const order = {
      new: 1,
      contacted: 2,
      payment_sent: 3,
      negotiation: 4,
      customer: 5,
      not_interested: 6
    };


    const rows =
      [...crmRows]

        .filter(r => {

          const p =
            profileMap.get(
              r.adventurer_id
            ) || {};


          const searchable = `

            ${p.full_name || ''}
            ${p.preferred_name || ''}
            ${p.email || ''}
            ${p.phone || ''}
            ${p.city || ''}
            ${p.state || ''}

          `
            .toLowerCase();


          return (
            !q ||
            searchable.includes(q)
          );
        })


        .sort(
          (a, b) =>
            (order[a.pipeline_stage] || 99) -
            (order[b.pipeline_stage] || 99)
        );


    if (!rows.length) {

      list.innerHTML = `

        <div class="crm-empty">
          Nenhum lead ou Aventureiro encontrado.
        </div>

      `;

      return;
    }


    list.innerHTML =
      rows
        .map(r => {

          const p =
            profileMap.get(
              r.adventurer_id
            ) || {};


          const active =
            isActiveAdventurer(p);


          const name =
            p.preferred_name ||
            p.full_name ||
            'Aventureiro';


          const link =
            wa(p.phone);


          /*
           * Se já é Aventureiro ativo,
           * mostramos isso visualmente.
           */

          const badge =
            active
              ? `
                <span class="crm-adventurer-badge">
                  AVENTUREIRO ATIVO
                </span>
              `
              : `
                <span class="crm-lead-badge">
                  LEAD
                </span>
              `;


          return `

            <div
              class="crm-row"
              data-id="${esc(
                r.adventurer_id
              )}"
            >


              <div class="crm-person">

                ${badge}

                <strong>
                  ${esc(name)}
                </strong>


                <span>
                  ${esc(
                    p.phone ||
                    'Telefone não informado'
                  )}
                </span>


                <small>
                  ${esc(
                    p.email || ''
                  )}
                </small>


                <small>

                  ${esc(
                    p.city || ''
                  )}

                  ${
                    p.state
                      ? ` · ${esc(p.state)}`
                      : ''
                  }

                </small>

              </div>


              <div class="crm-field">

                <label>
                  Status
                </label>


                <select
                  data-field="pipeline_stage"
                >
                  ${options(
                    r.pipeline_stage
                  )}
                </select>

              </div>


              <div class="crm-field">

                <label>
                  Próximo follow-up
                </label>


                <input
                  type="date"
                  data-field="next_follow_up_at"
                  value="${dateInput(
                    r.next_follow_up_at
                  )}"
                >

              </div>


              <div class="crm-field">

                <label>
                  Observação comercial
                </label>


                <textarea
                  data-field="notes"
                  placeholder="Ex.: enviei mensal e trimestral"
                >${esc(
                  r.notes || ''
                )}</textarea>


                <div
                  class="crm-save-state"
                  data-state
                ></div>

              </div>


              <div class="crm-actions">

                ${
                  link
                    ? `

                      <a
                        class="crm-btn secondary"
                        href="${link}"
                        target="_blank"
                        rel="noopener"
                      >
                        WhatsApp
                      </a>

                    `
                    : ''
                }


                <button
                  class="crm-btn primary"
                  data-action="save"
                  type="button"
                >
                  Salvar
                </button>

              </div>

            </div>

          `;
        })
        .join('');


    list
      .querySelectorAll(
        '[data-action="save"]'
      )
      .forEach(
        b =>
          b.addEventListener(
            'click',
            save
          )
      );
  }


  /* =========================================================
     SALVAR ALTERAÇÕES
     ========================================================= */

  async function save(e) {

    const card =
      e.currentTarget.closest(
        '.crm-row'
      );


    const id =
      card.dataset.id;


    const current =
      crmRows.find(
        r =>
          String(r.adventurer_id) ===
          String(id)
      );


    if (!current) {

      console.error(
        '[EVOLVE CRM] Registro não encontrado:',
        id
      );

      return;
    }


    const stage =
      card.querySelector(
        '[data-field="pipeline_stage"]'
      ).value;


    const follow =
      card.querySelector(
        '[data-field="next_follow_up_at"]'
      ).value;


    const notes =
      card.querySelector(
        '[data-field="notes"]'
      )
        .value
        .trim();


    const state =
      card.querySelector(
        '[data-state]'
      );


    const now =
      new Date().toISOString();


    state.textContent =
      'Salvando...';


    state.className =
      'crm-save-state';


    const payload = {

      pipeline_stage:
        stage,

      next_follow_up_at:
        follow
          ? new Date(
              `${follow}T12:00:00`
            ).toISOString()
          : null,

      notes:
        notes || null,

      updated_at:
        now
    };


    if (
      stage === 'contacted' &&
      !current?.last_contact_at
    ) {

      payload.last_contact_at =
        now;
    }


    if (
      stage === 'payment_sent'
    ) {

      payload.payment_status =
        'sent';

      payload.payment_options_sent_at =
        current?.payment_options_sent_at ||
        now;

      payload.last_contact_at =
        now;
    }


    if (
      stage === 'customer'
    ) {

      payload.payment_status =
        'paid';
    }


    const {
      data: { session }
    } =
      await supabaseClient.auth.getSession();


    if (session?.user?.id) {

      payload.updated_by =
        session.user.id;
    }


    const {
      error
    } =
      await supabaseClient

        .from('adventurer_crm')

        .update(payload)

        .eq(
          'adventurer_id',
          id
        );


    if (error) {

      console.error(
        '[EVOLVE CRM]',
        error
      );


      state.textContent =
        'Erro ao salvar';


      state.className =
        'crm-save-state error';


      return;
    }


    Object.assign(
      current,
      payload
    );


    state.textContent =
      'Salvo';


    state.className =
      'crm-save-state ok';


    metrics();


    setTimeout(
      () =>
        state.textContent = '',
      1500
    );
  }


  /* =========================================================
     GARANTIR CRM PARA AVENTUREIROS ATIVOS
     ========================================================= */

  async function ensureActiveAdventurersInCRM(
    activeProfiles,
    existingCRM
  ) {

    const existingIds =
      new Set(
        existingCRM.map(
          r =>
            String(
              r.adventurer_id
            )
        )
      );


    const missing =
      activeProfiles.filter(
        p =>
          !existingIds.has(
            String(p.id)
          )
      );


    if (!missing.length) {
      return;
    }


    const {
      data: { session }
    } =
      await supabaseClient.auth.getSession();


    const now =
      new Date().toISOString();


    const rows =
      missing.map(
        p => ({

          adventurer_id:
            p.id,

          pipeline_stage:
            'customer',

          payment_status:
            'paid',

          created_at:
            now,

          updated_at:
            now,

          updated_by:
            session?.user?.id ||
            null
        })
      );


    const {
      error
    } =
      await supabaseClient

        .from('adventurer_crm')

        .insert(rows);


    if (error) {

      console.error(
        '[EVOLVE CRM] Não foi possível criar CRM automático:',
        error
      );
    }
  }


  /* =========================================================
     CARREGAR CRM
     ========================================================= */

  async function load() {

    inject();


    /*
     * Espera o dashboard principal criar
     * a conexão Supabase.
     */

    for (
      let i = 0;
      i < 50 && !supabaseClient;
      i++
    ) {

      await new Promise(
        r =>
          setTimeout(
            r,
            100
          )
      );
    }


    if (!supabaseClient) {

      console.error(
        '[EVOLVE CRM] Supabase não disponível.'
      );

      return;
    }


    const list =
      document.querySelector(
        '#crmList'
      );


    if (list) {

      list.innerHTML = `

        <div class="crm-empty">
          Carregando CRM...
        </div>

      `;
    }


    /* =====================================================
       1. BUSCAR CRM EXISTENTE
       ===================================================== */

    const {
      data: existingCRM,
      error: crmError
    } =
      await supabaseClient

        .from('adventurer_crm')

        .select('*');


    if (crmError) {

      console.error(
        '[EVOLVE CRM]',
        crmError
      );


      if (list) {

        list.innerHTML = `

          <div class="crm-empty">
            Não foi possível carregar o CRM.
          </div>

        `;
      }

      return;
    }


    /* =====================================================
       2. BUSCAR AVENTUREIROS ATIVOS
       ===================================================== */

    const {
      data: activeProfiles,
      error: activeError
    } =
      await supabaseClient

        .from('profiles')

        .select(`
          id,
          full_name,
          preferred_name,
          email,
          phone,
          city,
          state,
          role,
          account_status,
          journey_stage,
          created_at
        `)

        .eq(
          'role',
          'adventurer'
        )

        .eq(
          'account_status',
          'active'
        )

        .in(
          'journey_stage',
          ACTIVE_JOURNEY_STAGES
        );


    if (activeError) {

      console.error(
        '[EVOLVE CRM] Erro ao carregar Aventureiros:',
        activeError
      );
    }


    const active =
      activeProfiles || [];


    /* =====================================================
       3. CRIAR CRM PARA QUEM AINDA NÃO POSSUI
       ===================================================== */

    await ensureActiveAdventurersInCRM(
      active,
      existingCRM || []
    );


    /* =====================================================
       4. RECARREGAR CRM
       ===================================================== */

    const {
      data: refreshedCRM,
      error: refreshError
    } =
      await supabaseClient

        .from('adventurer_crm')

        .select('*');


    if (refreshError) {

      console.error(
        '[EVOLVE CRM]',
        refreshError
      );

      return;
    }


    crmRows =
      refreshedCRM || [];


    /* =====================================================
       5. PEGAR TODOS OS PROFILES ASSOCIADOS AO CRM
       ===================================================== */

    const ids =
      [
        ...new Set(
          crmRows
            .map(
              r =>
                r.adventurer_id
            )
            .filter(Boolean)
        )
      ];


    let crmProfiles = [];


    if (ids.length) {

      const {
        data,
        error
      } =
        await supabaseClient

          .from('profiles')

          .select(`
            id,
            full_name,
            preferred_name,
            email,
            phone,
            city,
            state,
            role,
            account_status,
            journey_stage,
            created_at
          `)

          .in(
            'id',
            ids
          );


      if (error) {

        console.error(
          '[EVOLVE CRM] Profiles:',
          error
        );

      } else {

        crmProfiles =
          data || [];
      }
    }


    /*
     * Une os profiles do CRM
     * com os Aventureiros ativos.
     */

    const combinedProfiles =
      [
        ...crmProfiles,
        ...active
      ];


    profileMap =
      new Map();


    combinedProfiles.forEach(
      p => {

        profileMap.set(
          String(p.id),
          p
        );

      }
    );


    /*
     * Normaliza IDs.
     */

    crmRows =
      crmRows.map(
        r => ({

          ...r,

          adventurer_id:
            String(
              r.adventurer_id
            )

        })
      );


    metrics();

    renderRows();
  }


  /* =========================================================
     INICIALIZAÇÃO
     ========================================================= */

  document.addEventListener(
    'DOMContentLoaded',
    () =>
      setTimeout(
        load,
        250
      )
  );

})();
