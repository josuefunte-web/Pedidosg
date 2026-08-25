/* NOVENTIA — Vacaciones / Personal
   Módulo Vanilla JS. Funciona con Firebase si existe fbDb; si no, usa localStorage.
   Integra una vista global vVacaciones() para admin. */
(function(){
'use strict';

const VAC_DEFAULT_COLORS=['#3b82f6','#10b981','#f59e0b','#7c1d2d','#6366f1','#0891b2','#b2400e'];

function esc(v){
  if(typeof escHtml==='function') return escHtml(v);
  return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function attr(v){
  if(typeof escAttr==='function') return escAttr(v);
  return esc(v);
}
function uid(){return 'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function parseDate(value){const [y,m,d]=String(value||'').split('-').map(Number);return new Date(y,m-1,d);}
function formatDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function addDays(date,amount){const n=new Date(date);n.setDate(n.getDate()+amount);return n;}
function daysInclusive(start,end){const ms=parseDate(end)-parseDate(start);return Math.max(0,Math.floor(ms/86400000)+1);}
function overlapDaysUntilToday(v,today){const s=parseDate(v.start),e=parseDate(v.end),c=parseDate(today);if(c<s)return 0;const ee=c<e?c:e;return Math.max(0,Math.floor((ee-s)/86400000)+1);}
function remainingFutureDays(v,today){const e=parseDate(v.end),c=parseDate(today);if(c>=e)return 0;const s=parseDate(v.start),es=c<s?s:addDays(c,1);return Math.max(0,Math.floor((e-es)/86400000)+1);}
function buildMonthDays(year,monthIndex){const first=new Date(year,monthIndex,1);const startOffset=(first.getDay()+6)%7;const gridStart=addDays(first,-startOffset);return Array.from({length:42},(_,i)=>addDays(gridStart,i));}
const monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const weekDays=['L','M','X','J','V','S','D'];

window.vacStaff = window.vacStaff || {};
window.vacations = window.vacations || {};

function seedIfEmpty(){
  if(Object.keys(window.vacStaff||{}).length) return;
  window.vacStaff={
    david:{id:'david',name:'David',annualDays:30,color:VAC_DEFAULT_COLORS[0],active:true},
    laura:{id:'laura',name:'Laura',annualDays:30,color:VAC_DEFAULT_COLORS[1],active:true},
    marcos:{id:'marcos',name:'Marcos',annualDays:30,color:VAC_DEFAULT_COLORS[2],active:true}
  };
  window.vacations={david:{v1:{id:'v1',start:'2026-02-01',end:'2026-02-10',note:'Vacaciones febrero'}}};
}
function saveLocal(){try{localStorage.setItem('nv_vac_staff',JSON.stringify(window.vacStaff||{}));localStorage.setItem('nv_vacations',JSON.stringify(window.vacations||{}));}catch(e){}}
function loadLocal(){try{window.vacStaff=JSON.parse(localStorage.getItem('nv_vac_staff')||'{}');window.vacations=JSON.parse(localStorage.getItem('nv_vacations')||'{}');}catch(e){}}
function saveStaff(){
  if(window.fbDb) return fbDb.ref('staff').set(window.vacStaff).catch(e=>toast&&toast('Error guardando personal: '+e.message,'#dc2626'));
  saveLocal();
}
function saveVacations(){
  if(window.fbDb) return fbDb.ref('vacations').set(window.vacations).catch(e=>toast&&toast('Error guardando vacaciones: '+e.message,'#dc2626'));
  saveLocal();
}
function initVacState(){
  if(typeof S==='undefined') window.S={};
  if(!S.vacToday) S.vacToday=formatDate(new Date());
  if(!S.vacMonth) S.vacMonth=S.vacToday.slice(0,7);
  if(!S.vacSelected) S.vacSelected=Object.keys(window.vacStaff||{})[0]||'david';
  if(!S.vacDiscountMode) S.vacDiscountMode='consumed';
  if(!S.vacForm) S.vacForm={start:S.vacToday,end:S.vacToday,note:''};
  if(S.vacShowAddStaff===undefined) S.vacShowAddStaff=false;
}
function rerender(){if(typeof renderAdminContent==='function')renderAdminContent();else if(typeof render==='function')render();}
function getEmployees(){return Object.values(window.vacStaff||{}).filter(e=>e&&e.active!==false).sort((a,b)=>(a.name||'').localeCompare(b.name||'','es'));}
function getSelected(){const list=getEmployees();return (window.vacStaff||{})[S.vacSelected]||list[0]||null;}
function getVacList(empId){return Object.values((window.vacations||{})[empId]||{}).sort((a,b)=>String(a.start).localeCompare(String(b.start)));}
function calcBalance(emp){
  const list=getVacList(emp.id);
  const consumed=list.reduce((sum,v)=>sum+overlapDaysUntilToday(v,S.vacToday),0);
  const planned=list.reduce((sum,v)=>sum+daysInclusive(v.start,v.end),0);
  const pending=list.reduce((sum,v)=>sum+remainingFutureDays(v,S.vacToday),0);
  const available=S.vacDiscountMode==='consumed'?(emp.annualDays||0)-consumed:(emp.annualDays||0)-planned;
  return {consumed,planned,pending,available:Math.max(0,available)};
}
function isVacationDay(emp,day){const key=formatDate(day);return getVacList(emp.id).some(v=>key>=v.start&&key<=v.end);}
function dayStatus(emp,day){const key=formatDate(day);if(!isVacationDay(emp,day))return 'none';if(key<S.vacToday)return 'past';if(key===S.vacToday)return 'today';return 'future';}

function employeesHtml(selected){
  const list=getEmployees();
  return `<div class="vac-panel"><div class="vac-panel-head"><h2>Trabajadores</h2><button onclick="vacToggleAddStaff()">+ Persona</button></div>
    ${S.vacShowAddStaff?`<div class="vac-add-staff"><input id="vac-new-name" placeholder="Nombre"><input id="vac-new-days" type="number" value="30"><button onclick="vacAddStaff()">Añadir</button></div>`:''}
    <div class="vac-people">${list.map(emp=>`<button class="vac-person ${selected&&selected.id===emp.id?'act':''}" onclick="vacSelect('${attr(emp.id)}')"><span><i style="background:${attr(emp.color||'#7c1d2d')}"></i><b>${esc(emp.name)}</b></span><small>${emp.annualDays||0} días/año</small></button>`).join('')||'<div class="vac-empty-mini">Sin trabajadores.</div>'}</div>
  </div>`;
}
function balanceHtml(emp){
  const b=calcBalance(emp);
  return `<div class="vac-panel"><h2>Saldo de ${esc(emp.name)}</h2><div class="vac-balance-grid">
    <label class="vac-balance"><small>Anuales</small><input type="number" value="${attr(emp.annualDays||0)}" onchange="vacAnnualDays(this.value)"></label>
    <article class="vac-balance main"><small>Disponibles</small><b>${b.available}</b></article>
    <article class="vac-balance past"><small>Consumidos</small><b>${b.consumed}</b></article>
    <article class="vac-balance future"><small>Pendientes</small><b>${b.pending}</b></article>
  </div><div class="vac-mode"><label>Criterio de descuento</label><select onchange="vacMode(this.value)"><option value="consumed" ${S.vacDiscountMode==='consumed'?'selected':''}>Descontar solo días ya consumidos</option><option value="planned" ${S.vacDiscountMode==='planned'?'selected':''}>Bloquear también vacaciones asignadas</option></select></div></div>`;
}
function formHtml(){
  const f=S.vacForm||{};
  return `<div class="vac-panel"><h2>Asignar vacaciones</h2><div class="vac-form"><label>Desde<input type="date" value="${attr(f.start||'')}" onchange="vacForm('start',this.value)"></label><label>Hasta<input type="date" value="${attr(f.end||'')}" onchange="vacForm('end',this.value)"></label><label>Nota<input value="${attr(f.note||'')}" placeholder="Opcional" oninput="vacForm('note',this.value)"></label><button onclick="vacAddVacation()">Añadir rango</button></div></div>`;
}
function calendarHtml(emp){
  const [y,m]=String(S.vacMonth).split('-').map(Number);
  const cursor=new Date(y,m-1,1);
  const days=buildMonthDays(cursor.getFullYear(),cursor.getMonth());
  return `<div class="vac-panel vac-calendar-panel"><div class="vac-cal-head"><h2>${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}</h2><div><button onclick="vacMoveMonth(-1)">‹</button><button onclick="vacGoToday()">Hoy</button><button onclick="vacMoveMonth(1)">›</button></div></div><div class="vac-weekdays">${weekDays.map(d=>`<span>${d}</span>`).join('')}</div><div class="vac-calendar">${days.map(day=>{const key=formatDate(day);const st=dayStatus(emp,day);const inMonth=day.getMonth()===cursor.getMonth();return `<div class="vac-day ${st} ${inMonth?'':'out'}"><strong>${day.getDate()}</strong>${st!=='none'?`<span>${st==='past'?'Consumido':st==='today'?'En curso':'Asignado'}</span>`:''}</div>`;}).join('')}</div><div class="vac-legend"><span><i class="past"></i>Consumido</span><span><i class="today"></i>En curso</span><span><i class="future"></i>Pendiente</span></div></div>`;
}
function rangesHtml(emp){
  const list=getVacList(emp.id);
  return `<div class="vac-panel"><h2>Rangos asignados</h2>${list.length?`<div class="vac-ranges">${list.map(v=>`<article><div><b>${esc(v.note||'Vacaciones')}</b><span>${esc(v.start)} → ${esc(v.end)} · ${daysInclusive(v.start,v.end)} días · ${overlapDaysUntilToday(v,S.vacToday)} consumidos</span></div><button onclick="vacRemove('${attr(v.id)}')">Eliminar</button></article>`).join('')}</div>`:'<div class="vac-empty">Este trabajador todavía no tiene vacaciones asignadas.</div>'}</div>`;
}
function vVacaciones(){
  loadLocal(); seedIfEmpty(); initVacState();
  const emp=getSelected(); if(!emp) return '<div class="vac-empty">No hay trabajadores registrados.</div>';
  return `<div class="vac-page"><header class="vac-head"><span>Gestión de personal</span><h1>Vacaciones</h1><p>Controla días anuales, vacaciones consumidas y rangos pendientes.</p><label>Fecha actual / simulada<input type="date" value="${attr(S.vacToday)}" onchange="vacToday(this.value)"></label></header><div class="vac-layout"><aside>${employeesHtml(emp)}${balanceHtml(emp)}${formHtml()}</aside><main>${calendarHtml(emp)}${rangesHtml(emp)}</main></div></div>`;
}

window.vacSelect=function(id){S.vacSelected=id;rerender();};
window.vacToday=function(v){S.vacToday=v;S.vacMonth=v.slice(0,7);rerender();};
window.vacMode=function(v){S.vacDiscountMode=v;rerender();};
window.vacForm=function(k,v){S.vacForm={...(S.vacForm||{}),[k]:v};};
window.vacMoveMonth=function(delta){const [y,m]=String(S.vacMonth).split('-').map(Number);S.vacMonth=formatDate(new Date(y,m-1+delta,1)).slice(0,7);rerender();};
window.vacGoToday=function(){S.vacMonth=S.vacToday.slice(0,7);rerender();};
window.vacAnnualDays=function(v){const emp=getSelected();if(!emp)return;emp.annualDays=Math.max(0,parseInt(v||0,10));saveStaff();rerender();};
window.vacAddVacation=function(){const emp=getSelected(),f=S.vacForm||{};if(!emp||!f.start||!f.end||f.end<f.start){if(typeof toast==='function')toast('Rango de fechas no válido','#dc2626');return;} if(!window.vacations[emp.id]) window.vacations[emp.id]={}; const id=uid(); window.vacations[emp.id][id]={id,start:f.start,end:f.end,note:f.note||'Vacaciones'};S.vacForm={start:f.start,end:f.end,note:''};saveVacations();rerender();};
window.vacRemove=function(id){const emp=getSelected();if(!emp||!window.vacations[emp.id])return;delete window.vacations[emp.id][id];saveVacations();rerender();};
window.vacToggleAddStaff=function(){S.vacShowAddStaff=!S.vacShowAddStaff;rerender();};
window.vacAddStaff=function(){const name=(document.getElementById('vac-new-name')?.value||'').trim();const days=parseInt(document.getElementById('vac-new-days')?.value||30,10);if(!name)return;const id=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||uid();window.vacStaff[id]={id,name,annualDays:Math.max(0,days||30),color:VAC_DEFAULT_COLORS[Object.keys(window.vacStaff).length%VAC_DEFAULT_COLORS.length],active:true};S.vacSelected=id;S.vacShowAddStaff=false;saveStaff();rerender();};
window.vVacaciones=vVacaciones;
window.initVacationListeners=function(){
  if(!window.fbDb){loadLocal();seedIfEmpty();return;}
  try{fbDb.ref('staff').on('value',snap=>{window.vacStaff=snap.val()||{};seedIfEmpty();if(S.view==='admin'&&S.adminTab==='vacaciones')renderAdminContent();});fbDb.ref('vacations').on('value',snap=>{window.vacations=snap.val()||{};if(S.view==='admin'&&S.adminTab==='vacaciones')renderAdminContent();});}catch(e){console.warn('vac listeners',e);loadLocal();seedIfEmpty();}
};
})();
