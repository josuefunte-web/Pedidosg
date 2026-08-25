/* ═══════════════ PERMISSIONS SYSTEM ═══════════════
   6 niveles de autorización jerárquicos y acumulativos.
   Cada rol hereda TODOS los permisos del rol inferior + los suyos propios.

   1. camarero        → ver pedidos/inventario/recetas + wishlist al jefe
   2. jefe_cocina     → hace pedidos, gestiona inventario, ve food cost
   3. encargado       → jefe_cocina + horarios + reservas
   4. admin3          → encargado + aprobar pedidos hasta X€ (configurable)
   5. admin2          → admin3 sin límite + albaranes + coste personal + alta usuarios básicos
   6. admin1          → admin2 + asignar roles admin + config web + bloquear + reset passwords

   Los usuarios NO ven su propio rol. Solo admin1 (Josué) puede ver la lista
   completa de usuarios con sus roles.
════════════════════════════════════════════════════════ */

const ROLES = ['camarero','jefe_cocina','encargado','admin3','admin2','admin1'];
const ROLE_LABELS = {
  camarero:     'Camarero / Cocinero',
  jefe_cocina:  'Jefe de cocina',
  encargado:    'Encargado',
  admin3:       'Admin 3 (aprobación limitada)',
  admin2:       'Admin 2 (operativa)',
  admin1:       'Admin 1 (super-admin)'
};
const ROLE_LEVEL = { camarero:1, jefe_cocina:2, encargado:3, admin3:4, admin2:5, admin1:6 };

// Delta de permisos por rol — se acumulan en cascada al construir ROLE_PERMS.
const _ROLE_PERMS_DELTA = {
  camarero: {
    canViewOrders:       true,   // Ver pedidos hechos/aprobados
    canViewInventory:    true,   // Ver inventario (solo lectura)
    canViewRecipes:      true,   // Ver recetas
    canViewSchedule:     true,   // Ver horarios (Fase 3)
    canSendWishlist:     true,   // Enviar al jefe de cocina productos que faltan (Fase 2)
    approvalLimit:       0
  },
  jefe_cocina: {
    canCreateOrders:     true,   // Hacer pedidos
    canEditInventory:    true,   // Editar inventario (recuentos, altas manuales)
    canCreateAlbaran:    true,   // Registrar albaranes de entrada
    canViewFoodCost:     true,   // Ver food cost del local
    canViewOptimalPurchase: true, // Compras por producto / comparativa entre proveedores
    canViewSpendReports: true    // Ver "Mi gasto", histórico económico
  },
  encargado: {
    canEditSchedule:     true,   // Modificar horarios (Fase 3)
    canEditReservations: true    // Modificar libro de reservas (Fase 3)
  },
  admin3: {
    canAccessAdminPanel: true,   // Ver el panel de administración
    canApproveOrders:    true,   // Aprobar pedidos (con límite)
    approvalLimit:       100     // €. Configurable en globalCfg.admin3ApprovalLimit
  },
  admin2: {
    approvalLimit:       Infinity, // Sin límite económico
    canReviewAlbaranes:  true,     // Revisar y validar albaranes
    canEditPersonnelCost:true,     // Editar coste de personal (Fase 3)
    canAssignSuppliers:  true,     // Asignar/desasignar proveedores a locales
    canManageProducts:   true,     // Editar catálogo de productos
    canCreateBasicUsers: true,     // Dar de alta camarero, jefe_cocina, encargado
    canValidateConversions: true   // Validar conversiones pendientes
  },
  admin1: {
    canAssignAllRoles:   true,     // Cambiar rol de cualquier usuario (incluidos admins)
    canBlockUsers:       true,     // Bloquear/desbloquear cuentas
    canResetPasswords:   true,     // Reset de contraseñas
    canConfigWeb:        true,     // Configuración global
    canImportBulk:       true,     // Importar plantilla masiva XLSX
    canManageEverything: true      // Comodín para lo demás
  }
};

// ROLE_PERMS[rol] = objeto plano con TODOS los permisos acumulados.
const ROLE_PERMS = (function(){
  const out = {}; let acc = {};
  ROLES.forEach(r => { acc = {...acc, ..._ROLE_PERMS_DELTA[r]}; out[r] = {...acc}; });
  return out;
})();

