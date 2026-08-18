import {PixelButton} from "./PixelButton.js";
import {PixelBadge} from "./PixelBadge.js";

const statusLabel={
  available:"DISPONÍVEL",
  "in-progress":"EM ANDAMENTO",
  completed:"CONCLUÍDA",
  locked:"BLOQUEADA"
};

export function MissionCard({mission,onAction}){
  const pct=Math.round((mission.progress/mission.total)*100);
  const card=document.createElement("article");
  card.className=`mission-card ${mission.status}`;
  const head=document.createElement("div");
  head.className="mission-head";
  head.innerHTML=`<span class="mission-code">${mission.code}</span>`;
  head.append(PixelBadge({
    label:statusLabel[mission.status],
    state:mission.status==="completed"?"completed":mission.status==="locked"?"locked":"active"
  }));
  card.append(head);

  const body=document.createElement("div");
  body.innerHTML=`
    <h3>${mission.title}</h3>
    <p>${mission.description}</p>
    <div class="progress-meta"><span>Progresso</span><strong>${mission.progress} / ${mission.total}</strong></div>
    <div class="mini-progress" aria-hidden="true"><span style="--progress:${pct}%"></span></div>`;
  card.append(body);

  const footer=document.createElement("div");
  footer.className="mission-footer";
  footer.innerHTML=`<span class="mission-xp">+${mission.xpReward} XP</span>`;
  let label="INICIAR MISSÃO";
  let variant="primary";
  let disabled=false;
  if(mission.status==="in-progress") label="CONTINUAR";
  if(mission.status==="completed"){label="VER CONCLUSÃO";variant="secondary"}
  if(mission.status==="locked"){label="BLOQUEADA";disabled=true}
  footer.append(PixelButton({label,variant,disabled,onClick:()=>onAction?.(mission)}));
  card.append(footer);
  return card;
}
