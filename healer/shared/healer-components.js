(() => {
  'use strict';
  const enhance=root=>{
    root.querySelectorAll('table:not([data-eq-table])').forEach(table=>{table.dataset.eqTable='true';const wrapper=document.createElement('div');wrapper.className='eq-table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Tabela com rolagem horizontal');table.before(wrapper);wrapper.append(table)});
    root.querySelectorAll('input,select,textarea').forEach(el=>{if(el.type==='hidden'||el.getAttribute('aria-label')||el.labels?.length)return;const label=el.closest('.field')?.querySelector('label')?.textContent||el.placeholder||el.name||'Filtro';el.setAttribute('aria-label',label)});
    root.querySelectorAll('.badge').forEach(el=>{const raw=el.textContent.trim();if(HealerUI.labels[raw])el.textContent=HealerUI.status(raw);const text=el.textContent;const tone=/Conclu|Ativo|Apto/.test(text)?'success':/Crítica|Alta|Dor/.test(text)?'danger':/Pendente|análise|Atenção|Enviado/.test(text)?'warning':'';if(tone&&el.dataset.tone!==tone)el.dataset.tone=tone});
    root.querySelectorAll('button').forEach(el=>{if(el.textContent.trim()==='×'&&!el.hasAttribute('aria-label'))el.setAttribute('aria-label','Fechar');});
    root.querySelectorAll('#statusRegion,#status,#statusPanel').forEach(el=>{
      if(!el.textContent.trim())return;
      const failed=/Não foi possível|Erro ao carregar|indisponível/.test(el.textContent);
      el.setAttribute('role',failed?'alert':'status');
      if(failed&&!el.querySelector('button')&&!el.closest('form')){const retry=document.createElement('button');retry.className='btn btn-secondary';retry.type='button';retry.textContent='Tentar novamente';retry.onclick=()=>{const refresh=document.querySelector('#refreshBtn,#refreshButton,#refresh');if(refresh)refresh.click();else location.reload()};el.append(retry)}
    });
  };
  document.addEventListener('DOMContentLoaded',()=>{
    enhance(document);
    let queued=false;new MutationObserver(records=>{if(!records.some(r=>r.type==='childList')||queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance(document)})}).observe(document.body,{childList:true,subtree:true});
    // Persist only list controls, never editor data or authentication material.
    const controls=[...document.querySelectorAll('.toolbar input,.toolbar select,.filters input,.filters select')].filter(x=>x.id&&!x.closest('.drawer,.modal,.overlay'));
    const key='healer-filters:'+location.pathname;
    let saved={};try{saved=JSON.parse(sessionStorage.getItem(key)||'{}')}catch{}
    if(!location.search&&Object.keys(saved).length){controls.forEach(el=>{if(saved[el.id]!==undefined){el.value=saved[el.id];el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))}})}
    controls.forEach(el=>{const remember=()=>{try{sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(controls.map(c=>[c.id,c.value]))))}catch{}};el.addEventListener('input',remember);el.addEventListener('change',remember)});
    controls.filter(el=>el.tagName==='INPUT'&&/search/i.test(el.id)&&!el.parentElement.querySelector('button')).forEach(el=>{const clear=document.createElement('button');clear.type='button';clear.className='btn btn-secondary';clear.textContent='Limpar';clear.setAttribute('aria-label','Limpar busca');clear.onclick=()=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()};el.after(clear)});
    // Keep legacy editor handlers; add keyboard semantics around their open state.
    let active=null,returnFocus=null,pending=false;
    const checkDialogs=()=>{pending=false;const candidates=[...document.querySelectorAll('.overlay.open,.drawer.open,.detail-drawer.open,.modal.open')].filter(el=>el.getBoundingClientRect().width>0);const next=candidates.at(-1)||null;if(next===active)return;if(active&&!next){returnFocus?.focus();active=null;return}if(next){returnFocus=document.activeElement;active=next;next.setAttribute('role','dialog');next.setAttribute('aria-modal','true');next.setAttribute('aria-label',next.querySelector('h2')?.textContent||'Editor');next.querySelector('button,input,select,textarea')?.focus()}};
    new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(checkDialogs)}}).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});
    document.addEventListener('keydown',e=>{if(!active||document.querySelector('dialog[open]'))return;const controls=[...active.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(x=>!x.disabled&&x.getBoundingClientRect().width>0);if(e.key==='Escape'){const close=active.querySelector('[id^=close],.close,.close-button,.x');close?.click()}if(e.key==='Tab'&&controls.length){const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  });
})();
