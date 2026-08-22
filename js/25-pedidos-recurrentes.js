/* ═══════════════ PEDIDOS RECURRENTES ═══════════════ */
function loadRecurringTpl(tplId){
  const uid2=S.session.userId;
  const tpl=Object.values(templates[uid2]||{}).find(t=>t.id===tplId);
  if(!tpl){toast('Plantilla no encontrada','#dc2626');return;}
  S.supId=tpl.supId;
  if(!S.cart[tpl.supId])S.cart[tpl.supId]={};
  tpl.items.forEach(it=>{S.cart[tpl.supId][it.prodId]=it.qty;});
  const todayKey=new Date().toISOString().split('T')[0];
  if(fbDb) fbDb.ref('templates/'+uid2+'/'+tplId+'/lastAutoDate').set(todayKey);
  if(templates[uid2]&&templates[uid2][tplId]) templates[uid2][tplId].lastAutoDate=todayKey;
  const sv=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(0,sv));
  toast('Plantilla recurrente cargada','#16a34a');
}
