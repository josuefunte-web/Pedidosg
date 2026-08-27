/* ═══════════════ PUSH NOTIFICATIONS ═══════════════ */
let _audioCtx=null;
function _getAudioCtx(){
  if(!_audioCtx) _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(_audioCtx.state==='suspended') _audioCtx.resume();
  return _audioCtx;
}
// Desbloquear AudioContext en el primer clic del usuario
document.addEventListener('click',()=>{ try{_getAudioCtx();}catch(e){} },{once:true});

function playNotifSound(urgent=false){
  try{
    const ctx=_getAudioCtx();
    const beep=(freq,start,dur)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(0,ctx.currentTime+start);
      g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+start+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+dur);
      o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur+0.05);
    };
    if(urgent){beep(880,0,0.15);beep(1100,0.2,0.15);beep(880,0.4,0.15);beep(1100,0.6,0.2);}
    else{beep(660,0,0.12);beep(880,0.18,0.18);}
  }catch(e){}
}
function testNotifSound(){ playNotifSound(false); toast('Sonido de prueba','#16a34a'); }
function requestPushPermission(){
  if(window.self!==window.top){
    toast('Abre la app directamente en el navegador para activar notificaciones emergentes. El sonido ya funciona.','#d97706',5000);
    return;
  }
  if(!('Notification' in window)){
    toast('Tu navegador no soporta notificaciones emergentes. El sonido sí está disponible.','#d97706',4000);
    return;
  }
  Notification.requestPermission().then(perm=>{
    const el=document.getElementById('push-status');
    if(perm==='granted'){
      if(el)el.textContent='Notificaciones activas';
      toast(' Notificaciones activadas','#16a34a');
    } else {
      if(el)el.textContent='Bloqueadas — actívalas en los ajustes del navegador';
      toast('Notificaciones bloqueadas — actívalas en los ajustes del navegador para este sitio','#dc2626',5000);
    }
  });
}
function pushNotify(title,body,icon=''){
  // Sonido siempre (si está activado en config)
  if(cfg.notifSound!==false) playNotifSound(icon==='');
  // Notificación emergente solo si hay permiso y no estamos en iframe
  if(window.self===window.top&&'Notification' in window&&Notification.permission==='granted'){
    try{ new Notification(`${icon} ${title}`,{body}); }catch(e){}
  }
}

function sendNtfy(title, body, {priority='default', tags='bell', urgent=false}={}){
  const topic=(cfg.ntfyTopic||'').trim();
  if(!topic) return Promise.resolve();
  const p=urgent?'urgent':priority;
  const t=urgent?'rotating_light,'+tags:tags;
  const url=`https://ntfy.sh/${encodeURIComponent(topic)}?title=${encodeURIComponent(title)}&priority=${encodeURIComponent(p)}&tags=${encodeURIComponent(t)}`;
  return fetch(url,{method:'POST',body});
}

function forcePushUpdate(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  const newVersion=new Date().toISOString().slice(0,10)+'-'+Date.now().toString(36);
  if(!confirm(`¿Forzar actualización en todos los dispositivos conectados?\n\nSe recargará la app en todos los móviles y ordenadores abiertos en este momento.`)) return;
  fbDb.ref('globalCfg/appVersion').set(newVersion).then(()=>{
    const el=document.getElementById('force-update-status');
    if(el) el.textContent='Actualización enviada — los dispositivos se recargarán en unos segundos.';
    toast('Actualización enviada a todos los dispositivos','#16a34a',4000);
  }).catch(e=>toast('Error: '+e.message,'#dc2626'));
}

function testNtfy(){
  const topic=(cfg.ntfyTopic||'').trim();
  if(!topic){toast('Primero pon un nombre de canal','#dc2626');return;}
  toast('Enviando...','#6b7280',2000);
  sendNtfy('Prueba O\'Carro','Si ves esto, las notificaciones push funcionan ',{tags:'white_check_mark'})
    .then(r=>{
      if(r&&r.ok){
        toast(`Enviado al canal "${topic}" — comprueba el móvil`,'#16a34a',6000);
      } else {
        toast(`Error al enviar (${r?r.status:'sin respuesta'}) — comprueba el canal`,'#dc2626',6000);
        console.error('ntfy error:',r?.status,r?.statusText);
      }
    })
    .catch(e=>{
      toast(`No se pudo conectar con ntfy.sh — ${e.message}`,'#dc2626',6000);
      console.error('ntfy fetch error:',e);
    });
}
