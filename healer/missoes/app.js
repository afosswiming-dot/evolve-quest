
'use strict';

const SUPABASE_URL = 'https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const PAGE_SIZE = 20;

const configured =
  !SUPABASE_URL.startsWith('YOUR_') &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');

const supabase = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const state = {
  page: 1,
  search: '',
  code: '',
  environment: '',
  status: '',
  level: '',
  chapterId: '',
  order: 'updated_desc',
  total: 0,
  chapters: [],
  currentMission: null,
  composition: {
    preparation: [],
    combat: [],
    improvement: [],
    conclusion: [],
  },
  librarySearch: '',
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));

function codeLabel(code) {
  return { alpha: 'Alpha', bravo: 'Bravo', charlie: 'Charlie' }[code] || code || '—';
}

function environmentLabel(environment) {
  return { gym: 'Academia', home: 'Casa' }[environment] || environment || '—';
}

function statusLabel(status) {
  return { draft: 'Rascunho', available: 'Disponível', archived: 'Arquivada' }[status] || status || '—';
}

function setStatus(type, message) {
  $('#statusRegion').innerHTML = `
    <div class="${type} panel">
      <strong>${escapeHtml(message)}</strong>
      ${type === 'error' ? '<button class="btn btn-secondary" id="retryButton">Tentar novamente</button>' : ''}
    </div>`;
  $('#retryButton')?.addEventListener('click', loadMissions);
}

async function authorize() {
  if (!configured) {
    setStatus('empty', 'Configure o Supabase para carregar as Missões.');
    return false;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    location.href = '/healer/login/';
    return false;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role,account_status')
    .eq('id', session.user.id)
    .single();

  const authorized =
    !error &&
    profile &&
    ['healer', 'admin'].includes(profile.role) &&
    profile.account_status === 'active';

  if (!authorized) {
    await supabase.auth.signOut();
    location.href = '/healer/login/';
    return false;
  }

  return true;
}

async function loadCatalogs() {
  if (!configured) return;

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id,title,chapter_number,level_number,status')
    .neq('status', 'archived')
    .order('chapter_number');

  state.chapters = chapters || [];

  const options = state.chapters.map((chapter) =>
    `<option value="${escapeHtml(chapter.id)}">
      ${escapeHtml(chapter.chapter_number)} — ${escapeHtml(chapter.title)}
    </option>`
  ).join('');

  $('#chapterFilter').insertAdjacentHTML('beforeend', options);
  $('#chapterInput').insertAdjacentHTML('beforeend', options);
}

async function loadMissions() {
  setStatus('loading', 'Carregando Missões...');

  if (!(await authorize())) return;

  const { data, error } = await supabase.rpc('get_healer_missions', {
    p_search: state.search || null,
    p_code: state.code || null,
    p_environment: state.environment || null,
    p_status: state.status || null,
    p_level: state.level ? Number(state.level) : null,
    p_chapter_id: state.chapterId || null,
    p_page: state.page,
    p_page_size: PAGE_SIZE,
    p_order: state.order,
  });

  if (error) {
    console.error(error);
    setStatus('error', 'Não foi possível carregar as Missões agora.');
    return;
  }

  $('#statusRegion').innerHTML = '';

  const items = Array.isArray(data) ? data : (data?.items || []);
  const summary = data?.summary || {};
  state.total = Number(data?.totalCount ?? items[0]?.totalCount ?? 0);

  renderMetrics(summary);
  renderMissions(items);
  renderPagination();
}

function renderMetrics(summary) {
  $('#metricTotal').textContent = state.total;
  $('#metricAvailable').textContent = summary.available ?? 0;
  $('#metricDraft').textContent = summary.draft ?? 0;
  $('#metricArchived').textContent = summary.archived ?? 0;
}

function renderMissions(items) {
  $('#resultCount').textContent = `${state.total} resultado${state.total === 1 ? '' : 's'}`;
  const grid = $('#missionGrid');

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty panel">
        <strong>Nenhuma Missão encontrada.</strong>
        <span class="muted">Ajuste os filtros ou crie um novo modelo.</span>
      </div>`;
    return;
  }

  grid.innerHTML = items.map((mission) => `
    <article class="mission-card panel">
      <div class="mission-top">
        <div class="identity">
          <div class="mission-icon">${escapeHtml(codeLabel(mission.code).slice(0, 1))}</div>
          <div>
            <h3>${escapeHtml(mission.name || `Missão ${codeLabel(mission.code)}`)}</h3>
            <p class="muted">${escapeHtml(mission.subtitle || 'Sem subtítulo.')}</p>
          </div>
        </div>
        <span class="badge ${escapeHtml(mission.status)}">${escapeHtml(statusLabel(mission.status))}</span>
      </div>

      <div class="data-grid">
        <div class="datum"><small>Código e ambiente</small><strong>${escapeHtml(codeLabel(mission.code))} · ${escapeHtml(environmentLabel(mission.environment))}</strong></div>
        <div class="datum"><small>Capítulo</small><strong>${escapeHtml(mission.chapterTitle || 'Não informado')}</strong></div>
        <div class="datum"><small>Duração</small><strong>${escapeHtml(mission.estimatedDurationMinutes ?? '—')} min</strong></div>
        <div class="datum"><small>Exercícios</small><strong>${escapeHtml(mission.exerciseCount ?? 0)}</strong></div>
        <div class="datum"><small>Versão</small><strong>v${escapeHtml(mission.version ?? 1)}</strong></div>
        <div class="datum"><small>Nível</small><strong>Nível ${escapeHtml(mission.levelNumber ?? '—')}</strong></div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" data-edit="${escapeHtml(mission.id)}">Editar</button>
        <button class="btn btn-secondary" data-duplicate="${escapeHtml(mission.id)}">Duplicar</button>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => openMission(button.dataset.edit));
  });

  grid.querySelectorAll('[data-duplicate]').forEach((button) => {
    button.addEventListener('click', () => duplicateMissionDirect(button.dataset.duplicate));
  });
}

