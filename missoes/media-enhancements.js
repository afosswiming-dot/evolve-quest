'use strict';

// EVOLVE Quest — Ilustrações dos exercícios
// Executa depois de app.js e melhora somente a apresentação da mídia.

renderExercise = function renderExerciseWithIllustration(exercise, started) {
  const checked = state.completedExercises.has(exercise.id);

  const media = exercise.mediaUrl
    ? `<a class="exercise-media exercise-media-image"
          href="${exercise.mediaUrl}"
          target="_blank"
          rel="noopener"
          aria-label="Abrir ilustração de ${exercise.name}">
        <img
          src="${exercise.mediaUrl}"
          alt="Demonstração do exercício ${exercise.name}"
          loading="lazy"
          decoding="async"
        />
        <span class="exercise-media-caption">Toque para ampliar</span>
      </a>`
    : `<div class="exercise-media"
            role="img"
            aria-label="Demonstração de ${exercise.name} ainda não disponível">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <path d="M10 8.8l5 3.2-5 3.2z"/>
        </svg>
      </div>`;

  return `<div class="exercise" id="exercise-${exercise.id}">
    <div class="exercise-head">
      <span class="exercise-name">${exercise.name}</span>
    </div>

    ${media}

    <div class="exercise-data">
      <div class="data-cell"><span>Séries</span><strong>${exercise.sets}</strong></div>
      <div class="data-cell"><span>Repetições</span><strong>${exercise.reps}</strong></div>
      <div class="data-cell"><span>Intervalo</span><strong>${exercise.rest}</strong></div>
    </div>

    <p class="healer-note">
      <strong>Observação do Healer:</strong> ${exercise.note}
    </p>

    ${exercise.alternative
      ? `<p class="alternative"><strong>Alternativa:</strong> ${exercise.alternative}</p>`
      : ''}

    <label class="exercise-check">
      <input
        type="checkbox"
        data-exercise="${exercise.id}"
        ${checked ? 'checked' : ''}
        ${!started || state.paused ? 'disabled' : ''}
      >
      Marcar exercício como concluído
    </label>
  </div>`;
};

const mediaStyle = document.createElement('style');
mediaStyle.textContent = `
  .exercise-media-image {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    border-radius: 18px;
    background: #f7f3ec;
    margin: 14px 0 16px;
    text-decoration: none;
  }

  .exercise-media-image img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 420px;
    object-fit: contain;
    background: #f7f3ec;
  }

  .exercise-media-caption {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(24, 15, 29, .78);
    color: #fff;
    font: 600 11px/1.2 Inter, sans-serif;
    letter-spacing: .02em;
    backdrop-filter: blur(6px);
  }

  @media (max-width: 640px) {
    .exercise-media-image img {
      max-height: 360px;
    }
  }
`;
document.head.appendChild(mediaStyle);
