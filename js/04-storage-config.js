/* ═══════════════ LOCAL STORAGE (config, users, PINs) ═══════════════ */
let cfg      = JSON.parse(localStorage.getItem('oc_cfg') || JSON.stringify({adminName:'Josué',adminPhone:'',adminEmail:'josue.funte@gmail.com',users:DEFAULT_USERS}));
if(!cfg.adminEmail) cfg.adminEmail='josue.funte@gmail.com';
if(!cfg.users) cfg.users=DEFAULT_USERS;
if(!cfg.localPhones) cfg.localPhones={};
function saveCfg(){
  localStorage.setItem('oc_cfg', JSON.stringify(cfg));
  // Sincronizar campos globales en Firebase para que lleguen a todos los dispositivos
  // Sincronizamos SOLO campos no sensibles a globalCfg (leíble por cualquier
  // usuario auth). La API key de Mistral NUNCA se sube — se guarda solo en el
  // localStorage del navegador del admin1 y las llamadas a Mistral pasan por
  // el Cloudflare Worker que inyecta la key server-side.
  if(fbDb) fbDb.ref('globalCfg').update({
    ntfyTopic: cfg.ntfyTopic||'',
    approvalMinAmount: cfg.approvalMinAmount||0,
    alertThreshold: cfg.alertThreshold||300,
    priceAlertPct: cfg.priceAlertPct||5,
    adminPhone: cfg.adminPhone||'',
    admin3ApprovalLimit: cfg.admin3ApprovalLimit!==undefined?cfg.admin3ApprovalLimit:100,
    mistralProxyUrl: cfg.mistralProxyUrl||'',
    localPhones: cfg.localPhones||{}
  });
}
// Guarda/borra el teléfono de WhatsApp de un local concreto (usado para
// avisarle cuando su pedido es aprobado y enviado al proveedor).
function setLocalPhone(restaurant,val){
  const phone=(val||'').replace(/\D/g,'');
  if(!cfg.localPhones) cfg.localPhones={};
  if(phone) cfg.localPhones[restaurant]=phone;
  else delete cfg.localPhones[restaurant];
  saveCfg();
  toast(phone?'Teléfono guardado':'Teléfono eliminado','#16a34a');
  if(typeof renderAdminContent==='function' && S.view==='admin'){
    const _sy=window.scrollY;
    renderAdminContent();
    requestAnimationFrame(()=>window.scrollTo(0,_sy));
  }
}

// --- Admins extra ---
