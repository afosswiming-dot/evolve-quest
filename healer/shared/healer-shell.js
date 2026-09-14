(() => {
  'use strict';
  if(location.pathname.includes('/login/'))return;
  document.body.classList.add('healer-app');
  const groups=[['VISÃO GERAL',[['Painel','painel','⌂']]],['GESTÃO',[['Aventureiros','aventureiros','◉'],['Avaliações','avaliacoes','◇'],['Registros','registros','≡'],['Checkpoints','checkpoints','✓'],['Progressões','progressao','↗']]],['CONTEÚDO',[['Missões','missoes','⚑'],['Exercícios','exercicios','▦'],['Capítulos','capitulos','▤']]],['RELACIONAMENTO',[['CRM','crm','◎'],['Alertas','alertas','!']]],['SISTEMA',[['Configurações','configuracoes','⚙']]]];
  const route=location.pathname.split('/')[2];
  const aside=document.querySelector('aside.sidebar')||document.createElement('aside');
  const footer=aside.querySelector('.sidebar-footer');
  aside.className='sidebar eq-sidebar';aside.id='healerNavigation';aside.setAttribute('aria-label','Navegação do Healer');
  aside.innerHTML='<a class="eq-brand" href="/healer/painel/"><span class="eq-mark">EQ</span><span><b>EVOLVE QUEST</b><small>HEALER</small></span></a><nav class="eq-nav">'+groups.map(([title,items])=>`<div class="eq-group"><small>${title}</small>${items.map(([name,key,icon])=>{const active=key===route||(key==='aventureiros'&&route==='aventureiro')||(key==='missoes'&&route==='treinos');return `<a href="/${key==='configuracoes'?'admin':'healer'}/${key}/" ${active?'aria-current="page"':''}><span class="eq-nav-icon" aria-hidden="true">${icon}</span>${name}</a>`}).join('')}</div>`).join('')+'</nav>';
  if(footer){footer.classList.add('eq-profile');aside.append(footer)}else{const profile=document.createElement('div');profile.className='eq-profile';profile.innerHTML='<strong>Healer</strong><small>Central de Jornadas</small><button type="button" class="btn" id="eqLogout">Sair</button>';aside.append(profile);profile.querySelector('button').onclick=()=>HealerUI.logout()}
  if(!aside.isConnected)document.body.prepend(aside);
  const bar=document.createElement('div');bar.className='eq-mobile-bar';bar.innerHTML='<button type="button" aria-label="Abrir navegação" aria-controls="healerNavigation" aria-expanded="false">☰</button><strong>EVOLVE Quest <small> / Healer</small></strong>';
  document.body.prepend(bar);const toggle=bar.querySelector('button'),scrim=document.createElement('div');scrim.className='eq-scrim';document.body.append(scrim);
  const main=document.querySelector('main');if(main&&!main.id)main.id='healerMain';
  if(!document.querySelector('.skip-link')&&main){const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Pular para o conteúdo';document.body.prepend(skip)}
  function setOpen(open){document.body.classList.toggle('eq-menu-open',open);toggle.setAttribute('aria-expanded',String(open));const currentMain=document.querySelector('main');if(currentMain)currentMain.inert=open;aside.inert=!open&&!matchMedia('(min-width:1024px)').matches;if(open)aside.querySelector('a').focus();else toggle.focus()}
  toggle.onclick=()=>setOpen(!document.body.classList.contains('eq-menu-open'));scrim.onclick=()=>setOpen(false);
  document.addEventListener('keydown',e=>{if(!document.body.classList.contains('eq-menu-open'))return;if(e.key==='Escape')setOpen(false);if(e.key==='Tab'){const links=[...aside.querySelectorAll('a,button')].filter(x=>!x.hidden);const first=links[0],last=links.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  const media=matchMedia('(min-width:1024px)');aside.inert=!media.matches;media.addEventListener('change',()=>{if(media.matches&&document.body.classList.contains('eq-menu-open'))setOpen(false);aside.inert=!media.matches&&!document.body.classList.contains('eq-menu-open')});
})();
