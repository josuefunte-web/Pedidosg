/* ═══════════════ FOOD COST — CONTROL DE FACTURACIÓN Y COMPRAS ═══════════════ */
// Replica la plantilla mensual que Josué llevaba en Excel ("Control porcentajes.xlsx"):
// por cada local y día se registra Facturació y Compres; se calculan en vivo
// % FC (Compres/Facturació) y % FC s/Desc (que resta al coste el 50% del
// Descompte 1 y el 30% del Descompte 2 negociados con proveedores ese mes —
// misma fórmula que usaba en la hoja de cálculo).
// Datos en Firebase: foodcost/{monthKey 'YYYY-MM'}/{userId}/{desc1,desc2,objetivo,days:{dia:{fact,compras}}}

// Importa una única vez el histórico Abril-Agosto 2026 que Josué ya tenía en su Excel
// ("Control porcentajes.xlsx"). Los datos viven en js/data-foodcost-import.js, que solo
// se descarga cuando se pulsa el botón (igual que se hacía antes con la tarifa CWC) para
// no añadir peso a la carga normal de la app.
function fcImportHistorico(){
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  if(!confirm('¿Importar Abril-Agosto 2026 desde tu Excel? Si esos meses ya tienen datos en la app, se sobrescribirán.')) return;
  const run=()=>{
    const data=(typeof FOODCOST_IMPORT_DATA!=='undefined')?FOODCOST_IMPORT_DATA:window.FOODCOST_IMPORT_DATA;
    if(!data){ toast('No se pudo leer el archivo de importación','#dc2626'); return; }
    const updates={};
    Object.keys(data).forEach(mk=>{ updates['foodcost/'+mk]=data[mk]; });
    fbDb.ref().update(updates)
      .then(()=>{ toast('Histórico importado: Abril a Agosto 2026','#16a34a',5000); renderAdminContent(); })
      .catch(e=>toast('Error al importar: '+e.message,'#dc2626',5000));
  };
  if(typeof FOODCOST_IMPORT_DATA!=='undefined'){ run(); return; }
  const s=document.createElement('script');
  s.src='js/data-foodcost-import.js?v=20260820d';
  s.onload=run;
  s.onerror=()=>toast('No se pudo cargar el archivo de importación','#dc2626');
  document.head.appendChild(s);
}

function fcDaysInMonth(monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  return new Date(y,m,0).getDate();
}
function fcMonthLabel(monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
}
function fcChangeMonth(delta){
  const [y,m]=S.foodcostMonth.split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  S.foodcostMonth=d.toISOString().slice(0,7);
  renderAdminContent();
}
function fcSetLocal(id){ S.foodcostLocalId=id; renderAdminContent(); }
function fcLocalData(monthKey,uid){ return (foodCost[monthKey]||{})[uid]||{}; }
function fcSetMeta(uid,field,val){
  const v=parseFloat(val)||0;
  if(fbDb) fbDb.ref(`foodcost/${S.foodcostMonth}/${uid}/${field}`).set(v);
}
function fcSetDay(uid,day,field,val){
  const v=parseFloat(val)||0;
  if(fbDb) fbDb.ref(`foodcost/${S.foodcostMonth}/${uid}/days/${day}/${field}`).set(v);
}
// Totales del mes para un local: suma de todos los días + % FC calculado sobre esa suma
// (igual que la fila "TOTALS MENSUALS" del Excel, que aplica la misma fórmula a los sumatorios).
function fcLocalTotals(monthKey,uid){
  const d=fcLocalData(monthKey,uid);
  const days=d.days||{};
  let fact=0,compras=0;
  Object.values(days).forEach(v=>{ fact+=parseFloat(v.fact)||0; compras+=parseFloat(v.compras)||0; });
  const desc1=parseFloat(d.desc1)||0, desc2=parseFloat(d.desc2)||0;
  const pct = fact>0 ? compras/fact : null;
  const pctDesc = fact>0 ? (compras-desc1*0.5-desc2*0.3)/fact : null;
  return {fact,compras,pct,pctDesc,desc1,desc2,objetivo:d.objetivo};
}
function fcPct(v){ return v==null?'—':(v*100).toFixed(1)+'%'; }
// Verde si está en objetivo o por debajo, ámbar si se pasa poco, rojo si se pasa mucho
function fcPctColor(pct,objetivo){
  if(pct==null||objetivo==null) return 'var(--txt)';
  const diff=pct*100-objetivo;
  return diff>3?'#dc2626':diff>0?'#d97706':'#16a34a';
}

