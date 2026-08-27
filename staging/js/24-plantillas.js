/* ═══════════════ PLANTILLAS ═══════════════ */
function saveTpl(){
  const name=document.getElementById('tpl-name')?.value.trim();
  if(!name){toast('Pon un nombre','#dc2626');return;}
  const uid2=S.session.userId;
  const sup=suppliers[S.supId];
  const sc=S.cart[S.supId]||{};
  const items=sup.products.filter(p=>sc[p.id]).map(p=>({prodId:p.id,prodName:p.name,qty:sc[p.id],unit:p.unit,price:p.price}));
  if(!items.length){toast('Añade productos primero','#dc2626');return;}
  const recurType=document.getElementById('tpl-recur')?.value||'none';
  const recurDayRaw=document.getElementById('tpl-recur-day')?.value||'1';
  const recurrence=recurType==='none'?{type:'none'}:recurType==='weekly'?{type:'weekly',weekday:parseInt(recurDayRaw)||1}:{type:'monthly',dayOfMonth:parseInt(recurDayRaw.replace('d',''))||1};
  const tpl={id:uid(),name,supId:S.supId,items,recurrence,createdAt:new Date().toISOString()};
  if(!templates[uid2])templates[uid2]={};
  templates[uid2][tpl.id]=tpl;
  if(fbDb)fbDb.ref('templates/'+uid2+'/'+tpl.id).set(tpl);
  S.showSaveTemplate=false;
  toast('Plantilla guardada','#16a34a');render();
}
function loadTemplate(tplId){
  const uid2=S.session.userId;
  const tpl=templates[uid2]?.[tplId];if(!tpl)return;
  S.supId=tpl.supId;
  if(!S.cart[tpl.supId])S.cart[tpl.supId]={};
  tpl.items.forEach(it=>{S.cart[tpl.supId][it.prodId]=it.qty;});
  render();toast('Plantilla cargada — revisa cantidades','#16a34a');
}
function deleteTpl(tplId){
  const uid2=S.session.userId;
  if(!confirm('¿Eliminar plantilla?'))return;
  if(templates[uid2])delete templates[uid2][tplId];
  if(fbDb)fbDb.ref('templates/'+uid2+'/'+tplId).remove();
  render();
}
function loadAutoSuggest(){
  if(!S.session) return;
  const myHistory=orders.filter(o=>o.restaurant===S.session.restaurant&&o.supId===S.supId&&o.status!=='rejected');
  const acc={};
  myHistory.forEach(o=>(o.items||[]).forEach(it=>{if(!acc[it.id])acc[it.id]={prodId:it.id,totalQty:0,count:0};acc[it.id].count++;acc[it.id].totalQty+=it.qty;}));
  if(!S.cart[S.supId])S.cart[S.supId]={};
  Object.values(acc).sort((a,b)=>b.count-a.count).slice(0,5).forEach(it=>{
    S.cart[S.supId][it.prodId]=Math.round(it.totalQty/it.count)||1;
  });
  render();toast('Pedido típico cargado — ajusta cantidades','#7c3aed');
}
