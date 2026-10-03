/* ═══════════════ MIGRACIÓN: TODOS LOS PRODUCTOS A KG ═══════════════
   Solo admin. Descarga antes una copia de seguridad de los proveedores.
   - Productos en g: precio ×1000 (equivalente exacto en KG).
   - Resto (UN, UD, Caja...): unidad → KG manteniendo el precio tal cual.
   - Litros (L/ml) no se tocan: no hay equivalencia a kg sin densidad.
   La unidad anterior se guarda en unitOrig para poder revertir. */
function _kgMigPlan(){
  const plan=[];
  Object.entries(suppliers||{}).forEach(([sid,sup])=>{
    if(!sup||!sup.products) return;
    const arr=Array.isArray(sup.products)?sup.products:Object.values(sup.products);
    arr.forEach(p=>{
      if(!p) return;
      const u=String(p.unit||'').trim().toLowerCase().replace(/\./g,'');
      if(u==='kg'||u==='kgs'||['l','lt','litro','litros','ml','cl'].includes(u)) return;
      plan.push({sid,p,g:['g','gr','gramo','gramos'].includes(u)});
    });
  });
  return plan;
}
function _kgStatus(msg,col){
  console.log('[migración KG]',msg);
  const el=document.getElementById('kg-mig-status');
  if(el){ el.textContent=msg; el.style.color=col||'var(--mut)'; }
  toast(msg,col||'#222',9000);
}
function migrarProductosAKg(){
  _kgStatus('Revisando productos...');
  if(!S.session||!S.session.isAdmin){ _kgStatus('Solo el administrador puede hacer esto','#dc2626'); return; }
  const plan=_kgMigPlan();
  if(!plan.length){ _kgStatus('Todos los productos (salvo litros) ya están en KG','#16a34a'); return; }
  const nG=plan.filter(x=>x.g).length;
  _kgStatus(`${plan.length} productos por cambiar...`);
  if(!confirm(`Se cambiarán ${plan.length} productos a KG (${nG} en gramos con precio ×1000; el resto conserva su precio).\n\nSe descargará antes una copia de seguridad. ¿Continuar?`)) return;
  try{
    const blob=new Blob([JSON.stringify(suppliers,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='backup-proveedores-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ _kgStatus('No se pudo crear la copia de seguridad; cancelado','#dc2626'); return; }
  const sids=new Set();
  plan.forEach(({sid,p,g})=>{
    p.unitOrig=p.unit;
    if(g) p.price=Math.round((parseFloat(p.price)||0)*1000*10000)/10000;
    p.unit='KG';
    sids.add(sid);
  });
  try{ localStorage.setItem('oc_suppliers',JSON.stringify(suppliers)); }catch(e){}
  const done=()=>{
    if(typeof escPickIndex==='function') escPickIndex(true);
    if(typeof renderAdminContent==='function') renderAdminContent();
  };
  if(!fbDb){ done(); _kgStatus('Sin conexión con Firebase: el cambio NO se ha guardado en la nube','#dc2626'); return; }
  _kgStatus('Guardando en Firebase...');
  Promise.all([...sids].map(sid=>fbDb.ref('suppliers/'+sid).set(suppliers[sid]))).then(()=>{
    done(); _kgStatus(`${plan.length} productos pasados a KG y guardados en Firebase`,'#16a34a');
  }).catch(err=>{
    console.error(err); done(); _kgStatus('Firebase rechazó el guardado ('+(err&&err.code||err)+'). Hace falta rol admin1/admin2. Nada guardado en la nube.','#dc2626');
  });
}
