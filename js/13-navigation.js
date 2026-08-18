/* ═══════════════ NAVIGATION ═══════════════ */
function showHdr(isAdmin){
  document.getElementById('hdr').style.display='flex';
  const sesLabel=S.session?(S.session.isAdmin?''+cfg.adminName:S.session.restaurant):'';
  document.getElementById('ses-info').textContent=sesLabel;
  document.getElementById('btn-np').style.display=!isAdmin?'':'none';
  document.getElementById('btn-alb-r').style.display=!isAdmin?'':'none';
  document.getElementById('btn-adm').style.display=isAdmin?'':'none';
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
function goOrder(){ S.view='order';S.cart={};S.cartUnits={};S._cartProds={};S.orderTab='new';const sl=visibleSups();if(sl.length)S.supId=sl[0].id;showHdr(false);render(); }
function goAdmin(){ S.view='admin';S.session={isAdmin:true,name:cfg.adminName};S.adminOrderPicker=false;localStorage.setItem('oc_admin_session','1');showHdr(true);render(); }
function goOrderAsAdmin(rest){ S.session={isAdmin:true,name:cfg.adminName,restaurant:rest,isAdminOrder:true,needsApproval:false};S.adminOrderPicker=false;S.cart={};S.cartUnits={};S._cartProds={};S.orderTab='new';S.view='order';const sl=visibleSups();if(sl.length)S.supId=sl[0].id;showHdr(false);render(); }
function goAlbaran(){ S.view='albaran-new';S.albItems=[];S.albRestaurant=S.session?S.session.restaurant:'';S.albSupId=supList()[0]?.id||'';S.albPhoto=null;S.albFileType=null;S.albFileName=null;S.albDate=new Date().toISOString().split('T')[0];S.albTotalManual=null;showHdr(false);render(); }
function setTabSb(t){ S.adminTab=t;S.sidebarOpen=false;render(); }
