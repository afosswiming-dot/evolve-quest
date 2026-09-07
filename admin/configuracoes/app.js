'use strict';
const SUPABASE_URL='https://gtmngtweohixfeajljik.supabase.co',SUPABASE_PUBLISHABLE_KEY='sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF';
const configured=!SUPABASE_URL.startsWith('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const supabase=configured?window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'evolve-quest-healer-auth'}}):null;
const S={classes:[],levels:[],chapters:[],healers:[],auditPage:1,auditTotal:0,actorRole:null};
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function status(m){$('#status').innerHTML=`<div class="card"><strong>${esc(m)}</strong></div>`}
async function auth(){
  if(!configured){status('Configure o Supabase para carregar a gestão de Capítulos.');return false}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/healer/login/';return false}
  const {data:p,error:profileError}=await supabase.from('profiles').select('role,account_status').eq('id',session.user.id).single();
  if(profileError||!p||!['healer','admin'].includes(p.role)||p.account_status!=='active'){
    status('Este ambiente é exclusivo para Healers e Administradores autorizados.');
    return false;
  }
  const {data:ok,error:roleError}=await supabase.rpc('is_healer_or_admin');
  if(roleError||ok!==true){status('A autorização administrativa não pôde ser confirmada.');return false}
  S.actorRole=p.role;
  configureRoleView();
  return true;
}
function activatePanel(name){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
  document.querySelectorAll('.panel-page').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));
}
function configureRoleView(){
  if(S.actorRole==='admin')return;
  document.querySelectorAll('[data-admin-only]').forEach(el=>el.hidden=true);
  $('#pageHeading').textContent='Gestão de Capítulos';
  $('#pageDescription').textContent='Crie, revise e publique os Capítulos oficiais da Jornada.';
  activatePanel('chapters');
}
async function load(){
  status('Carregando configurações...');
  if(!(await auth()))return;

  if(S.actorRole==='healer'){
    const [l,ch]=await Promise.all([
      supabase.from('adventurer_levels').select('*').order('display_order'),
      supabase.from('chapters').select('*').order('display_order').order('chapter_number')
    ]);
    if(ch.error){status('Não foi possível carregar os Capítulos agora.');return}
    $('#status').innerHTML='';
    S.levels=l.error?[]:(l.data||[]);
    S.chapters=ch.data||[];
    renderAll();
    return;
  }

  const [sum,c,l,ch,h]=await Promise.all([
    supabase.rpc('get_admin_settings_summary'),
    supabase.from('adventurer_classes').select('*').order('display_order'),
    supabase.from('adventurer_levels').select('*').order('display_order'),
    supabase.from('chapters').select('*').order('display_order').order('chapter_number'),
    supabase.rpc('get_admin_healers',{p_search:null,p_status:null})
  ]);
  if(sum.error||c.error||ch.error||h.error){status('Não foi possível concluir esta ação agora.');return}
  $('#status').innerHTML='';
  S.classes=c.data||[];
  S.levels=l.error?[]:(l.data||[]);
  S.chapters=ch.data||[];
  S.healers=Array.isArray(h.data)?h.data:(h.data?.items||[]);
  const x=sum.data||{};
  mc.textContent=x.activeClasses??0;ml.textContent=x.activeLevels??0;mch.textContent=x.activeChapters??0;
  mh.textContent=x.activeHealers??0;mu.textContent=x.unassignedAdventurers??0;ma.textContent=x.recentAdminChanges??0;
  renderAll();
  loadAudit();
}
function ccard(title,sub,statusv,actions=''){return `<article class="card"><div><h3>${esc(title)}</h3><p class="muted">${esc(sub||'')}</p></div><span class="badge">${esc(statusv||'')}</span><div class="actions">${actions}</div></article>`}
function renderAll(){classes.innerHTML=S.classes.length?S.classes.map(x=>ccard(x.name,x.description,x.status,`<button class="btn primary" data-ce="${x.id}">Editar</button><button class="btn secondary" data-ca="${x.id}">Arquivar</button>`)).join(''):'<div class="card">Nenhuma Classe cadastrada.</div>';levels.innerHTML=S.levels.length?S.levels.map(x=>ccard(`Nível ${x.level_number} · ${x.name||''}`,x.description,x.status,`<button class="btn primary" data-le="${x.id}">Editar</button>`)).join(''):'<div class="card">Nenhum Nível cadastrado.</div>';chapters.innerHTML=S.chapters.length?S.chapters.map(x=>ccard(`Capítulo ${x.chapter_number} · ${x.title}`,`Nível ${x.level_number} · ${x.estimated_duration_weeks||'—'} semanas`,x.status,`<button class="btn primary" data-che="${x.id}">Editar</button><a class="btn secondary" href="/healer/missoes/?chapter_id=${encodeURIComponent(x.id)}">Ver Missões</a>`)).join(''):'<div class="card">Nenhum Capítulo cadastrado.</div>';renderHealers();document.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>editClass(b.dataset.ce));document.querySelectorAll('[data-le]').forEach(b=>b.onclick=()=>editLevel(b.dataset.le));document.querySelectorAll('[data-che]').forEach(b=>b.onclick=()=>editChapter(b.dataset.che));document.querySelectorAll('[data-ca]').forEach(b=>b.onclick=()=>archiveClass(b.dataset.ca))}
function renderHealers(){let q=healerSearch.value.toLowerCase(),f=healerFilter.value;let a=S.healers.filter(x=>(!q||`${x.displayName||''} ${x.email||''}`.toLowerCase().includes(q))&&(!f||x.accountStatus===f));healers.innerHTML=a.length?a.map(x=>ccard(x.displayName||x.email,x.email,x.accountStatus,`<button class="btn primary" data-he="${x.id}">Editar acesso</button><button class="btn secondary" data-as="${x.id}">Atribuir Aventureiro</button>`)).join(''):'<div class="card">Nenhum Healer cadastrado.</div>';document.querySelectorAll('[data-he]').forEach(b=>b.onclick=()=>editHealer(b.dataset.he));document.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>assign(b.dataset.as))}
function openEditor(title,body,handler){drawerTitle.textContent=title;editorForm.innerHTML=body;drawer.classList.add('open');editorForm.onsubmit=async e=>{e.preventDefault();const submit=e.currentTarget.querySelector('[type="submit"]');if(submit?.disabled)return;if(submit)submit.disabled=true;try{await handler(new FormData(e.currentTarget))}finally{if(submit)submit.disabled=false}}}
function close(){drawer.classList.remove('open')}
function formActions(label){return `<div class="form-actions"><button class="btn primary" type="submit">${label}</button></div>`}
function editClass(id=null){let x=S.classes.find(v=>v.id===id)||{};openEditor(id?'Editar Classe':'Nova Classe',`<div class="form-grid"><div class="field"><label>Nome</label><input name="name" required value="${esc(x.name||'')}"></div><div class="field"><label>Slug</label><input name="slug" required value="${esc(x.slug||'')}"></div><div class="field"><label>Descrição</label><textarea name="description">${esc(x.description||'')}</textarea></div><div class="field"><label>Ordem</label><input name="display_order" type="number" min="0" value="${x.display_order??0}"></div><div class="field"><label>Status</label><select name="status"><option>active</option><option>inactive</option><option>archived</option></select></div></div>${formActions('Salvar Classe')}`,async fd=>{let p=Object.fromEntries(fd.entries());p.display_order=Number(p.display_order);let r=await supabase.rpc(id?'update_adventurer_class':'create_adventurer_class',id?{p_class_id:id,p_data:p}:{p_data:p});if(r.error)return alert('Não foi possível concluir esta ação agora.');alert(id?'Classe atualizada.':'Classe criada com sucesso.');close();load()})}
function editLevel(id=null){let x=S.levels.find(v=>v.id===id)||{};openEditor(id?'Editar Nível':'Novo Nível',`<div class="form-grid"><div class="field"><label>Número</label><input name="level_number" type="number" min="1" required value="${x.level_number??1}"></div><div class="field"><label>Nome</label><input name="name" required value="${esc(x.name||'')}"></div><div class="field"><label>Slug</label><input name="slug" required value="${esc(x.slug||'')}"></div><div class="field"><label>Descrição</label><textarea name="description">${esc(x.description||'')}</textarea></div><div class="field"><label>Objetivo</label><textarea name="objective">${esc(x.objective||'')}</textarea></div><div class="field"><label>Status</label><select name="status"><option>active</option><option>inactive</option><option>archived</option></select></div></div>${formActions('Salvar Nível')}`,async fd=>{let p=Object.fromEntries(fd.entries());p.level_number=Number(p.level_number);let r=await supabase.rpc(id?'update_adventurer_level':'create_adventurer_level',id?{p_level_id:id,p_data:p}:{p_data:p});if(r.error)return alert('Não foi possível concluir esta ação agora.');alert('Nível salvo.');close();load()})}
function chapterError(error){
  const message=error?.message||'';
  if(message.includes('ACTIVE_CHAPTER_NUMBER_EXISTS'))return'Já existe um Capítulo ativo com este número.';
  if(message.includes('ACTIVE_CHAPTER_SLUG_EXISTS'))return'Já existe um Capítulo ativo com este slug.';
  if(message.includes('CHAPTER_IN_USE'))return'Este Capítulo está em uso por uma Jornada atual e não pode ser desativado ou arquivado.';
  if(message.includes('INVALID_SLUG'))return'Use um slug em minúsculas, sem espaços e separado por hífens.';
  if(message.includes('INVALID_LEVEL'))return'Selecione um Nível cadastrado.';
  if(message.includes('ACCESS_DENIED'))return'Você não possui autorização para gerenciar Capítulos.';
  return'Não foi possível salvar o Capítulo agora.';
}
function editChapter(id=null){
  const x=S.chapters.find(v=>v.id===id)||{};
  const selectedStatus=x.status||'draft';
  const levels=S.levels.length
    ? S.levels.map(level=>`<option value="${level.level_number}" ${Number(level.level_number)===Number(x.level_number||1)?'selected':''}>Nível ${level.level_number} · ${esc(level.name||'')}</option>`).join('')
    : `<option value="${x.level_number||1}">Nível ${x.level_number||1}</option>`;
  const statuses=['draft','active','archived'].map(value=>`<option value="${value}" ${value===selectedStatus?'selected':''}>${{draft:'Rascunho',active:'Ativo',archived:'Arquivado'}[value]}</option>`).join('');

  openEditor(id?'Editar Capítulo':'Novo Capítulo',`
    <div class="form-grid">
      <div class="field"><label>Número</label><input name="chapter_number" type="number" min="1" required value="${x.chapter_number??1}"></div>
      <div class="field"><label>Título</label><input name="title" maxlength="160" required value="${esc(x.title||'')}"></div>
      <div class="field"><label>Slug</label><input name="slug" maxlength="160" pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="exemplo-de-capitulo" value="${esc(x.slug||'')}"></div>
      <div class="field"><label>Nível</label><select name="level_number" required>${levels}</select></div>
      <div class="field"><label>Duração estimada (semanas)</label><input name="estimated_duration_weeks" type="number" min="1" required value="${x.estimated_duration_weeks??4}"></div>
      <div class="field"><label>Ordem de exibição</label><input name="display_order" type="number" min="0" required value="${x.display_order??0}"></div>
      <div class="field"><label>Descrição</label><textarea name="description">${esc(x.description||'')}</textarea></div>
      <div class="field"><label>Objetivo</label><textarea name="objective">${esc(x.objective||'')}</textarea></div>
      <div class="field"><label>Status</label><select name="status" required>${statuses}</select></div>
    </div>
    ${formActions(id?'Salvar alterações':'Criar Capítulo')}
  `,async fd=>{
    const p=Object.fromEntries(fd.entries());
    p.chapter_number=Number(p.chapter_number);
    p.level_number=Number(p.level_number);
    p.estimated_duration_weeks=Number(p.estimated_duration_weeks);
    p.display_order=Number(p.display_order);
    if(p.status==='active'&&!confirm('Ativar este Capítulo e disponibilizá-lo no catálogo oficial?'))return;
    if(p.status==='archived'&&!confirm('Arquivar este Capítulo? Ele deixará de aparecer para os Aventureiros.'))return;
    const r=await supabase.rpc(id?'update_chapter':'create_chapter',id?{p_chapter_id:id,p_data:p}:{p_data:p});
    if(r.error)return alert(chapterError(r.error));
    alert(id?'Capítulo atualizado com sucesso.':'Capítulo criado com sucesso.');
    close();
    load();
  });
}
function editHealer(id){let x=S.healers.find(v=>v.id===id)||{};openEditor('Editar acesso administrativo',`<div class="form-grid"><div class="field"><label>Nome</label><input disabled value="${esc(x.displayName||'')}"></div><div class="field"><label>E-mail</label><input disabled value="${esc(x.email||'')}"></div><div class="field"><label>Função</label><select name="role"><option>healer</option><option>admin</option><option>adventurer</option></select></div><div class="field"><label>Status</label><select name="account_status"><option>active</option><option>inactive</option></select></div><div class="field"><label>Nome de exibição</label><input name="display_name" value="${esc(x.displayName||'')}"></div></div>${formActions('Salvar acesso')}`,async fd=>{let r=await supabase.rpc('update_healer_status',{p_user_id:id,p_data:Object.fromEntries(fd.entries())});if(r.error)return alert('Não foi possível concluir esta ação agora.');alert('Healer atualizado.');close();load()})}
async function archiveClass(id){if(!confirm('Arquivar esta Classe?'))return;let r=await supabase.rpc('archive_adventurer_class',{p_class_id:id});if(r.error)return alert('Não foi possível concluir esta ação agora.');alert('Classe arquivada.');load()}
async function assign(hid){let aid=prompt('Informe o UUID do Aventureiro:');if(!aid)return;let r=await supabase.rpc('assign_adventurer_to_healer',{p_adventurer_id:aid,p_healer_id:hid});if(r.error)return alert('Não foi possível atualizar o vínculo.');alert('Vínculo atualizado.');load()}
async function loadAudit(){if(!configured)return;let r=await supabase.rpc('get_admin_audit_logs',{p_search:auditSearch.value||null,p_action:auditFilter.value||null,p_page:S.auditPage,p_page_size:50});if(r.error){audit.innerHTML='<div class="card">Não foi possível carregar a auditoria.</div>';return}let rows=Array.isArray(r.data)?r.data:(r.data?.items||[]);S.auditTotal=Number(r.data?.totalCount??rows[0]?.totalCount??0);audit.innerHTML=rows.length?rows.map(x=>ccard(x.actionLabel||x.action,`${x.actorName||'—'} · ${x.resourceType||'—'} · ${x.createdAt||'—'}`,'')).join(''):'<div class="card">Nenhum evento encontrado.</div>';let pages=Math.max(1,Math.ceil(S.auditTotal/50));pagination.innerHTML=pages>1?`<button data-p="${S.auditPage-1}" ${S.auditPage===1?'disabled':''}>‹</button><button>${S.auditPage}</button><button data-p="${S.auditPage+1}" ${S.auditPage===pages?'disabled':''}>›</button>`:'';pagination.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.auditPage=Number(b.dataset.p);loadAudit()})}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel-page').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector(`[data-panel="${b.dataset.tab}"]`).classList.add('active');if(b.dataset.tab==='audit')loadAudit()});newClass.onclick=()=>editClass();newLevel.onclick=()=>editLevel();newChapter.onclick=()=>editChapter();promote.onclick=async()=>{let id=prompt('Informe o UUID do usuário existente no Supabase Auth:');if(!id)return;let r=await supabase.rpc('promote_user_to_healer',{p_user_id:id});if(r.error)return alert('Não foi possível autorizar este usuário.');alert('Healer autorizado.');load()};refresh.onclick=load;closeDrawer.onclick=close;healerSearch.oninput=renderHealers;healerFilter.onchange=renderHealers;auditSearch.oninput=()=>{S.auditPage=1;loadAudit()};auditFilter.onchange=()=>{S.auditPage=1;loadAudit()};drawer.onclick=e=>{if(e.target===drawer)close()};load();
