'use strict';
(() => {
  const STAGES={new:'Novo lead',contacted:'Contatado',payment_sent:'Pagamento enviado',negotiation:'Negociação',customer:'Cliente',not_interested:'Sem interesse'};
  let crmRows=[], profileMap=new Map();
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const wa=(phone)=>{let n=String(phone||'').replace(/\D/g,'');if(!n)return'';if((n.length===10||n.length===11)&&!n.startsWith('55'))n='55'+n;return`https://wa.me/${n}`};
  const dateInput=(v)=>{if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

  function inject(){
    const dashboard=document.querySelector('#dashboardContent');
    if(!dashboard||document.querySelector('#crmSection'))return;
    const html=`<section class="crm-section" id="crmSection">
      <div class="section-heading"><div><span class="eyebrow">COMERCIAL</span><h2>Funil de Aventureiros</h2></div><span class="period-label">CRM EVOLVE</span></div>
      <div class="crm-metrics">
        <div class="crm-metric"><small>Novos leads</small><strong id="crmNew">0</strong></div>
        <div class="crm-metric"><small>Contatados</small><strong id="crmContacted">0</strong></div>
        <div class="crm-metric"><small>Pagamento enviado</small><strong id="crmPaymentSent">0</strong></div>
        <div class="crm-metric"><small>Em negociação</small><strong id="crmNegotiation">0</strong></div>
        <div class="crm-metric"><small>Clientes</small><strong id="crmCustomers">0</strong></div>
      </div>
      <article class="crm-panel">
        <div class="crm-toolbar"><div><strong>Relacionamento comercial</strong><div class="muted">Atualize contato, proposta, follow-up e observações.</div></div><input id="crmSearch" type="search" placeholder="Buscar Aventureiro..."></div>
        <div class="crm-list" id="crmList"><div class="crm-empty">Carregando CRM...</div></div>
      </article>
    </section>`;
    const first=dashboard.querySelector('section');
    if(first) first.insertAdjacentHTML('afterend',html); else dashboard.insertAdjacentHTML('afterbegin',html);
    document.querySelector('#crmSearch')?.addEventListener('input',renderRows);
  }

  const options=(cur)=>Object.entries(STAGES).map(([v,l])=>`<option value="${v}" ${v===cur?'selected':''}>${l}</option>`).join('');

  function metrics(){
    const c=s=>crmRows.filter(r=>r.pipeline_stage===s).length;
    document.querySelector('#crmNew').textContent=c('new');
    document.querySelector('#crmContacted').textContent=c('contacted');
    document.querySelector('#crmPaymentSent').textContent=c('payment_sent');
    document.querySelector('#crmNegotiation').textContent=c('negotiation');
    document.querySelector('#crmCustomers').textContent=c('customer');
  }

  function renderRows(){
    const list=document.querySelector('#crmList'); if(!list)return;
    const q=(document.querySelector('#crmSearch')?.value||'').trim().toLowerCase();
    const order={new:1,contacted:2,payment_sent:3,negotiation:4,customer:5,not_interested:6};
    const rows=[...crmRows].filter(r=>{const p=profileMap.get(r.adventurer_id)||{};return !q||`${p.full_name||''} ${p.preferred_name||''} ${p.email||''} ${p.phone||''}`.toLowerCase().includes(q)})
      .sort((a,b)=>(order[a.pipeline_stage]||99)-(order[b.pipeline_stage]||99));
    if(!rows.length){list.innerHTML='<div class="crm-empty">Nenhum Aventureiro encontrado.</div>';return}
    list.innerHTML=rows.map(r=>{
      const p=profileMap.get(r.adventurer_id)||{}, name=p.preferred_name||p.full_name||'Aventureiro', link=wa(p.phone);
      return `<div class="crm-row" data-id="${r.adventurer_id}">
        <div class="crm-person"><strong>${esc(name)}</strong><span>${esc(p.phone||'Telefone não informado')}</span><small>${esc(p.email||'')}</small><small>${esc(p.city||'')}${p.state?' · '+esc(p.state):''}</small></div>
        <div class="crm-field"><label>Status</label><select data-field="pipeline_stage">${options(r.pipeline_stage)}</select></div>
        <div class="crm-field"><label>Próximo follow-up</label><input type="date" data-field="next_follow_up_at" value="${dateInput(r.next_follow_up_at)}"></div>
        <div class="crm-field"><label>Observação comercial</label><textarea data-field="notes" placeholder="Ex.: enviei mensal e trimestral">${esc(r.notes||'')}</textarea><div class="crm-save-state" data-state></div></div>
        <div class="crm-actions">${link?`<a class="crm-btn secondary" href="${link}" target="_blank" rel="noopener">WhatsApp</a>`:''}<button class="crm-btn primary" data-action="save" type="button">Salvar</button></div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-action="save"]').forEach(b=>b.addEventListener('click',save));
  }

  async function save(e){
    const card=e.currentTarget.closest('.crm-row'), id=card.dataset.id, current=crmRows.find(r=>r.adventurer_id===id);
    const stage=card.querySelector('[data-field="pipeline_stage"]').value, follow=card.querySelector('[data-field="next_follow_up_at"]').value, notes=card.querySelector('[data-field="notes"]').value.trim(), state=card.querySelector('[data-state]'), now=new Date().toISOString();
    state.textContent='Salvando...'; state.className='crm-save-state';
    const payload={pipeline_stage:stage,next_follow_up_at:follow?new Date(`${follow}T12:00:00`).toISOString():null,notes:notes||null,updated_at:now};
    if(stage==='contacted'&&!current?.last_contact_at)payload.last_contact_at=now;
    if(stage==='payment_sent'){payload.payment_status='sent';payload.payment_options_sent_at=current?.payment_options_sent_at||now;payload.last_contact_at=now}
    if(stage==='customer')payload.payment_status='paid';
    const {data:{session}}=await supabaseClient.auth.getSession(); if(session?.user?.id)payload.updated_by=session.user.id;
    const {error}=await supabaseClient.from('adventurer_crm').update(payload).eq('adventurer_id',id);
    if(error){console.error('[EVOLVE CRM]',error);state.textContent='Erro ao salvar';state.className='crm-save-state error';return}
    Object.assign(current,payload);state.textContent='Salvo';state.className='crm-save-state ok';metrics();setTimeout(()=>state.textContent='',1500);
  }

  async function load(){
    inject();
    for(let i=0;i<50 && !supabaseClient;i++) await new Promise(r=>setTimeout(r,100));
    if(!supabaseClient)return;
    const {data:crm,error}=await supabaseClient.from('adventurer_crm').select('*');
    if(error){console.error('[EVOLVE CRM]',error);document.querySelector('#crmList').innerHTML='<div class="crm-empty">Não foi possível carregar o CRM.</div>';return}
    crmRows=crm||[];
    const ids=crmRows.map(r=>r.adventurer_id);
    if(ids.length){
      const {data:profiles}=await supabaseClient.from('profiles').select('id,full_name,preferred_name,email,phone,city,state,created_at').in('id',ids);
      profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
    }
    metrics();renderRows();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(load,250));
})();