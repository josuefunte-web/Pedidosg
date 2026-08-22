/* ═══════════════ LOCAL STORAGE (config, users, PINs) ═══════════════ */
let cfg      = JSON.parse(localStorage.getItem('oc_cfg') || JSON.stringify({adminName:'Josué',adminPhone:'',adminEmail:'josue.funte@gmail.com',users:DEFAULT_USERS}));
if(!cfg.adminEmail) cfg.adminEmail='josue.funte@gmail.com';
if(!cfg.users) cfg.users=DEFAULT_USERS;
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
    mistralProxyUrl: cfg.mistralProxyUrl||''
  });
}

// --- Admins extra ---
