/* ═══════════════ RECORTADOR ═══════════════ */
function showCropUI(){
  S.albCropping=true;
  render();
  setTimeout(initCropCanvas,80);
}
function cancelCrop(){ S.albCropping=false; render(); }
const CROP_HR=16; // radio de detección de tiradores (px)
function initCropCanvas(){
  const canvas=document.getElementById('crop-canvas');
  if(!canvas)return;
  const img=new Image();
  img.src=S.albPhoto;
  img.onload=()=>{
    const maxW=canvas.parentElement.clientWidth-4;
    const scale=Math.min(1,maxW/img.naturalWidth);
    canvas.width=img.naturalWidth*scale;
    canvas.height=img.naturalHeight*scale;
    canvas._scale=scale; canvas._img=img;
    const ctx=canvas.getContext('2d');
    // Selección inicial: recuadro centrado al 84% (ya puesto para solo ajustar)
    const mx=canvas.width*0.08, my=canvas.height*0.08;
    cropState={x1:mx,y1:my,x2:canvas.width-mx,y2:canvas.height-my,mode:'idle',handle:null,_mx:0,_my:0};
    drawOverlay(ctx,img,canvas.width,canvas.height);

    const pos=(e)=>{
      const r=canvas.getBoundingClientRect();
      const t=e.touches?e.touches[0]:e;
      return{x:Math.max(0,Math.min(canvas.width,t.clientX-r.left)),y:Math.max(0,Math.min(canvas.height,t.clientY-r.top))};
    };
    const handlePts=()=>{const{x1,y1,x2,y2}=cropState;const cx=(x1+x2)/2,cy=(y1+y2)/2;
      return{nw:[x1,y1],n:[cx,y1],ne:[x2,y1],e:[x2,cy],se:[x2,y2],s:[cx,y2],sw:[x1,y2],w:[x1,cy]};};
    const hitHandle=(p)=>{const hs=handlePts();for(const k in hs){if(Math.abs(p.x-hs[k][0])<CROP_HR&&Math.abs(p.y-hs[k][1])<CROP_HR)return k;}return null;};
    const inside=(p)=>p.x>cropState.x1&&p.x<cropState.x2&&p.y>cropState.y1&&p.y<cropState.y2;

    canvas.onmousedown=canvas.ontouchstart=(e)=>{
      e.preventDefault();const p=pos(e);const h=hitHandle(p);
      if(h){cropState.mode='resize';cropState.handle=h;}
      else if(inside(p)){cropState.mode='move';cropState._mx=p.x;cropState._my=p.y;}
      else{cropState.mode='new';cropState.x1=p.x;cropState.y1=p.y;cropState.x2=p.x;cropState.y2=p.y;}
    };
    canvas.onmousemove=canvas.ontouchmove=(e)=>{
      const p=pos(e);
      if(cropState.mode==='idle'){canvas.style.cursor=hitHandle(p)?'pointer':(inside(p)?'move':'crosshair');return;}
      e.preventDefault();
      if(cropState.mode==='new'){cropState.x2=p.x;cropState.y2=p.y;}
      else if(cropState.mode==='move'){
        const dx=p.x-cropState._mx,dy=p.y-cropState._my;
        let nx1=cropState.x1+dx,ny1=cropState.y1+dy,nx2=cropState.x2+dx,ny2=cropState.y2+dy;
        if(nx1<0){nx2-=nx1;nx1=0;} if(ny1<0){ny2-=ny1;ny1=0;}
        if(nx2>canvas.width){nx1-=(nx2-canvas.width);nx2=canvas.width;}
        if(ny2>canvas.height){ny1-=(ny2-canvas.height);ny2=canvas.height;}
        cropState.x1=nx1;cropState.y1=ny1;cropState.x2=nx2;cropState.y2=ny2;
        cropState._mx=p.x;cropState._my=p.y;
      }
      else if(cropState.mode==='resize'){
        const h=cropState.handle;
        if(h.includes('n'))cropState.y1=p.y; if(h.includes('s'))cropState.y2=p.y;
        if(h.includes('w'))cropState.x1=p.x; if(h.includes('e'))cropState.x2=p.x;
      }
      drawOverlay(ctx,img,canvas.width,canvas.height);
    };
    canvas.onmouseup=canvas.ontouchend=()=>{
      // normalizar para que x1<x2 e y1<y2 siempre
      const x1=Math.min(cropState.x1,cropState.x2),x2=Math.max(cropState.x1,cropState.x2);
      const y1=Math.min(cropState.y1,cropState.y2),y2=Math.max(cropState.y1,cropState.y2);
      cropState.x1=x1;cropState.y1=y1;cropState.x2=x2;cropState.y2=y2;
      cropState.mode='idle';
      drawOverlay(ctx,img,canvas.width,canvas.height);
    };
  };
}
function drawOverlay(ctx,img,w,h){
  ctx.drawImage(img,0,0,w,h);
  const x1=Math.min(cropState.x1,cropState.x2),y1=Math.min(cropState.y1,cropState.y2);
  const x2=Math.max(cropState.x1,cropState.x2),y2=Math.max(cropState.y1,cropState.y2);
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(0,0,w,h);
  if(x2>x1&&y2>y1){
    // mostrar nítida el área seleccionada
    ctx.drawImage(img,x1,y1,x2-x1,y2-y1,x1,y1,x2-x1,y2-y1);
    ctx.strokeStyle='#e94560';ctx.lineWidth=2;
    ctx.strokeRect(x1,y1,x2-x1,y2-y1);
    // tiradores (4 esquinas + 4 lados)
    const cx=(x1+x2)/2,cy=(y1+y2)/2;
    const pts=[[x1,y1],[cx,y1],[x2,y1],[x2,cy],[x2,y2],[cx,y2],[x1,y2],[x1,cy]];
    const s=6;
    pts.forEach(([px,py])=>{
      ctx.fillStyle='#fff';ctx.strokeStyle='#e94560';ctx.lineWidth=2;
      ctx.beginPath();ctx.rect(px-s,py-s,s*2,s*2);ctx.fill();ctx.stroke();
    });
  }
}
function applyCrop(){
  const canvas=document.getElementById('crop-canvas');
  if(!canvas){toast('Error al recortar','#dc2626');return;}
  const sc=canvas._scale||1;
  const x1=Math.min(cropState.x1,cropState.x2),y1=Math.min(cropState.y1,cropState.y2);
  const w=Math.abs(cropState.x2-cropState.x1),h=Math.abs(cropState.y2-cropState.y1);
  if(w<20||h<20){toast('Selecciona un área más grande','#dc2626');return;}
  const out=document.createElement('canvas');
  out.width=Math.round(w/sc); out.height=Math.round(h/sc);
  out.getContext('2d').drawImage(canvas._img,x1/sc,y1/sc,w/sc,h/sc,0,0,out.width,out.height);
  S.albPhoto=out.toDataURL('image/jpeg',0.95);
  S.albCropping=false;
  render();
  toast('Recorte aplicado — ahora pulsa Reconocer','#16a34a');
}

