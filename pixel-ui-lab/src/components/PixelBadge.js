export function PixelBadge({label,state="active"}){
  const badge=document.createElement("span");
  badge.className=`pixel-badge ${state}`;
  const symbol=state==="completed"?"✓":state==="locked"?"▣":"◆";
  badge.innerHTML=`<span aria-hidden="true">${symbol}</span><span>${label}</span>`;
  return badge;
}
