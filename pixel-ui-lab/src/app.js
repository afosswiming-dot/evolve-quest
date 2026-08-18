import {missions} from "./data/missions.js";
import {LocationTabs} from "./components/LocationTabs.js";
import {MissionCard} from "./components/MissionCard.js";
import {XPBar} from "./components/XPBar.js";
import {PixelBadge} from "./components/PixelBadge.js";
import {PixelButton} from "./components/PixelButton.js";
import {HealerDialog} from "./components/HealerDialog.js";
import {MissionCompleteModal} from "./components/MissionCompleteModal.js";

let currentLocation="gym";

const missionGrid=document.querySelector("#missionGrid");
const tabsRoot=document.querySelector("#locationTabs");
const xpRoot=document.querySelector("#xpBar");
const badgesRoot=document.querySelector("#badgeShowcase");
const healerRoot=document.querySelector("#healerDialog");
const buttonsRoot=document.querySelector("#buttonShowcase");
const modalRoot=document.querySelector("#modalRoot");

function renderMissions(){
  missionGrid.replaceChildren();
  missions[currentLocation].forEach(mission=>{
    missionGrid.append(MissionCard({mission,onAction:handleMissionAction}));
  });
}

function handleMissionAction(mission){
  if(mission.status==="locked") return;
  if(mission.status==="completed" || mission.status==="in-progress"){
    openCompleteModal(mission);
    return;
  }
  const original=mission.status;
  mission.status="in-progress";
  mission.progress=Math.max(1,mission.progress);
  renderMissions();
  window.setTimeout(()=>{mission.status=original;mission.progress=0;renderMissions()},1600);
}

function openCompleteModal(mission){
  const close=()=>{modalRoot.replaceChildren();document.body.style.overflow=""};
  modalRoot.replaceChildren(MissionCompleteModal({mission,onClose:close}));
  document.body.style.overflow="hidden";
  modalRoot.querySelector(".modal-close")?.focus();
}

tabsRoot.append(LocationTabs({
  value:currentLocation,
  onChange:(value)=>{currentLocation=value;renderMissions()}
}));

xpRoot.append(XPBar({currentXP:120,requiredXP:300,level:1}));

const badgeWrap=document.createElement("div");
badgeWrap.className="badge-showcase";
badgeWrap.append(
  PixelBadge({label:"ATIVO",state:"active"}),
  PixelBadge({label:"CONCLUÍDO",state:"completed"}),
  PixelBadge({label:"BLOQUEADO",state:"locked"})
);
badgesRoot.append(badgeWrap);

healerRoot.append(HealerDialog({
  message:"“Mais um passo, Aventureiro.<br>Sua próxima missão está pronta.”"
}));

const buttonWrap=document.createElement("div");
buttonWrap.className="surface button-showcase";
buttonWrap.append(
  PixelButton({label:"INICIAR MISSÃO",variant:"primary"}),
  PixelButton({label:"VER DETALHES",variant:"secondary"}),
  PixelButton({label:"+250 XP",variant:"reward"}),
  PixelButton({label:"BLOQUEADO",variant:"primary",disabled:true})
);
buttonsRoot.append(buttonWrap);

document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && modalRoot.firstChild){
    modalRoot.replaceChildren();
    document.body.style.overflow="";
  }
});

renderMissions();