function renderPagination() {
  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const pagination = $('#pagination');

  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  pagination.innerHTML = `
    <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
    <button aria-current="page">${state.page}</button>
    <button ${state.page === pages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>
  `;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page = Number(button.dataset.page);
      loadMissions();
    });
  });
}

function resetEditor() {
  state.currentMission = null;
  state.composition = {
    preparation: [],
    combat: [],
    improvement: [],
    conclusion: [],
  };

  $('#missionForm').reset();
  $('#missionId').value = '';
  $('#drawerTitle').textContent = 'Nova Missão';
  $('#statusInput').value = 'draft';
  $('#versionInput').value = '1';
  $('#duplicateButton').classList.add('hidden');
  $('#archiveButton').classList.add('hidden');
  updateChapterLevel();
  renderComposition();
  renderPreview();
}

function openDrawer() {
  $('#missionDrawer').classList.add('open');
  $('#missionDrawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  $('#missionDrawer').classList.remove('open');
  $('#missionDrawer').setAttribute('aria-hidden', 'true');
}

async function openMission(id) {
  resetEditor();
  openDrawer();
  $('#drawerTitle').textContent = 'Carregando Missão...';

  const { data, error } = await supabase.rpc('get_mission_editor_detail', {
    p_mission_id: id,
  });

  if (error || !data) {
    console.error(error);
    alert('Não foi possível carregar esta Missão.');
    closeDrawer();
    return;
  }

  state.currentMission = data.mission;
  $('#drawerTitle').textContent = data.mission.name || 'Editar Missão';
  $('#missionId').value = data.mission.id || '';
  $('#nameInput').value = data.mission.name || '';
  $('#codeInput').value = data.mission.code || 'alpha';
  $('#environmentInput').value = data.mission.environment || 'gym';
  $('#subtitleInput').value = data.mission.subtitle || '';
  $('#objectiveInput').value = data.mission.objective || '';
  $('#chapterInput').value = data.mission.chapter_id || '';
  $('#durationInput').value = data.mission.estimated_duration_minutes || '';
  $('#statusInput').value = data.mission.status || 'draft';
  $('#versionInput').value = data.mission.version || 1;
  $('#generalNotesInput').value = data.mission.healer_notes || '';

  state.composition = {
    preparation: [],
    combat: [],
    improvement: [],
    conclusion: [],
  };

  (data.exercises || []).forEach((item) => {
    const section = item.section || 'preparation';
    if (!state.composition[section]) state.composition[section] = [];
    state.composition[section].push({
      id: item.id,
      exerciseId: item.exercise_id,
      exerciseName: item.exercise_name,
      sets: item.sets,
      repetitions: item.repetitions,
      durationSeconds: item.duration_seconds,
      restSeconds: item.rest_seconds,
      healerNote: item.healer_note,
      alternativeExerciseId: item.alternative_exercise_id,
      alternativeExerciseName: item.alternative_exercise_name,
    });
  });

  $('#duplicateButton').classList.remove('hidden');
  $('#archiveButton').classList.remove('hidden');
  $('#archiveButton').textContent = data.mission.status === 'archived' ? 'Restaurar' : 'Arquivar';

  updateChapterLevel();
  renderComposition();
  renderPreview();
}

function updateChapterLevel() {
  const selected = state.chapters.find((chapter) => chapter.id === $('#chapterInput').value);
  $('#levelDisplay').value = selected ? `Nível ${selected.level_number}` : '';
}

function renderComposition() {
  Object.entries(state.composition).forEach(([section, items]) => {
    const list = document.querySelector(`[data-list="${section}"]`);

    if (!items.length) {
      list.innerHTML = '<div class="empty"><span class="muted">Nenhum exercício nesta seção.</span></div>';
      return;
    }

    list.innerHTML = items.map((item, index) => `
      <article class="exercise-row">
        <div class="exercise-row-head">
          <div>
            <strong>${escapeHtml(item.exerciseName || 'Exercício')}</strong>
            ${item.alternativeExerciseName ? `<p class="muted">Alternativa: ${escapeHtml(item.alternativeExerciseName)}</p>` : ''}
          </div>
          <span class="badge">${index + 1}</span>
        </div>

        <div class="exercise-row-grid">
          <div class="field">
            <label>Séries</label>
            <input type="number" min="0" value="${escapeHtml(item.sets ?? '')}" data-field="sets" data-section="${section}" data-index="${index}">
          </div>
          <div class="field">
            <label>Repetições</label>
            <input value="${escapeHtml(item.repetitions ?? '')}" data-field="repetitions" data-section="${section}" data-index="${index}">
          </div>
          <div class="field">
            <label>Duração (s)</label>
            <input type="number" min="0" value="${escapeHtml(item.durationSeconds ?? '')}" data-field="durationSeconds" data-section="${section}" data-index="${index}">
          </div>
          <div class="field">
            <label>Descanso (s)</label>
            <input type="number" min="0" value="${escapeHtml(item.restSeconds ?? '')}" data-field="restSeconds" data-section="${section}" data-index="${index}">
          </div>
          <div class="field field-wide">
            <label>Observação do Healer</label>
            <input value="${escapeHtml(item.healerNote ?? '')}" data-field="healerNote" data-section="${section}" data-index="${index}">
          </div>
        </div>

        <div class="mini-actions">
          <button type="button" class="mini-btn" data-up="${section}:${index}">Mover acima</button>
          <button type="button" class="mini-btn" data-down="${section}:${index}">Mover abaixo</button>
          <button type="button" class="mini-btn" data-copy="${section}:${index}">Duplicar item</button>
          <button type="button" class="mini-btn" data-move="${section}:${index}">Mover seção</button>
          <button type="button" class="mini-btn" data-remove="${section}:${index}">Remover</button>
        </div>
      </article>
    `).join('');
  });

  document.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const item = state.composition[input.dataset.section][Number(input.dataset.index)];
      const field = input.dataset.field;
      item[field] = ['sets', 'durationSeconds', 'restSeconds'].includes(field)
        ? (input.value === '' ? null : Number(input.value))
        : input.value;
      renderPreview();
    });
  });

  document.querySelectorAll('[data-up]').forEach((button) => button.addEventListener('click', () => moveItem(button.dataset.up, -1)));
  document.querySelectorAll('[data-down]').forEach((button) => button.addEventListener('click', () => moveItem(button.dataset.down, 1)));
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => copyItem(button.dataset.copy)));
  document.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => moveSection(button.dataset.move)));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => removeItem(button.dataset.remove)));
}