function handleAlbPhoto(input){
  const file=input.files[0];if(!file)return;
  const nameLow=file.name.toLowerCase();
  // Excel / CSV → parseo automático
  if(nameLow.endsWith('.xlsx')||nameLow.endsWith('.xls')||nameLow.endsWith('.csv')){
    handleAlbExcel(file);return;
  }
  // Imagen o PDF → base64 para Gemini/OCR
  const reader=new FileReader();
  reader.onload=e=>{
    S.albPhoto=e.target.result;
    S.albFileName=file.name;
    S.albFileType=file.type.startsWith('image')?'image':'pdf';
    render();
  };
  reader.readAsDataURL(file);
}

async function handleAlbExcel(file){
  try{
    if(!window.XLSX){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    if(!rows.length){toast('El archivo está vacío o no tiene filas con datos','#d97706');return;}
    const sample=rows[0];
    const findKey=(candidates)=>{
      for(const c of candidates){
        const k=Object.keys(sample).find(k=>k.toLowerCase().includes(c));
        if(k)return k;
      }
      return null;
    };
    const nameKey=findKey(['nombre','name','product','producto','artículo','articulo','descripci']);
    const qtyKey=findKey(['cantidad','qty','quantity','unidades','bultos','cajas','cant']);
    const unitKey=findKey(['unidad','unit','ud.','ud ','tipo']);
    const priceKey=findKey(['precio','price','importe','pvp','coste','costo']);
    if(!nameKey){toast('No se encontró columna de nombre de producto. Comprueba los encabezados del Excel.','#dc2626');return;}
    const parsed=rows.map(r=>({
      code:'',
      name:String(r[nameKey]||'').trim(),
      unit:unitKey?String(r[unitKey]||'KG').trim():'KG',
      qty:parseFloat(String(r[qtyKey]||'1').replace(',','.'))||1,
      price:parseFloat(String(r[priceKey]||'0').replace(',','.'))||0
    })).filter(r=>r.name);
    if(parsed.length){
      S.albItems=[...S.albItems,...parsed];
      toast(`${parsed.length} productos importados desde Excel. Revisa y corrige si es necesario.`,'#16a34a');
      render();
    } else {
      toast('No se encontraron filas con nombre de producto.','#d97706');
    }
  }catch(e){
    console.error(e);
    toast('Error al leer el Excel: '+e.message,'#dc2626');
  }
}
function albAddItem(){ S.albItems.push({code:'',name:'',unit:'KG',qty:1,price:0});render(); }
function albDelItem(i){ S.albItems.splice(i,1);render(); }

// Entry point: elige Mistral (si hay clave) o el fallback OCR.space.
// Refactorizado 19 ago 2026: antes era una función de 157 líneas con las tres
// ramas metidas dentro; ahora cada rama es su propia función pequeña.
async function runOCR(){
  if(!S.albPhoto){ toast('Añade una foto primero','#dc2626'); return; }
  const prog=document.getElementById('ocr-progress');
  const showProg=(msg)=>{ if(prog){ prog.style.display='block'; prog.textContent=msg; } };
  const hideProg=()=>{ if(prog) prog.style.display='none'; };

  const mistralKey=cfg.mistralKey||'';
  if(mistralKey){
    try{
      const isPdf=S.albFileType==='pdf';
      if(isPdf) await _runOCRMistralPDF(mistralKey, showProg);
      else await _runOCRMistralImage(mistralKey, showProg);
    }catch(e){
      console.error(e);
      toast('Error Mistral OCR: '+e.message,'#dc2626',5000);
    }finally{
      hideProg(); render();
    }
    return;
  }

  try{
    await _runOCRSpaceFallback(showProg);
  }catch(e){
    console.error(e);
    toast('Error de conexión con OCR. Comprueba tu internet.','#dc2626');
  }finally{
    hideProg(); render();
  }
}

// Construye el data-URI que Mistral pide para foto o PDF.
function _mistralDataUri(){
  const isPdf=S.albFileType==='pdf';
  const mediaType=isPdf?'application/pdf':(S.albPhoto.match(/data:([^;]+)/)||[])[1]||'image/jpeg';
  const base64=S.albPhoto.replace(/^data:[^;]+;base64,/,'');
  return `data:${mediaType};base64,${base64}`;
}

// Construye el prompt de extracción (con o sin catálogo del proveedor).
// supIdOverride: usado por la importación por lotes (js/48-import-dia.js),
// donde cada borrador tiene su propio proveedor y no hay uno "activo" en S.
function _mistralPrompt(supIdOverride){
  const _sup=suppliers[supIdOverride||S.albSupId]||{};
  const _cat=(Array.isArray(_sup.products)?_sup.products:Object.values(_sup.products||{}))
    .map(p=>({code:String(p.code||''),name:p.name,unit:p.unit||'UN',price:parseFloat(p.price||0)}));
  const catalogBlock=_cat.length
    ? `CATÁLOGO DEL PROVEEDOR "${_sup.name||''}" (empareja cada línea del albarán con UNO de estos productos por código o por nombre parecido; usa el NOMBRE y la UNIDAD EXACTOS del catálogo):
${_cat.map(p=>`- code:${p.code||'-'} | ${p.name} | ${p.unit} | ${p.price}€`).join('\n')}

Reglas de emparejamiento:
- Si una línea del albarán coincide con un producto del catálogo (mismo código, o nombre claramente equivalente aunque esté abreviado o con errores de OCR), usa el "name" y "unit" EXACTOS del catálogo y marca "matched":true.
- Solo la cantidad (qty) y el precio (price) se toman del albarán. Si el albarán no trae precio, usa el del catálogo.
- Si una línea NO está en el catálogo, inclúyela igual con "matched":false y el nombre tal como aparece.\n`
    : '';
  const promptText=`Eres un asistente que extrae líneas de productos de albaranes de proveedor.
${catalogBlock}Extrae TODOS los productos del albarán con su nombre, cantidad, unidad y precio unitario.
Las cantidades pueden estar en columnas tipo "UNID." (unidades/cajas) o "KG" (peso); usa la cantidad realmente entregada. El importe suele estar en la columna "BRUTO" o "IMPORTE".
Responde ÚNICAMENTE con un JSON, sin texto adicional, con esta forma:
{"items":[{"code":"12345","name":"Entrecot","qty":5,"unit":"KG","price":18.50,"matched":true}]}
- code: código del artículo si aparece, si no ""
- name: nombre del producto (sin códigos ni referencias)
- qty: cantidad numérica realmente entregada
- unit: "KG", "UN", "L", "Caja" o "Bote" según corresponda
- price: precio/importe unitario en €
- matched: true si coincide con el catálogo, false si no

Ignora líneas de totales, IVA, cabeceras, direcciones o textos que no sean productos.`;
  return { promptText, catalogSize:_cat.length };
}

// Parsea la respuesta del chat de Mistral en una lista de items normalizados.
function _mistralParseItems(rawContent){
  try{
    const obj=JSON.parse(rawContent);
    // El modelo puede devolver {items:[...]} o directamente [...]
    const arr=Array.isArray(obj)?obj:(obj.items||obj.products||obj.lineas||Object.values(obj).find(v=>Array.isArray(v))||[]);
    return arr.filter(it=>it.name&&it.qty>0).map(it=>({
      code:String(it.code||''),
      name:String(it.name).slice(0,60),
      qty:Math.round(parseFloat(it.qty)*100)/100,
      unit:it.unit||'UN',
      price:Math.round(parseFloat(it.price||0)*100)/100,
      matched:it.matched===true
    }));
  }catch(e){ console.warn('Parse error:',e); return []; }
}

// URL del Cloudflare Worker que hace de proxy a Mistral.
// Configurable desde admin1 → Settings → OCR. Si no está configurado se cae al
// fallback OCR.space. La API key de Mistral está en las Variables de Entorno
// del Worker (nunca en el cliente).
function _mistralProxyUrl(){
  return (cfg.mistralProxyUrl||'').replace(/\/$/,'');
}

// Llamada al chat de Mistral a través del proxy autenticado.
// El primer parámetro se ignora (antes era la API key en cliente) — ahora
// solo se manda el idToken de Firebase Auth y el proxy inyecta la key.
async function _mistralChat(_ignoredKey, chatBody){
  const proxyBase = _mistralProxyUrl();
  if(!proxyBase){
    throw new Error('Proxy OCR no configurado. Ve a Admin → Configuración → OCR para poner la URL del Worker.');
  }
  if(!fbAuth || !fbAuth.currentUser){
    throw new Error('Sesión Firebase requerida para usar el OCR.');
  }
  const idToken = await fbAuth.currentUser.getIdToken();
  const resp = await fetch(proxyBase + '/mistral/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + idToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(chatBody)
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    throw new Error(err?.detail || err?.error || err?.message || ('Error proxy Mistral ('+resp.status+')'));
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '[]';
}

// Publica los items detectados al carrito de albarán + toast de resultado.
function _publishOCRItems(parsed, catalogSize, diagText, rawContent){
  if(parsed.length>0){
    S.albItems=[...S.albItems,...parsed];
    const nMatch=parsed.filter(it=>it.matched).length;
    const detail=catalogSize?` (${nMatch} del catálogo)`:'';
    toast(`${parsed.length} producto${parsed.length!==1?'s':''} reconocido${parsed.length!==1?'s':''}${detail}. Revisa y corrige.`,'#16a34a');
    return;
  }
  // Mistral SÍ leyó texto pero la extracción no devolvió productos → mostrar diagnóstico
  toast('Mistral leyó el albarán pero no extrajo líneas. Pulsa para ver el texto leído.','#d97706',6000);
  if(confirm('Mistral analizó el albarán pero no consiguió sacar las líneas de producto.\n\n¿Quieres ver el detalle? (para diagnosticar)')){
    alert(((diagText||'')+'\n\n--- RESPUESTA IA ---\n'+(rawContent||'')).slice(0,1500)||'(vacío)');
  }
}

// Rama 1: imagen → visión directa (pixtral). Lee también las tablas que el
// OCR de texto deja como imagen.
async function _runOCRMistralImage(mistralKey, showProg){
  showProg('Leyendo el albarán con IA de visión...');
  const { promptText, catalogSize } = _mistralPrompt();
  const dataUri=_mistralDataUri();
  const chatBody={
    model:'pixtral-12b-2409',
    messages:[{role:'user',content:[{type:'text',text:promptText},{type:'image_url',image_url:dataUri}]}],
    response_format:{type:'json_object'}
  };
  const rawContent=await _mistralChat(mistralKey, chatBody);
  console.log('[OCR] Respuesta de visión (pixtral):\n',rawContent);
  const parsed=_mistralParseItems(rawContent);
  _publishOCRItems(parsed, catalogSize, '(imagen analizada directamente con visión)', rawContent);
}

// Rama 2: PDF → paso 1 Mistral OCR (texto), paso 2 mistral-medium (extracción).
async function _runOCRMistralPDF(mistralKey, showProg){
  showProg('Paso 1/2 — leyendo el PDF...');
  const { promptText, catalogSize } = _mistralPrompt();
  const dataUri=_mistralDataUri();
  const proxyBase = _mistralProxyUrl();
  if(!proxyBase) throw new Error('Proxy OCR no configurado.');
  if(!fbAuth || !fbAuth.currentUser) throw new Error('Sesión Firebase requerida.');
  const idToken = await fbAuth.currentUser.getIdToken();
  const ocrResp=await fetch(proxyBase+'/mistral/ocr',{
    method:'POST',
    headers:{'Authorization':'Bearer '+idToken,'Content-Type':'application/json'},
    body:JSON.stringify({model:'mistral-ocr-latest',document:{type:'document_url',document_url:dataUri}})
  });
  if(!ocrResp.ok){ const err=await ocrResp.json().catch(()=>({})); throw new Error(err?.detail||err?.error||err?.message||'Error Mistral OCR ('+ocrResp.status+')'); }
  const ocrData=await ocrResp.json();
  const markdown=(ocrData.pages||[]).map(p=>p.markdown||'').join('\n');
  console.log('[OCR] Texto leído del PDF:\n',markdown);
  if(!markdown.trim()){ toast('Mistral no leyó texto del PDF. Prueba con otra calidad.','#d97706',6000); return; }
  showProg('Paso 2/2 — extrayendo productos...');
  const chatBody={
    model:'mistral-medium-latest',
    messages:[{role:'user',content:`${promptText}\n\nTEXTO DEL ALBARÁN:\n${markdown}`}],
    response_format:{type:'json_object'}
  };
  const rawContent=await _mistralChat(mistralKey, chatBody);
  console.log('[OCR] Respuesta de extracción (mistral-medium):\n',rawContent);
  const parsed=_mistralParseItems(rawContent);
  _publishOCRItems(parsed, catalogSize, markdown, rawContent);
}

// ── Importación por lotes: 1 PDF con los albaranes de todo el día ──────────
// (UI en js/48-import-dia.js). Reutiliza el mismo proxy/Worker y las mismas
// funciones de extracción de arriba; solo añade un paso de OCR de todo el
// PDF + un paso de "split" que agrupa las páginas por albarán antes de
// extraer las líneas de cada uno.

// Paso 1: OCR de TODO el PDF de una vez, devuelve el markdown por página.
async function _mistralOcrPagesFromDataUri(dataUri){
  const proxyBase=_mistralProxyUrl();
  if(!proxyBase) throw new Error('Proxy OCR no configurado. Ve a Admin → Configuración → OCR.');
  if(!fbAuth||!fbAuth.currentUser) throw new Error('Sesión Firebase requerida para usar el OCR.');
  const idToken=await fbAuth.currentUser.getIdToken();
  const ocrResp=await fetch(proxyBase+'/mistral/ocr',{
    method:'POST',
    headers:{'Authorization':'Bearer '+idToken,'Content-Type':'application/json'},
    body:JSON.stringify({model:'mistral-ocr-latest',document:{type:'document_url',document_url:dataUri}})
  });
  if(!ocrResp.ok){ const err=await ocrResp.json().catch(()=>({})); throw new Error(err?.detail||err?.error||err?.message||'Error Mistral OCR ('+ocrResp.status+')'); }
  const ocrData=await ocrResp.json();
  return (ocrData.pages||[]).map(p=>p.markdown||'');
}

// Paso 2: agrupar páginas por albarán/proveedor con un prompt de texto.
function _batchSplitPrompt(pages){
  const pagesBlock=pages.map((md,i)=>`--- PÁGINA ${i} ---\n${md}`).join('\n\n');
  return `Eres un asistente que separa un PDF con VARIOS albaranes de proveedor distintos (escaneados uno detrás de otro) en bloques.
Cada página pertenece a un único albarán. Varias páginas SEGUIDAS pueden ser el mismo albarán si la tabla de productos continúa de una página a otra.
Agrupa las páginas por albarán, respetando el orden en que aparecen. No mezcles páginas de distintos proveedores en el mismo bloque.
Responde ÚNICAMENTE con un JSON, sin texto adicional, con esta forma:
{"albaranes":[{"paginas":[0,1],"proveedor":"nombre del proveedor tal como aparece en la cabecera del albarán","numero":"nº de albarán si aparece, si no \\"\\""}]}

${pagesBlock}`;
}
async function _mistralSplitPages(pages, mistralKey){
  if(pages.length<=1) return [{paginas:[0],proveedor:'',numero:''}];
  const chatBody={
    model:'mistral-medium-latest',
    messages:[{role:'user',content:_batchSplitPrompt(pages)}],
    response_format:{type:'json_object'}
  };
  try{
    const raw=await _mistralChat(mistralKey, chatBody);
    console.log('[OCR lote] Respuesta de split:\n',raw);
    const obj=JSON.parse(raw);
    const arr=Array.isArray(obj)?obj:(obj.albaranes||obj.items||Object.values(obj).find(v=>Array.isArray(v))||[]);
    const groups=arr.map(g=>({
      paginas:(g.paginas||g.pages||[]).map(n=>parseInt(n)).filter(n=>!isNaN(n)&&n>=0&&n<pages.length),
      proveedor:String(g.proveedor||g.supplier||'').trim(),
      numero:String(g.numero||g.numero_albaran||'').trim()
    })).filter(g=>g.paginas.length);
    if(!groups.length) throw new Error('sin grupos');
    return groups;
  }catch(e){
    console.warn('[OCR lote] No se pudo separar por proveedor, se trata cada página como un albarán aparte:',e);
    return pages.map((_,i)=>({paginas:[i],proveedor:'',numero:''}));
  }
}

// Empareja el nombre de proveedor detectado por la IA con uno ya dado de
// alta (por nombre normalizado, exacto o por inclusión). Vacío si no hay match.
function _matchSupplierByName(name){
  if(!name) return '';
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  const target=norm(name);
  if(!target) return '';
  const list=supList();
  let hit=list.find(s=>norm(s.name)===target);
  if(hit) return hit.id;
  hit=list.find(s=>norm(s.name).includes(target)||target.includes(norm(s.name)));
  return hit?hit.id:'';
}

// Paso 3: extraer las líneas de un bloque de páginas (mismo prompt/parser
// que la extracción individual, aquí con supId explícito).
async function _extractDraftItems(markdown, supId, mistralKey){
  const { promptText, catalogSize } = _mistralPrompt(supId);
  const chatBody={
    model:'mistral-medium-latest',
    messages:[{role:'user',content:`${promptText}\n\nTEXTO DEL ALBARÁN:\n${markdown}`}],
    response_format:{type:'json_object'}
  };
  const rawContent=await _mistralChat(mistralKey, chatBody);
  return { items:_mistralParseItems(rawContent), catalogSize };
}

// Orquestador: OCR del PDF completo → split por albarán → extracción de
// líneas de cada uno → deja los resultados en S.albBatchDrafts para revisar.
async function runAlbaranBatchImport(){
  if(!S.albBatchFile){ toast('Sube un PDF primero','#dc2626'); return; }
  const mistralKey=cfg.mistralKey||'';
  if(!mistralKey){ toast('Configura tu clave de Mistral en Admin → Configuración → OCR','#dc2626',6000); return; }
  S.albBatchProcessing=true; S.albBatchProgress='Leyendo el PDF...'; render();
  try{
    const pages=await _mistralOcrPagesFromDataUri(S.albBatchFile);
    if(!pages.length||!pages.join('').trim()){
      toast('No se pudo leer texto del PDF. Prueba con otro escaneo.','#d97706',6000);
      S.albBatchProcessing=false; render(); return;
    }
    S.albBatchProgress=pages.length>1?`Separando ${pages.length} páginas por albarán...`:'Extrayendo productos...';
    render();
    const groups=await _mistralSplitPages(pages, mistralKey);
    const drafts=[];
    for(let i=0;i<groups.length;i++){
      const g=groups[i];
      S.albBatchProgress=`Extrayendo albarán ${i+1}/${groups.length}...`; render();
      const md=g.paginas.map(p=>pages[p]||'').join('\n');
      const supId=_matchSupplierByName(g.proveedor);
      let items=[];
      try{
        const res=await _extractDraftItems(md, supId, mistralKey);
        items=res.items;
      }catch(e){ console.error('[OCR lote] Error extrayendo albarán '+i,e); }
      drafts.push({ id:uid(), pages:g.paginas, supNameRaw:g.proveedor, numero:g.numero, supId, items });
    }
    S.albBatchDrafts=drafts;
    S.albBatchProcessing=false;
    const nMatched=drafts.filter(d=>d.supId).length;
    toast(`${drafts.length} albarán${drafts.length!==1?'es':''} detectado${drafts.length!==1?'s':''} · ${nMatched} proveedor${nMatched!==1?'es':''} reconocido${nMatched!==1?'s':''}. Revisa antes de guardar.`,'#16a34a',6000);
    render();
  }catch(e){
    console.error(e);
    toast('Error al procesar el PDF: '+e.message,'#dc2626',6000);
    S.albBatchProcessing=false; render();
  }
}

// Rama 3: fallback OCR.space cuando no hay clave Mistral. Menos preciso — el
// parser local `parseOCRText` intenta extraer los productos de las líneas.
async function _runOCRSpaceFallback(showProg){
  const apiKey=cfg.ocrSpaceKey||'helloworld';
  showProg('Reconociendo texto...');
  const formData=new FormData();
  formData.append('base64Image', S.albPhoto);
  formData.append('language','spa');
  formData.append('OCREngine','2');
  formData.append('isTable','true');
  formData.append('scale','true');
  formData.append('detectOrientation','true');
  if(S.albFileType==='pdf') formData.append('filetype','PDF');
  const resp=await fetch('https://api.ocr.space/parse/image',{
    method:'POST',
    headers:{'apikey': apiKey},
    body:formData
  });
  const data=await resp.json();
  if(data.IsErroredOnProcessing||data.OCRExitCode===99){
    const msg=data.ErrorMessage?.[0]||'Error OCR';
    if(msg.includes('Limit')||msg.includes('apikey')||apiKey==='helloworld'){
      toast('Configura tu API key de Mistral en Configuración para mejor OCR','#d97706',7000);
    } else {
      toast('Error OCR: '+msg,'#dc2626');
    }
    return;
  }
  const text=(data.ParsedResults||[]).map(r=>r.ParsedText||'').join('\n');
  if(!text.trim()){ toast('No se reconoció texto. Prueba con foto más clara.','#d97706'); return; }
  const parsed=parseOCRText(text);
  if(parsed.length>0){
    S.albItems=[...S.albItems,...parsed];
    toast(`${parsed.length} producto${parsed.length!==1?'s':''} reconocido${parsed.length!==1?'s':''}. Revisa y corrige.`,'#16a34a');
  } else {
    toast('No se identificaron productos. Revisa la foto o añade manualmente.','#d97706');
  }
}

function parseOCRText(text){
  // Patterns to skip: headers, footers, totals, addresses, legal text
  const SKIP=/base\s*impon|i\.v\.a|importe\s*(total|bruto)|telf[eé]?f?|fax\.?:|www\.|n\.i\.f|c\.i\.f|f\.pedido|f\.entrega|referencia\s*del|preparado|firma|ruta\s*\d|caixe|informaci[oó]n|responsable|alergen|legitimaci|finalidad|mercabarna|import.export|direcci[oó]n|albar[aá]n\s*n|art\.\s*ref|mercancia|n\.\s*cient|kg\.\s*\/?\s*ca|08[0-9]{3}|cliente|c\.i\.f|nif:|10,00\s*%|%\s*de\s*r|sidoro|cami\s*de|palamos|girona\s*\)|barcelona\s*\)|llogitud|francesc|longitud/i;

  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.length>3);
  const items=[];

  lines.forEach(line=>{
    if(SKIP.test(line)) return;

    // Extract all decimal numbers from line
    const nums=[...line.matchAll(/(\d+[,\.]\d{1,2})/g)].map(m=>parseFloat(m[1].replace(',','.')));
    if(!nums.length) return;

    // Look for article code (3-5 digit number at start of line or after pipe)
    const codeMatch=line.match(/(?:^|\|)\s*(\d{3,5})\b/);
    const code=codeMatch?codeMatch[1]:'';

    // Remove pipe chars, leading code, and scientific names (2+ consecutive ALL_CAPS words ≥4 chars each)
    let name=line
      .replace(/\|/g,' ')
      .replace(/^\s*\d{3,5}\s*/,'')
      .replace(/\b([A-ZÁÉÍÓÚ]{4,})(\s+[A-ZÁÉÍÓÚ]{3,}){1,}\b/g,'')
      .replace(/\d+[,\.]\d+/g,'')
      .replace(/\s+/g,' ')
      .trim();

    // Require meaningful text (at least 3 alpha chars)
    if(name.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g,'').length < 3) return;

    // Determine qty and unit_price using qty*price=total relationship
    let qty=1, price=0, found=false;
    if(nums.length>=3){
      // Try all triplets: a*b≈c or a*c≈b or b*c≈a
      outer: for(let i=0;i<nums.length;i++){
        for(let j=i+1;j<nums.length;j++){
          const prod=nums[i]*nums[j];
          for(let k=0;k<nums.length;k++){
            if(k!==i&&k!==j&&Math.abs(nums[k]-prod)/Math.max(nums[k],0.01)<0.06){
              // nums[i]*nums[j]≈nums[k]: smallest of i,j is qty, other is price
              qty=Math.min(nums[i],nums[j]);
              price=Math.max(nums[i],nums[j]);
              // If qty looks like a price (>50) swap
              if(qty>50&&price<qty){[qty,price]=[price,qty];}
              found=true;
              break outer;
            }
          }
        }
      }
    }
    if(!found){
      if(nums.length>=2){ qty=nums[0]; price=nums[1]; }
      else { price=nums[0]; qty=1; }
    }

    // Sanity: skip totals/taxes (importe bruto etc)
    if(price<=0||price>5000||qty<=0||qty>2000) return;
    // Skip if name contains total-like words
    if(/importe|total|bruto|iva|i\.v\.a/i.test(name)) return;

    // Unit: decimal qty = KG, otherwise check line or default UN
    const unit=qty%1!==0?'KG':/\bkg\b|\bkgs\b|\bkilo/i.test(line)?'KG':'UN';

    items.push({
      code,
      name:name.slice(0,60),
      unit,
      qty:Math.round(qty*100)/100,
      price:Math.round(price*100)/100
    });
  });

  return items.slice(0,50);
}

