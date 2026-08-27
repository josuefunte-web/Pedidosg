/* ═══════════════ STATE ═══════════════ */
let S={
  view:'login', adminTab:'dashboard',
  session:null,
  supId:Object.keys(DEFAULT_SUPS)[0],
  cart:{},
  orderTab:'new',
  editUserId:null, editSupId:null, openSupId:null,
  editOrderId:null, editItems:[], chatOpen:null,
  albView:'list', albItems:[], albRestaurant:'', albSupId:'', albDate:new Date().toISOString().split('T')[0], albPhoto:null,
  fcPeriod:'month', fcDate:new Date().toISOString().split('T')[0],
  foodcostMonth:new Date().toISOString().slice(0,7), foodcostLocalId:'u1',
  showSaveTemplate:false,
  albCropping:false,
  sidebarOpen:false,
  editingPermsUid:null,
  orderUrgent:false,
  orderDeliveryDate:'',
  orderNotes:'',
  prodSearch:'',
  cartUnits:{},
  darkMode:localStorage.getItem('oc_dark')==='1',
  loginTab:'login',
  invRest:null,
  invShowMov:false,
  invEditId:null,
  invForm:{name:'',unit:'',qty:'',minStock:'',category:'',price:''},
  adminOrderPicker:false,
  _escLocalExpanded:{},
  _cartProds:{},
  // Comparar precios (módulo 27-comparativa.js): filtros y detalles abiertos.
  cmpSearch:'',
  cmpCat:'',
  cmpSup:'',
  cmpKind:'all',       // 'all' | 'saving' | 'single'
  cmpSort:'saving',    // 'saving' | 'price' | 'name' | 'pct'
  cmpOpen:{},          // {groupKey:true}
};
let cropState={dragging:false,startX:0,startY:0,endX:0,endY:0};
const PROD_CATS=['Carnes','Pescados','Verduras y Frutas','Lácteos','Pasta y Arroces','Conservas','Condimentos','Panadería','Bebidas','Limpieza','Otros'];
// Lista global de unidades (la usa renderConvRows y otras funciones que no son
// internas de supDetailForm). Antes _U solo existía localmente y renderConvRows
// lanzaba "Can't find variable: _U" al editar un proveedor con productos.
const _U=['KG','L','UN','Caja','Bote','Bolsa','g'];
const PROD_CAT_COLORS={'Carnes':'#dc2626','Pescados':'#0ea5e9','Verduras y Frutas':'#16a34a','Lácteos':'#d97706','Pasta y Arroces':'#ca8a04','Conservas':'#7c3aed','Condimentos':'#ea580c','Panadería':'#92400e','Bebidas':'#2563eb','Limpieza':'#0f766e','Otros':'#64748b'};
const ESC_CATS=['Calientes','Fríos','Entrantes','Postres','Bebidas','Aperitivos','Fondos','Guarniciones','Otros'];
const ESC_CAT_COLORS={'Calientes':'#dc2626','Fríos':'#0ea5e9','Postres':'#a855f7','Bebidas':'#2563eb','Aperitivos':'#ea580c','Fondos':'#7c3aed','Entrantes':'#16a34a','Guarniciones':'#d97706','Otros':'#64748b'};
// 14 alérgenos obligatorios UE (Reglamento 1169/2011)
const ALERGENOS=[
  {id:'gluten',    label:'Gluten'},
  {id:'crustaceos',label:'Crustáceos'},
  {id:'huevos',    label:'Huevos'},
  {id:'pescado',   label:'Pescado'},
  {id:'cacahuetes',label:'Cacahuetes'},
  {id:'soja',      label:'Soja'},
  {id:'lacteos',   label:'Lácteos'},
  {id:'frutos_cascara',label:'Frutos de cáscara'},
  {id:'apio',      label:'Apio'},
  {id:'mostaza',   label:'Mostaza'},
  {id:'sesamo',    label:'Sésamo'},
  {id:'sulfitos',  label:'Sulfitos'},
  {id:'altramuces',label:'Altramuces'},
  {id:'moluscos',  label:'Moluscos'},
];
function alergenosFromIngs(ings){
  const set=new Set();
  ings.forEach(ing=>{
    if(!ing.proveedorId) return;
    const sup=suppliers[ing.proveedorId];
    if(!sup) return;
    const prod=(Array.isArray(sup.products)?sup.products:Object.values(sup.products||[])).find(p=>p.id===ing.productoId);
    if(prod&&prod.alergenos) prod.alergenos.forEach(a=>set.add(a));
  });
  return [...set];
}
function catColor(cat,map){ return (map||PROD_CAT_COLORS)[cat]||'#64748b'; }
function catDot(cat,map){ const c=catColor(cat,map); return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};flex-shrink:0"></span>`; }
function prodCatOpts(sel){ return PROD_CATS.map(c=>`<option${c===sel?' selected':''}>${c}</option>`).join(''); }