function parsePosition(value) {
  const [section, index] = value.split(':');
  return { section, index: Number(index) };
}

function moveItem(value, direction) {
  const { section, index } = parsePosition(value);
  const items = state.composition[section];
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  renderComposition();
  renderPreview();
}

function copyItem(value) {
  const { section, index } = parsePosition(value);
  const original = state.composition[section][index];
  state.composition[section].splice(index + 1, 0, { ...original, id: null });
  renderComposition();
  renderPreview();
}

function moveSection(value) {
  const { section, index } = parsePosition(value);
  const sections = ['preparation', 'combat', 'improvement', 'conclusion'];
  const current = sections.indexOf(section);
  const target = sections[(current + 1) % sections.length];
  const [item] = state.composition[section].splice(index, 1);
  state.composition[target].push(item);
  renderComposition();
  renderPreview();
}

function removeItem(value) {
  const { section, index } = parsePosition(value);
  state.composition[section].splice(index, 1);
  renderComposition();
  renderPreview();
}

async function openExerciseModal() {
  $('#exerciseModal').classList.add('open');
  $('#exerciseModal').setAttribute('aria-hidden', 'false');
  await loadExerciseLibrary();
}

function closeExerciseModal() {
  $('#exerciseModal').classList.remove('open');
  $('#exerciseModal').setAttribute('aria-hidden', 'true');
}

