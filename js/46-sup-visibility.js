/* ═══════════════ VISIBILIDAD DE PROVEEDORES POR LOCAL ═══════════════ */
// Pantalla dedicada para editar de un vistazo qué proveedores ve cada local.
// Antes esto solo se podía tocar entrando al proveedor uno por uno; aquí se
// muestra una matriz (proveedores en filas × locales en columnas) con
// checkboxes en cada cruce — igual que la vista clásica de permisos en una
// hoja de cálculo. Un ✓ = ese local ve ese proveedor; sin ✓ = está oculto.
// La fuente de verdad sigue siendo `sup.disabledFor=[userId,...]` y se
// modifica reutilizando `toggleSupVisibility(sid,uid,visible)` de
// js/23-suppliers.js — nada nuevo que sincronizar con Firebase.
//
// Para acelerar la selección cuando hay muchos proveedores/locales, la
// matriz soporta "pintar" varias casillas arrastrando el puntero (como en
// una hoja de cálculo), además de un buscador de proveedores y un filtro
// para localizar los que tienen visibilidad a medias.

// Los botones "Todos ✓ / Ninguno ✕" actualizan las celdas ya pintadas
// directamente en el DOM (como el arrastre) en vez de volver a construir
// toda la tabla — un renderAdminContent() aquí resetea el scroll interno
// de la matriz (y el de la página) cada vez que se pulsan, que es molesto
// cuando hay muchos proveedores y toca desplazarse para llegar a ellos.
function svSetAllForSup(sid, visible){
  const tr=document.querySelector(`#sv-tbody tr[data-sid="${sid}"]`);
  if(tr){
    tr.querySelectorAll('td.sv-cell').forEach(td=>svApplyPaint(td,visible));
  } else {
    (cfg.users||[]).forEach(u=>toggleSupVisibilityQuiet(sid,u.id,visible));
  }
  saveSups(sid);
  svUpdatePartialChip();
  toast(visible?'Proveedor visible para todos los locales':'Proveedor oculto para todos los locales','#16a34a');
}
function svSetAllForLocal(uid, visible){
  const rows=document.querySelectorAll('#sv-tbody tr[data-sid]');
  if(rows.length){
    rows.forEach(tr=>{
      const td=tr.querySelector(`td.sv-cell[data-uid="${uid}"]`);
      if(td) svApplyPaint(td,visible);
    });
  } else {
    supList().forEach(s=>toggleSupVisibilityQuiet(s.id,uid,visible));
  }
  // Guardar todos los proveedores tocados de una vez
  if(fbDb) fbDb.ref('suppliers').set(suppliers);
  localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
  svUpdatePartialChip();
  const localName=(cfg.users.find(u=>u.id===uid)||{}).restaurant||uid;
  toast(visible?`Todos los proveedores activos para ${localName}`:`Todos los proveedores ocultos para ${localName}`,'#16a34a');
}
// Versión sin guardar/toast — solo muta en memoria (para hacer un solo guardado al final)
function toggleSupVisibilityQuiet(sid,uid,visible){
  if(!suppliers[sid]) return;
  if(!suppliers[sid].disabledFor) suppliers[sid].disabledFor=[];
  if(visible){ suppliers[sid].disabledFor=suppliers[sid].disabledFor.filter(id=>id!==uid); }
  else { if(!suppliers[sid].disabledFor.includes(uid)) suppliers[sid].disabledFor.push(uid); }
}

const SV_CHECK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><path d="M20 6 9 17l-5-5"/></svg>';
// Estilos de la matriz por clase (no inline), para que pintar por arrastre
// solo tenga que alternar la clase `sv-vis` y el CSS haga el resto — si el
// color dependiera de un `style` fijado al renderizar, cambiarlo a mano en
// cada celda pintada quedaría desincronizado.
const SV_STYLE=`<style>
  /* Esta pantalla es una tabla ancha (proveedores × locales): el límite de
     900px de .main (pensado para lectura de texto) la deja apretujada con
     mucho hueco muerto a los lados. Aquí se anula solo para esta vista. */
  .main.sv-wide{max-width:none}
  .sv-cell{background:transparent}
  .sv-cell.sv-vis{background:rgba(22,163,74,.08)}
  .sv-dot{width:16px;height:16px;border-radius:5px;margin:0 auto;border:1.5px solid var(--brd);display:flex;align-items:center;justify-content:center;transition:background .08s,border-color .08s}
  .sv-cell.sv-vis .sv-dot{background:#16a34a;border-color:#16a34a}
  .sv-cell:hover .sv-dot{border-color:var(--acc,#e11d48)}
  .sv-count-full{color:#059669!important;border-color:rgba(22,163,74,.35)!important;background:rgba(22,163,74,.1)!important}
  .sv-count-none{color:var(--mut)!important}
</style>`;

function svVisibleCount(s,users){ return users.filter(u=>!(s.disabledFor||[]).includes(u.id)).length; }
function svIsPartial(s,users){ const n=svVisibleCount(s,users); return n>0 && n<users.length; }

