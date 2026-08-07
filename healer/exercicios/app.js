
'use strict';

const SUPABASE_URL = 'https://gtmngtweohixfeajljik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const PAGE_SIZE = 20;

const configured =
  !SUPABASE_URL.startsWith('YOUR_') &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');

const supabase = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}})
  : null;

const state = {
  page: 1,
  search: '',
  environment: '',
  status: '',
  minimumLevel: '',
  movement: '',
  equipment: '',
  difficulty: '',
  order: 'updated_desc',
  total: 0,
  currentExercise: null,
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

function statusLabel(status) {
  return {
    draft: 'Rascunho',
    active: 'Ativo',
    archived: 'Arquivado',
  }[status] || 'Status não informado';
}

function environmentLabel(values) {
  const list = Array.isArray(values) ? values : [values].filter(Boolean);
  const labels = list.map((value) => ({
    gym: 'Academia',
    home: 'Casa',
    both: 'Academia e Casa',
  }[value] || value));
  return labels.join(' · ') || 'Não informado';
}

function setStatus(type, message) {
  $('#statusRegion').innerHTML = `
    <div class="${type} panel">
      <strong>${escapeHtml(message)}</strong>
      ${type === 'error' ? '<button class="btn btn-secondary" id="retryButton">Tentar novamente</button>' : ''}
    </div>`;
  $('#retryButton')?.addEventListener('click', loadExercises);
}

async function authorize() {
  if (!configured) {
    setStatus('empty', 'Configure o Supabase para carregar a Biblioteca de Exercícios.');
    return false;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/healer/login/';
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
    window.location.href = '/healer/login/';
    return false;
  }

  return true;
}

async function loadExercises() {
  setStatus('loading', 'Carregando exercícios...');

  if (!(await authorize())) return;

  const { data, error } = await supabase.rpc('get_healer_exercises', {
    p_search: state.search || null,
    p_environment: state.environment || null,
    p_status: state.status || null,
    p_minimum_level: state.minimumLevel ? Number(state.minimumLevel) : null,
    p_movement_pattern: state.movement || null,
    p_equipment: state.equipment || null,
    p_difficulty_level: state.difficulty ? Number(state.difficulty) : null,
    p_page: state.page,
    p_page_size: PAGE_SIZE,
    p_order: state.order,
  });

  if (error) {
    console.error(error);
    setStatus('error', 'Não foi possível carregar os exercícios agora.');
    return;
  }

  $('#statusRegion').innerHTML = '';

  const items = Array.isArray(data) ? data : (data?.items || []);
  const summary = data?.summary || {};

  state.total = Number(data?.totalCount ?? items[0]?.totalCount ?? 0);

  renderMetrics(summary);
  renderExercises(items);
  renderPagination();
}

function renderMetrics(summary) {
  $('#metricTotal').textContent = state.total;
  $('#metricActive').textContent = summary.active ?? 0;
  $('#metricDraft').textContent = summary.draft ?? 0;
  $('#metricArchived').textContent = summary.archived ?? 0;
}

function renderExercises(items) {
  $('#resultCount').textContent = `${state.total} resultado${state.total === 1 ? '' : 's'}`;
  const grid = $('#exerciseGrid');

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty panel">
        <strong>Nenhum exercício encontrado.</strong>
        <span class="muted">Ajuste os filtros ou crie um novo exercício.</span>
      </div>`;
    return;
  }

  grid.innerHTML = items.map((exercise) => {
    const equipment = Array.isArray(exercise.equipment) ? exercise.equipment : [];
    const muscles = Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles : [];

    return `
      <article class="exercise-card panel">
        <div class="exercise-top">
          <div class="exercise-title">
            <div class="exercise-icon">${escapeHtml((exercise.name || '?').slice(0, 2).toUpperCase())}</div>
            <div>
              <h3>${escapeHtml(exercise.name || 'Exercício')}</h3>
              <p class="muted">${escapeHtml(exercise.description || 'Sem descrição curta.')}</p>
            </div>
          </div>
          <span class="badge ${escapeHtml(exercise.status || '')}">
            ${escapeHtml(statusLabel(exercise.status))}
          </span>
        </div>

        <div class="data-grid">
          <div class="datum">
            <small>Ambiente</small>
            <strong>${escapeHtml(environmentLabel(exercise.environment))}</strong>
          </div>
          <div class="datum">
            <small>Nível mínimo</small>
            <strong>Nível ${escapeHtml(exercise.minimumLevel ?? 1)}</strong>
          </div>
          <div class="datum">
            <small>Padrão de movimento</small>
            <strong>${escapeHtml(exercise.movementPattern || 'Não informado')}</strong>
          </div>
          <div class="datum">
            <small>Dificuldade</small>
            <strong>${escapeHtml(exercise.difficultyLevel ?? '—')}</strong>
          </div>
        </div>

        <div class="tag-list">
          ${equipment.slice(0, 3).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
          ${muscles.slice(0, 2).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-edit="${escapeHtml(exercise.id)}">Editar</button>
          <button class="btn btn-secondary" data-preview="${escapeHtml(exercise.id)}">Visualizar</button>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => openExercise(button.dataset.edit));
  });

  grid.querySelectorAll('[data-preview]').forEach((button) => {
    button.addEventListener('click', () => openExercise(button.dataset.preview));
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
    <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}" aria-label="Página anterior">‹</button>
    <button aria-current="page">${state.page}</button>
    <button ${state.page === pages ? 'disabled' : ''} data-page="${state.page + 1}" aria-label="Próxima página">›</button>`;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page = Number(button.dataset.page);
      loadExercises();
    });
  });
}

function resetForm() {
  state.currentExercise = null;
  $('#exerciseForm').reset();
  $('#exerciseId').value = '';
  $('#drawerTitle').textContent = 'Novo exercício';
  $('#duplicateButton').classList.add('hidden');
  $('#archiveButton').classList.add('hidden');
  $('#statusInput').value = 'draft';
  $('#minimumLevelInput').value = '1';
  $('#difficultyInput').value = '1';
  $('#mediaPreview').innerHTML = `
    <strong>Pré-visualização da mídia</strong>
    <p class="muted">Nenhuma demonstração disponível.</p>`;
}

function openDrawer() {
  $('#exerciseDrawer').classList.add('open');
  $('#exerciseDrawer').setAttribute('aria-hidden', 'false');
  $('#nameInput').focus();
}

function closeDrawer() {
  $('#exerciseDrawer').classList.remove('open');
  $('#exerciseDrawer').setAttribute('aria-hidden', 'true');
}

async function openExercise(id) {
  resetForm();
  openDrawer();
  $('#drawerTitle').textContent = 'Carregando exercício...';

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    $('#drawerTitle').textContent = 'Exercício indisponível';
    alert('Não foi possível carregar este exercício.');
    return;
  }

  state.currentExercise = data;
  $('#drawerTitle').textContent = data.name || 'Editar exercício';
  $('#exerciseId').value = data.id || '';
  $('#nameInput').value = data.name || '';
  $('#descriptionInput').value = data.description || '';
  $('#instructionsInput').value = data.instructions || '';
  $('#technicalPointsInput').value = data.technical_points || '';
  $('#commonErrorsInput').value = data.common_errors || '';
  $('#equipmentInput').value = (data.equipment || []).join(', ');
  $('#movementInput').value = data.movement_pattern || '';
  $('#primaryMusclesInput').value = (data.primary_muscles || []).join(', ');
  $('#secondaryMusclesInput').value = (data.secondary_muscles || []).join(', ');
  $('#minimumLevelInput').value = data.minimum_level || 1;
  $('#difficultyInput').value = data.difficulty_level || 1;
  $('#mediaUrlInput').value = data.media_url || '';
  $('#thumbnailUrlInput').value = data.thumbnail_url || '';
  $('#statusInput').value = data.status || 'draft';

  const environments = Array.isArray(data.environment)
    ? data.environment
    : [data.environment].filter(Boolean);

  Array.from($('#environmentInput').options).forEach((option) => {
    option.selected = environments.includes(option.value);
  });

  $('#duplicateButton').classList.remove('hidden');
  $('#archiveButton').classList.remove('hidden');
  $('#archiveButton').textContent = data.status === 'archived' ? 'Restaurar' : 'Arquivar';

  updateMediaPreview();
}

function valuesFromCommaSeparated(input) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectFormData() {
  return {
    id: $('#exerciseId').value || null,
    name: $('#nameInput').value.trim(),
    description: $('#descriptionInput').value.trim(),
    instructions: $('#instructionsInput').value.trim(),
    technical_points: $('#technicalPointsInput').value.trim(),
    common_errors: $('#commonErrorsInput').value.trim(),
    environment: Array.from($('#environmentInput').selectedOptions).map((option) => option.value),
    equipment: valuesFromCommaSeparated($('#equipmentInput').value),
    movement_pattern: $('#movementInput').value.trim(),
    primary_muscles: valuesFromCommaSeparated($('#primaryMusclesInput').value),
    secondary_muscles: valuesFromCommaSeparated($('#secondaryMusclesInput').value),
    minimum_level: Number($('#minimumLevelInput').value),
    difficulty_level: Number($('#difficultyInput').value),
    media_url: $('#mediaUrlInput').value.trim() || null,
    thumbnail_url: $('#thumbnailUrlInput').value.trim() || null,
    status: $('#statusInput').value,
  };
}

async function saveExercise(event) {
  event.preventDefault();

  const payload = collectFormData();

  if (!payload.name) {
    alert('Informe o nome do exercício.');
    $('#nameInput').focus();
    return;
  }

  if (!payload.environment.length) {
    alert('Selecione ao menos um ambiente.');
    $('#environmentInput').focus();
    return;
  }

  const { data, error } = await supabase.rpc('save_exercise', {
    p_exercise: payload,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível concluir esta ação agora.');
    return;
  }

  alert('Exercício salvo.');
  closeDrawer();
  loadExercises();
}

async function duplicateExercise() {
  if (!state.currentExercise) return;

  const payload = collectFormData();
  payload.id = null;
  payload.name = `${payload.name} — cópia`;
  payload.status = 'draft';

  const { error } = await supabase.rpc('save_exercise', {
    p_exercise: payload,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível duplicar este exercício.');
    return;
  }

  alert('Exercício duplicado.');
  closeDrawer();
  loadExercises();
}

async function archiveOrRestoreExercise() {
  if (!state.currentExercise) return;

  const isArchived = state.currentExercise.status === 'archived';
  const rpcName = isArchived ? 'restore_exercise' : 'archive_exercise';

  const { error } = await supabase.rpc(rpcName, {
    p_exercise_id: state.currentExercise.id,
  });

  if (error) {
    console.error(error);
    alert('Não foi possível concluir esta ação agora.');
    return;
  }

  alert(isArchived ? 'Exercício restaurado.' : 'Exercício arquivado.');
  closeDrawer();
  loadExercises();
}

function updateMediaPreview() {
  const mediaUrl = $('#mediaUrlInput').value.trim();
  const thumbnailUrl = $('#thumbnailUrlInput').value.trim();
  const preview = $('#mediaPreview');

  if (thumbnailUrl) {
    preview.innerHTML = `
      <strong>Pré-visualização da mídia</strong>
      <img src="${escapeHtml(thumbnailUrl)}" alt="Imagem de capa do exercício">
      ${mediaUrl ? `<p><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noopener noreferrer">Abrir demonstração</a></p>` : ''}`;
    return;
  }

  if (mediaUrl) {
    preview.innerHTML = `
      <strong>Pré-visualização da mídia</strong>
      <p><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noopener noreferrer">Abrir demonstração em nova aba</a></p>`;
    return;
  }

  preview.innerHTML = `
    <strong>Pré-visualização da mídia</strong>
    <p class="muted">Nenhuma demonstração disponível.</p>`;
}