async function loadExerciseLibrary() {
  $('#exerciseModalStatus').innerHTML = '<div class="loading"><strong>Carregando exercícios...</strong></div>';

  const { data, error } = await supabase.rpc('get_healer_exercises', {
    p_search: state.librarySearch || null,
    p_environment: $('#environmentInput').value,
    p_status: 'active',
    p_minimum_level: null,
    p_movement_pattern: null,
    p_equipment: null,
    p_difficulty_level: null,
    p_page: 1,
    p_page_size: 50,
    p_order: 'name_asc',
  });

  if (error) {
    console.error(error);
    $('#exerciseModalStatus').innerHTML = '<div class="error"><strong>Não foi possível carregar a Biblioteca.</strong></div>';
    return;
  }

  $('#exerciseModalStatus').innerHTML = '';
  const items = Array.isArray(data) ? data : (data?.items || []);
  const list = $('#libraryList');

  if (!items.length) {
    list.innerHTML = '<div class="empty"><strong>Nenhum exercício encontrado.</strong></div>';
    return;
  }

  list.innerHTML = items.map((exercise) => `
    <article class="library-item">
      <div>
        <strong>${escapeHtml(exercise.name)}</strong>
        <p class="muted">${escapeHtml(exercise.movementPattern || '')}</p>
      </div>
      <button class="btn btn-secondary" data-add-exercise="${escapeHtml(exercise.id)}" data-name="${escapeHtml(exercise.name)}">Adicionar</button>
    </article>
  `).join('');

  list.querySelectorAll('[data-add-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = $('#targetSectionInput').value;
      state.composition[section].push({
        id: null,
        exerciseId: button.dataset.addExercise,
        exerciseName: button.dataset.name,
        sets: null,
        repetitions: '',
        durationSeconds: null,
        restSeconds: 0,
        healerNote: '',
        alternativeExerciseId: null,
        alternativeExerciseName: '',
      });
      closeExerciseModal();
      renderComposition();
      renderPreview();
    });
  });
}

function collectMissionPayload() {
  const exercises = [];

  Object.entries(state.composition).forEach(([section, items]) => {
    items.forEach((item, index) => {
      exercises.push({
        id: item.id || null,
        exercise_id: item.exerciseId,
        section,
        sets: item.sets,
        repetitions: item.repetitions || null,
        duration_seconds: item.durationSeconds,
        rest_seconds: item.restSeconds ?? 0,
        healer_note: item.healerNote || null,
        alternative_exercise_id: item.alternativeExerciseId || null,
        display_order: index + 1,
      });
    });
  });

  return {
    mission: {
      id: $('#missionId').value || null,
      name: $('#nameInput').value.trim(),
      code: $('#codeInput').value,
      mission_type: codeLabel($('#codeInput').value),
      environment: $('#environmentInput').value,
      subtitle: $('#subtitleInput').value.trim(),
      objective: $('#objectiveInput').value.trim(),
      chapter_id: $('#chapterInput').value || null,
      estimated_duration_minutes: $('#durationInput').value ? Number($('#durationInput').value) : null,
      status: $('#statusInput').value,
      version: Number($('#versionInput').value || 1),
      healer_notes: $('#generalNotesInput').value.trim() || null,
    },
    exercises,
  };
}

function validateMission(payload, forPublish = false) {
  const errors = [];

  if (!payload.mission.name) errors.push('Nome');
  if (!payload.mission.code) errors.push('Código');
  if (!payload.mission.environment) errors.push('Ambiente');
  if (!payload.mission.chapter_id) errors.push('Capítulo');
  if (!payload.mission.objective) errors.push('Objetivo');
  if (!payload.mission.estimated_duration_minutes) errors.push('Duração');

  if (forPublish && !payload.exercises.length) {
    errors.push('Ao menos um exercício');
  }

  payload.exercises.forEach((item) => {
    if (!item.exercise_id) errors.push('Exercício inválido');
    if (item.sets !== null && item.sets <= 0) errors.push('Séries devem ser maiores que zero');
    if (item.duration_seconds !== null && item.duration_seconds <= 0) errors.push('Duração deve ser maior que zero');
    if (item.rest_seconds < 0) errors.push('Descanso não pode ser negativo');
    if (item.alternative_exercise_id && item.alternative_exercise_id === item.exercise_id) {
      errors.push('Alternativa deve ser diferente do exercício principal');
    }
  });

  return [...new Set(errors)];
}

