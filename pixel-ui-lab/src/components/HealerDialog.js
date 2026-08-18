export function HealerDialog({message}){
  const el=document.createElement("article");
  el.className="surface healer-dialog";
  el.innerHTML=`
    <img src="./assets/pixel/characters/healer.png" alt="Healer da EVOLVE Quest">
    <div class="healer-copy">
      <span class="pixel-text">HEALER</span>
      <p>${message}</p><span class="healer-hint">Continue avançando no seu ritmo.</span>
    </div>`;
  return el;
}
