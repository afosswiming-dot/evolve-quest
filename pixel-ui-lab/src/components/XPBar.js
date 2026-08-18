export function XPBar({currentXP,requiredXP,level}){
  const percent=Math.max(0,Math.min(100,Math.round((currentXP/requiredXP)*100)));
  const remaining=Math.max(0,requiredXP-currentXP);
  const el=document.createElement("article");
  el.className="surface xp-card";
  el.innerHTML=`
    <div class="level-shield" aria-hidden="true"><div><span>NÍVEL</span><strong>${String(level).padStart(2,"0")}</strong></div></div>
    <div class="xp-content">
      <div class="xp-top"><span class="pixel-text">XP</span><span class="xp-value">${currentXP} / ${requiredXP} XP</span></div>
      <div class="xp-track" role="progressbar" aria-label="Experiência do nível" aria-valuemin="0" aria-valuemax="${requiredXP}" aria-valuenow="${currentXP}">
        <div class="xp-fill" style="--progress:${percent}%"></div>
      </div>
      <p class="xp-note">Faltam <b>${remaining} XP</b> para o nível ${String(level+1).padStart(2,"0")}</p>
    </div>`;
  return el;
}