async function saveDraft() {
  const payload = collectMissionPayload();
  payload.mission.status = 'draft';

  const errors = validateMission(payload, false);
  if (errors.length) {
    alert(`Revise os campos obrigatórios: ${errors.join(', ')}.`);
    return;
  }

  const { data, error } = await supabase.rpc('save_mission_draft', {
    p_mission: payload.mission,
    p_exercises: payload.exercises,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível concluir esta ação agora.');
    return;
  }

  alert('Rascunho salvo.');
  closeDrawer();
  loadMissions();
}

async function publishMission() {
  const payload = collectMissionPayload();

  const errors = validateMission(payload, true);
  if (errors.length) {
    alert(`Revise os campos obrigatórios antes de publicar: ${errors.join(', ')}.`);
    return;
  }

  const { data: saved, error: saveError } = await supabase.rpc('save_mission_draft', {
    p_mission: { ...payload.mission, status: 'draft' },
    p_exercises: payload.exercises,
  });

  if (saveError) {
    console.error(saveError);
    alert('Não foi possível salvar o rascunho antes da publicação.');
    return;
  }

  const missionId = saved?.mission_id || payload.mission.id;

  const { error: publishError } = await supabase.rpc('publish_mission', {
    p_mission_id: missionId,
  });

  if (publishError) {
    console.error(publishError);
    alert('Não foi possível publicar esta Missão.');
    return;
  }

  alert('Missão publicada.');
  closeDrawer();
  loadMissions();
}

async function duplicateMissionDirect(id) {
  const targetEnvironment = prompt('Digite o ambiente de destino: gym ou home', 'home');
  if (!['gym', 'home'].includes(targetEnvironment || '')) return;

  const targetChapterId = prompt('Digite o UUID do Capítulo de destino ou deixe em branco para manter o atual', '');

  const { error } = await supabase.rpc('duplicate_mission', {
    p_mission_id: id,
    p_target_environment: targetEnvironment,
    p_target_chapter_id: targetChapterId || null,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível duplicar esta Missão.');
    return;
  }

  alert('Missão duplicada.');
  loadMissions();
}

async function duplicateCurrentMission() {
  if (!state.currentMission) return;
  await duplicateMissionDirect(state.currentMission.id);
  closeDrawer();
}

async function archiveOrRestoreCurrentMission() {
  if (!state.currentMission) return;

  const archived = state.currentMission.status === 'archived';

  if (archived) {
    alert('A restauração deverá utilizar a função oficial definida no backend.');
    return;
  }

  const { error } = await supabase.rpc('archive_mission', {
    p_mission_id: state.currentMission.id,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível arquivar esta Missão.');
    return;
  }

  alert('Missão arquivada.');
  closeDrawer();
  loadMissions();
}

function renderPreview() {
  const preview = $('#missionPreview');
  const missionName = $('#nameInput').value.trim() || `Missão ${codeLabel($('#codeInput').value)}`;
  const subtitle = $('#subtitleInput').value.trim();
  const objective = $('#objectiveInput').value.trim();
  const duration = $('#durationInput').value;
  const environment = environmentLabel($('#environmentInput').value);

  const sectionsHtml = Object.entries(state.composition)
    .filter(([, items]) => items.length)
    .map(([section, items]) => `
      <section class="preview-section">
        <h4>${escapeHtml({
          preparation: 'Preparação',
          combat: 'Combate',
          improvement: 'Aprimoramento',
          conclusion: 'Conclusão',
        }[section])}</h4>
        ${items.map((item) => `
          <div class="preview-exercise">
            <strong>${escapeHtml(item.exerciseName)}</strong>
            <p class="muted">
              ${item.sets ? `${escapeHtml(item.sets)} séries` : ''}
              ${item.repetitions ? ` · ${escapeHtml(item.repetitions)} repetições` : ''}
              ${item.durationSeconds ? ` · ${escapeHtml(item.durationSeconds)}s` : ''}
              ${item.restSeconds !== null ? ` · descanso ${escapeHtml(item.restSeconds)}s` : ''}
            </p>
            ${item.healerNote ? `<p>${escapeHtml(item.healerNote)}</p>` : ''}
          </div>
        `).join('')}
      </section>
    `).join('');

  preview.innerHTML = `
    <div>
      <p class="eyebrow">${escapeHtml(codeLabel($('#codeInput').value))} · ${escapeHtml(environment)}</p>
      <h3>${escapeHtml(missionName)}</h3>
      ${subtitle ? `<p><strong>${escapeHtml(subtitle)}</strong></p>` : ''}
      ${objective ? `<p class="muted">${escapeHtml(objective)}</p>` : ''}
      ${duration ? `<p class="muted">${escapeHtml(duration)} minutos</p>` : ''}
    </div>
    ${sectionsHtml || '<p class="muted">Nenhum exercício adicionado.</p>'}
  `;
}

let searchTimer;
$('#searchInput').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = event.target.value.trim();
    state.page = 1;
    loadMissions();
  }, 350);
});