function svSetQuery(v){
  S.supVisQuery=v;
  svFilterRows();
}
function svTogglePartialFilter(){
  S.supVisOnlyPartial=!S.supVisOnlyPartial;
  const chip=document.getElementById('sv-chip-partial');
  if(chip) chip.classList.toggle('act',S.supVisOnlyPartial);
  svFilterRows();
}
// Aplica el buscador + filtro "solo parciales" directamente sobre el DOM
// (sin volver a llamar a renderAdminContent) para no perder el foco del
// campo de búsqueda mientras se escribe.
function svFilterRows(){
  const tbody=document.getElementById('sv-tbody');
  if(!tbody) return;
  const q=(S.supVisQuery||'').toLowerCase().trim();
  const onlyPartial=!!S.supVisOnlyPartial;
  let shown=0;
  tbody.querySelectorAll('tr[data-sid]').forEach(tr=>{
    const name=(tr.dataset.name||'');
    const matchesQ=!q||name.includes(q);
    const matchesPartial=!onlyPartial||tr.dataset.partial==='1';
    const show=matchesQ&&matchesPartial;
    tr.style.display=show?'':'none';
    if(show) shown++;
  });
  const emptyRow=document.getElementById('sv-empty-row');
  if(emptyRow) emptyRow.style.display=shown?'none':'';
  const foot=document.getElementById('sv-foot-count');
  if(foot) foot.textContent=`${shown} de ${tbody.querySelectorAll('tr[data-sid]').length} proveedores mostrados`;
}

// ── Selección por arrastre ──────────────────────────────────────────────
// Al bajar el puntero en una casilla se fija el valor a pintar (lo
// contrario de esa casilla), y mientras el puntero sigue pulsado se aplica
// ese mismo valor a cada casilla por la que pasa. El guardado en Firebase
// se hace una sola vez al soltar, para no disparar un guardado por celda.
let _svPainting=false, _svPaintValue=true, _svTouched=null;

function svApplyPaint(td,visible){
  const sid=td.dataset.sid, uid=td.dataset.uid;
  if(!suppliers[sid]) return;
  toggleSupVisibilityQuiet(sid,uid,visible);
  td.classList.toggle('sv-vis',visible);
  const dot=td.querySelector('.sv-dot');
  if(dot) dot.innerHTML=visible?SV_CHECK_SVG:'';
  if(_svTouched) _svTouched.add(sid);
  // Refrescar solo el contador y la marca "parcial" de esta fila
  const tr=td.closest('tr');
  if(!tr) return;
  const users=(cfg.users||[]);
  const s=suppliers[sid];
  const n=svVisibleCount(s,users);
  const countEl=tr.querySelector('.sv-count');
  if(countEl){
    countEl.textContent=`${n}/${users.length}`;
    countEl.classList.toggle('sv-count-full',n===users.length);
    countEl.classList.toggle('sv-count-none',n===0);
  }
  const partial=n>0&&n<users.length;
  tr.dataset.partial=partial?'1':'0';
  if(S.supVisOnlyPartial){ tr.style.display=partial?'':'none'; }
}

// Recuenta cuántas filas están marcadas como parciales y refresca el
// contador del chip. Se llama una sola vez al terminar (soltar el
// arrastre, o tras un botón "Todos/Ninguno"), no por cada celda pintada.
function svUpdatePartialChip(){
  const tbody=document.getElementById('sv-tbody');
  const chip=document.getElementById('sv-chip-partial');
  if(!tbody || !chip) return;
  const n=tbody.querySelectorAll('tr[data-sid][data-partial="1"]').length;
  chip.textContent=`Solo parciales (${n})`;
}

function initSupVisibility(){
  const table=document.getElementById('sv-table');
  if(!table || table._svBound) return;
  table._svBound=true;
  table.addEventListener('pointerdown',e=>{
    const td=e.target.closest('td.sv-cell');
    if(!td) return;
    if(e.pointerType==='mouse' && e.button!==0) return;
    _svPainting=true;
    _svTouched=new Set();
    _svPaintValue=!td.classList.contains('sv-vis');
    svApplyPaint(td,_svPaintValue);
    e.preventDefault();
  });
  table.addEventListener('pointerenter',e=>{
    if(!_svPainting) return;
    const td=e.target.closest('td.sv-cell');
    if(td) svApplyPaint(td,_svPaintValue);
  },true);
  window.addEventListener('pointerup',()=>{
    if(!_svPainting) return;
    _svPainting=false;
    if(_svTouched && _svTouched.size){
      // Un único guardado para todos los proveedores tocados en el arrastre
      if(fbDb) fbDb.ref('suppliers').set(suppliers);
      localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
      svUpdatePartialChip();
    }
    _svTouched=null;
  });
}

