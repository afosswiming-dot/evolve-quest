export function PixelButton({label,variant="primary",disabled=false,onClick=null,icon=""}){
  const button=document.createElement("button");
  button.type="button";
  button.className=`pixel-button ${variant}`;
  button.disabled=disabled;
  button.innerHTML=`${icon?`<span aria-hidden="true">${icon}</span>`:""}<span>${label}</span>`;
  if(onClick) button.addEventListener("click",onClick);
  return button;
}
