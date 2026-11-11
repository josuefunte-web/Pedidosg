/* ═══════════════ RENDER ═══════════════ */
function render(){
  const app=document.getElementById('app');
  if(S.view==='login')              app.innerHTML=vLogin();
  else if(S.view==='pending-approval') app.innerHTML=vPendingApproval();
  else if(S.view==='order')         app.innerHTML=vOrder();
  else if(S.view==='admin'){        app.innerHTML=vAdmin();
    if(S.adminTab==='escandallos') setTimeout(initEscandallos,50);
    if(S.adminTab==='sup-visibility') setTimeout(initSupVisibility,50);
  }
  else if(S.view==='albaran-new') app.innerHTML=vAlbaranNew();
  try{ _updatePendingBadge(); }catch(e){}
}

function renderAdminContent(){
  const tc=document.getElementById('tc');
  if(!tc) return;
  // No interrumpir modales abiertos
  if(S.adminTab==='escandallos' && document.getElementById('esc-modal-ov')?.style.display==='block') return;
  // Editor de menús y calculadora de grupo abiertos (usan display:flex): un re-render
  // por un pedido o cambio de proveedor los borraría con lo que se está escribiendo
  if(S.adminTab==='escandallos' && ['men-modal-ov','men-group-ov'].some(id=>{
    const d=document.getElementById(id)?.style.display; return d&&d!=='none';
  })) return;
  if(S.adminTab==='escandallos' && S._escDetailId && document.getElementById('esc-detail-wrap')?.style.display==='block') return;
  if(S.adminTab==='inventario'  && S.invEditId) return; // formulario inline abierto
  const _sv=window.scrollY;
  // La matriz de "Visibilidad por local" tiene su propio scroll interno
  // (vertical y horizontal). Un guardado ahí dispara el listener de
  // Firebase de `suppliers`, que llama a este render aunque el cambio ya
  // se haya pintado en el sitio — sin esto, reconstruir la tabla resetea
  // ese scroll interno a 0 y "salta" hasta el primer local.
  const _svScrollEl=document.getElementById('sv-scroll');
  const _svScroll=_svScrollEl?{left:_svScrollEl.scrollLeft,top:_svScrollEl.scrollTop}:null;
  const content=_adminTabHtml();
  tc.innerHTML=content;
  if(S.adminTab==='escandallos') initEscandallos();
  if(S.adminTab==='sup-visibility'){
    initSupVisibility();
    if(_svScroll){
      const el=document.getElementById('sv-scroll');
      if(el){ el.scrollLeft=_svScroll.left; el.scrollTop=_svScroll.top; }
    }
  }
  if(S.adminTab==='budgets') setTimeout(renderBudgetTrendChart,100);
  // Update sidebar stats
  const pend=orders.filter(o=>o.status==='pending');
  const appr=orders.filter(o=>o.status==='approved');
  const sbStatsEl=document.getElementById('sb-stats');
  if(sbStatsEl) sbStatsEl.innerHTML=buildSbStats(pend,appr);
  // Update pending badge in sidebar
  const sbBadge=document.getElementById('sb-pend-badge');
  if(sbBadge){sbBadge.textContent=pend.length;sbBadge.style.display=pend.length?'':'none';}
  requestAnimationFrame(()=>window.scrollTo(0,_sv));
}
