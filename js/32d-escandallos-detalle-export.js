/* ═══════════════ ESCANDALLOS: EXPORTAR (PDF/Excel), IMPORTAR, BORRAR Y MIGRAR ═══════════════ */
// Toma los valores actuales del formulario del modal de edición y devuelve un
// objeto "e" con la misma forma que un escandallo guardado — así los helpers
// de PDF (escPdfSection/escPdfDoc, ya usados por la vista de detalle en 32a)
// pueden reutilizarse tal cual, sin duplicar 140 líneas de maquetación.
function _escBuildFromForm(){
  return {
    nombre:document.getElementById('esc-nombre')?.value.trim()||'Escandallo',
    tipo:document.getElementById('esc-tipo')?.value||'final',
    categoria:document.getElementById('esc-categoria')?.value||'',
    restaurante:document.getElementById('esc-local')?.value||'global',
    rendimiento:parseFloat(document.getElementById('esc-rend')?.value)||1,
    rendimientoUnidad:document.getElementById('esc-rend-unit')?.value||'rac.',
    precioVenta:parseFloat(document.getElementById('esc-pvp')?.value)||0,
    iva:parseFloat(document.getElementById('esc-iva')?.value)||0,
    foodCostObjetivo:parseFloat(document.getElementById('esc-fcobj')?.value)||30,
    notas:document.getElementById('esc-notas')?.value.trim()||'',
    ingredientes:_escIngs,
    elaboracion:_escElab||{texto:'',pasos:[]},
    recetaSecciones:_escSecciones||[]
  };
}

function escExportPDF(){
  const e=_escBuildFromForm();
  const w=window.open('','_blank');
  if(!w){ toast('Permite las ventanas emergentes para el PDF','#dc2626'); return; }
  w.document.write(escPdfDoc(e.nombre, escPdfSection(e,false)));
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 400);
}

