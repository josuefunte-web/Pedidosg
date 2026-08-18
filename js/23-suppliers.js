/* ═══════════════ SUPPLIER MGMT ═══════════════ */
function vSuppliers(){
  const curMonth=new Date().toISOString().slice(0,7);
  const curYear=new Date().toISOString().slice(0,4);
  const newF=S.editSupId==='new'?supForm(null):`<button class="btn btn-pri btn-sm" onclick="S.editSupId='new';render()" style="margin-bottom:14px">+ Añadir proveedor</button>`;
  const exportBtn=`<button class="btn btn-ghost btn-sm" onclick="exportExcel('all')" style="margin-bottom:14px;margin-left:8px">Exportar pedidos</button>`;
  const autoClasBtn=`<button class="btn btn-blue btn-sm" onclick="autoClasificarProductos(false)" style="margin-bottom:14px;margin-left:8px" title="Asigna categoría a los productos que no tienen ninguna, usando el nombre del producto">Clasificar productos automáticamente</button>`
    +`<button class="btn btn-ok btn-sm" onclick="reclasificarTodo()" style="margin-bottom:14px;margin-left:8px" title="Revisa TODOS los productos y corrige los que estén mal clasificados">Revisar y corregir todo</button>`;
  const list=supList().map(sup=>{
    if(!sup.products) sup.products=[];
    const open=S.openSupId===sup.id;
    const supOrders=orders.filter(o=>o.supId===sup.id&&o.status!=='rejected');
    const mesActual=supOrders.filter(o=>(o.createdAt||'').startsWith(curMonth)).reduce((s,o)=>s+total(o),0);
    const anoActual=supOrders.filter(o=>(o.createdAt||'').startsWith(curYear)).reduce((s,o)=>s+total(o),0);
    const balanceHtml=`<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">
      <span style="font-size:11px;background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:6px;font-weight:600">Este mes: ${fmt(mesActual)}</span>
      <span style="font-size:11px;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:6px;font-weight:600">Este año: ${fmt(anoActual)}</span>
    </div>`;
    return `<div class="sup-card"><div class="sc-hd"><div><div class="sc-name">${sup.emoji} ${sup.name}</div><div class="sc-info">${sup.products.length} productos · ${sup.phone||'Sin número'}</div>${balanceHtml}</div>
      <div class="sc-acts"><button class="btn btn-ghost btn-sm" onclick="S.openSupId=S.openSupId==='${sup.id}'?null:'${sup.id}';render()">${open?'▲ Cerrar':'Editar'}</button>
      <button class="btn btn-no btn-sm" onclick="delSup('${sup.id}')"></button></div></div>
      ${open?`<div class="sc-body">${supDetailForm(sup)}</div>`:''}
    </div>`;
  }).join('');
  return newF+exportBtn+autoClasBtn+list;
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
      const catSel=`<span style="display:inline-flex;align-items:center;gap:5px"><span style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.3px">Categoría</span><select title="Clasificación del producto" style="padding:4px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:12px;font-weight:600;background:var(--card);color:var(--txt)" onchange="editProdCat('${sid}','${p.id}',this.value)">${prodCatOpts(p.category||'Otros')}</select></span>`;
      const alerSel=ALERGENOS.map(a=>`<label style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--mut);cursor:pointer;margin:1px 3px 1px 0;padding:1px 5px;border-radius:4px;background:${(p.alergenos||[]).includes(a.id)?'#fff3cd':'var(--srf)'};border:1px solid ${(p.alergenos||[]).includes(a.id)?'#ffc107':'var(--brd)'}"><input type="checkbox" ${(p.alergenos||[]).includes(a.id)?'checked':''} onchange="toggleProdAlergeno('${sid}','${p.id}','${a.id}',this.checked)" style="width:11px;height:11px;accent-color:#d97706"> ${a.label}</label>`).join('');
      return `<div class="prod-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="prod-info" style="width:100%">
          <div class="prod-name-t">${p.name}</div>
          <div style="display:flex;gap:5px;align-items:center;margin-top:5px;flex-wrap:wrap">
            ${catSel}
            <select style="padding:3px 6px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" onchange="editProdUnit('${sid}','${p.id}',this.value)">${unitOpts}</select>
            <input type="number" value="${parseFloat(p.price||0).toFixed(2)}" step="0.01" min="0" title="Precio €" style="width:80px;padding:4px 8px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="editProdPrice('${sid}','${p.id}',this.value)"/>
            <span style="font-size:12px;color:var(--mut)">€</span>
            <input type="number" value="${p.pesoGr||''}" step="1" min="0" placeholder="gr" title="Peso gr" style="width:60px;padding:4px 8px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="editProdGr('${sid}','${p.id}',this.value)"/>
            <span style="font-size:12px;color:var(--mut)">gr</span>
            <button class="btn btn-no btn-xs" onclick="delProd('${sid}','${p.id}')">Eliminar</button>
          </div>
          <div style="margin-top:6px;font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">Alérgenos</div>
          <div style="display:flex;flex-wrap:wrap">${alerSel}</div>
          <div style="margin-top:8px;font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Conversiones de unidad</div>
          <div id="conv-list-${sid}-${p.id}">${renderConvRows(sid,p)}</div>
          <button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="addProdConv('${sid}','${p.id}')">+ Añadir conversión</button>
        </div>
      </div>`;
    }).join('');
    const _cc=catColor(cat);
    return `<div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:6px 0 4px;border-bottom:2px solid ${_cc}40;margin-bottom:6px;display:flex;align-items:center;gap:6px;color:${_cc}">${catDot(cat)} ${cat} <span style="font-weight:400;opacity:.6;color:var(--mut)">(${byCat[cat].length})</span></div>
      ${rows}
    </div>`;
  }).join('');
  return `<div class="sh">Información del proveedor</div>
  <div class="two-col">
    <div class="fg"><label>Nombre</label><input type="text" id="sf-name-${sid}" value="${sup.name}" placeholder="Bencar"/></div>
    <div class="fg"><label>Emoji</label><input type="text" id="sf-emoji-${sid}" value="${sup.emoji}" maxlength="4"/></div>
    <div class="fg" style="grid-column:1/-1"><label>WhatsApp (sin + ni espacios)</label><input type="tel" id="sf-phone-${sid}" value="${sup.phone||''}" placeholder="34612345678"/></div>
    <div class="fg"><label>Orden (posición en la lista)</label><input type="number" id="sf-orden-${sid}" value="${sup.orden??''}" min="1" step="1" placeholder="1, 2, 3..."/></div>
  </div>
  <button class="btn btn-pri btn-sm" onclick="saveSup2('${sid}')">✓ Guardar cambios</button>
  ${sup.products.length?`<div style="margin-top:18px;background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:12px 14px">
    <div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Clasificar todo el proveedor</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Pon la misma categoría a los ${sup.products.length} productos de golpe (p.ej. si este proveedor solo trae carne). Luego puedes cambiar los productos sueltos uno a uno.</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="sup-bulk-cat-${sid}" style="padding:6px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;font-weight:600;background:var(--card);color:var(--txt)">${prodCatOpts('')}</select>
      <button class="btn btn-ok btn-sm" onclick="clasificarProveedorTodo('${sid}')">Aplicar a todos</button>
    </div>
  </div>`:''}
  <div class="sh" style="margin-top:20px">Productos (${sup.products.length}) por categoría</div>
  ${sup.products.length>6?`<input type="text" placeholder="Buscar producto..." oninput="filterSupProds(this.value,'sdp-list-${sid}')" style="width:100%;padding:8px 12px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;margin-bottom:10px;background:#fff;color:var(--txt);outline:none;transition:border-color .15s" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>`:``}
  ${!sup.products.length?`<div style="color:var(--mut);font-size:13px;text-align:center;margin:8px 0 12px">Sin productos aún — añade el primero abajo</div>`:''}
  <div id="sdp-list-${sid}">${prodsHtml}</div>
  <div class="sh" style="margin-top:16px">Añadir nuevo producto</div>
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr 80px;gap:8px;margin-bottom:8px">
    <div class="fg" style="margin:0"><label>Nombre</label><input type="text" id="pf-name-${sid}" placeholder="Entrecot..."/></div>
    <div class="fg" style="margin:0"><label>Categoría</label><select id="pf-cat-${sid}">${prodCatOpts('')}</select></div>
    <div class="fg" style="margin:0"><label>Unidad</label><select id="pf-unit-${sid}"><option>KG</option><option>g</option><option>UN</option><option>L</option><option>Caja</option><option>Bote</option></select></div>
    <div class="fg" style="margin:0"><label>Precio €</label><input type="number" id="pf-price-${sid}" placeholder="12.50" step="0.01" min="0"/></div>
  </div>
  <button class="btn btn-ok btn-sm" onclick="addProd('${sid}')">+ Añadir producto</button>
  <div class="sh" style="margin-top:20px">Limpiar nombres de productos</div>
  <div style="font-size:13px;color:var(--mut);margin-bottom:8px">Elimina sufijos de formato (75cl, x6, CAJ, BOT…) de todos los nombres ya importados.</div>
  <button class="btn btn-ghost btn-sm" onclick="cleanSupProdNames('${sid}')">Limpiar nombres de este proveedor</button>
  <div id="sup-clean-status-${sid}" style="font-size:13px;margin-top:6px;color:var(--mut)"></div>
  <div class="sh" style="margin-top:20px">Importar tarifa desde archivo</div>
  <div style="font-size:13px;color:var(--mut);margin-bottom:10px">Sube un Excel (.xlsx/.csv) o PDF con la tarifa del proveedor y se importarán todos los productos automáticamente.</div>
  <div class="file-input-wrap" style="max-width:360px">
    <div class="file-input-btn" style="padding:12px">Subir Excel o PDF de tarifa</div>
    <input type="file" accept=".xlsx,.xls,.csv,application/pdf,.pdf" onchange="importSupTarifa('${sid}',this)"/>
  </div>
  <div id="sup-import-status-${sid}" style="font-size:13px;margin-top:8px;color:var(--mut)"></div>
  <div class="sh" style="margin-top:20px">Visibilidad por local</div>
  <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Desmarca los locales que <strong>no</strong> deben ver este proveedor</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
    ${cfg.users.map(u=>{const dis=(sup.disabledFor||[]).includes(u.id);return`<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;background:${dis?'var(--srf)':'transparent'};border:1px solid ${dis?'var(--brd)':'transparent'}"><input type="checkbox" ${!dis?'checked':''} onchange="toggleSupVisibility('${sup.id}','${u.id}',this.checked)"/><span style="font-size:13px;${dis?'color:var(--mut)':''}">${dis?'':''} ${u.restaurant}</span></label>`;}).join('')}
  </div>`;
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
function delSup(id){ if(!confirm('¿Eliminar proveedor?'))return;delete suppliers[id];if(fbDb) fbDb.ref('suppliers/'+id).remove();localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));render(); }

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
      // Refrescar lista de productos sin cerrar el panel
      const listEl = document.getElementById('sdp-list-'+sid);
      if(listEl){
        const _U=['KG','L','UN','Caja','Bote','Bolsa','g'];
        listEl.innerHTML = (sup.products||[]).map(p=>{
          const unitOpts=_U.map(u=>`<option${(p.unit||'KG')===u?' selected':''}>${u}</option>`).join('');
          return `<div class="prod-row"><div class="prod-info" style="flex:1"><div class="prod-name-t">${p.name}</div><div style="display:flex;gap:5px;align-items:center;margin-top:5px;flex-wrap:wrap"><select style="padding:3px 6px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" onchange="editProdUnit('${sid}','${p.id}',this.value)">${unitOpts}</select><input type="number" value="${parseFloat(p.price||0).toFixed(2)}" step="0.01" min="0" title="Precio €" style="width:80px;padding:4px 8px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="editProdPrice('${sid}','${p.id}',this.value)"/><span style="font-size:12px;color:var(--mut)">€</span><input type="number" value="${p.pesoGr||''}" step="1" min="0" placeholder="gr" title="Peso en gramos" style="width:66px;padding:4px 8px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="editProdGr('${sid}','${p.id}',this.value)"/><span style="font-size:12px;color:var(--mut)">gr</span></div></div><button class="btn btn-no btn-xs" style="align-self:center" onclick="delProd('${sid}','${p.id}')">✕</button></div>`;
        }).join('');
      }
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
  const category=document.getElementById('pf-cat-'+sid)?.value||'Otros';
  const unit=document.getElementById('pf-unit-'+sid)?.value;
  const price=parseFloat(document.getElementById('pf-price-'+sid)?.value);
  const grRaw=document.getElementById('pf-gr-'+sid)?.value;
  const pesoGr=grRaw&&!isNaN(parseInt(grRaw))?parseInt(grRaw):undefined;
  if(!name||isNaN(price)||price<0){toast('Nombre y precio obligatorios','#dc2626');return;}
  const prod={id:'p'+uid(),name,unit:unit||'KG',price,category};
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
function renderConvRows(sid,p){
  const convs=p.conversions||[];
  if(!convs.length) return `<span style="font-size:12px;color:var(--mut)">Sin conversiones</span>`;
  const unitOpts=_U.map(u=>`<option>${u}</option>`).join('');
  return convs.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--mut)">1</span>
      <select style="padding:3px 6px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" onchange="editConvUnit('${sid}','${p.id}',${i},this.value)">${_U.map(u=>`<option${(c.fromUnit||'Caja')===u?' selected':''}>${u}</option>`).join('')}</select>
      <span style="font-size:12px;color:var(--mut)">=</span>
      <input type="number" value="${c.factor||''}" step="0.001" min="0" placeholder="9" style="width:70px;padding:3px 7px;border:1px solid var(--brd);border-radius:6px;font-size:13px" onchange="editConvFactor('${sid}','${p.id}',${i},this.value)"/>
      <span style="font-size:12px;color:var(--mut)">${p.unit||'KG'}</span>
      <button class="btn btn-ghost btn-xs" onclick="invertProdConv('${sid}','${p.id}',${i})" title="Invertir conversión">⇄ Invertir</button>
      <button class="btn btn-no btn-xs" onclick="delProdConv('${sid}','${p.id}',${i})">✕</button>
    </div>`).join('');
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
  const rows=container.querySelectorAll('.prod-row');
  const q=term.toLowerCase().trim();
  rows.forEach(r=>{
    const name=(r.querySelector('.prod-name-t')?.textContent||'').toLowerCase();
    r.style.display=(!q||name.includes(q))?'':'none';
  });
}
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