// ── Helpers de sesión ─────────────────────────────────────────────────────
// Devuelve el rol del usuario logueado. Compat con sesiones antiguas:
//   · isAdmin === true → admin1
//   · resto (locales sin campo role) → jefe_cocina por defecto
function currentRole(){
  if(!S.session) return null;
  if(S.session.role && ROLES.includes(S.session.role)) return S.session.role;
  return S.session.isAdmin ? 'admin1' : 'jefe_cocina';
}
// Chequeo de permiso booleano — true/false. Uso: if(can('canCreateOrders')) {...}
function can(perm){
  const r = currentRole();
  if(!r) return false;
  return ROLE_PERMS[r]?.[perm] === true;
}
// Límite de aprobación en € del usuario actual. Para admin3 se lee de
// globalCfg (configurable por admin1). El resto usa el default del rol.
function currentApprovalLimit(){
  const r = currentRole();
  if(!r) return 0;
  if(r === 'admin3' && typeof cfg!=='undefined' && cfg.admin3ApprovalLimit!==undefined){
    const v = parseFloat(cfg.admin3ApprovalLimit);
    return isNaN(v) ? 100 : v;
  }
  const lim = ROLE_PERMS[r]?.approvalLimit;
  return lim === undefined ? 0 : lim;
}
// ¿Puede aprobar un pedido de este importe concreto?
function canApproveOrderAmount(amt){
  if(!can('canApproveOrders')) return false;
  const limit = currentApprovalLimit();
  return limit === Infinity || (parseFloat(amt)||0) <= limit;
}
function isSuperAdmin(){ return currentRole() === 'admin1'; }
function hasAdminAccess(){ return can('canAccessAdminPanel'); }
// ¿El rol A puede asignar el rol B a alguien? admin1 puede asignar todos.
// admin2 solo puede asignar camarero/jefe_cocina/encargado (no admins).
function canAssignRole(myRole, targetRole){
  if(myRole === 'admin1') return true;
  if(myRole === 'admin2') return ['camarero','jefe_cocina','encargado'].includes(targetRole);
  return false;
}

// ── Helpers de seguridad extra (Fase 1 hardening) ────────────────────
function isAdminRole(role){
  return role === 'admin1' || role === 'admin2' || role === 'admin3';
}
function currentAuthUid(){
  return (S.session && S.session.uid) || null;
}
function currentAuthEmail(){
  return (S.session && S.session.email) || null;
}
// Guardia para operaciones sensibles en cliente. Devuelve true si tiene
// permiso; si no, muestra toast y devuelve false. `silent` evita el toast.
// (No sustituye a las Firebase Rules — es defensa en profundidad y UX.)
function requireCan(perm, silent){
  if(!can(perm)){
    if(!silent && typeof toast === 'function') toast('Sin permiso para: '+perm, '#dc2626');
    return false;
  }
  return true;
}
// Aborta la operación si el usuario está bloqueado — desloguea y redirige.
function requireNotBlocked(){
  const uid = currentAuthUid();
  if(!uid) return false;
  const u = (typeof authUsers !== 'undefined' && authUsers[uid]) || null;
  if(u && u.blocked === true){
    try{ if(typeof fbAuth !== 'undefined' && fbAuth) fbAuth.signOut().catch(()=>{}); }catch(e){}
    S.session = null; S.view = 'login';
    try{ render(); }catch(e){}
    return false;
  }
  return true;
}
// Registra una acción sensible en auditLog. Append-only, cada uid escribe
// solo sus propias entradas (Firebase Rules lo garantizan). Solo admin1 lee.
function auditLog(action, details){
  try{
    if(typeof fbDb === 'undefined' || !fbDb) return;
    if(!S.session || !S.session.uid) return;
    const id = 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    fbDb.ref('auditLog/'+id).set({
      uid: S.session.uid,
      email: S.session.email || null,
      role: currentRole(),
      action: String(action),
      ts: Date.now(),
      details: details || null
    }).catch(()=>{});
  }catch(e){}
}