let searchTimer;
$('#searchInput').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = event.target.value.trim();
    state.page = 1;
    loadExercises();
  }, 350);
});

$('#clearSearch').addEventListener('click', () => {
  $('#searchInput').value = '';
  state.search = '';
  state.page = 1;
  loadExercises();
});

[
  ['environmentFilter', 'environment'],
  ['statusFilter', 'status'],
  ['levelFilter', 'minimumLevel'],
  ['movementFilter', 'movement'],
  ['equipmentFilter', 'equipment'],
  ['difficultyFilter', 'difficulty'],
].forEach(([id, stateKey]) => {
  const element = $('#' + id);
  const eventName = element.tagName === 'INPUT' ? 'change' : 'change';
  element.addEventListener(eventName, (event) => {
    state[stateKey] = event.target.value.trim();
    state.page = 1;
    loadExercises();
  });
});

$('#orderSelect').addEventListener('change', (event) => {
  state.order = event.target.value;
  state.page = 1;
  loadExercises();
});

$('#filterToggle').addEventListener('click', () => $('#filtersPanel').classList.toggle('open'));
$('#menuButton').addEventListener('click', () => $('#filtersPanel').classList.toggle('open'));
$('#refreshButton').addEventListener('click', loadExercises);

$('#newExerciseButton').addEventListener('click', () => {
  resetForm();
  openDrawer();
});

$('#closeDrawer').addEventListener('click', closeDrawer);
$('#exerciseDrawer').addEventListener('click', (event) => {
  if (event.target === $('#exerciseDrawer')) closeDrawer();
});

$('#exerciseForm').addEventListener('submit', saveExercise);
$('#duplicateButton').addEventListener('click', duplicateExercise);
$('#archiveButton').addEventListener('click', archiveOrRestoreExercise);
$('#mediaUrlInput').addEventListener('input', updateMediaPreview);
$('#thumbnailUrlInput').addEventListener('input', updateMediaPreview);

loadExercises();
