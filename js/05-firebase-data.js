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
let fbConnected = false;

function supList(){ return Object.values(suppliers).sort((a,b)=>{const oa=a.orden??999,ob=b.orden??999;return oa!==ob?oa-ob:a.name.localeCompare(b.name,'es');}); }
function visibleSups(){
  const all=supList();
  if(!S.session||S.session.isAdmin) return all;
  return all.filter(s=>!(s.disabledFor||[]).includes(S.session.userId));
}
