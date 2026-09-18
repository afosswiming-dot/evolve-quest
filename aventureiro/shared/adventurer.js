/* Presentation helpers only; no session, API, or persistence access. */
(() => {
  'use strict';
  const page = location.pathname.split('/').filter(Boolean)[0];
  const onboarding = ['boas-vindas', 'avaliacao-inicial', 'tela-espera'].includes(page);
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'eq-skip'; skip.href = '#' + main.id; skip.textContent = 'Pular para o conteúdo';
    document.body.prepend(skip);
  }
  if (!onboarding) {
    document.querySelectorAll('.bottom-nav').forEach(nav => nav.remove());
    const links = [['painel-aventureiro','Início','⌂'],['missoes','Missões','◇'],['jornada','Jornada','⌁'],['progressao','Progresso','↗'],['perfil','Perfil','○']];
    const nav = document.createElement('nav');
    nav.className = 'eq-nav'; nav.setAttribute('aria-label','Navegação principal');
    links.forEach(([route, label, icon]) => {
      const link = document.createElement('a'); link.href = '/' + route + '/';
      if (page === route || (page === 'registro-missao' && route === 'missoes') || (page === 'feedback-evolucao' && route === 'progressao')) link.setAttribute('aria-current','page');
      const mark = document.createElement('span'); mark.className = 'eq-nav-icon'; mark.setAttribute('aria-hidden','true'); mark.textContent = icon;
      link.append(mark, document.createTextNode(label)); nav.append(link);
    });
    document.body.append(nav); document.body.classList.add('eq-has-nav');
    if (!document.querySelector('header')) {
      const header = document.createElement('header'); header.className = 'eq-header';
      header.innerHTML = '<strong>EVOLVE Quest</strong><a href="/painel-aventureiro/">Início</a>';
      document.body.prepend(header);
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-eq-retry]')) location.reload();
  });
})();
