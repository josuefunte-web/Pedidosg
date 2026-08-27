/* ═══════════════ NAVIGATION ═══════════════ */
function showHdr(isAdmin){
  document.getElementById('hdr').style.display='flex';
  const sesLabel=S.session?(S.session.isAdmin?''+cfg.adminName:S.session.restaurant):'';
  document.getElementById('ses-info').textContent=sesLabel;
  // Los botones "+ Pedido" y "Albarán" se muestran solo si el rol tiene permiso
  // para crearlos. Camareros/cocineros no los ven (solo pueden ver, no crear).
  // El botón "Admin" solo se muestra a quien tiene acceso al panel admin
  // (admin3 en adelante), sea cual sea el flag isAdmin de la sesión.
  document.getElementById('btn-np').style.display=(!isAdmin&&can('canCreateOrders'))?'':'none';
  document.getElementById('btn-alb-r').style.display=(!isAdmin&&can('canCreateAlbaran'))?'':'none';
  document.getElementById('btn-adm').style.display=(isAdmin||hasAdminAccess())?'':'none';
}
function handleLogo(){ if(S.session){S.session.isAdmin?goAdmin():goOrder();} }
function logout(){
  if(!confirm('¿Cerrar sesión?'))return;
  localStorage.removeItem('oc_admin_session');
  S.session=null;S.view='login';S.loginTab='login';
  document.getElementById('hdr').style.display='none';
  if(fbAuth) fbAuth.signOut().catch(()=>{});
  render();
}
function goOrder(){
  if(S.session) S.session={...S.session,isAdminOrder:false};
  S.view='order';S.cart={};S.cartUnits={};S._cartProds={};
  // Camareros/cocineros no ven la pestaña "Hacer pedido" — arrancan en "Mis pedidos"
  S.orderTab = can('canCreateOrders') ? 'new' : 'history';
  const sl=visibleSups();if(sl.length)S.supId=sl[0].id;showHdr(false);render();
}
// Cambiar el local activo cuando un usuario tiene varios restaurantes asignados
// (selector "Pedido para"). Actualiza también userId, del que dependen la
// visibilidad de proveedores por local y las plantillas/pedidos recurrentes.
function setActiveRestaurant(r){ S.session.restaurant=r;S.session.userId=userIdForRestaurant(r);S.cart={};S.orderTab='new';render(); }
// goAdmin: navegación al panel admin. YA NO crea sesión ni escribe
// nada en localStorage — solo cambia la vista si el usuario logueado
// tiene rol con acceso admin. La sesión viene siempre de Firebase Auth.
function goAdmin(){
  if(!S.session || !hasAdminAccess()){
    if(typeof toast==='function') toast('No tienes permiso para el panel admin','#dc2626');
    return;
  }
  S.view='admin';
  S.adminTab='dashboard';
  if(S.session) S.session={...S.session,isAdminOrder:false};
  S.adminOrderPicker=false;
  showHdr(true);
  render();
}
// goOrderAsAdmin: admin abre la vista de pedido "haciéndose pasar" por
// un local. Se mantiene el uid/email real para trazabilidad; solo se
// cambia la fachada del restaurant activo. La autorización real (rol +
// Rules) sigue siendo la del admin.
function goOrderAsAdmin(rest){
  if(!S.session || !hasAdminAccess()){
    if(typeof toast==='function') toast('No tienes permiso','#dc2626');
    return;
  }
  S.session={
    ...S.session,
    restaurant:rest,
    userId:userIdForRestaurant(rest),
    isAdminOrder:true,
    needsApproval:false
  };
  S.adminOrderPicker=false;
  S.cart={};S.cartUnits={};S._cartProds={};
  S.orderTab='new';
  S.view='order';
  const sl=visibleSups();if(sl.length)S.supId=sl[0].id;
  showHdr(false);render();
}
function goAlbaran(){ S.view='albaran-new';S.albItems=[];S.albRestaurant=S.session?S.session.restaurant:'';S.albSupId=visibleSups()[0]?.id||'';S.albPhoto=null;S.albFileType=null;S.albFileName=null;S.albDate=new Date().toISOString().split('T')[0];S.albTotalManual=null;showHdr(false);render(); }
function setTabSb(t){ S.adminTab=t;S.sidebarOpen=false;render(); }
