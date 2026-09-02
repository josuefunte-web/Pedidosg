/* ═══════════════ FIREBASE DATA (pedidos, proveedores, albaranes, revenue) ═══════════════ */
let orders      = [];
let suppliers   = JSON.parse(localStorage.getItem('oc_suppliers')||JSON.stringify(DEFAULT_SUPS));
let albNotes    = [];
let orderComments = {}; // {orderId: [{id,author,isAdmin,text,ts}]}
let revenue     = {};
let budgets     = {};
let priceHistory= [];
let templates   = {};
let extraExpenses= {}; // gastos manuales: {id:{id,restaurant,amount,concept,date,createdAt}}
let inventory   = {}; // {restKey: {productId: {id,name,unit,qty,minStock,category,updatedAt,updatedBy}}}
let inventoryMovements = {}; // {restKey: {movId: {productId,productName,type,qty,date,source,orderId,note}}}
let pendingReview = {}; // {id: {id,type:'inventario'|'excel-albaran',supName,code,name,unit,price,qty,restaurant,note,createdAt,createdBy}}
let foodCost    = {}; // {monthKey('YYYY-MM'): {userId: {desc1,desc2,objetivo,days:{day:{fact,compras}}}}}
let wishlist    = {}; // {id: {id,restaurant,uid,authorName,items:[{name,qty,unit}],note,status:'pending'|'done',createdAt,doneAt,doneBy,doneByName}}
let schedules   = {}; // {restKey: {shiftId: {id,restaurant,day,person,start,end,note,updatedAt,updatedBy}}}
let favorites   = {}; // {restKey: {supId: {prodId:true}}} — productos favoritos marcados por el local
let fbConnected = false;

function supList(){ return Object.values(suppliers).sort((a,b)=>{const oa=a.orden??999,ob=b.orden??999;return oa!==ob?oa-ob:a.name.localeCompare(b.name,'es');}); }
function visibleSups(){
  const all=supList();
  if(!S.session||S.session.isAdmin) return all;
  return all.filter(s=>!(s.disabledFor||[]).includes(S.session.userId));
}
// Traduce el nombre de restaurante guardado en la sesión (S.session.restaurant,
// p.ej. "El Pinos") al id fijo u1-u12 de cfg.users que usa disabledFor,
// templates y pedidos recurrentes. Sin esto S.session.userId queda undefined
// y esas comprobaciones ('...').includes(undefined) nunca coinciden con nada.
function userIdForRestaurant(name){
  const u=cfg.users.find(x=>x.restaurant===name);
  return u?u.id:null;
}