// Crea un albarán: vincula/añade productos al catálogo del proveedor y lo
// guarda. La usan tanto el alta individual (saveAlbaran) como la revisión
// de la importación por lotes (js/48-import-dia.js, draftConfirm).
// Devuelve {ok:false,msg} si faltan datos, o {ok:true,nuevos,vinculados,actualizados}.
function commitAlbaran({restaurant,supId,date,items,photo,totalManual}){
  if(!restaurant) return {ok:false,msg:'Selecciona el restaurante'};
  if(!supId) return {ok:false,msg:'Selecciona el proveedor'};
  const valid=(items||[]).filter(it=>it.name&&it.qty>0).map(it=>({...it,iva:lineIvaFor(it,supId)}));
  if(!valid.length) return {ok:false,msg:'Añade al menos un producto con nombre y cantidad'};
  // Vincular/añadir productos del albarán al catálogo del proveedor por código
  let nuevos=0, vinculados=0, actualizados=0;
  const sup=suppliers[supId];
  if(sup){
    if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
    const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    valid.forEach(it=>{
      const code=String(it.code||'').trim();
      const nuevoPrecio=parseFloat(it.price||0)||0;
      const nuevoIva=lineIvaFor(it,supId);
      // 1º intentar casar por código; si no, por nombre
      let prod=code?sup.products.find(p=>String(p.code||'').trim()===code):null;
      if(!prod) prod=sup.products.find(p=>norm(p.name)===norm(it.name));
      if(prod){
        // Si casó por nombre y aún no tenía código, grabarle el del albarán → quedan vinculados
        if(code && String(prod.code||'').trim()!==code){ prod.code=code; vinculados++; }
        // Actualizar precio e IVA del producto existente con los del albarán
        if(nuevoPrecio>0 && parseFloat(prod.price||0)!==nuevoPrecio){ prod.price=nuevoPrecio; actualizados++; }
        if(it.unit) prod.unit=it.unit;
        prod.iva=nuevoIva;
      } else {
        sup.products.push({
          id:uid(),
          name:String(it.name).slice(0,60),
          unit:it.unit||'UN',
          price:nuevoPrecio,
          iva:nuevoIva,
          ...(code?{code}:{})
        });
        nuevos++;
      }
    });
    if(nuevos>0||vinculados>0||actualizados>0) saveSups(supId);
  }
  const a={id:uid(),restaurant,supId,date,photo:photo||null,items:valid,createdAt:new Date().toISOString(),...(totalManual!=null?{totalManual}:{})};
  saveAlb(a);
  return {ok:true,nuevos,vinculados,actualizados};
}

function saveAlbaran(){
  const rest=S.session&&!S.session.isAdmin?S.session.restaurant:(document.getElementById('alb-rest')?.value||S.albRestaurant);
  const supId=document.getElementById('alb-sup')?.value||S.albSupId;
  const date=document.getElementById('alb-date')?.value||S.albDate;
  const res=commitAlbaran({restaurant:rest,supId,date,items:S.albItems,photo:S.albPhoto,totalManual:S.albTotalManual});
  if(!res.ok){ toast(res.msg,'#dc2626'); return; }
  const msgParts=[];
  if(res.nuevos>0) msgParts.push(`${res.nuevos} nuevo${res.nuevos!==1?'s':''}`);
  if(res.vinculados>0) msgParts.push(`${res.vinculados} vinculado${res.vinculados!==1?'s':''} por código`);
  if(res.actualizados>0) msgParts.push(`${res.actualizados} precio${res.actualizados!==1?'s':''} actualizado${res.actualizados!==1?'s':''}`);
  toast(msgParts.length?`Albarán guardado · ${msgParts.join(' · ')} en catálogo`:'Albarán guardado','#16a34a');
  if(S.session&&S.session.isAdmin){ S.adminTab='albaranes';goAdmin(); } else goOrder();
}
