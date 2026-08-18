/* ═══════════════ PIN ═══════════════ */
function openPIN(type,userId){
  S.pinTarget={type,userId};S.pinBuf='';
  const u=type==='user'?cfg.users.find(u=>u.id===userId):null;
  document.getElementById('pin-title').textContent=type==='admin'?'Administrador':(u?u.restaurant:'PIN');
  document.getElementById('pin-sub').textContent=type==='admin'?'PIN de administrador':'Introduce tu PIN';
  document.getElementById('pin-err').style.display='none';
  updateDots();
  document.getElementById('pin-ov').style.display='flex';
}
function closePIN(){ document.getElementById('pin-ov').style.display='none';S.pinBuf=''; }
function addPIN(d){ if(S.pinBuf.length>=4)return;S.pinBuf+=d;updateDots();if(S.pinBuf.length===4)setTimeout(confirmPIN,120); }
function delPIN(){ S.pinBuf=S.pinBuf.slice(0,-1);updateDots(); }
function updateDots(){
  for(let i=0;i<4;i++) document.getElementById('d'+i).className='dot'+(i<S.pinBuf.length?' fill':'');
  document.getElementById('pin-err').style.display='none';
}
function confirmPIN(){
  const {type,userId}=S.pinTarget;
  if(type==='admin'){
    if(S.pinBuf===cfg.adminPIN){closePIN();S.session={isAdmin:true,name:cfg.adminName};goAdmin();}
    else wrong();
  } else {
    const u=cfg.users.find(u=>u.id===userId);
    if(u&&S.pinBuf===u.pin){closePIN();S.session={userId:u.id,name:u.name,restaurant:u.restaurant,isAdmin:false,needsApproval:u.needsApproval};goOrder();}
    else wrong();
  }
}
function wrong(){ S.pinBuf='';updateDots();const e=document.getElementById('pin-err');e.style.display='block';setTimeout(()=>e.style.display='none',2000); }
document.addEventListener('keydown',e=>{
  if(document.getElementById('pin-ov').style.display==='none') return;
  if(e.key>='0'&&e.key<='9') addPIN(e.key);
  else if(e.key==='Backspace') delPIN();
  else if(e.key==='Enter') confirmPIN();
});
