/* ═══════════════ GLOBAL ERROR HANDLER ═══════════════ */
window.onerror = function(msg, src, line, col, err){
  console.error('App error:', msg, 'at', src, line, col, err);
  // Solo mostrar banner para errores críticos visibles al usuario, no errores de init
  const ignore = ['initAdminAccount','Script error','ResizeObserver','fbAuth','fbDb'];
  if(ignore.some(k => String(msg).includes(k) || String(src).includes(k))) return true;
  const app = document.getElementById('app');
  if(app && !app.innerHTML.includes('error-banner') && S && S.view !== 'login'){
    const banner = document.createElement('div');
    banner.id = 'error-banner';
    banner.style.cssText = 'background:#fef2f2;border:1.5px solid #fca5a5;color:#991b1b;padding:12px 16px;margin:12px 14px;border-radius:10px;font-size:13px;font-weight:600';
    const detalle = (String(msg||'')+' — '+String(src||'').split('/').pop()+':'+line).replace(/[<>]/g,'');
    banner.innerHTML = 'Error inesperado. Recarga la página si algo no funciona.'
      + '<div style="font-weight:400;font-size:11px;color:#b45309;margin-top:6px;word-break:break-word">Detalle: '+detalle+'</div>'
      + '<button onclick="navigator.clipboard&&navigator.clipboard.writeText(this.parentNode.innerText);this.textContent=\'Copiado\'" style="margin-top:6px;font-size:11px;padding:3px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fff;color:#991b1b;cursor:pointer">Copiar detalle</button>';
    app.prepend(banner);
    setTimeout(()=>banner.remove(), 12000);
  }
  return false;
};
