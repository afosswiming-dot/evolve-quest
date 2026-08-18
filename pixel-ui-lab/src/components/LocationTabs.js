export function LocationTabs({value="gym",onChange}){
  const wrap=document.createElement("div");
  wrap.className="location-tabs";
  wrap.setAttribute("role","tablist");
  wrap.setAttribute("aria-label","Local da missão");
  const items=[
    {id:"gym",label:"ACADEMIA",icon:"./assets/pixel/icons/gym.png"},
    {id:"home",label:"CASA",icon:"./assets/pixel/icons/home.png"}
  ];
  const renderState=(selected)=>{
    wrap.querySelectorAll(".location-tab").forEach(btn=>{
      const isActive=btn.dataset.value===selected;
      btn.setAttribute("aria-selected",String(isActive));
      btn.tabIndex=isActive?0:-1;
    });
  };
  items.forEach(item=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="location-tab";
    btn.dataset.value=item.id;
    btn.setAttribute("role","tab");
    btn.innerHTML=`<img src="${item.icon}" alt="" aria-hidden="true"><span class="pixel-text">${item.label}</span>`;
    btn.addEventListener("click",()=>{renderState(item.id);onChange?.(item.id)});
    wrap.append(btn);
  });
  renderState(value);
  return wrap;
}