function escExportExcel(){
  if(typeof XLSX==='undefined'){toast('Librería Excel no disponible','#dc2626');return;}
  const nombre=document.getElementById('esc-nombre')?.value.trim()||'Escandallo';
  const pvp=parseFloat(document.getElementById('esc-pvp')?.value)||0;
  const fcObj=parseFloat(document.getElementById('esc-fcobj')?.value)||30;
  const coste=_escIngs.reduce((s,i)=>s+escCosteFactor(i),0);
  const fcReal=pvp>0?(coste/pvp*100):null;

  const rows=[['Ingrediente','Proveedor','Cantidad','Unidad','Merma %','Precio/u. €','Coste real €']];
  _escIngs.forEach(ing=>{
    rows.push([
      ing.nombre,
      ing.proveedorNombre||'Libre',
      ing.cantidad,
      ing.unidad,
      parseFloat(ing.merma)||0,
      escLivePrice(ing),
      +escCosteFactor(ing).toFixed(4)
    ]);
  });
  rows.push([]);
  rows.push(['','','','','Coste total',coste,'']);
  rows.push(['','','','','PVP',pvp,'']);
  rows.push(['','','','','Food cost %',fcReal!==null?+(fcReal.toFixed(2)):'','']);
  rows.push(['','','','','FC objetivo %',fcObj,'']);
  rows.push(['','','','','Margen €',pvp>0?+(pvp-coste).toFixed(4):0,'']);

  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Escandallo');
  XLSX.writeFile(wb,(nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_'))+'.xlsx');
}

function escImportarJSON(){
  document.getElementById('esc-import-input')?.click();
}

function escProcesarImport(input){
  const file=input.files[0];
  if(!file){return;}
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  const reader=new FileReader();
  reader.onload=async function(e){
    let datos;
    try{ datos=JSON.parse(e.target.result); }
    catch(err){ toast('El archivo no es un JSON válido','#dc2626'); return; }
    if(!Array.isArray(datos)||!datos.length){ toast('El archivo no contiene escandallos','#dc2626'); return; }

    const existentes=new Set(Object.values(_escAllData||{}).map(x=>(x.nombre||'').toLowerCase().trim()));
    const nuevos=datos.filter(d=>!existentes.has((d.nombre||'').toLowerCase().trim()));
    const duplicados=datos.length-nuevos.length;

    if(!nuevos.length){
      toast(`Todos los escandallos ya existen (${duplicados} duplicados omitidos)`,'#d97706');
      input.value=''; return;
    }

    const msg=duplicados>0
      ?`Se van a importar ${nuevos.length} escandallos (${duplicados} ya existían y se omiten). ¿Continuar?`
      :`Se van a importar ${nuevos.length} escandallos. ¿Continuar?`;
    if(!confirm(msg)){input.value='';return;}

    let ok=0,errors=0;
    toast(`Importando ${nuevos.length} escandallos...`,'#2563eb');
    for(const esc of nuevos){
      try{
        esc.updatedAt=Date.now();
        if(!esc.createdAt) esc.createdAt=Date.now();
        await fbDb.ref('escandallos').push().set(esc);
        ok++;
      }catch(err){ errors++; console.error('Error importando',esc.nombre,err); }
    }
    input.value='';
    if(errors) toast(`Importados ${ok} escandallos (${errors} errores)`,'#d97706');
    else toast(`${ok} escandallos importados correctamente`,'#16a34a');
  };
  reader.readAsText(file);
}

function escExportTodos(){
  if(typeof XLSX==='undefined'){toast('Librería Excel no disponible','#dc2626');return;}
  const localFiltro=document.getElementById('esc-local-filter')?.value||'';
  let todos=Object.values(_escAllData||{});
  if(!todos.length){toast('No hay escandallos guardados','#dc2626');return;}
  if(localFiltro) todos=todos.filter(e=>(e.restaurante||'global')===localFiltro);
  if(!todos.length){toast('No hay escandallos para este local','#f59e0b');return;}

  // Ordenar por nombre
  todos.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es'));

  // Calcular coste con merma para cada escandallo
  function calcCoste(esc){
    return (esc.ingredientes||[]).reduce((s,ing)=>{
      // Precio vivo o guardado
      let p=parseFloat(ing.precioUnitario)||0;
      if(ing.proveedorId&&suppliers[ing.proveedorId]){
        const prod=(suppliers[ing.proveedorId].products||[]).find(x=>x.id===ing.productoId);
        if(prod) p=parseFloat(prod.price)||0;
      }
      const merma=parseFloat(ing.merma)||0;
      const factor=merma>0&&merma<100?1/(1-merma/100):1;
      return s+(parseFloat(ing.cantidad)||0)*p*factor;
    },0);
  }

  const ws_data=[
    ['PLATO','PRECIO COSTE + IVA','PRECIO VENTA OBJETIVO','%','PRECIO DE VENTA REAL','% REAL']
  ];
  todos.forEach((esc,i)=>{
    const row=i+2; // fila Excel (1 = cabecera)
    ws_data.push([
      esc.nombre||'',
      +calcCoste(esc).toFixed(4),
      {f:`B${row}*4`},       // precio objetivo (food cost 25%)
      {f:`B${row}/C${row}`}, // % food cost objetivo
      esc.precioVenta||0,
      {f:`IF(E${row}>0,B${row}/E${row},"")`} // % real
    ]);
  });

  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(ws_data);

  // Formato numérico para columnas %
  const range=XLSX.utils.decode_range(ws['!ref']);
  for(let r=1;r<=range.e.r;r++){
    const dCell=ws[XLSX.utils.encode_cell({r,c:3})]; // D
    const fCell=ws[XLSX.utils.encode_cell({r,c:5})]; // F
    if(dCell) dCell.z='0.00%';
    if(fCell) fCell.z='0.00%';
  }

  // Anchos de columna (en caracteres)
  ws['!cols']=[{wch:40},{wch:22},{wch:26},{wch:8},{wch:24},{wch:10}];

  XLSX.utils.book_append_sheet(wb,ws,'Escandallos');
  const fecha=new Date().toISOString().split('T')[0];
  const sufijo=localFiltro?'_'+localFiltro.replace(/[^a-zA-Z0-9]/g,'_'):'_todos';
  XLSX.writeFile(wb,`Escandallos${sufijo}_${fecha}.xlsx`);
  // PDF con todas las fichas (cada una en su página)
  const inner=todos.map((e,i)=>escPdfSection(e, i<todos.length-1)).join('');
  const w=window.open('','_blank');
  if(!w){ toast(`Excel exportado. Permite ventanas emergentes para el PDF.`,'#d97706',5000); return; }
  w.document.write(escPdfDoc('Escandallos '+fecha, inner));
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 600);
  toast(`${todos.length} escandallos exportados (Excel + PDF)`,'#16a34a',4000);
}

function escDelete(){
  if(!_escEditId||!confirm('¿Eliminar este escandallo?')) return;
  fbDb.ref('escandallos/'+_escEditId).remove().then(()=>{escCloseModal();toast('Escandallo eliminado','#888');});
}

/* ── Migrar recetas → escandallos ── */
async function escMigrarRecetas(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  if(!confirm('¿Fusionar todas las recetas en los escandallos?\n\nLas recetas con el mismo nombre se combinarán con su escandallo. Las que no tengan escandallo se crearán como nuevos escandallos.\n\nSe eliminarán todas las recetas de Firebase.')){return;}
  const [escSnap,recSnap]=await Promise.all([
    fbDb.ref('escandallos').once('value'),
    fbDb.ref('recetas').once('value')
  ]);
  const escandallos=escSnap.val()||{};
  const recetas=Object.entries(recSnap.val()||{});
  if(!recetas.length){toast('No hay recetas que migrar','#d97706');return;}
  const updates={};
  let migradas=0, nuevas=0;
  recetas.forEach(([rid,rec])=>{
    const nombre=(rec.nombre||'').toLowerCase().trim();
    // Buscar escandallo con mismo nombre
    const escEntry=Object.entries(escandallos).find(([,e])=>(e.nombre||'').toLowerCase().trim()===nombre);
    if(escEntry){
      const [eid]=escEntry;
      updates['escandallos/'+eid+'/temporada']=rec.temporada||[];
      updates['escandallos/'+eid+'/recetaSecciones']=rec.secciones||[];
      migradas++;
    } else {
      // Crear nuevo escandallo desde la receta
      const newKey=fbDb.ref('escandallos').push().key;
      updates['escandallos/'+newKey]={
        nombre:rec.nombre||'Sin nombre',
        categoria:rec.partida||'Otros',
        restaurante:'global',
        rendimiento:rec.rendimiento||1,
        rendimientoUnidad:rec.rendimientoUnidad||'rac.',
        precioVenta:0, iva:10, foodCostObjetivo:30,
        notas:'', alergenos:[],
        ingredientes:[],
        elaboracion:{texto:'',pasos:[]},
        temporada:rec.temporada||[],
        recetaSecciones:rec.secciones||[],
        createdAt:rec.createdAt||Date.now(),
        updatedAt:Date.now()
      };
      nuevas++;
    }
    updates['recetas/'+rid]=null; // borrar receta
  });
  await fbDb.ref().update(updates);
  toast(`Migración completa: ${migradas} fusionadas, ${nuevas} nuevas creadas`,'#16a34a');
}

/* ── Copiar escandallo para un local específico ── */
function escCopiarParaLocal(id){
  if(!_escAllData[id]){toast('Escandallo no encontrado','#dc2626');return;}
  const e=_escAllData[id];
  // Mostrar selector de local
  const rests=cfg.users.map(u=>u.restaurant);
  const sel=prompt('¿Para qué local?\n'+rests.map((r,i)=>`${i+1}. ${r}`).join('\n')+'\n\nEscribe el número:');
  if(!sel) return;
  const idx=parseInt(sel)-1;
  if(isNaN(idx)||idx<0||idx>=rests.length){toast('Local no válido','#dc2626');return;}
  const rest=rests[idx];
  if(!confirm(`¿Crear una copia de "${e.nombre}" para ${rest}?\nPodrás editarla de forma independiente.`)) return;
  const copia={...JSON.parse(JSON.stringify(e)),restaurante:rest,baseId:id,nombre:e.nombre+' ('+rest+')',createdAt:Date.now(),updatedAt:Date.now()};
  delete copia.id;
  fbDb.ref('escandallos').push(copia).then(()=>toast(`Copia creada para ${rest}`,'#16a34a')).catch(err=>toast('Error: '+err.message,'#dc2626'));
}
