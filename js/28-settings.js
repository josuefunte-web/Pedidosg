/* ═══════════════ SETTINGS ═══════════════ */
function vSettings(){
  return `<div class="card">
    <div class="card-t">Administrador</div>
    <div class="fg"><label>Nombre</label><input type="text" value="${cfg.adminName}" onchange="cfg.adminName=this.value;saveCfg()"/></div>
    <div class="fg"><label>Email administrador</label><input type="email" value="${cfg.adminEmail||'josue.funte@gmail.com'}" onchange="cfg.adminEmail=this.value.trim();saveCfg()"/><div style="font-size:12px;color:var(--mut);margin-top:4px">Usa este correo para iniciar sesión como administrador</div></div>
    <div class="fg">
      <label>Tu WhatsApp — para recibir notificaciones de pedidos</label>
      <input type="tel" value="${cfg.adminPhone||''}" placeholder="34612345678" onchange="cfg.adminPhone=this.value.replace(/\\D/g,'');saveCfg()"/>
      ${!cfg.adminPhone?`<div style="color:#dc2626;font-size:12px;margin-top:4px">Sin número — los restaurantes no podrán notificarte</div>`:`<div style="color:#16a34a;font-size:12px;margin-top:4px">Número configurado</div>`}
    </div>
    <div class="card-t" style="margin-top:20px">Alertas</div>
    <div class="fg">
      <label>Importe mínimo para aprobación (€)</label>
      <input type="number" value="${cfg.approvalMinAmount||0}" min="0" step="10" onchange="cfg.approvalMinAmount=parseFloat(this.value)||0;saveCfg()"/>
      <div style="font-size:12px;color:var(--mut);margin-top:4px">Los pedidos <strong>por encima</strong> de este importe requieren aprobación manual. Pon 0 para requerir aprobación siempre (comportamiento actual).</div>
    </div>
    <div class="fg">
      <label>Alerta pedidos grandes (€)</label>
      <input type="number" value="${cfg.alertThreshold||300}" min="0" step="10" onchange="cfg.alertThreshold=parseFloat(this.value)||300;saveCfg()"/>
      <div style="font-size:12px;color:var(--mut);margin-top:4px">Se marca en rojo cualquier pedido que supere este importe</div>
    </div>
    <div class="fg">
      <label>Alerta subida de precios (%)</label>
      <input type="number" value="${cfg.priceAlertPct||5}" min="1" max="50" step="1" onchange="cfg.priceAlertPct=parseFloat(this.value)||5;saveCfg()"/>
      <div style="font-size:12px;color:var(--mut);margin-top:4px">Aviso cuando un producto sube más de este porcentaje</div>
    </div>
    <div class="card-t" style="margin-top:20px"> Notificaciones push en el móvil</div>
    <div class="fg">
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px">
        <strong>Cómo recibir notificaciones en el móvil (iOS y Android):</strong>
        <ol style="margin:8px 0 0 16px;padding:0;line-height:1.8">
          <li>Instala la app <strong>ntfy</strong> en tu móvil (gratuita — App Store / Play Store)</li>
          <li>En ntfy, suscríbete al canal que pongas aquí abajo</li>
          <li>¡Listo! Cuando un local envíe un pedido, te llega al móvil aunque la app esté cerrada</li>
        </ol>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #bfdbfe;color:#1e40af">
          <strong>El canal se comparte automáticamente</strong> con todos los locales vía Firebase — solo necesitas configurarlo aquí una vez.
        </div>
      </div>
      <label>Canal ntfy (elige uno único, sin espacios)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" value="${cfg.ntfyTopic||''}" placeholder="ej: provea-pedidos-2024" style="flex:1" onchange="cfg.ntfyTopic=this.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');saveCfg();this.value=cfg.ntfyTopic"/>
        <button class="btn btn-ghost btn-sm" onclick="testNtfy()">Probar</button>
      </div>
      <div style="font-size:12px;margin-top:5px;${cfg.ntfyTopic?'color:#16a34a':'color:#dc2626;font-weight:600'}">
        ${cfg.ntfyTopic
          ? `Canal activo: <strong>${cfg.ntfyTopic}</strong> — sincronizado con todos los dispositivos`
          : 'Sin canal configurado — las notificaciones NO llegarán hasta que pongas un canal aquí'}
      </div>
      <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" ${cfg.notifSound!==false?'checked':''} onchange="cfg.notifSound=this.checked;saveCfg()" style="width:15px;height:15px;accent-color:var(--pri)"> Sonido de alerta en el ordenador (cuando la pestaña está abierta)
        </label>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="testNotifSound()">Probar sonido</button>
        <div style="margin-top:12px">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">Notificaciones emergentes del navegador</div>
          <div id="push-status" style="font-size:12px;margin-bottom:8px;color:${typeof Notification!=='undefined'&&Notification.permission==='granted'?'#16a34a':typeof Notification!=='undefined'&&Notification.permission==='denied'?'#dc2626':'#6b7280'}">${typeof Notification==='undefined'?'No soportadas en este navegador':Notification.permission==='granted'?'Activas — recibirás notificaciones cuando lleguen pedidos':Notification.permission==='denied'?'Bloqueadas — actívalas en los ajustes del navegador':'Sin activar — pulsa el botón para activarlas'}</div>
          <button class="btn btn-ghost btn-sm" onclick="requestPushPermission()">Activar notificaciones del navegador</button>
          <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="pushNotify('Prueba','Si ves esto, las notificaciones del navegador funcionan ','')">Probar</button>
        </div>
      </div>
    </div>
    <div class="card-t" style="margin-top:20px">OCR para albaranes — Mistral OCR</div>
    <div class="fg">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px">
        <strong>OCR con IA — Mistral OCR</strong> (recomendado)
        <ol style="margin:8px 0 0 16px;padding:0;line-height:1.8">
          <li>Ve a <a href="https://console.mistral.ai" target="_blank" style="color:var(--pri)">console.mistral.ai</a> → Claves API</li>
          <li>Crea una clave y pégala aquí</li>
          <li>~2€ por cada 1.000 albaranes escaneados</li>
        </ol>
      </div>
      <label>API Key de Mistral</label>
      <input type="password" value="${cfg.mistralKey||''}" placeholder="aytq3E..." onchange="cfg.mistralKey=this.value.trim();saveCfg()"/>
      <div style="font-size:12px;color:${cfg.mistralKey?'#16a34a':'var(--mut)'};margin-top:4px">${cfg.mistralKey?'✓ Configurada — el OCR usará Mistral OCR (IA)':'Sin configurar — se usará OCR.space como alternativa'}</div>
    </div>
    <div class="card-t" style="margin-top:20px">OCR alternativo — OCR.space</div>
    <div class="fg">
      <div style="font-size:12px;color:var(--mut);margin-bottom:8px">Se usa solo si no hay clave Mistral configurada.</div>
      <label>API Key de OCR.space</label>
      <input type="password" value="${cfg.ocrSpaceKey||''}" placeholder="helloworld" onchange="cfg.ocrSpaceKey=this.value.trim();saveCfg()"/>
      <div style="font-size:12px;color:var(--mut);margin-top:4px">${cfg.ocrSpaceKey?'Configurada':'Usando clave demo (limitada)'}</div>
    </div>
    <div class="card-t" style="margin-top:20px">Firebase</div>
    <div class="banner green">Conectado a Firebase — los pedidos se sincronizan en tiempo real entre todos los dispositivos.</div>
    <div class="card-t" style="margin-top:20px">Actualización remota</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:10px">
      Cuando subas una nueva versión a GitHub, pulsa este botón para que <strong>todos los dispositivos conectados recarguen automáticamente</strong> la app con los últimos cambios.
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-pri btn-sm" onclick="forcePushUpdate()">Publicar actualización a todos los dispositivos</button>
      <span style="font-size:12px;color:var(--mut)">Útil tras subir cambios a GitHub — espera ~1 min a que se publique</span>
    </div>
    <div id="force-update-status" style="font-size:12px;color:var(--mut);margin-top:6px"></div>
    <div class="card-t" style="margin-top:20px">Datos</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-no btn-sm" onclick="if(confirm('¿Borrar TODOS los pedidos de Firebase?')){fbDb.ref('orders').remove();toast('Pedidos eliminados','#dc2626')}">Borrar pedidos</button>
      <button class="btn btn-no btn-sm" onclick="if(confirm('¿Borrar todos los albaranes?')){fbDb.ref('albaranes').remove();toast('Albaranes eliminados','#dc2626')}">Borrar albaranes</button>
    </div>
  </div>`;
}
