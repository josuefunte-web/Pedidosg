/* ═══════════════ SAVE FUNCTIONS ═══════════════ */
// Cola de pedidos pendientes de grabar (resistente a cierre de la app / sin conexión)
function _getPendingOrders(){ try{ return JSON.parse(localStorage.getItem('oc_pending_orders')||'[]'); }catch(e){ return []; } }
function _setPendingOrders(arr){ try{ localStorage.setItem('oc_pending_orders', JSON.stringify(arr)); }catch(e){} }
function _queueOrder(o){
  const q=_getPendingOrders();
  if(!q.find(x=>x.id===o.id)) q.push(o);
  _setPendingOrders(q);
  _updatePendingBadge();
}
function _unqueueOrder(id){
  _setPendingOrders(_getPendingOrders().filter(o=>o.id!==id));
  _updatePendingBadge();
}
function _updatePendingBadge(){
  const n=_getPendingOrders().length;
  const el=document.getElementById('pending-orders-badge');
  if(el){ el.style.display=n>0?'flex':'none'; el.textContent=n+(n===1?' pedido sin enviar':' pedidos sin enviar'); }
}
// Reintenta grabar todos los pedidos pendientes (se llama al reconectar y al cargar)
function flushPendingOrders(){
  if(!fbDb) return;
  const q=_getPendingOrders();
  if(!q.length) return;
  let denied=0;
  Promise.all(q.map(o=>fbDb.ref('orders/'+o.id).set(o)
    .then(()=>{ _unqueueOrder(o.id); })
    .catch(err=>{
      // PERMISSION_DENIED nunca se arreglará solo reintentando: se descarta
      // de la cola para no quedar atascado para siempre reintentando en vano.
      if(err&&err.code==='PERMISSION_DENIED'){ denied++; _unqueueOrder(o.id); }
      /* otros errores (red, etc.) siguen en cola, se reintentarán */
    })
  )).then(()=>{
    if(denied>0) toast(denied+' pedido(s) descartados por falta de autorización: tu restaurante asignado no coincide. Avisa al administrador y vuelve a crearlos.','#dc2626',9000);
  });
}
function saveOrder(o){
  if(fbDb){
    // Encola SIEMPRE primero; se elimina de la cola cuando Firebase confirma la
    // escritura. Así, si el usuario cierra la app o pierde la conexión antes de
    // que se grabe, el pedido no se pierde: se reenvía al reconectar.
    _queueOrder(o);
    fbDb.ref('orders/'+o.id).set(o)
      .then(()=>{ _unqueueOrder(o.id); })
      .catch(err=>{
        if(err&&err.code==='PERMISSION_DENIED'){
          // No tiene sentido seguir reintentando algo que siempre va a fallar
          // igual: se descarta de la cola en vez de quedar atascado.
          _unqueueOrder(o.id);
          toast('No autorizado: tu restaurante asignado no coincide con el del pedido. Avisa al administrador.','#dc2626',9000);
        } else {
          toast('Sin conexión: el pedido se enviará al recuperar la conexión','#d97706',5000);
        }
      });
  } else {
    orders.unshift(o);
    _queueOrder(o);
    toast('Sin conexión: el pedido se enviará automáticamente al volver','#d97706',5000);
  }
}
// Marca un pedido como enviado al proveedor (para saber qué pedidos ya se han
// mandado por WhatsApp y cuáles quedan pendientes de enviar).
function markSentToSupplier(id){
  const o=orders.find(x=>x.id===id);
  if(o&&o.sentToSupplier) return; // ya estaba marcado, no repetir
  updateOrder(id,{sentToSupplier:true,sentAt:new Date().toISOString()});
  if(!fbDb){ if(o){o.sentToSupplier=true;o.sentAt=new Date().toISOString();} render(); }
}
// Marca como enviados todos los pedidos aprobados de un proveedor (envío consolidado)
function markSupplierOrdersSent(sid){
  orders.filter(o=>o.supId===sid&&o.status==='approved'&&!o.sentToSupplier).forEach(o=>markSentToSupplier(o.id));
}
function updateOrder(id, data){
  if(fbDb) fbDb.ref('orders/'+id).update(data);
  else { const o=orders.find(x=>x.id===id); if(o) Object.assign(o,data); }
}
// Si se pasa un sid, escribe SOLO esa rama (suppliers/<sid>) para no pisar
// los cambios que otro dispositivo pueda estar haciendo en otros proveedores.
// Sin sid, reescribe todo el árbol (solo para operaciones masivas intencionadas).
function saveSups(sid){
  if(fbDb){
    if(sid && suppliers[sid]) fbDb.ref('suppliers/'+sid).set(suppliers[sid]);
    else fbDb.ref('suppliers').set(suppliers);
  }
  localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
}

function saveAlb(a){
  if(fbDb) fbDb.ref('albaranes/'+a.id).set(a);
  else albNotes.unshift(a);
}
function deleteAlb(id){
  if(fbDb) fbDb.ref('albaranes/'+id).remove();
  else albNotes = albNotes.filter(a=>a.id!==id);
}
