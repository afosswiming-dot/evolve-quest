import {PixelButton} from "./PixelButton.js";

export function MissionCompleteModal({mission,onClose}){
  const overlay=document.createElement("div");
  overlay.className="modal-overlay";
  overlay.setAttribute("role","presentation");

  const card=document.createElement("section");
  card.className="modal-card";
  card.setAttribute("role","dialog");
  card.setAttribute("aria-modal","true");
  card.setAttribute("aria-labelledby","missionCompleteTitle");

  const close=document.createElement("button");
  close.type="button"; close.className="modal-close"; close.setAttribute("aria-label","Fechar"); close.textContent="×";
  close.addEventListener("click",onClose);

  card.append(close);
  card.insertAdjacentHTML("beforeend",`
    <div class="modal-medal" aria-hidden="true">⚔</div>
    <span class="modal-kicker">MISSÃO CONCLUÍDA!</span>
    <h2 id="missionCompleteTitle">${mission.title}</h2>
    <p>Você concluiu a missão e avançou na Jornada.</p>
    <div class="reward-panel"><span>RECOMPENSA</span><strong>+${mission.xpReward} XP</strong></div>`);
  card.append(PixelButton({label:"CONTINUAR JORNADA",variant:"primary",onClick:onClose}));
  overlay.append(card);
  overlay.addEventListener("click",e=>{if(e.target===overlay)onClose()});
  return overlay;
}
