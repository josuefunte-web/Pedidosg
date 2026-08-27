/* ═══════════════ VISIBILIDAD DE PROVEEDORES POR LOCAL ═══════════════ */
// Pantalla dedicada para editar de un vistazo qué proveedores ve cada local.
// Antes esto solo se podía tocar entrando al proveedor uno por uno; aquí se
// muestra una matriz (proveedores en filas × locales en columnas) con
// checkboxes en cada cruce — igual que la vista clásica de permisos en una
// hoja de cálculo. Un ✓ = ese local ve ese proveedor; sin ✓ = está oculto.
// La fuente de verdad sigue siendo `sup.disabledFor=[userId,...]` y se
// modifica reutilizando `toggleSupVisibility(sid,uid,visible)` de
// js/23-suppliers.js — nada nuevo que sincronizar con Firebase.

function svSetAllForSup(sid, visible){
  const users=cfg.users||[];
  users.forEach(u=>toggleSupVisibilityQuiet(sid,u.id,visible));
  saveSups(sid);
  toast(visible?'Proveedor visible para todos los locales':'Proveedor oculto para todos los locales','#16a34a');
  renderAdminContent();
}
function svSetAllForLocal(uid, visible){
  const sups=supList();
  sups.forEach(s=>toggleSupVisibilityQuiet(s.id,uid,visible));
  // Guardar todos los proveedores tocados de una vez
  if(fbDb) fbDb.ref('suppliers').set(suppliers);
  const localName=(cfg.users.find(u=>u.id===uid)||{}).restaurant||uid;
  toast(visible?`Todos los proveedores activos para ${localName}`:`Todos los proveedores ocultos para ${localName}`,'#16a34a');
  renderAdminContent();
}
// Versión sin guardar/toast — solo muta en memoria (para hacer un solo guardado al final)
function toggleSupVisibilityQuiet(sid,uid,visible){
  if(!suppliers[sid]) return;
  if(!suppliers[sid].disabledFor) suppliers[sid].disabledFor=[];
  if(visible){ suppliers[sid].disabledFor=suppliers[sid].disabledFor.filter(id=>id!==uid); }
  else { if(!suppliers[sid].disabledFor.includes(uid)) suppliers[sid].disabledFor.push(uid); }
}

function vSupVisibility(){
  const sups=supList();
  const users=(cfg.users||[]).slice();
  if(!sups.length){
    return `<div class="main"><div class="card"><div class="card-t">Visibilidad por local</div><div style="color:var(--mut)">No hay proveedores todavía.</div></div></div>`;
  }

  // Cabecera con los 12 locales — nombre en vertical para que quepan todos
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
    const cells=users.map(u=>{
      const visible=!dis.includes(u.id);
      // Cuadro grande, tocable con el dedo — usamos un checkbox nativo escalado
      return `<td style="text-align:center;padding:6px 4px;background:${visible?'rgba(22,163,74,.08)':'transparent'}">
        <input type="checkbox" ${visible?'checked':''} onchange="toggleSupVisibility('${s.id}','${u.id}',this.checked)" style="width:20px;height:20px;cursor:pointer;accent-color:#16a34a"/>
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:8px 10px;font-weight:600;white-space:nowrap;background:var(--card);position:sticky;left:0;z-index:1;border-right:1px solid var(--brd)">
        <div style="display:flex;align-items:center;gap:8px">
          <span>${s.emoji||''} ${s.name}</span>
        </div>
      </td>
      ${cells}
      <td style="padding:6px 8px;white-space:nowrap;background:var(--card);border-left:1px solid var(--brd);position:sticky;right:0">
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px" title="Visible para todos" onclick="svSetAllForSup('${s.id}',true)">Todos ✓</button>
        <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px;margin-left:3px" title="Oculto para todos" onclick="svSetAllForSup('${s.id}',false)">Ninguno ✕</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="main">
    <div class="card">
      <div class="card-t">Visibilidad de proveedores por local</div>
      <div style="font-size:13px;color:var(--mut);margin-bottom:10px">
        Marca la casilla para que ese local vea ese proveedor. Desmarca para ocultarlo.
        Los cambios se guardan en el momento. Puedes usar los botones ✓/✕ de la cabecera
        para activar o desactivar de golpe todos los proveedores de un local, o todos los
        locales de un proveedor.
      </div>
      <div style="overflow:auto;max-height:78vh;border:1px solid var(--brd);border-radius:10px">
        <table style="border-collapse:separate;border-spacing:0;font-size:13px;min-width:100%">
          <thead>
            <tr>
              <th style="padding:8px 10px;text-align:left;background:var(--srf);position:sticky;top:0;left:0;z-index:2;min-width:200px;border-right:1px solid var(--brd)">Proveedor</th>
              ${headCells}
              <th style="padding:8px 10px;background:var(--srf);position:sticky;top:0;right:0;z-index:2;text-align:center;min-width:150px">Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="font-size:12px;color:var(--mut);margin-top:10px">
        ${sups.length} proveedores × ${users.length} locales — ${sups.length*users.length} combinaciones.
      </div>
    </div>
  </div>`;
}