function vSupVisibility(){
  const sups=supList();
  const users=(cfg.users||[]).slice();
  if(!sups.length){
    return `<div class="main"><div class="card"><div class="card-t">Visibilidad por local</div><div style="color:var(--mut)">No hay proveedores todavía.</div></div></div>`;
  }

  const partialCount=sups.filter(s=>svIsPartial(s,users)).length;

  // Cabecera con los locales — nombre en vertical para que quepan todos
  const headCells=users.map(u=>`
    <th style="padding:8px 4px;text-align:center;min-width:64px;vertical-align:bottom;background:var(--srf);position:sticky;top:0;z-index:1">
      <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;font-weight:600;white-space:nowrap;margin:0 auto 6px;height:110px;line-height:1.2">${u.restaurant}</div>
      <div style="display:flex;flex-direction:column;gap:2px;align-items:center">
        <button class="btn btn-ghost" style="font-size:10px;padding:2px 5px;line-height:1" title="Marcar todos" onclick="svSetAllForLocal('${u.id}',true)">✓</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:2px 5px;line-height:1" title="Desmarcar todos" onclick="svSetAllForLocal('${u.id}',false)">✕</button>
      </div>
    </th>`).join('');

  // Filas: un proveedor por fila
  const rows=sups.map(s=>{
    const dis=s.disabledFor||[];
    const n=svVisibleCount(s,users);
    const partial=n>0&&n<users.length;
    const countCls=n===users.length?'sv-count-full':(n===0?'sv-count-none':'');
    const cells=users.map(u=>{
      const visible=!dis.includes(u.id);
      return `<td class="sv-cell${visible?' sv-vis':''}" data-sid="${s.id}" data-uid="${u.id}" style="text-align:center;padding:0;height:38px;cursor:pointer">
        <div class="sv-dot">${visible?SV_CHECK_SVG:''}</div>
      </td>`;
    }).join('');
    return `<tr data-sid="${s.id}" data-name="${(s.name||'').toLowerCase().replace(/"/g,'&quot;')}" data-partial="${partial?'1':'0'}">
      <td style="padding:8px 10px;font-weight:600;white-space:nowrap;background:var(--card);position:sticky;left:0;z-index:1;border-right:1px solid var(--brd)">
        <div style="display:flex;align-items:center;gap:8px">
          <span>${s.emoji||''} ${s.name}</span>
          <span class="sv-count ${countCls}" style="margin-left:auto;font-size:10.5px;font-weight:700;color:var(--mut);background:var(--srf);border:1px solid var(--brd);border-radius:999px;padding:1px 7px">${n}/${users.length}</span>
        </div>
      </td>
      ${cells}
      <td style="padding:6px 8px;white-space:nowrap;background:var(--card);border-left:1px solid var(--brd);position:sticky;right:0">
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px" title="Visible para todos" onclick="svSetAllForSup('${s.id}',true)">Todos ✓</button>
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px;margin-left:3px" title="Oculto para todos" onclick="svSetAllForSup('${s.id}',false)">Ninguno ✕</button>
      </td>
    </tr>`;
  }).join('');

  return `${SV_STYLE}<div class="main sv-wide">
    <div class="card">
      <div class="card-t">Visibilidad de proveedores por local</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px">
        <input type="text" placeholder="Buscar proveedor..." value="${(S.supVisQuery||'').replace(/"/g,'&quot;')}" oninput="svSetQuery(this.value)" style="flex:1;min-width:220px;max-width:420px;padding:8px 12px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;background:var(--card);color:var(--txt);outline:none" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>
        <button id="sv-chip-partial" class="stab${S.supVisOnlyPartial?' act':''}" style="padding:6px 12px;font-size:12px" onclick="svTogglePartialFilter()">Solo parciales (${partialCount})</button>
        <span style="font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:12px;margin-left:auto">
          <span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:rgba(22,163,74,.15);border:1px solid rgba(22,163,74,.4);margin-right:4px;vertical-align:-1px"></span>Visible</span>
          <span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:transparent;border:1px solid var(--brd);margin-right:4px;vertical-align:-1px"></span>Oculto</span>
        </span>
      </div>
      <div style="font-size:12px;color:var(--mut);margin-bottom:10px">
        💡 Haz clic y arrastra sobre varias casillas para marcarlas u ocultarlas todas de golpe.
        También puedes usar los botones ✓/✕ para activar o desactivar de una vez todos los
        proveedores de un local, o todos los locales de un proveedor.
      </div>
      <div style="overflow:auto;max-height:78vh;border:1px solid var(--brd);border-radius:10px">
        <table id="sv-table" style="border-collapse:separate;border-spacing:0;font-size:13px;min-width:100%;user-select:none">
          <thead>
            <tr>
              <th style="padding:8px 10px;text-align:left;background:var(--srf);position:sticky;top:0;left:0;z-index:2;min-width:200px;border-right:1px solid var(--brd)">Proveedor</th>
              ${headCells}
              <th style="padding:8px 10px;background:var(--srf);position:sticky;top:0;right:0;z-index:2;text-align:center;min-width:150px">Acciones</th>
            </tr>
          </thead>
          <tbody id="sv-tbody">
            ${rows}
            <tr id="sv-empty-row" style="display:none"><td colspan="${users.length+2}" style="padding:24px;text-align:center;color:var(--mut)">Ningún proveedor coincide con la búsqueda.</td></tr>
          </tbody>
        </table>
      </div>
      <div style="font-size:12px;color:var(--mut);margin-top:10px" id="sv-foot-count">
        ${sups.length} de ${sups.length} proveedores mostrados
      </div>
    </div>
  </div>`;
}
