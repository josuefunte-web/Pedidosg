/* ═══════════════ ESCANDALLOS ═══════════════ */
let _escEditId=null, _escIngs=[], _escAllData={}, _escSupsCache={}, _escInit=false;
let _escElab={texto:'',pasos:[]};
let _escTemporada=[], _escSecciones=[];
let _menAllData={}, _menEditId=null, _menEscIds=[], _menInit=false;

function vEscandallos(){
  const escTab=S._escSubTab||'escandallos';
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="font-size:18px;font-weight:800;color:var(--pri)">${escTab==='menus'?'🍽 Menús':'Escandallos'}</div>
    <div style="display:flex;gap:8px">
      ${escTab==='escandallos'?`<button class="btn btn-ghost btn-sm" onclick="escExportTodos()">Exportar</button>
      <button class="btn btn-ghost btn-sm" onclick="escImportarJSON()" title="Importar escandallos desde archivo JSON">⬆ Importar</button>
      <input type="file" id="esc-import-input" accept=".json" style="display:none" onchange="escProcesarImport(this)">
      <button class="btn btn-ghost btn-sm" onclick="escMigrarRecetas()" title="Fusionar recetas existentes en escandallos">🔀 Migrar recetas</button>
      <button class="btn btn-pri btn-sm" onclick="escOpenModal()">+ Nuevo</button>`
      :`<button class="btn btn-pri btn-sm" onclick="menOpenModal()">+ Nuevo menú</button>`}
    </div>
  </div>
  <div class="tabs" style="margin-bottom:12px">
    <button class="tab ${escTab==='escandallos'?'act':''}" onclick="S._escSubTab='escandallos';renderAdminContent()">Escandallos</button>
    <button class="tab ${escTab==='menus'?'act':''}" onclick="S._escSubTab='menus';renderAdminContent()">🍽 Menús</button>
  </div>
  ${escTab==='menus'?`
  <div class="esc-filtros">
    <input type="text" id="men-search" placeholder="Buscar menú..." oninput="menRender()" />
    <select id="men-local-filter" onchange="menRender()"><option value="">Todos los locales</option>${cfg.users.map(u=>`<option>${u.restaurant}</option>`).join('')}</select>
  </div>
  <div id="men-grid" class="men-grid"><p style="color:var(--mut)">Cargando...</p></div>
  `:
  `<div id="esc-detail-wrap" style="display:none"></div>
  <div id="esc-list-wrap">
  <div class="esc-subtabs">
    <button class="esc-subtab ${(S._escTipoTab||'final')==='final'?'act':''}" onclick="S._escTipoTab='final';escRender()">Elaboraciones finales</button>
    <button class="esc-subtab ${S._escTipoTab==='intermedia'?'act':''}" onclick="S._escTipoTab='intermedia';escRender()">Elaboraciones intermedias</button>
  </div>
  <div class="esc-filtros">
    <input type="text" id="esc-search" placeholder="Buscar plato..." oninput="escRender()" />
    <select id="esc-cat-filter" onchange="escRender()">
      <option value="">Todas las categorías</option>
      <option>Primeros</option><option>Segundos</option><option>Postres</option>
      <option>Entrantes</option><option>Carnes</option><option>Pescados</option>
      <option>Bebidas</option><option>Otros</option>
    </select>
    <select id="esc-local-filter" onchange="escRender()">
      <option value="">Todos los locales</option>
      <option value="global">Solo globales</option>
      ${cfg.users.map(u=>`<option value="${u.restaurant}">${u.restaurant}</option>`).join('')}
    </select>
  </div>
  <div id="esc-grid" class="esc-grid"><p style="color:var(--mut)">Cargando...</p></div>
  </div>`}

  <!-- MODAL MENÚ -->
  <div class="overlay" id="men-modal-ov" style="display:none" onclick="if(event.target===this)menCloseModal()">
    <div class="esc-modal-box" style="max-width:780px">
      <div class="esc-modal-hd">
        <h3 id="men-modal-title">Nuevo menú</h3>
        <button class="btn btn-ghost btn-sm" onclick="menCloseModal()">✕</button>
      </div>
      <div style="padding:0 24px 16px;overflow-y:auto">
        <div class="fg"><label>Nombre del menú</label><input type="text" id="men-nombre" placeholder="Ej: Menú degustación"/></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fg"><label>Local</label><select id="men-local"><option value="global">Global (todos)</option>${cfg.users.map(u=>`<option value="${u.restaurant}">${u.restaurant}</option>`).join('')}</select></div>
          <div class="fg"><label>PVP del menú €</label><input type="number" id="men-pvp" min="0" step="0.01" placeholder="0.00"/></div>
        </div>
        <div class="fg"><label>Notas</label><textarea id="men-notas" rows="2" placeholder="Descripción, alérgenos..."></textarea></div>
        <div style="font-weight:700;font-size:13px;margin:14px 0 8px;color:var(--pri)">Platos del menú</div>
        <div id="men-esc-selector" class="men-sel-cols"></div>
      </div>
      <div class="esc-modal-ft">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-no btn-sm" id="men-btn-del" style="display:none" onclick="menDelete()">Eliminar</button>
          <span style="font-size:13px;color:var(--mut)">Coste total</span>
          <strong id="men-coste-total" style="font-size:16px;color:var(--pri)">0,00 €</strong>
        </div>
        <div class="esc-modal-ft-r">
          <button class="btn btn-ghost btn-sm" onclick="menExportPDF()">PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="menCloseModal()">Cancelar</button>
          <button class="btn btn-pri btn-sm" onclick="menSave()">Guardar menú</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL CALCULADORA DE MENÚ DE GRUPO -->
  <div class="overlay" id="men-group-ov" style="display:none" onclick="if(event.target===this)menGroupClose()">
    <div class="esc-modal-box" style="max-width:640px">
      <div class="esc-modal-hd">
        <h3>👥 Menú para grupo</h3>
        <button class="btn btn-ghost btn-sm" onclick="menGroupClose()">✕</button>
      </div>
      <div id="men-group-body" style="padding:0 24px 20px;overflow-y:auto"></div>
    </div>
  </div>

  <!-- EDITOR ESCANDALLO (panel inline) -->
  <div class="esc-edit-screen" id="esc-modal-ov" style="display:none">
    <div class="esc-modal-box">
      <div class="esc-modal-hd">
        <h3 id="esc-modal-title">Nuevo escandallo</h3>
        <button class="btn btn-ghost btn-sm" onclick="escCloseModal()">✕</button>
      </div>
      <div class="esc-modal-body">
        <div class="esc-left">
          <label>Nombre del plato</label>
          <input type="text" id="esc-nombre" placeholder="Ej: Entrecot con patatas"/>
          <label>Tipo de elaboración</label>
          <select id="esc-tipo">
            <option value="final">Elaboración final (plato)</option>
            <option value="intermedia">Elaboración intermedia (base/salsa)</option>
          </select>
          <label>Categoría</label>
          <select id="esc-categoria">${ESC_CATS.map(c=>`<option>${c}</option>`).join('')}</select>
          <label>Local</label>
          <select id="esc-local">
            <option value="global">Global (todos los locales)</option>
          </select>
          <label>Precio de venta al público (con IVA) €</label>
          <input type="number" id="esc-pvp" min="0" step="0.01" placeholder="0.00" oninput="escRecalc()"/>
          <label>IVA aplicable</label>
          <select id="esc-iva" onchange="escRecalc()">
            <option value="0">0% — Exento</option>
            <option value="4">4% — Superreducido</option>
            <option value="10" selected>10% — Reducido (hostelería)</option>
            <option value="21">21% — General</option>
          </select>
          <label>Food cost objetivo (%)</label>
          <input type="number" id="esc-fcobj" min="1" max="100" value="30" oninput="escRecalc()"/>
          <label>Rendimiento (cuánto produce)</label>
          <div style="display:flex;gap:6px">
            <input type="number" id="esc-rend" min="0.001" step="0.001" placeholder="1" style="flex:2" oninput="escRecalc()"/>
            <select id="esc-rend-unit" style="flex:1"><option>rac.</option><option>KG</option><option>L</option><option>UN</option></select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label>Tiempo elaboración (min)</label>
              <input type="number" id="esc-tiempo" min="0" step="1" placeholder="30"/>
            </div>
            <div>
              <label>Temperatura servicio</label>
              <input type="text" id="esc-temp" placeholder="Ej: 65°C"/>
            </div>
          </div>
          <label>Alérgenos presentes <span style="font-weight:400;color:var(--mut);font-size:10px">(auto desde ingredientes vinculados)</span></label>
          <div id="esc-alergenos-display" style="min-height:30px;padding:6px 0;font-size:12px;color:var(--mut)">Añade ingredientes para ver alérgenos</div>
          <label>Notas</label>
          <textarea id="esc-notas" rows="2" placeholder="Temporada, presentación..."></textarea>
        </div>
        <div class="esc-right">
          <h4>Ingredientes</h4>
          <div class="esc-add-ing" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <select id="esc-sel-prov" onchange="escLoadProds()" style="grid-column:1/3">
              <option value="">-- Proveedor (opcional) --</option>
            </select>
            <input type="text" id="esc-prod-search" placeholder="Buscar producto del proveedor..." style="grid-column:1/3;display:none;padding:7px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt);outline:none" oninput="escFilterProdsSearch(this.value)" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>
            <select id="esc-sel-prod" style="grid-column:1/3"><option value="">-- Producto del proveedor --</option></select>
            <div id="esc-new-prod-wrap" style="display:none;grid-column:1/3;background:var(--srf);border:1.5px solid var(--brd);border-radius:9px;padding:10px;display:none">
              <div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Crear nuevo producto en este proveedor</div>
              <div style="display:grid;grid-template-columns:2fr 1fr 1fr 80px;gap:6px;margin-bottom:8px">
                <input type="text" id="esc-np-name" placeholder="Nombre del producto"/>
                <select id="esc-np-unit"><option>KG</option><option>g</option><option>UN</option><option>L</option><option>Caja</option></select>
                <input type="number" id="esc-np-price" placeholder="€/u." step="0.01" min="0"/>
                <input type="number" id="esc-np-gr" placeholder="gr" step="1" min="0" title="Peso en gramos"/>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ok btn-sm" onclick="escCrearProd()">✓ Crear y seleccionar</button>
                <button class="btn btn-ghost btn-sm" onclick="escToggleNewProd(false)">Cancelar</button>
              </div>
            </div>
            <button id="esc-btn-new-prod" class="btn btn-ghost btn-sm" style="display:none;grid-column:1/3;font-size:12px" onclick="escToggleNewProd(true)">+ Crear nuevo producto en este proveedor</button>
            <input type="text" id="esc-libre-nombre" placeholder="O escribe ingrediente libre" style="grid-column:1/3;padding:6px 9px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt)"/>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" id="esc-sel-qty" placeholder="Cant." min="0" step="0.001" style="flex:1"/>
              <input type="number" id="esc-libre-precio" placeholder="€/u." min="0" step="0.01" style="flex:1"/>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" id="esc-sel-merma" placeholder="Merma %" min="0" max="99" step="1" style="flex:1" title="% de merma/desperdicio"/>
              <button class="btn btn-ghost btn-sm" onclick="escAddIng()" style="flex:1">+ Añadir</button>
            </div>
          </div>
          <div id="esc-ing-list" class="esc-ing-list"><p style="color:var(--mut);font-size:13px">Sin ingredientes</p></div>
          <div class="esc-calcs">
            <div class="esc-calc-r"><span>Coste total</span><strong id="ec-coste">0,00 €</strong></div>
            <div class="esc-calc-r"><span>Food cost real</span><strong id="ec-fc">— %</strong></div>
            <div class="esc-calc-r" style="border-top:1px solid var(--brd);padding-top:6px;margin-top:2px"><span>PVP con IVA</span><strong id="ec-pvp-coniva">— €</strong></div>
            <div class="esc-calc-r"><span>IVA (<span id="ec-iva-pct">10</span>%)</span><strong id="ec-iva-amt">— €</strong></div>
            <div class="esc-calc-r"><span>PVP sin IVA</span><strong id="ec-pvp-noiva">— €</strong></div>
            <div class="esc-calc-r" style="border-top:1px solid var(--brd);padding-top:6px;margin-top:2px"><span>PVP sugerido (con IVA)</span><strong id="ec-pvpsug">— €</strong></div>
            <div class="esc-calc-r"><span>Margen bruto (s/IVA)</span><strong id="ec-margen">— €</strong></div>
            <div class="esc-calc-r"><span>% Margen (s/IVA)</span><strong id="ec-margenpct">— %</strong></div>
          </div>
        </div>
      </div>
      <!-- RECETA — ancho completo -->
      <div style="padding:14px 20px 16px;border-top:1px solid var(--brd)">
        <div style="font-weight:700;font-size:13px;color:var(--pri);margin-bottom:12px">📖 Receta</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Descripción general</label>
            <textarea id="esc-elab-texto" rows="4" placeholder="Técnica, presentación, temperatura..." style="width:100%;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt);resize:vertical;box-sizing:border-box" oninput="_escElab.texto=this.value"></textarea>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px">Temporada</label>
            <div id="esc-temporada-btns" style="display:flex;gap:4px;flex-wrap:wrap"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px">Secciones de elaboración</label>
            <button class="btn btn-ghost btn-xs" onclick="escAddSeccion()">+ Añadir sección</button>
          </div>
          <div id="esc-secciones-list"></div>
        </div>
      </div>
      <div class="esc-modal-ft">
        <button class="btn btn-no btn-sm" id="esc-btn-del" style="display:none" onclick="escDelete()">Eliminar</button>
        <div class="esc-modal-ft-r">
          <button class="btn btn-ghost btn-sm" id="esc-btn-pdf" onclick="escExportPDF()" title="Exportar a PDF">PDF</button>
          <button class="btn btn-ghost btn-sm" id="esc-btn-xlsx" onclick="escExportExcel()" title="Exportar a Excel">Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="escCloseModal()">Cancelar</button>
          <button class="btn btn-pri btn-sm" onclick="escSave()">Guardar</button>
        </div>
      </div>
    </div>
  </div>`;
}

function initEscandallos(){
  _escSupsCache = suppliers;
  escRender();
  menRender();
  if(_escInit||!fbDb) return;
  _escInit=true;
  fbDb.ref('escandallos').on('value', snap=>{
    _escAllData = snap.val() || {};
    escRender();
    menRender();
    if(S.view==='order' && S.orderTab==='escandallos') render();
  });
  if(!_menInit){ _menInit=true;
    fbDb.ref('menus').on('value', snap=>{
      _menAllData = snap.val() || {};
      menRender();
      if(S.view==='order' && S.orderTab==='escandallos') render();
    });
  }
}

function escRender(){
  const grid = document.getElementById('esc-grid');
  if(!grid) return;
  const txt = (document.getElementById('esc-search')?.value||'').toLowerCase();
  const cat = document.getElementById('esc-cat-filter')?.value||'';
  const local = document.getElementById('esc-local-filter')?.value||'';
  const tipoTab=S._escTipoTab||'final';
  const entries = Object.entries(_escAllData).filter(([,e])=>{
    const rest=e.restaurante||'global';
    return ((e.tipo||'final')===tipoTab)
      &&(!txt||e.nombre?.toLowerCase().includes(txt))
      &&(!cat||e.categoria===cat)
      &&(!local||(local==='global'?rest==='global':rest===local));
  });
  if(!entries.length){
    grid.innerHTML='<p style="color:var(--mut)">No hay escandallos con esos filtros. Crea uno con "+ Nuevo".</p>';
    return;
  }
  function escCard([id,e]){
    const coste = escCosteTotal(e);
    const pvp = parseFloat(e.precioVenta)||0;
    const fcObj = parseFloat(e.foodCostObjetivo)||30;
    const fcReal = pvp>0?(coste/pvp*100):null;
    const margen = pvp>0?(pvp-coste):null;
    const margenPct = pvp>0&&margen!==null?(margen/pvp*100):null;
    let cls='esc-ok';
    if(fcReal!==null){if(fcReal>fcObj+5)cls='esc-bad';else if(fcReal>fcObj)cls='esc-warn';}
    const rest=e.restaurante||'global';
    const restBadge=rest==='global'
      ?`<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:1px 7px;font-weight:700">Global</span>`
      :`<span style="font-size:10px;background:#f3e8ff;color:#7c3aed;border-radius:10px;padding:1px 7px;font-weight:700">${rest}</span>`;
    const baseTag=e.baseId?`<span style="font-size:10px;color:var(--mut);margin-left:4px">copia</span>`:'';
    const copyBtn=`<button class="btn btn-ghost btn-xs" style="margin-top:8px;width:100%;justify-content:center" onclick="event.stopPropagation();escCopiarParaLocal('${id}')">Copiar para local</button>`;
    // Alérgenos de la ficha
    const alerList=(e.alergenos||[]).map(id=>{const a=ALERGENOS.find(x=>x.id===id);return a?a.label:id;});
    const alerHtml=alerList.length
      ?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:3px">${alerList.map(l=>`<span style="font-size:10px;background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:3px;padding:1px 5px;font-weight:600">${l}</span>`).join('')}</div>`:'';
    // Tiempo y temperatura
    const metaHtml=[
      e.tiempoElaboracion?`${e.tiempoElaboracion} min`:'',
      e.temperatura||'',
    ].filter(Boolean).join(' · ');
    return `<div class="esc-card" onclick="escShowDetail('${id}')">
      <div class="esc-fc-ind ${cls}">${fcReal!==null?fcReal.toFixed(0)+'%':'—'}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${restBadge}${baseTag}</div>
      <h4>${e.nombre||'Sin nombre'}</h4>
      ${metaHtml?`<div style="font-size:11px;color:var(--mut);margin-bottom:8px">${metaHtml}</div>`:''}
      <div class="esc-stats">
        <div class="esc-stat"><span>Coste</span><strong>${escFmt(coste)}</strong></div>
        <div class="esc-stat"><span>PVP</span><strong>${pvp>0?escFmt(pvp):'—'}</strong></div>
        <div class="esc-stat"><span>Margen</span><strong>${margen!==null?escFmt(margen):'—'}</strong></div>
        <div class="esc-stat"><span>% Margen</span><strong>${margenPct!==null?margenPct.toFixed(1)+'%':'—'}</strong></div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--mut)">${(e.ingredientes||[]).length} ingrediente${(e.ingredientes||[]).length!==1?'s':''}</div>
      ${alerHtml}
      ${copyBtn}
    </div>`;
  }
  // Agrupar por categoría si no hay filtro de categoría activo
  if(cat){
    grid.innerHTML=`<div class="esc-grid">${entries.map(escCard).join('')}</div>`;
  } else {
    const byCat={};
    entries.forEach(entry=>{ const c=entry[1].categoria||'Otros'; if(!byCat[c])byCat[c]=[]; byCat[c].push(entry); });
    // Ordenar: categorías de escandallos (Carnes, Fríos, Postres, Bebidas, Aperitivos, Fondos, Otros)
    const ESC_CATS=['Calientes','Fríos','Postres','Bebidas','Aperitivos','Fondos','Entrantes','Guarniciones','Otros'];
    const orderedCats=[...ESC_CATS,...Object.keys(byCat).filter(c=>!ESC_CATS.includes(c))].filter(c=>byCat[c]);
    grid.innerHTML=orderedCats.map(c=>`
      <div style="grid-column:1/-1;margin-top:${c===orderedCats[0]?'0':'8px'}">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;padding:8px 0 6px;border-bottom:2px solid ${(ESC_CAT_COLORS[c]||'#64748b')}50;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:${ESC_CAT_COLORS[c]||'#64748b'}">
          ${catDot(c,ESC_CAT_COLORS)} ${c} <span style="font-size:10px;font-weight:600;background:${(ESC_CAT_COLORS[c]||'#64748b')}15;border:1px solid ${(ESC_CAT_COLORS[c]||'#64748b')}30;border-radius:10px;padding:1px 8px;color:${ESC_CAT_COLORS[c]||'#64748b'}">${byCat[c].length}</span>
        </div>
      </div>
      ${byCat[c].map(escCard).join('')}
    `).join('');
  }
}

