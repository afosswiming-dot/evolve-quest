'use strict';
const db=window.supabase.createClient(
  'https://gtmngtweohixfeajljik.supabase.co',
  'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(v)):'';

const CHARACTERS=[
{id:'warrior-m',name:'Guerreiro',gender:'Masculino',className:'sprite-warrior-m'},
{id:'warrior-f',name:'Guerreira',gender:'Feminino',className:'sprite-warrior-f'},
{id:'mage-m',name:'Mago',gender:'Masculino',className:'sprite-mage-m'},
{id:'mage-f',name:'Maga',gender:'Feminino',className:'sprite-mage-f'},
{id:'vampire-m',name:'Vampiro',gender:'Masculino',className:'sprite-vampire-m'},
{id:'vampire-f',name:'Vampira',gender:'Feminino',className:'sprite-vampire-f'},
{id:'bard-m',name:'Bardo',gender:'Masculino',className:'sprite-bard-m'},
{id:'bard-f',name:'Barda',gender:'Feminino',className:'sprite-bard-f'}];

let selectedCharacterId=localStorage.getItem('evolveQuestCharacter')||'warrior-m';
let journeyData=null;

function getTotalXp(data){
 const p=data.profile||{},j=data.journey||{},s=data.summary||{};
 const vals=[j.totalXp,j.total_xp,j.xp,j.currentXp,j.current_xp,p.totalXp,p.total_xp,p.xp,s.totalXp,s.total_xp,s.xp,data.totalXp,data.total_xp,data.xp];
 const v=vals.map(Number).find(x=>Number.isFinite(x)&&x>0);
 return v||0;
}
function xpProgress(xp){
 const marks=[0,500,1000,1500,2000,3000,5000,10000];
 const next=marks.find(v=>v>xp)||10000;
 const prev=[...marks].reverse().find(v=>v<=xp)||0;
 return next===prev?100:Math.max(0,Math.min(100,((xp-prev)/(next-prev))*100));
}
function currentCharacter(){return CHARACTERS.find(c=>c.id===selectedCharacterId)||CHARACTERS[0]}

(async()=>{
 try{
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user)return location.replace('/login/');
  const {data,error}=await db.rpc('get_my_journey_map');
  if(error)throw error;
  journeyData=data||{};
  render(journeyData);
 }catch(error){
  console.error('[EVOLVE Jornada v4]',error);
  $('status').innerHTML='<strong>Não foi possível carregar sua Jornada.</strong>';
 }
})();

function render(data){
 const p=data.profile||{},j=data.journey||{},c=data.chapter||{},s=data.summary||{};
 const progress=Math.max(0,Math.min(100,Number(j.chapterProgress||0)));
 const planned=Math.max(1,Number(j.plannedSessions||0)||8);
 const completed=Math.max(0,Number(j.completedSessions||0));
 const xp=getTotalXp(data);
 const level=Number(p.currentLevel||1);

 $('status').hidden=true;$('journeyContent').hidden=false;
 $('chapterNumber').textContent=c.number||'I';
 $('chapterTitle').textContent=(c.title||'Construindo a Base').toUpperCase();
 $('chapterObjective').textContent=c.objective||'Cada passo te aproxima de uma versão mais forte de você.';
 $('progressText').textContent=`${progress}%`;
 $('progressBar').style.width=`${progress}%`;
 $('sessionsLabel').textContent=`${completed} de ${planned} sessões`;
 $('mapSessionsLabel').textContent=`${completed} de ${planned} sessões`;

 $('levelNumber').textContent=level;
 $('totalXp').textContent=`${xp} XP`;
 $('xpBar').style.width=`${xpProgress(xp)}%`;
 $('className').textContent=p.className||'—';
 $('frequency').textContent=j.prescribedFrequency?`${j.prescribedFrequency}x / semana`:'—';
 $('streak').textContent=j.currentStreak?`${j.currentStreak} dias`:'0 dias';

 const milestone=s.nextMilestone||'Continue avançando';
 $('nextMilestone').textContent=milestone;
 $('nextMilestoneTitle').textContent=milestone.toUpperCase();
 $('nextMilestoneText').textContent=milestoneText(progress,data.checkpoint);

 renderCharacters();
 renderMap(planned,completed);
 renderDots(planned,completed);
 renderMini(data.achievements||[]);
 renderAchievements(data.achievements||[]);
 renderRecords(data.records||[]);
 renderDialog(data);
}

function milestoneText(progress,checkpoint){
 if(progress<25)return'Complete novas sessões para alcançar o primeiro marco.';
 if(progress<50)return'Você está se aproximando da metade do Capítulo.';
 if(progress<75)return'A metade ficou para trás. Continue avançando.';
 if(progress<100)return'A reta final começou. O próximo portal está perto.';
 if(checkpoint?.status!=='completed')return'Capítulo completo. Seu próximo portal é o Checkpoint.';
 return'Jornada concluída. Aguarde a próxima progressão.';
}

