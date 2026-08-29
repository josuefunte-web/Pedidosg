/* ═══════════════ SUPPLIER MGMT ═══════════════
   Vista de Proveedores rediseñada con look NOVENTIA:
   cabecera profesional, KPIs reales, buscador, tabla ERP compacta
   con detalle plegable. Sin emojis en la lista. supDetailForm y
   funciones satélite (saveSup2, delSup, etc.) NO se han tocado.
   ═══════════════════════════════════════════════════════════════ */
function vSuppliers(){
  // Si hay un proveedor abierto, mostramos su ficha completa a página entera
  // en vez de la lista — antes se desplegaba inline dentro de la fila de la
  // tabla y con tantas secciones (teléfonos, productos, importación...) quedaba
  // todo amontonado y era difícil de encontrar nada.
  if(S.openSupId && suppliers[S.openSupId]) return vSupplierPage(suppliers[S.openSupId]);

  const curMonth = new Date().toISOString().slice(0,7);
  const curYear  = new Date().toISOString().slice(0,4);
  const sups     = supList();

  // ── KPIs reales ────────────────────────────────────────────────
  const totalSups     = sups.length;
  const totalProducts = sups.reduce(function(s,sp){ return s + ((sp.products||[]).length); }, 0);
  const spendMonth    = orders
    .filter(function(o){ return o.status!=='rejected' && (o.createdAt||'').startsWith(curMonth); })
    .reduce(function(s,o){ return s + total(o); }, 0);
  const spendYear     = orders
    .filter(function(o){ return o.status!=='rejected' && (o.createdAt||'').startsWith(curYear); })
    .reduce(function(s,o){ return s + total(o); }, 0);

  // ── Banner de conversiones pendientes de validar ───────────────
  const pending=[];
  Object.values(suppliers).forEach(function(sup){
    (sup.products||[]).forEach(function(p){
      (p.conversions||[]).forEach(function(c){
        if(c.pendingValidation) pending.push({sup:sup,prod:p,conv:c});
      });
    });
  });
  const pendingBanner = pending.length ? _supPendingBanner(pending) : '';

  // ── Estado local: buscador ─────────────────────────────────────
  if(S.supSearch===undefined) S.supSearch='';
  const q = (S.supSearch||'').trim().toLowerCase();
  const shownSups = q
    ? sups.filter(function(sp){ return (sp.name||'').toLowerCase().indexOf(q)>-1; })
    : sups;

  // ── Cabecera + acción primaria + acciones secundarias ──────────
  const canBulk = (typeof can==='function' && can('canImportBulk'));
  const head =
    '<div class="sup-head">' +
      '<div class="sup-head-l">' +
        '<div class="sup-head-t">Proveedores</div>' +
        '<div class="sup-head-s">Gestiona el catálogo del grupo, precios y visibilidad por local</div>' +
      '</div>' +
      '<div class="sup-head-r">' +
        (S.editSupId==='new' ? '' :
          '<button class="btn btn-pri btn-sm" onclick="S.editSupId=\'new\';render()">+ Nuevo proveedor</button>') +
      '</div>' +
    '</div>';

  const kpis =
    '<div class="sup-kpi-grid">' +
      '<div class="sup-kpi"><div class="sup-kpi-l">Proveedores</div><div class="sup-kpi-v">' + totalSups + '</div></div>' +
      '<div class="sup-kpi"><div class="sup-kpi-l">Productos en catálogo</div><div class="sup-kpi-v">' + totalProducts + '</div></div>' +
      '<div class="sup-kpi"><div class="sup-kpi-l">Gasto del mes</div><div class="sup-kpi-v">' + fmt(spendMonth) + '</div></div>' +
      '<div class="sup-kpi"><div class="sup-kpi-l">Gasto del año</div><div class="sup-kpi-v">' + fmt(spendYear) + '</div></div>' +
    '</div>';

  const tools =
    '<div class="sup-tools">' +
      '<input class="sup-input sup-search" type="text" placeholder="Buscar proveedor..." value="' + _a(S.supSearch||'') + '" oninput="supSetSearch(this.value)"/>' +
      '<div class="sup-tools-r">' +
        '<button class="btn btn-ghost btn-sm" onclick="exportExcel(\'all\')">Exportar pedidos</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="autoClasificarProductos(false)" title="Asigna categoría a los productos que no tienen ninguna">Clasificar automáticamente</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="reclasificarTodo()" title="Revisa todos los productos y corrige los que estén mal clasificados">Revisar clasificación</button>' +
        (canBulk ? '<button class="btn btn-ghost btn-sm" onclick="exportCatalogoTarifas()" title="Descarga un XLSX con una hoja por proveedor y todos sus productos, incluidos los alérgenos">Exportar catálogo</button>' : '') +
        (canBulk ? '<label class="btn btn-acc btn-sm" style="cursor:pointer" title="Sube un XLSX con una hoja por proveedor">Importar plantilla masiva<input type="file" accept=".xlsx,.xls" style="display:none" onchange="importBulkTarifa(this)"/></label>' : '') +
      '</div>' +
    '</div>';

  // Formulario de alta nuevo (aparece encima de la tabla si S.editSupId==='new')
  const newForm = S.editSupId==='new'
    ? '<div class="sup-panel sup-new-panel">' +
        '<div class="sup-panel-t">Nuevo proveedor</div>' +
        supForm(null) +
      '</div>'
    : '';

  // ── Tabla / cards de proveedores ───────────────────────────────
  let listHtml = '';
  if(!totalSups){
    listHtml = '<div class="sup-empty"><div class="sup-empty-t">Sin proveedores</div><div class="sup-empty-s">Añade el primer proveedor con el botón "Nuevo proveedor".</div></div>';
  } else if(!shownSups.length){
    listHtml = '<div class="sup-empty"><div class="sup-empty-t">Sin resultados</div><div class="sup-empty-s">Ningún proveedor coincide con la búsqueda.</div></div>';
  } else {
    const rows = shownSups.map(function(sup){
      if(!sup.products) sup.products = [];
      const supOrders = orders.filter(function(o){ return o.supId===sup.id && o.status!=='rejected'; });
      const mesActual = supOrders.filter(function(o){ return (o.createdAt||'').startsWith(curMonth); }).reduce(function(s,o){ return s+total(o); }, 0);
      const anoActual = supOrders.filter(function(o){ return (o.createdAt||'').startsWith(curYear);  }).reduce(function(s,o){ return s+total(o); }, 0);
      const nLocalPhones = Object.keys(sup.phonesByLocal||{}).length;
      const contact   = sup.phone
        ? _e(sup.phone) + (nLocalPhones?' <span class="sup-mut">(+'+nLocalPhones+' por local)</span>':'')
        : (nLocalPhones ? '<span class="sup-mut">'+nLocalPhones+' por local</span>' : '<span class="sup-mut">Sin teléfono</span>');
      const orderCount = supOrders.length;

      return (
        '<tr class="sup-row" data-sup-id="' + _a(sup.id) + '" onclick="supToggle(this.dataset.supId)">' +
          '<td class="sup-td sup-td-name"><div class="sup-name">' + _e(sup.name || '') + '</div><div class="sup-sub">' + orderCount + ' pedido' + (orderCount===1?'':'s') + '</div></td>' +
          '<td class="sup-td sup-td-num">' + sup.products.length + '</td>' +
          '<td class="sup-td sup-td-contact sup-hide-md">' + contact + '</td>' +
          '<td class="sup-td sup-td-num">' + fmt(mesActual) + '</td>' +
          '<td class="sup-td sup-td-num sup-hide-md">' + fmt(anoActual) + '</td>' +
          '<td class="sup-td sup-td-acts">' +
            '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();supToggle(\'' + _a(sup.id) + '\')">Ver ficha</button>' +
            '<button class="btn btn-no btn-sm" onclick="event.stopPropagation();delSup(\'' + _a(sup.id) + '\')" title="Eliminar proveedor">Borrar</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    listHtml =
      '<div class="sup-panel">' +
        '<div class="sup-table-w">' +
          '<table class="sup-table">' +
            '<thead><tr>' +
              '<th class="sup-th">Proveedor</th>' +
              '<th class="sup-th sup-th-num">Productos</th>' +
              '<th class="sup-th sup-hide-md">Contacto</th>' +
              '<th class="sup-th sup-th-num">Gasto mes</th>' +
              '<th class="sup-th sup-th-num sup-hide-md">Gasto año</th>' +
              '<th class="sup-th sup-th-acts">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  return head + pendingBanner + kpis + tools + newForm + listHtml;
}

// Buscador y toggle expuestos globalmente (usa dataset para evitar XSS
// al interpolar el id dentro de un handler onclick).
window.supSetSearch = function(v){
  S.supSearch = v;
  if(typeof renderAdminContent==='function') renderAdminContent();
  var el = document.querySelector('.sup-search');
  if(el){ try{ el.focus(); el.setSelectionRange(v.length, v.length); }catch(e){} }
};
window.supToggle = function(sid){
  S.openSupId = (S.openSupId===sid) ? null : sid;
  render();
  window.scrollTo(0,0);
};
// Volver de la ficha de proveedor a la lista.
window.supBack = function(){
  S.openSupId = null;
  render();
  window.scrollTo(0,0);
};

// Banner NOVENTIA para conversiones pendientes de validar
function _supPendingBanner(pending){
  const rows = pending.slice(0,10).map(function(x){
    const base=x.prod.unit||'KG';
    const who=x.conv.addedBy?' · añadida por '+_e(x.conv.addedBy):'';
    return '<div class="sup-pend-row">' +
      '<div class="sup-pend-info"><strong>' + _e(x.sup.name) + '</strong> — ' + _e(x.prod.name) +
        '<br><span class="sup-pend-eq">1 ' + _e(x.conv.fromUnit) + ' = <strong>' + _e(String(x.conv.factor)) + '</strong> ' + _e(base) + who + '</span></div>' +
      '<div class="sup-pend-acts">' +
        '<input type="number" step="0.001" min="0" value="' + _a(String(x.conv.factor)) + '" id="pv-inp-' + _a(x.sup.id) + '-' + _a(x.prod.id) + '-' + _a(x.conv.fromUnit) + '" class="sup-input"/>' +
        '<button class="btn btn-ok btn-xs" onclick="validatePendingConv(\'' + _a(x.sup.id) + '\',\'' + _a(x.prod.id) + '\',\'' + _a(x.conv.fromUnit) + '\',document.getElementById(\'pv-inp-' + _a(x.sup.id) + '-' + _a(x.prod.id) + '-' + _a(x.conv.fromUnit) + '\').value)">Validar</button>' +
        '<button class="btn btn-no btn-xs" onclick="rejectPendingConv(\'' + _a(x.sup.id) + '\',\'' + _a(x.prod.id) + '\',\'' + _a(x.conv.fromUnit) + '\')">Borrar</button>' +
      '</div>' +
    '</div>';
  }).join('');
  const more = pending.length>10 ? '<div class="sup-pend-more">Y ' + (pending.length-10) + ' más…</div>' : '';
  return '<div class="sup-pend-banner">' +
    '<div class="sup-pend-t">' + pending.length + ' conversión' + (pending.length!==1?'es':'') + ' pendiente' + (pending.length!==1?'s':'') + ' de validar</div>' +
    '<div class="sup-pend-s">Estas equivalencias las introdujeron locales al hacer pedidos porque faltaban. Revísalas y confirma o corrige el valor.</div>' +
    rows + more +
  '</div>';
}
// Admin valida una conversión pendiente: guarda el factor (posiblemente
// corregido) y quita el flag pendingValidation.
function validatePendingConv(sid,pid,unit,newFactor){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions) return;
  const conv=prod.conversions.find(c=>c.fromUnit===unit);
  if(!conv) return;
  const f=parseFloat(newFactor);
  if(isNaN(f)||f<=0){ toast('Factor inválido','#dc2626'); return; }
  conv.factor=f;
  delete conv.pendingValidation;
  delete conv.addedBy;
  delete conv.addedAt;
  saveSups(sid);
  toast('Conversión validada','#16a34a');
  renderAdminContent();
}
function rejectPendingConv(sid,pid,unit){
  if(!confirm('¿Borrar esta conversión? El local que la introdujo tendrá que volver a añadirla si la necesita.')) return;
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions) return;
  const idx=prod.conversions.findIndex(c=>c.fromUnit===unit);
  if(idx<0) return;
  prod.conversions.splice(idx,1);
  saveSups(sid);
  toast('Conversión eliminada','#d97706');
  renderAdminContent();
}
// El comercial de un proveedor suele cambiar según la zona: permite fijar un
// WhatsApp distinto por local, que se usa en vez del teléfono por defecto al
// enviar el pedido de ese local a este proveedor (ver supPhoneFor en 11-helpers.js).
function supPhonesByLocalEditor(sup){
  const rests=cfg.users.map(u=>u.restaurant).filter(Boolean);
  const rows=rests.map(r=>{
    const phone=(sup.phonesByLocal||{})[r]||'';
    const rid=r.replace(/[^a-zA-Z0-9]/g,'_');
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--brd)">
      <span style="flex:1;font-size:13px">${_e(r)}</span>
      <input type="tel" id="sup-lp-${sup.id}-${rid}" value="${_a(phone)}" placeholder="${sup.phone?'usa el de defecto':'34612345678'}" style="width:170px;padding:5px 9px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt)" onchange="setSupPhoneForLocal('${_a(sup.id)}','${_a(r).replace(/'/g,"\\'")}',this.value)"/>
    </div>`;
  }).join('');
  return `<div style="background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:4px 12px">${rows}</div>`;
}
function setSupPhoneForLocal(sid,restaurant,val){
  const sup=suppliers[sid]; if(!sup) return;
  const phone=(val||'').replace(/\D/g,'');
  if(!sup.phonesByLocal) sup.phonesByLocal={};
  if(phone) sup.phonesByLocal[restaurant]=phone;
  else delete sup.phonesByLocal[restaurant];
  saveSups(sid);
  toast(phone?'Teléfono guardado':'Teléfono eliminado — usará el de defecto','#16a34a');
}
function supForm(sup){
  const id=sup?sup.id:'new';
  return `<div class="two-col">
    <div class="fg"><label>Nombre</label><input type="text" id="sf-name-${id}" value="${sup?sup.name:''}" placeholder="Bencar"/></div>
    <div class="fg"><label>Emoji</label><input type="text" id="sf-emoji-${id}" value="${sup?sup.emoji:''}" maxlength="4"/></div>
    <div class="fg" style="grid-column:1/-1"><label>WhatsApp (sin + ni espacios)</label><input type="tel" id="sf-phone-${id}" value="${sup?sup.phone:''}" placeholder="34612345678"/></div>
    <div class="fg"><label>Orden (posición en la lista)</label><input type="number" id="sf-orden-${id}" value="${sup?.orden??''}" min="1" step="1" placeholder="1, 2, 3..."/><div style="font-size:12px;color:var(--mut);margin-top:4px">Los proveedores se ordenan de menor a mayor número. Sin número → al final alfabético.</div></div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-pri btn-sm" onclick="saveSup2('${id}')">${!sup?'✓ Crear proveedor':'✓ Guardar'}</button>
    <button class="btn btn-ghost btn-sm" onclick="S.editSupId=null;render()">Cancelar</button>
  </div>`;
}
// Página completa de un proveedor: cabecera con volver + KPIs propios,
// seguida de las secciones de supDetailForm ya envueltas en tarjetas.
function vSupplierPage(sup){
  if(!sup.products) sup.products=[];
  const curMonth = new Date().toISOString().slice(0,7);
  const curYear  = new Date().toISOString().slice(0,4);
  const supOrders = orders.filter(function(o){ return o.supId===sup.id && o.status!=='rejected'; });
  const mesActual = supOrders.filter(function(o){ return (o.createdAt||'').startsWith(curMonth); }).reduce(function(s,o){ return s+total(o); }, 0);
  const anoActual  = supOrders.filter(function(o){ return (o.createdAt||'').startsWith(curYear);  }).reduce(function(s,o){ return s+total(o); }, 0);

  const head =
    '<div class="sup-head">' +
      '<div class="sup-head-l">' +
        '<button class="btn btn-ghost btn-sm" onclick="supBack()">← Proveedores</button>' +
        '<div class="sup-head-t" style="margin-top:10px">' + (sup.emoji?_e(sup.emoji)+' ':'') + _e(sup.name||'') + '</div>' +
        '<div class="sup-head-s">' + sup.products.length + ' productos · ' + supOrders.length + ' pedido' + (supOrders.length===1?'':'s') + ' · ' + fmt(mesActual) + ' este mes · ' + fmt(anoActual) + ' este año</div>' +
      '</div>' +
      '<div class="sup-head-r">' +
        '<button class="btn btn-no btn-sm" onclick="delSup(\'' + _a(sup.id) + '\')">Eliminar proveedor</button>' +
      '</div>' +
    '</div>';

  return head + supDetailForm(sup);
}
function supDetailForm(sup){
  const _U=['KG','L','UN','Caja','Bote','Bolsa','g'];
  const sid=sup.id;
  // Agrupar productos por categoría
  const byCat={};
  (sup.products||[]).forEach(p=>{
    const cat=p.category||'Otros';
    if(!byCat[cat]) byCat[cat]=[];
    byCat[cat].push(p);
  });
  // Ordenar categorías según PROD_CATS, luego las demás
  const catOrder=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))];
  const usedCats=catOrder.filter(c=>byCat[c]);
  const prodsHtml=usedCats.map(cat=>{
    const rows=byCat[cat].map(p=>{
      const unitOpts=_U.map(u=>`<option${(p.unit||'KG')===u?' selected':''}>${u}</option>`).join('');
      const alerSel=ALERGENOS.map(a=>`<label style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--mut);cursor:pointer;margin:1px 3px 1px 0;padding:1px 5px;border-radius:4px;background:${(p.alergenos||[]).includes(a.id)?'#fff3cd':'var(--srf)'};border:1px solid ${(p.alergenos||[]).includes(a.id)?'#ffc107':'var(--brd)'}"><input type="checkbox" ${(p.alergenos||[]).includes(a.id)?'checked':''} onchange="toggleProdAlergeno('${sid}','${p.id}','${a.id}',this.checked)" style="width:11px;height:11px;accent-color:#d97706"> ${a.label}</label>`).join('');
      const alCount=(p.alergenos||[]).length;
      const cvCount=(p.conversions||[]).length;
      const badges=
        (alCount?`<span class="pt-badge pt-badge-al" title="${alCount} alérgeno${alCount===1?'':'s'}">⚠${alCount}</span>`:'') +
        (cvCount?`<span class="pt-badge pt-badge-cv" title="${cvCount} conversión${cvCount===1?'':'es'} de unidad">⇄${cvCount}</span>`:'');
      return `<tr class="prod-row">
          <td class="pt-td pt-td-code"><input type="text" class="prod-code-t" value="${_a(p.code||'')}" title="Código de producto" placeholder="—" onchange="editProdCode('${sid}','${p.id}',this.value)"/></td>
          <td class="pt-td pt-td-name"><input type="text" class="prod-name-t" value="${_a(p.name)}" title="Nombre del producto" onchange="editProdName('${sid}','${p.id}',this.value)"/></td>
          <td class="pt-td pt-td-cat"><select title="Categoría" onchange="editProdCat('${sid}','${p.id}',this.value)">${prodCatOpts(p.category||'Otros')}</select></td>
          <td class="pt-td pt-td-unit"><select title="Unidad" onchange="editProdUnit('${sid}','${p.id}',this.value)">${unitOpts}</select></td>
          <td class="pt-td pt-td-price"><input type="number" value="${parseFloat(p.price||0).toFixed(2)}" step="0.01" min="0" title="Precio €" onchange="editProdPrice('${sid}','${p.id}',this.value)"/></td>
          <td class="pt-td pt-td-gr"><input type="number" value="${p.pesoGr||''}" step="1" min="0" placeholder="—" title="Peso en gramos" onchange="editProdGr('${sid}','${p.id}',this.value)"/></td>
          <td class="pt-td pt-td-badges">${badges}</td>
          <td class="pt-td pt-td-acts">
            <button type="button" class="pt-exp-btn" onclick="toggleProdRow(this)" title="Alérgenos y conversiones de unidad">▾</button>
            <button type="button" class="pt-del-btn" onclick="delProd('${sid}','${p.id}')" title="Eliminar producto">✕</button>
          </td>
        </tr>
        <tr class="prod-detail-row" style="display:none">
          <td class="pt-detail-td" colspan="8">
            <div class="pt-detail-inner">
              <div class="pt-detail-sec">
                <div class="pt-detail-lbl">Alérgenos</div>
                <div style="display:flex;flex-wrap:wrap">${alerSel}</div>
              </div>
              <div class="pt-detail-sec">
                <div class="pt-detail-lbl">Conversiones de unidad</div>
                <div id="conv-list-${sid}-${p.id}">${renderConvRows(sid,p)}</div>
                <button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="addProdConvCustom('${sid}','${p.id}')">+ Añadir unidad personalizada</button>
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');
    const _cc=catColor(cat);
    return `<details class="sup-cat-details" style="margin-bottom:10px">
      <summary style="cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:6px 0 4px;border-bottom:2px solid ${_cc}40;margin-bottom:6px;display:flex;align-items:center;gap:6px;color:${_cc}">${catDot(cat)} ${cat} <span style="font-weight:400;opacity:.6;color:var(--mut)">(${byCat[cat].length})</span></summary>
      <div class="pt-table-w"><table class="pt-table">
        <thead><tr>
          <th class="pt-th pt-th-code">Cód.</th>
          <th class="pt-th pt-th-name">Producto</th>
          <th class="pt-th pt-th-cat">Categoría</th>
          <th class="pt-th pt-th-unit">Ud.</th>
          <th class="pt-th pt-th-price">Precio €</th>
          <th class="pt-th pt-th-gr">Gr</th>
          <th class="pt-th pt-th-badges"></th>
          <th class="pt-th pt-th-acts"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </details>`;
  }).join('');
  const infoCard = `<div class="card">
    <div class="card-t">Información del proveedor</div>
    <div class="two-col">
      <div class="fg"><label>Nombre</label><input type="text" id="sf-name-${sid}" value="${sup.name}" placeholder="Bencar"/></div>
      <div class="fg"><label>Emoji</label><input type="text" id="sf-emoji-${sid}" value="${sup.emoji}" maxlength="4"/></div>
      <div class="fg" style="grid-column:1/-1"><label>WhatsApp por defecto (sin + ni espacios)</label><input type="tel" id="sf-phone-${sid}" value="${sup.phone||''}" placeholder="34612345678"/><div style="font-size:12px;color:var(--mut);margin-top:4px">Se usa para los locales que no tengan un comercial distinto en "Teléfono por local" abajo.</div></div>
      <div class="fg"><label>Orden (posición en la lista)</label><input type="number" id="sf-orden-${sid}" value="${sup.orden??''}" min="1" step="1" placeholder="1, 2, 3..."/></div>
    </div>
    <button class="btn btn-pri btn-sm" onclick="saveSup2('${sid}')">✓ Guardar cambios</button>
  </div>`;

  const phoneCard = `<div class="card">
    <div class="card-t">Teléfono por local</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">El comercial de este proveedor puede variar según la zona. Rellena solo los locales cuyo comercial sea distinto del teléfono por defecto — el resto usará ese.</div>
    ${supPhonesByLocalEditor(sup)}
  </div>`;

  const bulkCatCard = sup.products.length ? `<div class="card">
    <div class="card-t">Clasificar todo el proveedor</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Pon la misma categoría a los ${sup.products.length} productos de golpe (p.ej. si este proveedor solo trae carne). Luego puedes cambiar los productos sueltos uno a uno.</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="sup-bulk-cat-${sid}" style="padding:6px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;font-weight:600;background:var(--card);color:var(--txt)">${prodCatOpts('')}</select>
      <button class="btn btn-ok btn-sm" onclick="clasificarProveedorTodo('${sid}')">Aplicar a todos</button>
    </div>
  </div>` : '';

  const productsCard = `<div class="card">
    <div class="card-t">Productos (${sup.products.length}) por categoría</div>
    ${sup.products.length>6?`<input type="text" placeholder="Buscar producto..." oninput="filterSupProds(this.value,'sdp-list-${sid}')" style="width:100%;padding:8px 12px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;margin-bottom:10px;background:#fff;color:var(--txt);outline:none;transition:border-color .15s" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>`:``}
    ${!sup.products.length?`<div style="color:var(--mut);font-size:13px;text-align:center;margin:8px 0 12px">Sin productos aún — añade el primero abajo</div>`:''}
    <div id="sdp-list-${sid}">${prodsHtml}</div>
    <div class="sh" style="margin-top:16px">Añadir nuevo producto</div>
    <div style="display:grid;grid-template-columns:100px 2fr 1fr 1fr 80px;gap:8px;margin-bottom:8px">
      <div class="fg" style="margin:0"><label>Código *</label><input type="text" id="pf-code-${sid}" placeholder="obligatorio"/></div>
      <div class="fg" style="margin:0"><label>Nombre</label><input type="text" id="pf-name-${sid}" placeholder="Entrecot..."/></div>
      <div class="fg" style="margin:0"><label>Categoría</label><select id="pf-cat-${sid}">${prodCatOpts('')}</select></div>
      <div class="fg" style="margin:0"><label>Unidad</label><select id="pf-unit-${sid}"><option>KG</option><option>g</option><option>UN</option><option>L</option><option>Caja</option><option>Bote</option></select></div>
      <div class="fg" style="margin:0"><label>Precio €</label><input type="number" id="pf-price-${sid}" placeholder="12.50" step="0.01" min="0"/></div>
    </div>
    <button class="btn btn-ok btn-sm" onclick="addProd('${sid}')">+ Añadir producto</button>
  </div>`;

  const cleanCard = `<div class="card">
    <div class="card-t">Limpiar nombres de productos</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:8px">Elimina sufijos de formato (75cl, x6, CAJ, BOT…) de todos los nombres ya importados.</div>
    <button class="btn btn-ghost btn-sm" onclick="cleanSupProdNames('${sid}')">Limpiar nombres de este proveedor</button>
    <div id="sup-clean-status-${sid}" style="font-size:13px;margin-top:6px;color:var(--mut)"></div>
  </div>`;

  const importCard = `<div class="card">
    <div class="card-t">Importar tarifa desde archivo</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:10px">Sube un Excel (.xlsx/.csv) o PDF con la tarifa del proveedor y se importarán todos los productos automáticamente.</div>
    <div class="file-input-wrap" style="max-width:360px">
      <div class="file-input-btn" style="padding:12px">Subir Excel o PDF de tarifa</div>
      <input type="file" accept=".xlsx,.xls,.csv,application/pdf,.pdf" onchange="importSupTarifa('${sid}',this)"/>
    </div>
    <div id="sup-import-status-${sid}" style="font-size:13px;margin-top:8px;color:var(--mut)"></div>
  </div>`;

  const visibilityCard = `<div class="card">
    <div class="card-t">Visibilidad por local</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Desmarca los locales que <strong>no</strong> deben ver este proveedor</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
      ${cfg.users.map(u=>{const dis=(sup.disabledFor||[]).includes(u.id);return`<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;background:${dis?'var(--srf)':'transparent'};border:1px solid ${dis?'var(--brd)':'transparent'}"><input type="checkbox" ${!dis?'checked':''} onchange="toggleSupVisibility('${sup.id}','${u.id}',this.checked)"/><span style="font-size:13px;${dis?'color:var(--mut)':''}">${dis?'':''} ${u.restaurant}</span></label>`;}).join('')}
    </div>
  </div>`;

  const scheduleCard = `<div class="card">
    <div class="card-t">Horario de pedidos</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Marca los días de la semana en que este proveedor acepta pedidos y la hora límite. Los locales verán un aviso en "Nuevo pedido" cuando toque pedir.</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${[['1','L'],['2','M'],['3','X'],['4','J'],['5','V'],['6','S'],['0','D']].map(([k,lbl])=>{const on=(sup.orderDays||[]).includes(k);return `<button type="button" onclick="toggleSupOrderDay('${sup.id}','${k}')" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;background:${on?'var(--pri)':'var(--srf)'};color:${on?'#fff':'var(--txt)'};border:1.5px solid ${on?'var(--pri)':'var(--brd)'};padding:0">${lbl}</button>`;}).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <label style="font-size:13px;color:var(--mut)">Hora límite:</label>
      <input type="time" value="${sup.orderCutoffTime||''}" onchange="setSupOrderCutoff('${sup.id}',this.value)" style="padding:6px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:14px;background:var(--card);color:var(--txt)"/>
      ${sup.orderCutoffTime?`<button class="btn btn-ghost btn-xs" onclick="setSupOrderCutoff('${sup.id}','')">Quitar</button>`:''}
    </div>
  </div>`;

  return infoCard + phoneCard + bulkCatCard + productsCard + cleanCard + importCard + visibilityCard + scheduleCard;
}
// Toggle si el proveedor sirve un día concreto de la semana. Guarda los días
// como strings '0'-'6' compatibles con Date.getDay() (0=Domingo, 1=Lunes,...).
// Fuerza re-render tras cambiar para que el botón se vea marcado/desmarcado al instante.
function toggleSupOrderDay(sid,day){
  if(!suppliers[sid]) return;
  const arr=suppliers[sid].orderDays||[];
  const i=arr.indexOf(day);
  if(i>=0) arr.splice(i,1);
  else arr.push(day);
  suppliers[sid].orderDays=arr;
  saveSups(sid);
  const _sy=window.scrollY;
  renderAdminContent();
  requestAnimationFrame(()=>window.scrollTo(0,_sy));
}
function setSupOrderCutoff(sid,val){
  if(!suppliers[sid]) return;
  if(val) suppliers[sid].orderCutoffTime=val;
  else delete suppliers[sid].orderCutoffTime;
  saveSups(sid);
  renderAdminContent();
}
function saveSup2(id){
  const name=document.getElementById('sf-name-'+id)?.value.trim();
  const emoji=document.getElementById('sf-emoji-'+id)?.value.trim()||'';
  const phone=document.getElementById('sf-phone-'+id)?.value.trim().replace(/\D/g,'');
  const ordenRaw=document.getElementById('sf-orden-'+id)?.value.trim();
  const orden=ordenRaw&&!isNaN(ordenRaw)?parseInt(ordenRaw):undefined;
  if(!name){toast('Introduce el nombre','#dc2626');return;}
  const _sy=window.scrollY;
  const _rerender=()=>{ renderAdminContent(); requestAnimationFrame(()=>window.scrollTo(0,_sy)); };
  if(id==='new'){const nid='s'+uid();suppliers[nid]={id:nid,name,emoji,phone,...(orden!==undefined?{orden}:{}),products:[]};saveSups(nid);S.editSupId=null;S.openSupId=nid;_rerender();toast('Proveedor creado — ya puedes añadir productos','#16a34a');}
  else{if(!suppliers[id])return;suppliers[id].name=name;suppliers[id].emoji=emoji;suppliers[id].phone=phone;if(orden!==undefined)suppliers[id].orden=orden;else delete suppliers[id].orden;saveSups(id);_rerender();toast('Proveedor guardado','#16a34a');}
}
function delSup(id){ if(!confirm('¿Eliminar proveedor?'))return;delete suppliers[id];if(S.openSupId===id) S.openSupId=null;if(fbDb) fbDb.ref('suppliers/'+id).remove();localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));render(); }

function strToColor(str){
  // Genera un color oscuro consistente por nombre de restaurante
  let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))&0xffff;
  const hue=(h%360);
  return `hsl(${hue},55%,32%)`;
}
function cleanProdName(name){
  // Elimina info de formato/envase del final del nombre
  // ej: "Vino Tinto Cune 75cl x6" → "Vino Tinto Cune"
  return name
    .replace(/\s+(?:x|X)\s*\d+\s*$/,'')           // " x6", " X12" al final
    .replace(/\s+\d+[,.]?\d*\s*(?:cl|CL|ml|ML|L|l|g|kg|KG)\s+(?:x|X)\s*\d+\s*$/i,'') // "75cl x6"
    .replace(/\s+\d+[,.]?\d*\s*(?:cl|CL|ml|ML)\s*$/i,'') // "75cl", "37 cl"
    .replace(/\s+\d+[,.]?\d*\s*(?:L|l)\s*$/,'')   // "1L", "1,5L"
    .replace(/\s+(?:CAJ|BOT|UNI|CAN|TAR|PAQ|BOL)\s*$/i,'') // envases
    .replace(/\s+\d+[,.]?\d*\s*(?:L|l)t\s*$/i,'') // "1,5Lt"
    .replace(/\s+\d+[,.]?\d*\s*(?:cl|CL)[a-z]?\s*$/i,'') // "75c" truncado
    .replace(/\s+\d+u\s*$/i,'')                    // "12u"
    .trim();
}
function cleanSupProdNames(sid){
  const sup=suppliers[sid]; if(!sup||!sup.products) return;
  let changed=0;
  sup.products.forEach(p=>{
    const clean=cleanProdName(p.name||'');
    if(clean&&clean!==p.name){ p.name=clean; changed++; }
  });
  if(!changed){ document.getElementById('sup-clean-status-'+sid).textContent='Todos los nombres ya estaban limpios.'; return; }
  const _sy=window.scrollY;
  saveSups(sid);
  renderAdminContent();
  requestAnimationFrame(()=>window.scrollTo(0,_sy));
  toast(`${changed} nombres corregidos`,'#16a34a');
}
async function importSupTarifa(sid, input){
  const file = input.files[0]; if(!file) return;
  const statusEl = document.getElementById('sup-import-status-'+sid);
  const setStatus = (msg, color='var(--mut)') => { if(statusEl){ statusEl.style.color=color; statusEl.innerHTML=msg; } };
  setStatus(' Leyendo archivo...');
  const nameLow = file.name.toLowerCase();

  // ── EXCEL / CSV ──────────────────────────────────────────────
  if(nameLow.endsWith('.xlsx')||nameLow.endsWith('.xls')||nameLow.endsWith('.csv')){
    try{
      if(!window.XLSX){
        await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
      }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      if(!rows.length){ setStatus('El archivo está vacío o sin datos.','#dc2626'); return; }

      const sample = rows[0];
      const findKey = (...candidates) => { for(const c of candidates){ const k=Object.keys(sample).find(k=>k.toLowerCase().includes(c)); if(k) return k; } return null; };
      const nameKey  = findKey('nombre','name','product','producto','artículo','articulo','descripci','desc');
      const qtyKey   = findKey('cantidad','qty','uds','uds/caja','unidades','bultos');
      const unitKey  = findKey('unidad','unit','ud.','envase','tipo');
      const priceKey = findKey('precio','price','p.unidad','p. unidad','importe','pvp','coste','costo','tarifa');
      const codeKey  = findKey('código','codigo','code','ref','referencia','art');

      if(!nameKey){ setStatus('No se encontró columna de nombre. Comprueba los encabezados del archivo.','#dc2626'); return; }

      setStatus(' Procesando productos...');
      const sup = suppliers[sid]; if(!sup.products) sup.products=[];
      let added=0, updated=0;

      rows.forEach(r=>{
        const name = cleanProdName(String(r[nameKey]||'').trim()); if(!name) return;
        const unit = unitKey ? String(r[unitKey]||'UN').trim() : 'UN';
        const price = parseFloat(String(r[priceKey]||'0').replace(',','.'))||0;
        const code  = codeKey ? String(r[codeKey]||'').trim() : '';
        const id    = code ? 'imp_'+code : 'imp_'+uid();
        const idx   = code ? sup.products.findIndex(p=>p.code===code||p.id==='imp_'+code) : -1;
        if(idx>=0){ sup.products[idx]={...sup.products[idx], name, unit, price, ...(code?{code}:{})}; updated++; }
        else { sup.products.push({id, name, unit, price, ...(code?{code}:{})}); added++; }
      });

      saveSups(sid);
      setStatus(`Tarifa importada: <strong>${added} nuevos</strong> + ${updated} actualizados (${added+updated} total)`, '#16a34a');
      toast(`${added+updated} productos importados en ${sup.name}`, '#16a34a', 4000);
      // Refrescar la ficha del proveedor para que la tabla de productos
      // (agrupada por categoría) recoja lo recién importado.
      const _sy=window.scrollY;
      renderAdminContent();
      requestAnimationFrame(()=>window.scrollTo(0,_sy));
    } catch(e){ setStatus('Error al leer el Excel: '+e.message,'#dc2626'); console.error(e); }
    return;
  }

  // ── PDF ──────────────────────────────────────────────────────
  if(nameLow.endsWith('.pdf')){
    if(!cfg.geminiKey){ setStatus('Para leer PDFs necesitas configurar la API key de Gemini en Config (es gratuita).','#dc2626'); return; }
    setStatus('Analizando PDF con Gemini IA...');
    try{
      const base64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file); });
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cfg.geminiKey}`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({contents:[{parts:[
          {inline_data:{mime_type:'application/pdf', data:base64}},
          {text:`Eres un asistente que extrae tarifas de proveedores. Extrae TODOS los productos con código (si existe), nombre, unidad de venta y precio unitario. Responde ÚNICAMENTE con un JSON array sin texto adicional:\n[{"code":"12345","name":"Aceite Oliva 5L","unit":"Caja","price":18.50}]\nUnidades posibles: KG, L, UN, Caja, Bote, Bolsa, g. Si no hay código usa "". Solo el JSON array.`}
        ]}]})
      });
      const data = await resp.json();
      if(data.error){ setStatus('Error Gemini: '+data.error.message,'#dc2626'); return; }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
      const match = text.match(/\[[\s\S]*\]/);
      if(!match){ setStatus('Gemini no encontró productos. Prueba con un Excel o un PDF más claro.','#d97706'); return; }
      const parsed = JSON.parse(match[0]);
      if(!parsed.length){ setStatus('No se encontraron productos en el PDF.','#d97706'); return; }
      const sup = suppliers[sid]; if(!sup.products) sup.products=[];
      let added=0, updated=0;
      parsed.forEach(p=>{
        const name=cleanProdName(String(p.name||'').trim()); if(!name) return;
        const code=String(p.code||'').trim();
        const unit=String(p.unit||'UN').trim();
        const price=parseFloat(p.price)||0;
        const id=code?'imp_'+code:'imp_'+uid();
        const idx=code?sup.products.findIndex(x=>x.code===code||x.id==='imp_'+code):-1;
        if(idx>=0){ sup.products[idx]={...sup.products[idx],name,unit,price,...(code?{code}:{})}; updated++; }
        else { sup.products.push({id,name,unit,price,...(code?{code}:{})}); added++; }
      });
      saveSups(sid);
      setStatus(`PDF procesado: <strong>${added} nuevos</strong> + ${updated} actualizados (${added+updated} total)`, '#16a34a');
      toast(`${added+updated} productos importados en ${sup.name}`, '#16a34a', 4000);
    } catch(e){ setStatus('Error al procesar el PDF: '+e.message,'#dc2626'); console.error(e); }
    return;
  }

  setStatus('Formato no soportado. Usa .xlsx, .csv o .pdf','#dc2626');
}
function toggleSupVisibility(sid,uid,visible){
  if(!suppliers[sid])return;
  if(!suppliers[sid].disabledFor)suppliers[sid].disabledFor=[];
  if(visible){suppliers[sid].disabledFor=suppliers[sid].disabledFor.filter(id=>id!==uid);}
  else{if(!suppliers[sid].disabledFor.includes(uid))suppliers[sid].disabledFor.push(uid);}
  saveSups(sid);
  toast(visible?'Proveedor activado para este local':'Proveedor desactivado para este local','#16a34a');
}
function editProdName(sid,pid,val){
  const name=(val||'').trim();
  if(!suppliers[sid]){return;}
  if(!name){toast('El nombre no puede quedar vacío','#dc2626');renderAdminContent();return;}
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(prod){prod.name=name;saveSups(sid);toast('Nombre actualizado','#16a34a');}
}
function editProdCode(sid,pid,val){
  if(!suppliers[sid]) return;
  const code=(val||'').trim();
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(!prod) return;
  if(!code){
    toast('El código de producto es obligatorio, no se puede dejar vacío','#dc2626');
    renderAdminContent();
    return;
  }
  if(suppliers[sid].products.some(p=>p!==prod && p.code===code)){
    toast('Ese código ya lo usa otro producto de este proveedor','#dc2626');
    renderAdminContent();
    return;
  }
  prod.code=code;
  saveSups(sid);
  toast('Código actualizado','#16a34a');
}
function editProdUnit(sid,pid,val){
  if(!suppliers[sid])return;
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(prod){prod.unit=val;saveSups(sid);toast('Unidad actualizada','#16a34a');}
}
function editProdPrice(sid,pid,val){
  const price=parseFloat(val);
  if(!suppliers[sid]||isNaN(price)||price<0){toast('Precio no válido','#dc2626');return;}
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(prod){
    const oldPrice=parseFloat(prod.price)||0;
    prod.price=price;
    saveSups(sid);
    if(fbDb && Math.abs(oldPrice-price)>0.001){
      const h={id:uid(),supId:sid,supName:suppliers[sid].name,prodId:pid,prodName:prod.name,oldPrice,newPrice:price,changedAt:new Date().toISOString()};
      fbDb.ref('priceHistory/'+h.id).set(h);
    }
    const alertPct=cfg.priceAlertPct||5;
    if(oldPrice>0){
      const pct=((price-oldPrice)/oldPrice)*100;
      if(pct>alertPct) toast(`${prod.name}: precio subió un +${pct.toFixed(1)}%`,'#d97706',4000);
      else if(pct<-alertPct) toast(`${prod.name}: precio bajó un ${pct.toFixed(1)}%`,'#16a34a',4000);
      else toast('Precio actualizado','#16a34a');
    } else { toast('Precio actualizado','#16a34a'); }
  }
}
function addProd(sid){
  const name=document.getElementById('pf-name-'+sid)?.value.trim();
  const code=document.getElementById('pf-code-'+sid)?.value.trim();
  const category=document.getElementById('pf-cat-'+sid)?.value||'Otros';
  const unit=document.getElementById('pf-unit-'+sid)?.value;
  const price=parseFloat(document.getElementById('pf-price-'+sid)?.value);
  const grRaw=document.getElementById('pf-gr-'+sid)?.value;
  const pesoGr=grRaw&&!isNaN(parseInt(grRaw))?parseInt(grRaw):undefined;
  if(!name||isNaN(price)||price<0){toast('Nombre y precio obligatorios','#dc2626');return;}
  if(!code){toast('El código de producto del proveedor es obligatorio','#dc2626');return;}
  if((suppliers[sid].products||[]).some(p=>p.code===code)){toast('Ese código ya lo usa otro producto de este proveedor','#dc2626');return;}
  const prod={id:'p'+uid(),name,unit:unit||'KG',price,category,code};
  if(pesoGr!==undefined) prod.pesoGr=pesoGr;
  if(!Array.isArray(suppliers[sid].products)) suppliers[sid].products=Object.values(suppliers[sid].products||{});
  suppliers[sid].products.push(prod);
  // Transacción: añade el producto sin pisar lo que otros dispositivos hayan
  // grabado (mismo problema de "lost update" que en localAddProd).
  if(fbDb){
    fbDb.ref('suppliers/'+sid+'/products').transaction(curr=>{
      let arr = Array.isArray(curr) ? curr : (curr ? Object.values(curr) : []);
      if(!arr.find(p=>p && p.id===prod.id)) arr.push(prod);
      return arr;
    });
    localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
  } else { saveSups(sid); }
  const _sy=window.scrollY;renderAdminContent();requestAnimationFrame(()=>window.scrollTo(0,_sy));toast('Producto añadido','#16a34a');
}
function editProdGr(sid,pid,val){
  if(!suppliers[sid])return;
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(prod){
    const gr=parseInt(val);
    if(!isNaN(gr)&&gr>0) prod.pesoGr=gr;
    else delete prod.pesoGr;
    saveSups(sid);
  }
}
function editProdCat(sid,pid,val){
  if(!suppliers[sid])return;
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(prod){ prod.category=val; saveSups(sid); }
}
// Pone la misma categoría a TODOS los productos del proveedor de una vez
function clasificarProveedorTodo(sid){
  const sup=suppliers[sid];
  if(!sup){toast('Proveedor no encontrado','#dc2626');return;}
  if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
  if(!sup.products.length){toast('Este proveedor no tiene productos','#d97706');return;}
  const cat=document.getElementById('sup-bulk-cat-'+sid)?.value;
  if(!cat) return;
  if(!confirm(`Poner la categoría "${cat}" a los ${sup.products.length} productos de ${sup.name}?\n\nLuego podrás cambiar los productos sueltos a mano.`)) return;
  sup.products.forEach(p=>{ p.category=cat; });
  const _sy=window.scrollY;
  saveSups(sid);
  renderAdminContent();
  requestAnimationFrame(()=>window.scrollTo(0,_sy));
  toast(`${sup.products.length} productos clasificados como ${cat}`,'#16a34a',4000);
}
// --- Conversiones de unidad ---
// Devuelve las unidades disponibles para un producto: unidad base + fromUnits de conversiones
function _prodUnits(p){
  const base=p.unit||'KG';
  const extras=(p.conversions||[]).map(c=>c.fromUnit).filter(u=>u&&u!==base);
  return [base,...extras];
}
// Muestra una fila por cada unidad común distinta a la del precio (unidad base).
// Cada fila pregunta claramente: "1 [otra unidad] = [___] [unidad base]". Deja
// el campo vacío si esa unidad no aplica al producto. Reemplaza el sistema
// anterior con selector + factor que era ambiguo — ahora la equivalencia siempre
// se expresa en la unidad del precio.
function renderConvRows(sid,p){
  const base=p.unit||'KG';
  const COMMON=['KG','L','UN','Caja','Bote','Bolsa','g'];
  const others=COMMON.filter(u=>u!==base);
  // Preservar conversiones con unidades personalizadas no listadas en COMMON
  const custom=(p.conversions||[]).map(c=>c.fromUnit).filter(u=>u&&!COMMON.includes(u));
  const all=[...others,...custom];
  return `<div style="font-size:11px;color:var(--mut);margin-bottom:6px;line-height:1.4">Precio registrado en <strong>${base}</strong>. Rellena las equivalencias que apliquen a este producto (deja vacío las que no).</div>
    ${all.map(u=>{
      const conv=(p.conversions||[]).find(c=>c.fromUnit===u);
      const val=conv?conv.factor:'';
      const pending=conv&&conv.pendingValidation;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap${pending?';background:#dbeafe;padding:4px 6px;border-radius:6px':''}">
        <span style="font-size:12px;color:var(--mut);min-width:70px">1 ${u} =</span>
        <input type="number" value="${val}" step="0.001" min="0" placeholder="—" style="width:80px;padding:3px 7px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="setProdConv('${sid}','${p.id}','${u}',this.value)"/>
        <span style="font-size:12px;color:var(--mut)">${base}</span>
        ${pending?`<span style="font-size:11px;color:#0369a1;font-weight:700">⏳ Pendiente${conv.addedBy?' (de '+conv.addedBy+')':''}</span><button class="btn btn-ok btn-xs" onclick="validatePendingConv('${sid}','${p.id}','${u}',document.querySelector('[onchange*=\\'${p.id}\\'][onchange*=\\'${u}\\']').value)">✓ Validar</button>`:''}
        ${custom.includes(u)?`<button class="btn btn-no btn-xs" onclick="setProdConv('${sid}','${p.id}','${u}','')" title="Eliminar unidad personalizada">✕</button>`:''}
      </div>`;
    }).join('')}`;
}
// Setter único que reemplaza addProdConv+editConvUnit+editConvFactor+delProdConv.
// Si val es válido, crea o actualiza la conversión. Si es vacío/0, la elimina.
function setProdConv(sid,pid,unit,val){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod) return;
  if(!prod.conversions) prod.conversions=[];
  const idx=prod.conversions.findIndex(c=>c.fromUnit===unit);
  const f=parseFloat(val);
  if(isNaN(f)||f<=0){
    // Vaciar = eliminar la conversión
    if(idx>=0) prod.conversions.splice(idx,1);
  } else {
    if(idx>=0){
      prod.conversions[idx].factor=f;
      // Si el admin cambia el factor, se considera validado automáticamente
      delete prod.conversions[idx].pendingValidation;
      delete prod.conversions[idx].addedBy;
      delete prod.conversions[idx].addedAt;
    } else prod.conversions.push({fromUnit:unit,factor:f});
  }
  saveSups(sid);
}
function _refreshConvList(sid,pid){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod)return;
  const el=document.getElementById(`conv-list-${sid}-${pid}`);
  if(el) el.innerHTML=renderConvRows(sid,prod);
}
function addProdConv(sid,pid){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod)return;
  if(!prod.conversions) prod.conversions=[];
  prod.conversions.push({fromUnit:'Caja',factor:1});
  saveSups(sid);_refreshConvList(sid,pid);
}
// Pregunta al usuario el nombre de una unidad personalizada (Pack, Lata, Fardo…)
// y la añade a la lista con factor 0 para que la rellene después.
function addProdConvCustom(sid,pid){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod)return;
  const name=(prompt('Nombre de la unidad personalizada (ej: Pack, Lata, Fardo):')||'').trim();
  if(!name) return;
  if(!prod.conversions) prod.conversions=[];
  // Evitar duplicados
  if(prod.conversions.some(c=>c.fromUnit.toLowerCase()===name.toLowerCase())){
    toast('Esa unidad ya existe','#d97706'); return;
  }
  prod.conversions.push({fromUnit:name,factor:0}); // 0 = usuario debe rellenar
  saveSups(sid);_refreshConvList(sid,pid);
}
function delProdConv(sid,pid,idx){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions)return;
  prod.conversions.splice(idx,1);
  saveSups(sid);_refreshConvList(sid,pid);
}
function editConvUnit(sid,pid,idx,val){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions||!prod.conversions[idx])return;
  prod.conversions[idx].fromUnit=val;saveSups(sid);
}
function editConvFactor(sid,pid,idx,val){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions||!prod.conversions[idx])return;
  const f=parseFloat(val);if(isNaN(f)||f<=0){toast('Factor inválido','#dc2626');return;}
  prod.conversions[idx].factor=f;saveSups(sid);toast('Conversión guardada','#16a34a');
}
function invertProdConv(sid,pid,idx){
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod||!prod.conversions||!prod.conversions[idx])return;
  const c=prod.conversions[idx];
  const oldBase=prod.unit||'KG';
  const newBase=c.fromUnit;
  const newFactor=c.factor>0?parseFloat((1/c.factor).toFixed(6)):1;
  // Swap: new base unit = oldFromUnit, fromUnit = oldBase
  prod.unit=newBase;
  c.fromUnit=oldBase;
  c.factor=newFactor;
  saveSups(sid);_refreshConvList(sid,prod.id);
  const el=document.querySelector(`[onchange*="editProdUnit('${sid}','${pid}'"]`);
  if(el) el.value=newBase;
  toast('Conversión invertida','#16a34a');
}
function toggleProdAlergeno(sid,pid,aId,checked){
  if(!suppliers[sid])return;
  const prod=suppliers[sid].products.find(p=>p.id===pid);
  if(!prod) return;
  if(!prod.alergenos) prod.alergenos=[];
  if(checked){ if(!prod.alergenos.includes(aId)) prod.alergenos.push(aId); }
  else { prod.alergenos=prod.alergenos.filter(a=>a!==aId); }
  saveSups(sid);
}
function filterSupProds(term,containerId){
  const container=document.getElementById(containerId);
  if(!container)return;
  const q=term.toLowerCase().trim();
  container.querySelectorAll('details.sup-cat-details').forEach(det=>{
    const rows=det.querySelectorAll('.prod-row');
    let anyMatch=false;
    rows.forEach(r=>{
      const nameEl=r.querySelector('.prod-name-t');
      const name=(nameEl?(nameEl.value??nameEl.textContent):'' ).toLowerCase();
      const match=!q||name.includes(q);
      r.style.display=match?'':'none';
      // Cada producto ocupa dos <tr> (fila + fila de detalle plegable):
      // oculta también la de detalle cuando el producto no coincide.
      const det2=r.nextElementSibling;
      if(det2 && det2.classList.contains('prod-detail-row') && !match) det2.style.display='none';
      if(match) anyMatch=true;
    });
    // Con búsqueda activa, abre solo las categorías con resultados; sin
    // búsqueda, vuelve a colapsar todo para no saturar la pantalla.
    det.open=q?anyMatch:false;
  });
}
// Muestra/oculta la fila de detalle (alérgenos + conversiones) de un producto,
// que vive como <tr> hermano justo después de la fila principal.
window.toggleProdRow=function(btn){
  const tr=btn.closest('tr');
  const det=tr&&tr.nextElementSibling;
  if(!det||!det.classList.contains('prod-detail-row')) return;
  const open=det.style.display!=='none';
  det.style.display=open?'none':'table-row';
  btn.textContent=open?'▾':'▴';
  btn.classList.toggle('pt-exp-open',!open);
};
function delProd(sid,pid){ if(!suppliers[sid])return;const _sy=window.scrollY;suppliers[sid].products=suppliers[sid].products.filter(p=>p.id!==pid);saveSups(sid);renderAdminContent();requestAnimationFrame(()=>window.scrollTo(0,_sy)); }
function localAddProd(sid){
  const name=document.getElementById('lp-name')?.value.trim();
  const unit=document.getElementById('lp-unit')?.value||'KG';
  const priceRaw=document.getElementById('lp-price')?.value;
  const price=(priceRaw===''||priceRaw==null)?0:parseFloat(priceRaw);
  if(!name){toast('Escribe el nombre del producto','#dc2626');return;}
  if(isNaN(price)||price<0){toast('Introduce un precio válido','#dc2626');return;}
  if(!suppliers[sid]){toast('Proveedor no encontrado','#dc2626');return;}
  const pid='p'+uid();
  const newProd={id:pid,name,unit,price};
  // Garantizar que products es array (Firebase puede devolver objeto con claves numéricas)
  if(!Array.isArray(suppliers[sid].products)) suppliers[sid].products=Object.values(suppliers[sid].products||{});
  suppliers[sid].products.push(newProd);
  // Escritura mediante TRANSACCIÓN sobre suppliers/<sid>/products.
  // Antes se hacía un .set() del array completo, lo que provocaba "lost update":
  // si dos locales añadían un producto casi a la vez, el último set borraba el
  // producto del otro → "no quedaban grabados". La transacción relee el valor
  // actual de Firebase y AÑADE el producto sin pisar lo que otros añadieron.
  if(fbDb){
    fbDb.ref('suppliers/'+sid+'/products').transaction(curr=>{
      let arr = Array.isArray(curr) ? curr : (curr ? Object.values(curr) : []);
      if(!arr.find(p=>p && p.id===pid)) arr.push(newProd);
      return arr;
    }, (err)=>{
      if(err){ toast('Error al guardar el producto, reintenta','#dc2626'); }
    });
  }
  localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
  S.showAddProd=false;
  // Auto-añadir al carrito con cantidad 1
  if(!S.cart[sid]) S.cart[sid]={};
  S.cart[sid][pid]=1;
  // Guardar detalles del producto en _cartProds por si el listener de Firebase lo pisa antes de enviar el pedido
  if(!S._cartProds[sid]) S._cartProds[sid]={};
  S._cartProds[sid][pid]=newProd;
  render();
  toast(`"${name}" guardado en el proveedor y añadido al pedido`,'#16a34a');
}

// ══════════════════════════════════════════════════════════════════════════
// IMPORTACIÓN MASIVA — un XLSX con una hoja por proveedor.
// Estructura esperada de cada hoja de proveedor:
//   Fila 1: Título (se ignora)
//   Fila 2: Subtítulo (se ignora)
//   Fila 3: (vacía)
//   Fila 4: Encabezados: Proveedor | Código | Descripción | Precio(€) | Alérgenos
//   Fila 5+: Datos (código opcional, nombre del producto, precio, alérgenos opcional)
// Si hay columna de código, el emparejamiento de productos existentes se hace
// por código (prioritario) y si no, por nombre normalizado.
// La columna "Alérgenos" (opcional, detectada por contener "alerg" en el
// encabezado) acepta una lista separada por comas/punto y coma de nombres o
// ids de ALERGENOS (ej. "Gluten, Lácteos" o "gluten;lacteos"); si una fila la
// trae vacía, no se toca el alérgeno ya guardado del producto. Ver
// exportCatalogoTarifas() para generar la plantilla de partida con el
// catálogo actual ya volcado.
// Se ignoran hojas 'Leyenda', 'Inventario', 'Resumen' — el resto se tratan
// como proveedores. La coincidencia de proveedor es case-insensitive por
// nombre. Para proveedores existentes solo se actualizan precios y se añaden
// productos nuevos (nunca se borran) para preservar categorías/unidades/
// alérgenos/conversiones ya configuradas manualmente.
// ══════════════════════════════════════════════════════════════════════════
const _BULK_IGNORE_SHEETS=['Leyenda','Inventario','Resumen','Portada','Total','Totales'];
window._bulkPreview=null;

function _bulkNormName(s){ return (s||'').trim().toLowerCase().replace(/\s+/g,' ').replace(/[^\w\sáéíóúñ]/gi,''); }
// Quita acentos (á→a, é→e...) para comparar encabezados sin depender de que
// el usuario conserve las tildes exactas (ej. "Alérgenos" vs "Alergenos").
function _foldAccents(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,''); }

// Convierte un array de ids de ALERGENOS a texto legible "Gluten, Lácteos"
function _alergenosToText(ids){
  if(!ids||!ids.length) return '';
  return ids.map(id=>{ const a=ALERGENOS.find(x=>x.id===id); return a?a.label:id; }).join(', ');
}
// Convierte texto "Gluten, Lácteos" o "gluten;lacteos" a array de ids válidos de ALERGENOS
function _alergenosFromText(txt){
  if(!txt) return [];
  const parts=String(txt).split(/[,;\/]/).map(s=>_foldAccents(_bulkNormName(s))).filter(Boolean);
  const ids=new Set();
  parts.forEach(p=>{
    const found=ALERGENOS.find(a=>_foldAccents(_bulkNormName(a.label))===p || a.id===p || _foldAccents(_bulkNormName(a.id))===p);
    if(found) ids.add(found.id);
  });
  return [...ids];
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTACIÓN — genera el mismo formato de plantilla que espera la
// importación masiva (una hoja por proveedor), incluyendo columna Alérgenos,
// para poder rellenarla fuera de la app y volver a importarla.
// ══════════════════════════════════════════════════════════════════════════
function exportCatalogoTarifas(){
  if(typeof XLSX==='undefined'){ toast('La librería XLSX no está cargada','#dc2626'); return; }
  const sups=Object.values(suppliers||{}).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(!sups.length){ toast('No hay proveedores para exportar','#dc2626'); return; }
  const wb=XLSX.utils.book_new();
  const usedNames=new Set();
  sups.forEach(sup=>{
    const rows=[
      [`Tarifa — ${sup.name||sup.id}`],
      ['Catálogo exportado para revisar/completar alérgenos y volver a importar'],
      [],
      ['Proveedor','Código','Descripción','Precio(€)','Alérgenos'],
    ];
    (Array.isArray(sup.products)?sup.products:Object.values(sup.products||{})).forEach(p=>{
      rows.push([sup.name||sup.id, p.code||'', p.name||'', typeof p.price==='number'?p.price:parseFloat(p.price)||0, _alergenosToText(p.alergenos)]);
    });
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:22},{wch:12},{wch:40},{wch:10},{wch:30}];
    // Nombres de hoja válidos en Excel: máx 31 chars, sin caracteres especiales, únicos
    let sheetName=(sup.name||sup.id).toString().replace(/[\\/*?:\[\]]/g,' ').trim().slice(0,31)||sup.id;
    let base=sheetName, n=2;
    while(usedNames.has(sheetName)){ sheetName=(base.slice(0,28)+' '+n).slice(0,31); n++; }
    usedNames.add(sheetName);
    XLSX.utils.book_append_sheet(wb,ws,sheetName);
  });
  const fecha=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb,`catalogo-alergenos-${fecha}.xlsx`);
  toast('Catálogo exportado','#16a34a');
}

async function importBulkTarifa(input){
  const file=input.files[0]; if(!file) return;
  input.value=''; // permitir volver a subir el mismo archivo
  if(typeof XLSX==='undefined'){ toast('La librería XLSX no está cargada','#dc2626'); return; }
  toast('Procesando plantilla…','#0369a1',2000);
  try{
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    // Índice de proveedores actuales por nombre normalizado para matching
    const existingByName={};
    Object.values(suppliers).forEach(s=>{ existingByName[_bulkNormName(s.name)]=s; });
    const summary={update:[],create:[],skipped:[]};
    wb.SheetNames.forEach(sheetName=>{
      if(_BULK_IGNORE_SHEETS.includes(sheetName)) return;
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      // Buscar la fila de encabezado que contenga "Descripción" y "Precio" (y opcionalmente "Código")
      let headerIdx=-1, colName=-1, colPrice=-1, colCode=-1, colAlerg=-1;
      for(let i=0;i<Math.min(10,rows.length);i++){
        const r=rows[i]||[];
        for(let j=0;j<r.length;j++){
          const v=_foldAccents((r[j]||'').toString().toLowerCase());
          if(v.includes('descripci')) colName=j;
          if(v.includes('precio')) colPrice=j;
          if(v.includes('codigo')||v.includes('code')||v.includes('ref')) colCode=j;
          if(v.includes('alerg')) colAlerg=j;
        }
        if(colName>=0 && colPrice>=0){ headerIdx=i; break; }
      }
      if(headerIdx<0 || colName<0 || colPrice<0){ summary.skipped.push({name:sheetName,reason:'Sin encabezado Descripción/Precio'}); return; }
      const products=[];
      for(let i=headerIdx+1;i<rows.length;i++){
        const r=rows[i]||[];
        const name=(r[colName]||'').toString().trim();
        const price=parseFloat(r[colPrice]);
        const code=colCode>=0?(r[colCode]||'').toString().trim():'';
        const alergenos=colAlerg>=0?_alergenosFromText(r[colAlerg]):null;
        if(!name || isNaN(price)) continue;
        products.push({name,price,...(code?{code}:{}),...(alergenos&&alergenos.length?{alergenos}:{})});
      }
      if(!products.length){ summary.skipped.push({name:sheetName,reason:'Sin productos'}); return; }
      const normed=_bulkNormName(sheetName);
      const existing=existingByName[normed];
      if(existing){
        // Actualizar: contar precios que cambian y productos nuevos
        const existingByProdName={}, existingByCode={};
        (existing.products||[]).forEach(p=>{
          existingByProdName[_bulkNormName(p.name)]=p;
          if(p.code) existingByCode[String(p.code).trim()]=p;
        });
        let priceChanges=0, added=0, alergChanges=0;
        products.forEach(p=>{
          const ep=(p.code&&existingByCode[p.code])||existingByProdName[_bulkNormName(p.name)];
          if(ep){
            if(Math.abs((parseFloat(ep.price)||0)-p.price)>0.001) priceChanges++;
            if(p.alergenos && p.alergenos.length){
              const before=(ep.alergenos||[]).slice().sort().join(',');
              const after=p.alergenos.slice().sort().join(',');
              if(before!==after) alergChanges++;
            }
          } else added++;
        });
        summary.update.push({sid:existing.id,name:existing.name,total:products.length,priceChanges,added,alergChanges,products});
      } else {
        summary.create.push({name:sheetName,total:products.length,products});
      }
    });
    window._bulkPreview=summary;
    _showBulkPreview();
  }catch(e){
    console.error('Bulk import error:',e);
    toast('Error al leer el archivo: '+e.message,'#dc2626',5000);
  }
}

function _showBulkPreview(){
  const s=window._bulkPreview; if(!s) return;
  const totalNewProds=s.create.reduce((a,c)=>a+c.total,0);
  const totalPriceChanges=s.update.reduce((a,c)=>a+c.priceChanges,0);
  const totalAdded=s.update.reduce((a,c)=>a+c.added,0);
  const totalAlergChanges=s.update.reduce((a,c)=>a+(c.alergChanges||0),0);
  const upList=s.update.length?`<div style="margin-top:10px"><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#0369a1">🔄 ${s.update.length} proveedores a actualizar</div><div style="max-height:180px;overflow-y:auto;font-size:12px">${s.update.map(u=>`<div style="padding:3px 0;border-bottom:1px solid var(--brd)"><strong>${u.name}</strong> — ${u.priceChanges} precio${u.priceChanges!==1?'s':''} cambia, ${u.added} producto${u.added!==1?'s':''} nuevo${u.added!==1?'s':''}${u.alergChanges?`, ${u.alergChanges} alérgeno${u.alergChanges!==1?'s':''} actualizado${u.alergChanges!==1?'s':''}`:''}</div>`).join('')}</div></div>`:'';
  const crList=s.create.length?`<div style="margin-top:10px"><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#16a34a">➕ ${s.create.length} proveedores nuevos</div><div style="max-height:180px;overflow-y:auto;font-size:12px">${s.create.map(c=>`<div style="padding:3px 0;border-bottom:1px solid var(--brd)"><strong>${c.name}</strong> — ${c.total} productos</div>`).join('')}</div></div>`:'';
  const skList=s.skipped.length?`<div style="margin-top:10px"><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#d97706">⚠️ ${s.skipped.length} hojas ignoradas</div><div style="max-height:120px;overflow-y:auto;font-size:12px">${s.skipped.map(k=>`<div style="padding:2px 0;color:var(--mut)">${k.name} — ${k.reason}</div>`).join('')}</div></div>`:'';
  const modal=document.createElement('div');
  modal.id='bulk-preview-ov';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1500;display:flex;align-items:center;justify-content:center;padding:12px';
  modal.innerHTML=`<div style="background:var(--card);border-radius:14px;padding:22px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto">
    <div style="font-weight:700;font-size:16px;margin-bottom:6px">Vista previa de la importación</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:12px">Revisa lo que va a cambiar antes de aplicar. Nada se guarda todavía.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <div style="flex:1;min-width:120px;padding:10px;background:#eff6ff;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#0369a1">${s.update.length}</div><div style="font-size:11px;color:#0369a1">actualizar</div></div>
      <div style="flex:1;min-width:120px;padding:10px;background:#f0fdf4;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">${s.create.length}</div><div style="font-size:11px;color:#16a34a">crear nuevos</div></div>
      <div style="flex:1;min-width:120px;padding:10px;background:#fff7ed;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#d97706">${totalPriceChanges+totalAdded+totalNewProds}</div><div style="font-size:11px;color:#d97706">cambios totales</div></div>
      <div style="flex:1;min-width:120px;padding:10px;background:#fff3cd;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#b45309">${totalAlergChanges}</div><div style="font-size:11px;color:#b45309">alérgenos</div></div>
    </div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px;padding:8px;background:var(--srf);border-radius:6px">📝 De los proveedores existentes solo se actualizan precios, alérgenos (si la hoja trae columna "Alérgenos" con datos) y se añaden productos nuevos — nunca se borran productos ni se pierden categorías/unidades ya configurados.</div>
    ${upList}${crList}${skList}
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ok btn-sm" onclick="applyBulkTarifa()" style="flex:1">✓ Aplicar cambios</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('bulk-preview-ov').remove();window._bulkPreview=null">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function applyBulkTarifa(){
  const s=window._bulkPreview; if(!s){ toast('Nada que aplicar','#dc2626'); return; }
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  const modal=document.getElementById('bulk-preview-ov');
  if(modal) modal.innerHTML='<div style="background:var(--card);border-radius:14px;padding:30px;text-align:center"><div style="font-weight:700;font-size:16px;margin-bottom:8px">Aplicando cambios…</div><div style="font-size:13px;color:var(--mut)">No cierres esta pestaña</div></div>';
  try{
    const updates={};
    // 1. Actualizar existentes: fusionar productos por código (si hay) o por nombre
    s.update.forEach(u=>{
      const sup=suppliers[u.sid]; if(!sup) return;
      const byName={}, byCode={};
      (sup.products||[]).forEach(p=>{ byName[_bulkNormName(p.name)]=p; if(p.code) byCode[String(p.code).trim()]=p; });
      u.products.forEach(np=>{
        const ep=(np.code&&byCode[np.code])||byName[_bulkNormName(np.name)];
        if(ep){
          ep.price=np.price;
          if(np.code&&!ep.code) ep.code=np.code;
          if(np.alergenos&&np.alergenos.length) ep.alergenos=np.alergenos;
        } else {
          const created={id:'p'+uid(),name:np.name,price:np.price,unit:'UN',category:'',...(np.code?{code:np.code}:{}),...(np.alergenos&&np.alergenos.length?{alergenos:np.alergenos}:{})};
          byName[_bulkNormName(np.name)]=created;
          if(np.code) byCode[np.code]=created;
        }
      });
      updates['suppliers/'+u.sid+'/products']=Object.values(byName);
    });
    // 2. Crear nuevos proveedores
    s.create.forEach(c=>{
      const nid='s'+uid();
      const nameStr=String(c.name||'').trim();
      const products=c.products.map(p=>({id:'p'+uid(),name:p.name,price:p.price,unit:'UN',category:'',...(p.code?{code:p.code}:{}),...(p.alergenos&&p.alergenos.length?{alergenos:p.alergenos}:{})}));
      updates['suppliers/'+nid]={id:nid,name:nameStr,emoji:'',phone:'',products};
    });
    await fbDb.ref().update(updates);
    if(modal) modal.remove();
    window._bulkPreview=null;
    toast(`✓ ${s.update.length} actualizados, ${s.create.length} nuevos`,'#16a34a',6000);
    setTimeout(()=>renderAdminContent(),300);
  }catch(e){
    console.error('Apply bulk error:',e);
    if(modal) modal.remove();
    toast('Error al aplicar: '+e.message,'#dc2626',5000);
  }
}
