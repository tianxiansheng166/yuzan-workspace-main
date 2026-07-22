document.querySelectorAll('button,a').forEach(el=>{
  if(el.tagName==='A') el.addEventListener('click',e=>e.preventDefault());
});
