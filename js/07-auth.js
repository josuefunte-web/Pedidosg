/* ═══════════════ AUTH FUNCTIONS ═══════════════ */
async function loginWithEmail(){
  // Lazy init: si Firebase cargó pero fbAuth no se asignó, intentar de nuevo
  if(!fbAuth && typeof firebase !== 'undefined'){
    try{ fbApp=fbApp||firebase.initializeApp(FB_CONFIG); fbAuth=firebase.auth(); fbDb=fbDb||firebase.database(); }catch(e){}
  }
  if(!fbAuth){
    toast('Sin conexión. Comprueba tu internet y recarga la página.','#dc2626',7000);return;
  }
  const email=(document.getElementById('login-email')?.value||'').trim();
  const pass=document.getElementById('login-pass')?.value||'';
  const errEl=document.getElementById('login-err');
  const showErr=msg=>{if(errEl){errEl.textContent=msg;errEl.style.display='block';}else toast(msg,'#dc2626');};
  if(!email||!pass){showErr('Introduce email y contraseña');return;}
  // Disable button to prevent double-click
  const btn=document.querySelector('#app .btn-pri');
  if(btn){btn.disabled=true;btn.textContent='Entrando...';}
  try{
    await fbAuth.signInWithEmailAndPassword(email,pass);
    // onAuthStateChanged handles navigation
  }catch(e){
    const msgs={'auth/user-not-found':'Usuario no encontrado','auth/wrong-password':'Contraseña incorrecta','auth/invalid-email':'Email no válido','auth/too-many-requests':'Demasiados intentos. Espera unos minutos.','auth/invalid-credential':'Email o contraseña incorrectos'};
    showErr(msgs[e.code]||e.message);
    if(btn){btn.disabled=false;btn.textContent='Entrar →';}
  }
}

async function registerUser(){
  if(!fbAuth && typeof firebase !== 'undefined'){
    try{ fbApp=fbApp||firebase.initializeApp(FB_CONFIG); fbAuth=firebase.auth(); fbDb=fbDb||firebase.database(); }catch(e){}
  }
  if(!fbAuth){toast('Sin conexión. Comprueba tu internet y recarga la página.','#dc2626',7000);return;}
  const email=(document.getElementById('reg-email')?.value||'').trim();
  const pass=document.getElementById('reg-pass')?.value||'';
  const pass2=document.getElementById('reg-pass2')?.value||'';
  const rest=document.getElementById('reg-rest')?.value||'';
  const name=(document.getElementById('reg-name')?.value||'').trim();
  const errEl=document.getElementById('reg-err');
  const showErr=msg=>{if(errEl){errEl.textContent=msg;errEl.style.display='block';}else toast(msg,'#dc2626');};
  if(errEl) errEl.style.display='none';
  if(!email||!pass){showErr('Rellena todos los campos obligatorios');return;}
  if(pass.length<6){showErr('La contraseña debe tener al menos 6 caracteres');return;}
  if(pass!==pass2){showErr('Las contraseñas no coinciden');return;}
  if(!rest){showErr('Selecciona tu restaurante');return;}
  const btn=document.querySelector('#app .btn-pri');
  if(btn){btn.disabled=true;btn.textContent='Enviando...';}
  try{
    const cred=await fbAuth.createUserWithEmailAndPassword(email,pass);
    await fbDb.ref('authUsers/'+cred.user.uid).set({
      uid:cred.user.uid,email,name:name||email,restaurant:rest,
      status:'pending',needsApproval:true,
      createdAt:new Date().toISOString()
    });
    toast('Solicitud enviada. '+cfg.adminName+' la revisará pronto.','#16a34a',6000);
    // onAuthStateChanged → pending-approval screen
  }catch(e){
    const msgs={'auth/email-already-in-use':'Este email ya está registrado','auth/invalid-email':'Email no válido','auth/weak-password':'Contraseña demasiado débil (mín. 6 caracteres)'};
    showErr(msgs[e.code]||e.message);
    if(btn){btn.disabled=false;btn.textContent='Solicitar acceso';}
  }
}

function doResetPassword(){
  const email=(document.getElementById('login-email')?.value||'').trim();
  if(!email){toast('Introduce tu email primero en el campo de arriba','#dc2626');return;}
  if(!fbAuth){toast('Sin conexión','#dc2626');return;}
  fbAuth.sendPasswordResetEmail(email)
    .then(()=>toast('Email de recuperación enviado a '+email,'#16a34a',5000))
    .catch(e=>toast('Error: '+e.message,'#dc2626'));
}