function renderCharacters(){
 const ch=currentCharacter();
 $('selectedSprite').className=`sprite ${ch.className}`;
 $('selectedHeroName').textContent=ch.name;$('selectedHeroGender').textContent=ch.gender;
 $('characterGrid').innerHTML=CHARACTERS.map(c=>`<button class="character-card ${c.id===selectedCharacterId?'selected':''}" data-character="${c.id}" type="button"><div class="sprite ${c.className}"></div><span>${esc(c.name)}</span></button>`).join('');
 $('characterGrid').querySelectorAll('[data-character]').forEach(btn=>btn.onclick=()=>{
  selectedCharacterId=btn.dataset.character;localStorage.setItem('evolveQuestCharacter',selectedCharacterId);
  renderCharacters();
  const j=journeyData?.journey||{};renderMap(Math.max(1,Number(j.plannedSessions||0)||8),Math.max(0,Number(j.completedSessions||0)));
 });
}
$('toggleCharacters').onclick=()=>{$('characterGrid').hidden=!$('characterGrid').hidden};

function points(count){
 const anchors=[
  {x:15,y:44},{x:26,y:51},{x:37,y:58},{x:50,y:67},
  {x:61,y:75},{x:72,y:72},{x:78,y:58},{x:85,y:42},
  {x:86,y:30},{x:74,y:28},{x:62,y:36},{x:50,y:42},
  {x:38,y:38},{x:27,y:31},{x:19,y:25},{x:13,y:18}
 ];
 return anchors.slice(0,Math.max(4,Math.min(anchors.length,count)));
}
function renderMap(planned,completed){
 const pts=points(planned),idx=Math.max(0,Math.min(pts.length-1,completed));
 $('pathLayer').innerHTML=pts.map((p,i)=>`<span class="path-node ${i<idx?'complete':i===idx?'current':'locked'}" style="left:${p.x}%;top:${p.y}%">${i<idx?'✓':i+1}</span>`).join('');
 const p=pts[idx]||pts[0],hero=$('heroMarker');
 hero.style.left=`calc(${p.x}% - 30px)`;hero.style.top=`calc(${p.y}% - 76px)`;
 hero.innerHTML=`<div class="sprite ${currentCharacter().className}"></div>`;
}
function renderDots(planned,completed){
 const n=Math.max(4,Math.min(16,planned));
 $('mapProgressDots').innerHTML=Array.from({length:n},(_,i)=>`<span class="${i<completed?'complete':i===completed?'current':''}"></span>`).join('');
}
function renderMini(items){
 const u=items.filter(a=>a.unlocked).slice(-3).reverse();
 $('achievementMiniList').innerHTML=u.length?u.map(a=>`<div class="mini-achievement"><i>◆</i><div><strong>${esc(a.title)}</strong><span>${esc(a.description)}</span></div><b>✓</b></div>`).join(''):'<div class="empty">Sua primeira conquista aparecerá aqui.</div>';
}
function renderAchievements(items){
 $('achievementGrid').innerHTML=items.map(a=>`<article class="achievement ${a.unlocked?'unlocked':'locked'}"><div class="icon"><span>${a.unlocked?'◆':'🔒'}</span></div><strong>${esc(a.title)}</strong><p>${esc(a.description)}</p></article>`).join('');
}
function renderRecords(items){
 const v=items.slice(0,5);$('recentRecords').innerHTML=v.length?v.map(r=>`<article class="record"><div class="record-mark">${r.completionStatus==='completed'?'✓':'•'}</div><div><strong>${esc(r.missionName||'Missão')}</strong><span>${esc(r.missionSubtitle||'')}</span></div><time>${fmtDate(r.submittedAt)}</time></article>`).join(''):'<div class="empty">Sua primeira missão registrada aparecerá aqui.</div>';
}
function renderDialog(data){
 const j=data.journey||{},ach=Array.isArray(data.achievements)?data.achievements:[],records=Array.isArray(data.records)?data.records:[];
 const recent=[...ach].reverse().find(a=>a.unlocked),xp=getTotalXp(data);
 let title='Mais um passo, Aventureiro!',text='Você está construindo algo grande. Cada missão concluída te deixa mais forte.',reward=xp?`${xp} XP acumulados`:'';
 if(recent){title=`${recent.title}!`;text=recent.description||text;reward='CONQUISTA DESBLOQUEADA'}
 else if(records.length){title='Sua Jornada continua!';text='Seu último Registro da Missão já faz parte deste percurso.'}
 $('dialogTitle').textContent=title;$('dialogText').textContent=text;$('dialogReward').textContent=reward;
}
window.onresize=()=>{if(journeyData){const j=journeyData.journey||{};renderMap(Math.max(1,Number(j.plannedSessions||0)||8),Math.max(0,Number(j.completedSessions||0)))}};