$('#clearSearch').addEventListener('click', () => {
  $('#searchInput').value = '';
  state.search = '';
  state.page = 1;
  loadMissions();
});

[
  ['codeFilter', 'code'],
  ['environmentFilter', 'environment'],
  ['statusFilter', 'status'],
  ['levelFilter', 'level'],
  ['chapterFilter', 'chapterId'],
  ['orderSelect', 'order'],
].forEach(([id, stateKey]) => {
  $('#' + id).addEventListener('change', (event) => {
    state[stateKey] = event.target.value;
    state.page = 1;
    loadMissions();
  });
});

['nameInput', 'codeInput', 'environmentInput', 'subtitleInput', 'objectiveInput', 'durationInput'].forEach((id) => {
  $('#' + id).addEventListener('input', renderPreview);
  $('#' + id).addEventListener('change', renderPreview);
});

$('#chapterInput').addEventListener('change', () => {
  updateChapterLevel();
  renderPreview();
});

$('#newMissionButton').addEventListener('click', () => {
  resetEditor();
  openDrawer();
});

$('#closeDrawer').addEventListener('click', closeDrawer);
$('#missionDrawer').addEventListener('click', (event) => {
  if (event.target === $('#missionDrawer')) closeDrawer();
});

$('#addExerciseButton').addEventListener('click', openExerciseModal);
$('#closeExerciseModal').addEventListener('click', closeExerciseModal);
$('#exerciseModal').addEventListener('click', (event) => {
  if (event.target === $('#exerciseModal')) closeExerciseModal();
});

let libraryTimer;
$('#exerciseSearchInput').addEventListener('input', (event) => {
  clearTimeout(libraryTimer);
  libraryTimer = setTimeout(() => {
    state.librarySearch = event.target.value.trim();
    loadExerciseLibrary();
  }, 300);
});


$('#openPreviewButton').addEventListener('click', async () => {
  const payload = collectMissionPayload();
  let missionId = payload.mission.id;

  if (!missionId) {
    const errors = validateMission(payload, false);
    if (errors.length) {
      alert(`Salve o rascunho antes de abrir a pré-visualização. Campos: ${errors.join(', ')}.`);
      return;
    }

    const { data, error } = await supabase.rpc('save_mission_draft', {
      p_mission: { ...payload.mission, status: 'draft' },
      p_exercises: payload.exercises,
    });

    if (error) {
      console.error(error);
      alert('Não foi possível salvar o rascunho para pré-visualização.');
      return;
    }

    missionId = data?.mission_id;
  } else {
    const { error } = await supabase.rpc('save_mission_draft', {
      p_mission: payload.mission,
      p_exercises: payload.exercises,
    });

    if (error) {
      console.error(error);
      alert('Não foi possível atualizar o rascunho para pré-visualização.');
      return;
    }
  }

  if (!missionId) {
    alert('Não foi possível identificar a Missão.');
    return;
  }

  window.open(`/healer/missoes/detalhe/?mission_id=${encodeURIComponent(missionId)}`, '_blank', 'noopener');
});

$('#saveDraftButton').addEventListener('click', saveDraft);
$('#publishButton').addEventListener('click', publishMission);
$('#duplicateButton').addEventListener('click', duplicateCurrentMission);
$('#archiveButton').addEventListener('click', archiveOrRestoreCurrentMission);

$('#filterToggle').addEventListener('click', () => $('#filtersPanel').classList.toggle('open'));
$('#menuButton').addEventListener('click', () => $('#filtersPanel').classList.toggle('open'));
$('#refreshButton').addEventListener('click', loadMissions);

(async () => {
  await loadCatalogs();
  resetEditor();
  await loadMissions();
})();