function vFoodCost(){
  const monthKey=S.foodcostMonth;
  const label=fcMonthLabel(monthKey);

  // ── Resumen del mes: todos los locales de un vistazo (equivale al bloque de
  // totales por local que en el Excel quedaba repartido en 48 columnas) ──────
  const summaryRows=cfg.users.map(u=>{
    const t=fcLocalTotals(monthKey,u.id);
    const col=fcPctColor(t.pct,t.objetivo);
    const act=S.foodcostLocalId===u.id;
    return `<tr style="cursor:pointer${act?';background:var(--srf)':''}" onclick="fcSetLocal('${u.id}')">
      <td style="font-weight:${act?700:400}">${u.restaurant}</td>
      <td style="text-align:right">${fmt(t.fact)}</td>
      <td style="text-align:right">${fmt(t.compras)}</td>
      <td style="text-align:right;font-weight:700;color:${col}">${fcPct(t.pct)}</td>
      <td style="text-align:right;color:var(--mut)">${t.objetivo!=null?t.objetivo+'%':'—'}</td>
    </tr>`;
  }).join('');
  const summary=`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="card-t">Resumen del mes — todos los locales</div>
      <button class="btn btn-ghost btn-sm" onclick="fcImportHistorico()">Importar histórico de mi Excel (Abril–Agosto)</button>
    </div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:8px">Toca un local para ver y editar su detalle día a día.</div>
    <div style="overflow-x:auto"><table class="spend-table">
      <tr><th>Local</th><th style="text-align:right">Facturación</th><th style="text-align:right">Compras</th><th style="text-align:right">% FC</th><th style="text-align:right">Objetivo</th></tr>
      ${summaryRows}
    </table></div>
  </div>`;

  const monthNav=`<div style="display:flex;align-items:center;gap:10px;margin:14px 0">
    <button class="btn btn-ghost btn-sm" onclick="fcChangeMonth(-1)">‹ Mes anterior</button>
    <div style="font-weight:700;text-transform:capitalize;min-width:140px;text-align:center">${label}</div>
    <button class="btn btn-ghost btn-sm" onclick="fcChangeMonth(1)">Mes siguiente ›</button>
  </div>`;

  // ── Detalle día a día del local seleccionado ────────────────────────────
  const uid=S.foodcostLocalId;
  const localUser=cfg.users.find(u=>u.id===uid)||cfg.users[0];
  const d=fcLocalData(monthKey,uid);
  const days=d.days||{};
  const desc1=d.desc1||'', desc2=d.desc2||'';
  // objetivo: null si no está configurado (para no colorear en rojo por defecto), y el
  // valor para mostrar en el input (vacío si no hay nada guardado todavía)
  const objetivo=(d.objetivo!=null&&d.objetivo!=='')?parseFloat(d.objetivo):null;
  const objetivoInput=objetivo!=null?objetivo:'';

  const localSel=`<select onchange="fcSetLocal(this.value)" style="max-width:280px;font-weight:600">${cfg.users.map(u=>`<option value="${u.id}" ${uid===u.id?'selected':''}>${u.restaurant}</option>`).join('')}</select>`;

  const metaCard=`<div class="card">
    <div class="card-t">${localUser.restaurant} — <span style="text-transform:capitalize">${label}</span></div>
    <div class="three-col">
      <div class="fg"><label>Objetivo % FC</label><input type="number" step="0.5" min="0" max="100" value="${objetivoInput}" placeholder="—" onchange="fcSetMeta('${uid}','objetivo',this.value)"/></div>
      <div class="fg"><label>Descompte 1 (€)</label><input type="number" step="0.01" min="0" value="${desc1}" placeholder="0" onchange="fcSetMeta('${uid}','desc1',this.value)"/></div>
      <div class="fg"><label>Descompte 2 (€)</label><input type="number" step="0.01" min="0" value="${desc2}" placeholder="0" onchange="fcSetMeta('${uid}','desc2',this.value)"/></div>
    </div>
    <div style="font-size:12px;color:var(--mut)">% FC s/Desc resta al coste el 50% del Descompte 1 y el 30% del Descompte 2 — misma fórmula que tenías en el Excel.</div>
  </div>`;

  const nDays=fcDaysInMonth(monthKey);
  const t=fcLocalTotals(monthKey,uid);
  const dayRows=Array.from({length:nDays},(_,i)=>i+1).map(day=>{
    const v=days[day]||{};
    const factRaw=v.fact??'', comprasRaw=v.compras??'';
    const f=parseFloat(v.fact)||0, c=parseFloat(v.compras)||0;
    const pct=f>0?c/f:null;
    const pctDesc=f>0?(c-(parseFloat(desc1)||0)*0.5-(parseFloat(desc2)||0)*0.3)/f:null;
    return `<tr>
      <td>${day}</td>
      <td><input type="number" step="0.01" min="0" value="${factRaw}" placeholder="—" style="width:100px;padding:5px 7px;font-size:13px" onchange="fcSetDay('${uid}',${day},'fact',this.value)"/></td>
      <td><input type="number" step="0.01" min="0" value="${comprasRaw}" placeholder="—" style="width:100px;padding:5px 7px;font-size:13px" onchange="fcSetDay('${uid}',${day},'compras',this.value)"/></td>
      <td style="text-align:right;color:${fcPctColor(pct,objetivo)}">${fcPct(pct)}</td>
      <td style="text-align:right;color:${fcPctColor(pctDesc,objetivo)}">${fcPct(pctDesc)}</td>
    </tr>`;
  }).join('');

  const totalsRow=`<tr style="font-weight:700;background:var(--srf)">
    <td>Total</td>
    <td style="text-align:right">${fmt(t.fact)}</td>
    <td style="text-align:right">${fmt(t.compras)}</td>
    <td style="text-align:right;color:${fcPctColor(t.pct,t.objetivo)}">${fcPct(t.pct)}</td>
    <td style="text-align:right;color:${fcPctColor(t.pctDesc,t.objetivo)}">${fcPct(t.pctDesc)}</td>
  </tr>`;

  const dailyCard=`<div class="card">
    <div style="overflow-x:auto"><table class="spend-table">
      <tr><th>Día</th><th>Facturació</th><th>Compres</th><th style="text-align:right">% FC</th><th style="text-align:right">% FC s/Desc</th></tr>
      ${dayRows}
      ${totalsRow}
    </table></div>
  </div>`;

  return `<div class="main">
    ${summary}
    ${monthNav}
    <div class="fg" style="max-width:280px">${localSel}</div>
    ${metaCard}
    ${dailyCard}
  </div>`;
}
