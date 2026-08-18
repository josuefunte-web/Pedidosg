/* ═══════════════ ADMIN ACCOUNT SETUP ═══════════════ */
function initAdminAccount(){
  if(!fbAuth||!fbDb) return;
  // Si ya se creó en esta sesión, no repetir
  if(localStorage.getItem('oc_admin_init')==='1') return;
  const adminEmail=cfg.adminEmail||'josue.funte@gmail.com';
  fbAuth.createUserWithEmailAndPassword(adminEmail,'ELIMINADA')
    .then(cred=>{
      const uid=cred.user.uid;
      fbDb.ref('authUsers/'+uid).set({
        uid, email:adminEmail, name:cfg.adminName||'Josué',
        isAdmin:true, status:'approved', createdAt:new Date().toISOString()
      }).then(()=>{
        localStorage.setItem('oc_admin_init','1');
        // Cerrar sesión inmediatamente — el admin iniciará sesión de forma normal
        fbAuth.signOut().catch(()=>{});
      });
    })
    .catch(e=>{
      // Ya existe → simplemente marcar como inicializado
      // No hacemos signIn en segundo plano para evitar interferencias con la sesión
      if(e.code==='auth/email-already-in-use'){
        localStorage.setItem('oc_admin_init','1');
      }
    });
}
