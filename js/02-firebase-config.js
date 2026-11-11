/* ═══════════════ FIREBASE CONFIG ═══════════════ */
const FB_CONFIG = {
  apiKey: "AIzaSyCJIF3BsWdWnB59idnxCRlYbWixTp1sGb8",
  authDomain: "pedidos-835a1.firebaseapp.com",
  databaseURL: "https://pedidos-835a1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pedidos-835a1",
  storageBucket: "pedidos-835a1.firebasestorage.app",
  messagingSenderId: "236536249236",
  appId: "1:236536249236:web:6a2cad24995a1bc57cad81"
};
// Firebase rechaza en silencio las escrituras que no cumplen las reglas de
// seguridad (por ejemplo, un rol sin permiso). Muchas pantallas mostraban
// "guardado" sin comprobarlo. Este envoltorio avisa en rojo cuando una escritura
// (set/update/remove) es rechazada por permisos. No cambia lo que devuelven las
// llamadas: quien ya hace .then/.catch sigue recibiendo la misma promesa.
function _reportFbWriteError(err){
  const msg=String((err&&err.message)||'');
  if((err&&err.code==='PERMISSION_DENIED')||/permission_denied/i.test(msg)){
    if(typeof toast==='function') toast('No se ha guardado: tu rol no tiene permiso para este cambio.','#dc2626',6000);
    console.warn('[Firebase] escritura rechazada por permisos:',err);
  }
}
function _guardFbWrites(db){
  if(!db||db.__writesGuarded) return db;
  const origRef=db.ref.bind(db);
  db.ref=function(){
    const r=origRef.apply(null,arguments);
    ['set','update','remove'].forEach(m=>{
      const orig=r[m]; if(typeof orig!=='function') return;
      r[m]=function(){
        const pr=orig.apply(this,arguments);
        if(pr&&typeof pr.catch==='function') pr.catch(_reportFbWriteError);
        return pr;
      };
    });
    return r;
  };
  db.__writesGuarded=true;
  return db;
}
let fbApp, fbDb, fbAuth;
let authUsers = {};