function escCosteTotal(e, depth=0){
  return (e.ingredientes||[]).reduce((s,ing)=>{
    const p=escLivePrice(ing, depth);
    const merma=parseFloat(ing.merma)||0;
    const factor=merma>0&&merma<100?1/(1-merma/100):1;
    return s+(parseFloat(ing.cantidad)||0)*p*factor;
  },0);
}

function escOpenModal(id=null){
  _escEditId=id; _escIngs=[];
  _escSupsCache=suppliers;
  // Ocultar lista y detalle, mostrar editor en panel (no flotante)
  const lw=document.getElementById('esc-list-wrap'); if(lw) lw.style.display='none';
  const dw=document.getElementById('esc-detail-wrap'); if(dw) dw.style.display='none';
  const tipoEl=document.getElementById('esc-tipo');
  if(tipoEl) tipoEl.value=(id&&_escAllData[id]?.tipo)||S._escTipoTab||'final';
  document.getElementById('esc-modal-title').textContent=id?'Editar escandallo':'Nuevo escandallo';
  document.getElementById('esc-btn-del').style.display=id?'':'none';
  // Poblar select de local si existe
  const selLocal=document.getElementById('esc-local');
  if(selLocal){
    selLocal.innerHTML=`<option value="global">Global (todos los locales)</option>`+cfg.users.map(u=>`<option value="${u.restaurant}">${u.restaurant}</option>`).join('');
  }
  if(id&&_escAllData[id]){
    const e=_escAllData[id];
    document.getElementById('esc-nombre').value=e.nombre||'';
    document.getElementById('esc-categoria').value=e.categoria||'Carnes';
    document.getElementById('esc-pvp').value=e.precioVenta||'';
    const ivaSelEdit=document.getElementById('esc-iva');
    if(ivaSelEdit) ivaSelEdit.value=e.iva!==undefined?e.iva:10;
    document.getElementById('esc-fcobj').value=e.foodCostObjetivo||30;
    document.getElementById('esc-notas').value=e.notas||'';
    const rendEl=document.getElementById('esc-rend');
    const rendUEl=document.getElementById('esc-rend-unit');
    if(rendEl) rendEl.value=e.rendimiento||1;
    if(rendUEl) rendUEl.value=e.rendimientoUnidad||'rac.';
    if(selLocal) selLocal.value=e.restaurante||'global';
    const tiempoEl=document.getElementById('esc-tiempo');
    if(tiempoEl) tiempoEl.value=e.tiempoElaboracion||'';
    const tempEl=document.getElementById('esc-temp');
    if(tempEl) tempEl.value=e.temperatura||'';
    _escIngs=JSON.parse(JSON.stringify(e.ingredientes||[]));
    _escElab={texto:e.elaboracion?.texto||'',pasos:JSON.parse(JSON.stringify(e.elaboracion?.pasos||[]))};
    _escTemporada=JSON.parse(JSON.stringify(e.temporada||[]));
    _escSecciones=JSON.parse(JSON.stringify(e.recetaSecciones||[]));
  } else {
    document.getElementById('esc-nombre').value='';
    document.getElementById('esc-categoria').value=ESC_CATS[0];
    document.getElementById('esc-pvp').value='';
    document.getElementById('esc-fcobj').value=30;
    document.getElementById('esc-notas').value='';
    const ivaSelNew=document.getElementById('esc-iva');
    if(ivaSelNew) ivaSelNew.value=10;
    const rendEl=document.getElementById('esc-rend');
    const rendUEl=document.getElementById('esc-rend-unit');
    if(rendEl) rendEl.value=1;
    if(rendUEl) rendUEl.value='rac.';
    if(selLocal) selLocal.value='global';
    const tiempoEl=document.getElementById('esc-tiempo');
    if(tiempoEl) tiempoEl.value='';
    const tempEl=document.getElementById('esc-temp');
    if(tempEl) tempEl.value='';
    _escElab={texto:'',pasos:[]};
    _escTemporada=[];
    _escSecciones=[];
  }
  // Limpiar campos de añadir ingrediente
  ['esc-sel-qty','esc-sel-merma','esc-libre-nombre','esc-libre-precio'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // Poblar proveedores
  const sel=document.getElementById('esc-sel-prov');
  sel.innerHTML='<option value="">-- Proveedor (opcional) --</option>';
  // Opción sub-elaboración
  const subOpt=document.createElement('option');
  subOpt.value='__subesc__'; subOpt.textContent='🔗 Sub-elaboración (otro escandallo)';
  sel.appendChild(subOpt);
  Object.entries(_escSupsCache).forEach(([pid,prov])=>{
    const o=document.createElement('option');
    o.value=pid; o.textContent=(prov.emoji||'')+(prov.name||pid);
    sel.appendChild(o);
  });
  escRenderIngs(); escRecalc();
  document.getElementById('esc-modal-ov').style.display='block';
  window.scrollTo(0,0);
  // Cargar elaboración y receta tras mostrar modal
  requestAnimationFrame(()=>{
    const elabEl=document.getElementById('esc-elab-texto');
    if(elabEl) elabEl.value=_escElab.texto||'';
    escRenderTemporada();
    escRenderSecciones();
  });
}
function escCloseModal(){
  document.getElementById('esc-modal-ov').style.display='none';
  _escEditId=null; _escIngs=[]; _escElab={texto:'',pasos:[]}; _escTemporada=[]; _escSecciones=[];
  const dw=document.getElementById('esc-detail-wrap'); if(dw) dw.style.display='none';
  const lw=document.getElementById('esc-list-wrap'); if(lw) lw.style.display='';
  escRender();
}
