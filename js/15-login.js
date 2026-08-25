/* ═══════════════ LOGIN ═══════════════ */
function vLogin(){
  const isReg=S.loginTab==='register';
  return `<div class="login-wrap">
    <div class="login-title" style="margin-bottom:4px">O'<span style="color:var(--acc)">Carro</span> Pedidos</div>
    <div class="login-sub" style="margin-bottom:22px">Gestión de compras del grupo</div>
    <div style="max-width:400px;margin:0 auto">
      <div class="tabs" style="margin-bottom:18px">
        <button class="tab ${!isReg?'act':''}" onclick="S.loginTab='login';render()"> Iniciar sesión</button>
        <button class="tab ${isReg?'act':''}" onclick="S.loginTab='register';render()"> Solicitar acceso</button>
      </div>
      ${isReg ? vRegisterForm() : vLoginForm()}
    </div>
  </div>`;
}

function vLoginForm(){
  const fbReady=!!fbAuth;
  return `<div class="card">
    ${!fbReady?`<div class="banner" style="margin-bottom:14px;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:14px;height:14px;border:2px solid #d97706;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></span>
      Conectando con Firebase…
    </div>`:''}
    <div class="fg">
      <label>Email</label>
      <input type="email" id="login-email" placeholder="tucorreo@email.com" autocomplete="email"
        onkeydown="if(event.key==='Enter')loginWithEmail()"/>
    </div>
    <div class="fg">
      <label>Contraseña</label>
      <input type="password" id="login-pass" placeholder="••••••" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')loginWithEmail()"/>
    </div>
    <div id="login-err" style="color:#dc2626;font-size:13px;margin-bottom:10px;display:none;font-weight:600"></div>
    <button class="btn btn-pri" style="width:100%;justify-content:center;padding:11px" onclick="loginWithEmail()">Entrar →</button>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-ghost btn-sm" onclick="doResetPassword()" style="font-size:12px;color:var(--mut)">¿Olvidaste tu contraseña?</button>
    </div>
  </div>`;
}

function vRegisterForm(){
  const restOpts=cfg.users.map(u=>`<option value="${u.restaurant}">${u.restaurant}</option>`).join('');
  return `<div class="card">
    <div class="banner blue" style="margin-bottom:14px"> Tu solicitud será revisada por <strong>${cfg.adminName}</strong>. Recibirás acceso en cuanto la apruebe.</div>
    <div class="fg">
      <label>Email</label>
      <input type="email" id="reg-email" placeholder="tucorreo@email.com" autocomplete="email"/>
    </div>
    <div class="fg">
      <label>Contraseña <span style="font-weight:400;text-transform:none;letter-spacing:0">(mínimo 6 caracteres)</span></label>
      <input type="password" id="reg-pass" placeholder="••••••"/>
    </div>
    <div class="fg">
      <label>Confirmar contraseña</label>
      <input type="password" id="reg-pass2" placeholder="••••••"/>
    </div>
    <div class="fg">
      <label>Tu restaurante</label>
      <select id="reg-rest">${restOpts}</select>
    </div>
    <div class="fg">
      <label>Tu nombre</label>
      <input type="text" id="reg-name" placeholder="Juan García"/>
    </div>
    <div id="reg-err" style="color:#dc2626;font-size:13px;margin-bottom:10px;display:none;font-weight:600"></div>
    <button class="btn btn-pri" style="width:100%;justify-content:center;padding:11px" onclick="registerUser()">Solicitar acceso</button>
  </div>`;
}

function vPendingApproval(){
  const email=S.session?.email||'';
  const status=S.session?.pendingStatus||'pending';
  const isRejected=status==='rejected';
  return `<div class="login-wrap" style="text-align:center;padding-top:50px">
    <div style="font-size:58px;margin-bottom:16px">${isRejected?'':''}</div>
    <div class="login-title" style="font-size:20px">${isRejected?'Acceso denegado':'Solicitud pendiente'}</div>
    <div style="color:var(--mut);font-size:14px;margin:12px 0 24px;line-height:1.5">
      ${isRejected
        ?`Tu cuenta <strong>${email}</strong> no ha sido aprobada.<br>Contacta con ${cfg.adminName}.`
        :`Tu cuenta <strong>${email}</strong><br>está esperando aprobación.`}
    </div>
    ${!isRejected?`<div class="banner blue" style="max-width:380px;margin:0 auto 20px;text-align:left">
      Cuando <strong>${cfg.adminName}</strong> apruebe tu solicitud, la sesión se activará automáticamente. No hace falta que hagas nada.
    </div>`:''}
    <button class="btn btn-ghost" onclick="logout()">↩ Cerrar sesión</button>
  </div>`;
}
