/* ═══════════════ OCR DE ALBARANES ═══════════════
   Flujo:
     1. Imagen/PDF → reducción en cliente (solo imágenes)
     2. Mistral OCR  → texto en markdown con las tablas
     3. LLM          → JSON {cabecera, líneas}
     4. Validación aritmética (cantidad × precio = importe) + emparejado con
        el catálogo del proveedor, hecho en cliente (no se manda el catálogo).
     Respaldo: si 2 o 3 no dan líneas y es una imagen, visión directa.
   Todas las llamadas pasan por el Worker (cfg.mistralProxyUrl), que inyecta la
   clave de Mistral. Los nombres de modelo viven aquí: si Mistral renombra uno,
   solo hay que tocar OCR_MODELS.
   El resultado está normalizado y es reutilizable por el módulo de recepciones
   (cada línea lleva source/confidence/flags para que el usuario solo confirme). */

const OCR_MODELS={
  ocr:'mistral-ocr-latest',
  extract:['mistral-medium-latest','mistral-small-latest'],
  vision:['mistral-small-latest','pixtral-large-latest']
};
const OCR_IMG={maxSide:1800,quality:0.8};
const OCR_MAX_PDF_BYTES=15*1024*1024;

class OcrError extends Error{
  constructor(code,message,hint){ super(message); this.name='OcrError'; this.code=code; this.hint=hint||''; }
}

/* ───────── Utilidades puras (se prueban en node) ───────── */

// "1.234,56" · "12,5" · "12.350" · "3,20 €" → número. null si no es número.
function ocrNum(v){
  if(v==null||v==='') return null;
  if(typeof v==='number') return isFinite(v)?v:null;
  let s=String(v).replace(/eur/gi,'').replace(/[^\d,.\-]/g,'');
  if(!s||s==='-') return null;
  const lc=s.lastIndexOf(','), ld=s.lastIndexOf('.');
  if(lc>-1&&ld>-1){
    if(lc>ld) s=s.replace(/\./g,'').replace(',','.'); // 1.234,56
    else s=s.replace(/,/g,'');                         // 1,234.56
  } else if(lc>-1){
    s=s.replace(/,/g,'.');                             // 12,5
    if(s.indexOf('.')!==s.lastIndexOf('.')) s=s.replace(/\./g,'');
  } else if(ld>-1 && s.indexOf('.')!==ld){
    s=s.replace(/\./g,'');                             // 1.234.567
  }
  const n=parseFloat(s);
  return isFinite(n)?n:null;
}
function ocrNormUnit(u){
  const s=String(u==null?'':u).toLowerCase().replace(/[^a-záéíóúñ]/g,'');
  if(!s) return null;
  if(/^(kg|kgs|kilo|kilos|kgr|k)$/.test(s)) return 'KG';
  if(/^(l|lt|lts|litro|litros)$/.test(s)) return 'L';
  if(/^(g|gr|grs|gramo|gramos)$/.test(s)) return 'g';
  if(/^(ud|uds|un|und|unds|unid|unidad|unidades|uni|u|pz|pza|pieza|piezas)$/.test(s)) return 'UN';
  if(/^(caja|cajas|cj|cja|cajon)$/.test(s)) return 'Caja';
  if(/^(bote|botes)$/.test(s)) return 'Bote';
  if(/^(bolsa|bolsas|bls)$/.test(s)) return 'Bolsa';
  return null;
}
function ocrFold(s){
  return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function _ocrTokens(s){
  return ocrFold(s).split(' ').filter(t=>t.length>1);
}
// Palabras iguales o que solo difieren en el plural (tomate/tomates, limon/limones).
function _ocrTokEq(a,b){
  return a===b||a+'s'===b||b+'s'===a||a+'es'===b||b+'es'===a;
}
// Similitud 0..1 entre dos nombres de producto (Dice sobre palabras + contención).
function ocrSim(a,b){
  const A=Array.from(new Set(_ocrTokens(a))), B=Array.from(new Set(_ocrTokens(b)));
  if(!A.length||!B.length) return 0;
  const used=new Set(); let inter=0;
  A.forEach(t=>{ const j=B.findIndex((u,i)=>!used.has(i)&&_ocrTokEq(t,u)); if(j>=0){ used.add(j); inter++; } });
  const dice=2*inter/(A.length+B.length);
  const contained=inter===Math.min(A.length,B.length)&&Math.min(A.length,B.length)>=2;
  return contained?Math.max(dice,0.85):dice;
}
function _ocrCodeKey(c){ return String(c==null?'':c).trim().toLowerCase().replace(/^0+(?=.)/,''); }
// Empareja una línea con el catálogo: primero por código exacto, luego por nombre.
function ocrMatchProduct(line,products){
  const list=Array.isArray(products)?products:Object.values(products||{});
  const code=_ocrCodeKey(line.code);
  if(code.length>=2){
    const p=list.find(x=>x&&_ocrCodeKey(x.code)===code);
    if(p) return {product:p,score:1,by:'codigo'};
  }
  let best=null,bs=0;
  list.forEach(p=>{
    if(!p||!p.name) return;
    const s=ocrSim(line.name,p.name);
    if(s>bs){ bs=s; best=p; }
  });
  return (best&&bs>=0.6)?{product:best,score:Math.round(bs*100)/100,by:'nombre'}:null;
}

// Extrae el primer objeto/array JSON de una respuesta, aunque venga con ```json o texto alrededor.
function ocrParseJson(raw){
  if(raw==null) return null;
  if(typeof raw==='object') return raw;
  let s=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  try{ return JSON.parse(s); }catch(e){}
  const open=s.search(/[\[{]/);
  if(open<0) return null;
  const openCh=s[open], closeCh=openCh==='{'?'}':']';
  let depth=0,inStr=false,esc=false;
  for(let i=open;i<s.length;i++){
    const c=s[i];
    if(inStr){ if(esc) esc=false; else if(c==='\\') esc=true; else if(c==='"') inStr=false; continue; }
    if(c==='"') inStr=true;
    else if(c===openCh) depth++;
    else if(c===closeCh){ depth--; if(depth===0){ try{ return JSON.parse(s.slice(open,i+1)); }catch(e){ return null; } } }
  }
  return null;
}
function _ocrPick(o,keys){
  for(const k of keys){ if(o[k]!=null&&o[k]!=='') return o[k]; }
  return null;
}
function ocrNormDate(v){
  if(!v) return null;
  const s=String(v).trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let y,mo,d;
  if(m){ y=+m[1]; mo=+m[2]; d=+m[3]; }
  else{
    m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if(!m) return null;
    d=+m[1]; mo=+m[2]; y=+m[3]; if(y<100) y+=2000;
  }
  if(mo<1||mo>12||d<1||d>31||y<2020||y>2100) return null;
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}

// Convierte la respuesta cruda del LLM en {header, lines} con claves canónicas.
function ocrNormalizeExtraction(parsed){
  if(!parsed) return null;
  const root=Array.isArray(parsed)?{lines:parsed}:parsed;
  const rawLines=_ocrPick(root,['lines','items','products','lineas','líneas','productos'])
    ||Object.values(root).find(v=>Array.isArray(v))||[];
  const header={
    supplier:_ocrPick(root,['supplier','proveedor'])||null,
    number:_ocrPick(root,['albaranNumber','number','numero','número','albaran'])||null,
    date:ocrNormDate(_ocrPick(root,['date','fecha'])),
    base:ocrNum(_ocrPick(root,['baseAmount','base','baseImponible'])),
    total:ocrNum(_ocrPick(root,['totalAmount','total']))
  };
  const JUNK=/^\s*(total|base\s*imponible|i\.?v\.?a\.?|suma|subtotal|importe\s*(total|bruto)|recargo|portes?)\b/i;
  const lines=[];
  (Array.isArray(rawLines)?rawLines:[]).forEach(r=>{
    if(!r||typeof r!=='object') return;
    const name=String(_ocrPick(r,['description','name','descripcion','descripción','producto','articulo','artículo'])||'').replace(/\s+/g,' ').trim();
    if(!name||JUNK.test(name)) return;
    lines.push({
      code:String(_ocrPick(r,['code','codigo','código','ref','referencia'])||'').trim(),
      name:name.slice(0,80),
      qty:ocrNum(_ocrPick(r,['qty','cantidad','quantity'])),
      unit:ocrNormUnit(_ocrPick(r,['unit','unidad','ud'])),
      price:ocrNum(_ocrPick(r,['price','precio','unitPrice','precioUnitario'])),
      amount:ocrNum(_ocrPick(r,['amount','importe','total','bruto'])),
      discountPct:ocrNum(_ocrPick(r,['discountPct','dto','descuento']))
    });
  });
  return {header,lines};
}

const OCR_FLAG_TEXT={
  'importe-no-cuadra':'cantidad × precio no coincide con el importe: revísalo',
  'precio-calculado':'precio calculado a partir del importe',
  'cantidad-calculada':'cantidad calculada a partir del importe',
  'sin-cantidad':'no se leyó la cantidad',
  'sin-precio':'sin precio en el albarán'
};
const _ocrR=(n,d)=>{ const f=Math.pow(10,d); return Math.round(n*f)/f; };
const _ocrClose=(a,b)=>Math.abs(a-b)<=Math.max(0.02,0.02*Math.abs(b));

// Comprueba y, si se puede, corrige una línea con la relación cantidad × precio = importe.
function ocrValidateLine(l){
  const flags=[];
  let qty=l.qty, price=l.price, unit=l.unit;
  const amount=l.amount;
  const k=(l.discountPct>0&&l.discountPct<100)?1-l.discountPct/100:1;
  let conf='alta', hint='';
  const hasQ=qty>0, hasP=price>0, hasA=amount>0;
  if(hasQ&&hasP&&hasA){
    if(!_ocrClose(qty*price*k,amount)){
      const implied=_ocrR(amount/(price*k),3);
      flags.push('importe-no-cuadra'); conf='baja';
      if(implied>0&&implied<5000) hint='el importe equivale a '+implied+' '+(unit==='L'?'L':'kg')+' a '+price+' €: ¿es el peso real?';
    }
  } else if(hasQ&&hasA&&!hasP){
    price=_ocrR(amount/(qty*k),4); flags.push('precio-calculado'); conf='media';
  } else if(hasP&&hasA&&!hasQ){
    qty=_ocrR(amount/(price*k),3); flags.push('cantidad-calculada'); conf='media';
  } else if(!hasQ){
    flags.push('sin-cantidad'); conf='baja';
  } else if(!hasP){
    flags.push('sin-precio'); conf='media';
  } else conf='media'; // cantidad y precio, sin importe que contrastar
  return {qty:qty>0?qty:0, price:price>0?price:0, unit, flags, confidence:conf, hint};
}

// Contrasta la suma de las líneas con la base/total de la cabecera.
function ocrCheckDocument(header,lines){
  const sum=lines.reduce((s,l)=>s+(l.amount>0?l.amount:(l.qty*l.price)||0),0);
  const warnings=[];
  if(sum<=0) return {sum:0,warnings};
  if(header.base>0){
    if(!_ocrClose(sum,header.base)) warnings.push('La suma de las líneas ('+_ocrR(sum,2).toFixed(2)+' €) no coincide con la base imponible del albarán ('+_ocrR(header.base,2).toFixed(2)+' €). Puede faltar o sobrar alguna línea.');
  } else if(header.total>0){
    const okNoVat=_ocrClose(sum,header.total);
    const okVat=[1.04,1.07,1.10,1.21].some(f=>_ocrClose(sum*f,header.total))||
      (header.total>sum && header.total<sum*1.30);
    if(!okNoVat&&!okVat) warnings.push('La suma de las líneas ('+_ocrR(sum,2).toFixed(2)+' €) no encaja con el total del albarán ('+_ocrR(header.total,2).toFixed(2)+' €). Puede faltar o sobrar alguna línea.');
  }
  return {sum,warnings};
}

// Resultado final: líneas validadas + emparejadas + advertencias.
function ocrBuildResult(extraction,products,meta){
  const lines=extraction.lines.map(l=>{
    const v=ocrValidateLine(l);
    const m=ocrMatchProduct(l,products);
    const notes=v.flags.map(f=>OCR_FLAG_TEXT[f]).filter(Boolean);
    if(v.hint) notes.push(v.hint);
    return {
      code:l.code,
      name:l.name,
      qty:v.qty,
      unit:v.unit||(m&&m.product.unit?ocrNormUnit(m.product.unit)||m.product.unit:null)||'UN',
      price:v.price,
      amount:l.amount>0?l.amount:null,
      matched:m?{id:m.product.id||null,name:m.product.name,unit:m.product.unit||null,price:parseFloat(m.product.price)||0,score:m.score,by:m.by}:null,
      confidence:v.confidence,
      flags:v.flags,
      notes,
      source:'ocr'
    };
  });
  const chk=ocrCheckDocument(extraction.header,lines);
  return {header:extraction.header,lines,warnings:chk.warnings,sum:chk.sum,meta:meta||{}};
}

/* ───────── Prompts ───────── */
const OCR_SYSTEM=`Eres un extractor de datos de albaranes de proveedores de hostelería en España (castellano y catalán).
Recibes el texto de un albarán y devuelves SOLO un JSON, sin texto adicional, con esta forma exacta:
{"supplier":string|null,"albaranNumber":string|null,"date":"YYYY-MM-DD"|null,"baseAmount":number|null,"totalAmount":number|null,
 "lines":[{"code":string|null,"description":string,"qty":number|null,"unit":"KG"|"UN"|"L"|"Caja"|"Bote"|"Bolsa"|null,"price":number|null,"discountPct":number|null,"amount":number|null}]}
Reglas:
- Una entrada de "lines" por cada artículo del albarán. No incluyas totales, base imponible, IVA, portes, direcciones ni cabeceras.
- qty = cantidad realmente servida en la unidad en la que se factura el precio. Si el precio es €/kg, qty son los kg (no las cajas ni las unidades).
- price = precio unitario sin IVA. amount = importe de la línea (columna IMPORTE/BRUTO/TOTAL de la línea).
- Los números en JSON con punto decimal ("12,50" → 12.5; "1.234,56" → 1234.56).
- Si un dato no se lee con claridad, pon null. No inventes datos ni completes líneas que no aparezcan.
- Si hay varios albaranes en el mismo texto, extrae todas las líneas.`;
const OCR_USER_VISION='Extrae los datos de este albarán siguiendo las instrucciones. Responde solo con el JSON.';

/* ───────── Red ───────── */
function _ocrBase(){ return ((typeof cfg!=='undefined'&&cfg.mistralProxyUrl)||'').trim().replace(/\/+$/,''); }

function _ocrHttpError(status,body){
  const code=body&&body.error;
  let detail=(body&&(body.detail||body.message))||code||'';
  if(typeof detail!=='string') detail=JSON.stringify(detail).slice(0,200);
  if(code==='missing_auth'||code==='invalid_auth') return new OcrError('auth','El servidor de OCR no ha aceptado tu sesión.','Cierra sesión y vuelve a entrar. Si sigue igual, FIREBASE_API_KEY del Worker no es la del proyecto.');
  if(code==='server_misconfigured') return new OcrError('worker','Al Worker le falta la clave de Mistral.','Añade el secret MISTRAL_API_KEY (y FIREBASE_API_KEY) en el Worker de Cloudflare.');
  if(status===401||status===403) return new OcrError('clave','Mistral ha rechazado la clave del Worker.','Revisa que MISTRAL_API_KEY sea válida y tenga saldo.');
  if(status===404) return new OcrError('worker','No se encuentra el servicio OCR.','Comprueba la URL del Worker en Configuración (sin "/" final ni "/mistral") y que esté desplegada la última versión de worker.js.');
  if(status===413) return new OcrError('tamano','La imagen es demasiado grande.','Haz la foto con menos resolución o recórtala.');
  if(status===429) return new OcrError('cuota','Mistral está limitando las peticiones.','Espera un minuto y vuelve a intentarlo.');
  if(status===400||status===422) return new OcrError('peticion','Mistral ha rechazado la petición.',detail.slice(0,200));
  return new OcrError('servidor','Error del servicio OCR ('+status+').',detail.slice(0,200));
}

async function _ocrPost(path,body,opt){
  opt=opt||{};
  const tries=opt.tries||3, timeoutMs=opt.timeoutMs||90000;
  const base=_ocrBase();
  if(!base) throw new OcrError('config','El OCR no está configurado.','Un administrador debe poner la URL del Worker en Configuración → OCR.');
  if(typeof fbAuth==='undefined'||!fbAuth||!fbAuth.currentUser) throw new OcrError('auth','No hay sesión activa.','Cierra sesión y vuelve a entrar.');
  const payload=JSON.stringify(body);
  let last;
  for(let i=0;i<tries;i++){
    const token=await fbAuth.currentUser.getIdToken();
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),timeoutMs);
    try{
      const r=await fetch(base+path,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:payload,signal:ctl.signal});
      clearTimeout(t);
      if(r.ok) return await r.json();
      const err=await r.json().catch(()=>({}));
      last=_ocrHttpError(r.status,err);
      if(![429,502,503,504].includes(r.status)) throw last;
    }catch(e){
      clearTimeout(t);
      if(e instanceof OcrError){ if(!['cuota','servidor'].includes(e.code)||i===tries-1) throw e; last=e; }
      else if(e&&e.name==='AbortError') last=new OcrError('timeout','El OCR tarda demasiado en responder.','Reintenta; si pasa siempre, usa una foto más pequeña.');
      else last=new OcrError('red','No se puede contactar con el servicio OCR.','Comprueba tu conexión. Si es solo con el OCR, revisa la URL del Worker (y su CORS).');
    }
    if(i<tries-1) await new Promise(r=>setTimeout(r,1500*(i+1)));
  }
  throw last;
}

/* ───────── Imagen ───────── */
function ocrPrepareImage(dataUri,maxSide,quality){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      try{
        let w=img.naturalWidth,h=img.naturalHeight;
        if(!w||!h) return rej(new OcrError('imagen','La imagen no es válida.'));
        const k=Math.min(1,(maxSide||OCR_IMG.maxSide)/Math.max(w,h));
        w=Math.round(w*k); h=Math.round(h*k);
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        const ctx=c.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        res(c.toDataURL('image/jpeg',quality||OCR_IMG.quality));
      }catch(e){ rej(e); }
    };
    img.onerror=()=>rej(new OcrError('imagen','No se ha podido abrir la imagen.','Prueba con otra foto (JPG o PNG).'));
    img.src=dataUri;
  });
}

/* ───────── Pasos del pipeline ───────── */
async function _ocrStepOcr(post,docUri,isPdf){
  const document=isPdf?{type:'document_url',document_url:docUri}:{type:'image_url',image_url:docUri};
  const data=await post('/mistral/ocr',{model:OCR_MODELS.ocr,document});
  return (data.pages||[]).map(p=>p.markdown||'').join('\n\n');
}
async function _ocrStepChat(post,models,messages){
  let last;
  for(const model of models){
    try{
      const data=await post('/mistral/chat/completions',{model,temperature:0,response_format:{type:'json_object'},messages});
      const ex=ocrNormalizeExtraction(ocrParseJson(data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content));
      if(ex&&ex.lines.length) return {extraction:ex,model};
    }catch(e){
      last=e;
      if(['config','auth','red','clave','worker','cuota','timeout'].includes(e.code)) throw e; // probar otro modelo no ayuda
    }
  }
  if(last) throw last;
  return null;
}

/* ───────── Punto de entrada ─────────
   opt: {products, onProgress, post (para tests), prepare:false (para tests)} */
async function ocrReadAlbaran(dataUri,isPdf,opt){
  opt=opt||{};
  const post=opt.post||_ocrPost;
  const say=opt.onProgress||function(){};
  if(!dataUri) throw new OcrError('imagen','Añade primero una foto o PDF del albarán.');
  if(isPdf&&dataUri.length*0.75>OCR_MAX_PDF_BYTES) throw new OcrError('tamano','El PDF es demasiado grande (máx. 15 MB).');
  let doc=dataUri;
  if(!isPdf&&opt.prepare!==false){ say('Preparando la imagen…'); doc=await ocrPrepareImage(dataUri); }

  const trace=[];
  let markdown='', found=null;

  // 1+2: OCR de texto → extracción
  try{
    say('Leyendo el albarán…');
    markdown=await _ocrStepOcr(post,doc,isPdf);
    trace.push('ocr:'+markdown.length+' caracteres');
    if(markdown.trim().length>=20){
      say('Extrayendo productos…');
      found=await _ocrStepChat(post,OCR_MODELS.extract,[
        {role:'system',content:OCR_SYSTEM},
        {role:'user',content:'TEXTO DEL ALBARÁN (leído por OCR; las tablas vienen en markdown):\n\n'+markdown.slice(0,60000)}
      ]);
      if(found) trace.push('extracción:'+found.model);
    }
  }catch(e){
    // Fallos de configuración/sesión/red no se arreglan con otro método: se cuentan tal cual.
    if(['config','auth','red','clave','worker','cuota','timeout','tamano'].includes(e.code)) throw e;
    trace.push('ocr-falló:'+e.code);
  }

  // Respaldo: visión directa sobre la imagen
  if(!found&&!isPdf){
    say('Probando lectura directa de la imagen…');
    found=await _ocrStepChat(post,OCR_MODELS.vision,[
      {role:'system',content:OCR_SYSTEM},
      {role:'user',content:[{type:'text',text:OCR_USER_VISION},{type:'image_url',image_url:doc}]}
    ]);
    if(found) trace.push('visión:'+found.model);
  }

  if(!found) throw new OcrError('vacio','No he conseguido sacar líneas de producto de este albarán.',
    markdown.trim()?'Se leyó texto pero no parece una tabla de productos. Prueba con una foto más recta y con mejor luz, o recórtala.':'No se leyó texto. Prueba con una foto más nítida, recta y bien iluminada.');

  const res=ocrBuildResult(found.extraction,opt.products,{engine:'mistral',trace,markdown});
  return res;
}

/* ───────── Integración con la pantalla de albarán ───────── */
function ocrApplyToAlbaran(res){
  const items=res.lines.map(l=>({
    code:l.code||'',
    name:l.matched?l.matched.name:l.name,
    unit:l.unit||'UN',
    qty:l.qty||0,
    price:l.price||0,
    matched:!!l.matched,
    ...(l.notes.length?{ocrNote:l.notes.join(' · ')}:{})
  }));
  S.albItems=[...S.albItems,...items];
  if(res.header.date){
    const d=new Date(res.header.date+'T00:00:00');
    if(!isNaN(d)&&d.getTime()<=Date.now()+864e5) S.albDate=res.header.date;
  }
  const nWarn=res.lines.filter(l=>l.confidence==='baja').length;
  const nMatch=res.lines.filter(l=>l.matched).length;
  const parts=[items.length+' producto'+(items.length!==1?'s':'')+' reconocido'+(items.length!==1?'s':'')];
  if(nMatch) parts.push(nMatch+' del catálogo');
  S.albOcrMsg={kind:(nWarn||res.warnings.length)?'warn':'ok',
    text:parts.join(' · ')+'. Revisa las líneas antes de guardar.',
    details:[...(nWarn?[nWarn+' línea'+(nWarn!==1?'s':'')+' con avisos (marcadas abajo)']:[]),...res.warnings]};
}
function ocrShowError(e){
  const known=e instanceof OcrError;
  if(!known) console.error('[OCR]',e);
  S.albOcrMsg={kind:'err',
    text:known?e.message:'Error inesperado en el OCR: '+((e&&e.message)||e),
    details:known&&e.hint?[e.hint]:[]};
}

async function runOCR(){
  if(!S.albPhoto){ toast('Añade una foto primero','#dc2626'); return; }
  if(S._ocrBusy) return;
  S._ocrBusy=true; S.albOcrMsg=null;
  const prog=document.getElementById('ocr-progress');
  const showProg=msg=>{ if(prog){ prog.style.display='block'; prog.textContent=msg; } };
  try{
    const sup=(typeof suppliers!=='undefined'&&suppliers[S.albSupId])||{};
    const res=await ocrReadAlbaran(S.albPhoto,S.albFileType==='pdf',{products:sup.products,onProgress:showProg});
    ocrApplyToAlbaran(res);
  }catch(e){
    ocrShowError(e);
  }finally{
    S._ocrBusy=false;
    if(prog) prog.style.display='none';
    render();
  }
}

// Prueba de extremo a extremo para Configuración: genera un albarán de ejemplo,
// lo pasa por el OCR real y comprueba que sale la línea esperada.
async function ocrSelfTest(targetId){
  const out=document.getElementById(targetId);
  const rows=[];
  const paint=()=>{ if(out) out.innerHTML=rows.map(r=>'<div style="font-size:12px;margin-top:4px;color:'+(r.ok===false?'#dc2626':r.ok?'#16a34a':'var(--mut)')+'">'+(r.ok===false?'✗ ':r.ok?'✓ ':'… ')+escHtml(r.t)+'</div>').join(''); };
  const step=(t,ok)=>{ rows.push({t,ok}); paint(); };
  try{
    if(!_ocrBase()) return step('Falta la URL del Worker. Pégala arriba y vuelve a probar.',false);
    step('URL del Worker configurada',true);
    const c=document.createElement('canvas'); c.width=900; c.height=320;
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,900,320); g.fillStyle='#000';
    g.font='bold 30px Arial'; g.fillText('ALBARAN Nº 4471    Fecha: 12/03/2026',30,50);
    g.font='24px Arial'; g.fillText('Cod    Descripcion            Cant   Ud   Precio   Importe',30,110);
    g.fillText('1234   BACALAO DESALADO       2,500  KG   10,00    25,00',30,160);
    g.fillText('5678   ACEITE OLIVA 5L        3      UN   22,50    67,50',30,210);
    g.fillText('Base imponible: 92,50',30,280);
    step('Enviando albarán de prueba al OCR…');
    const res=await ocrReadAlbaran(c.toDataURL('image/jpeg',0.9),false,{prepare:false});
    rows.pop();
    step('El Worker y Mistral responden ('+res.meta.trace.join(' → ')+')',true);
    const bac=res.lines.find(l=>/bacalao/i.test(l.name));
    step(bac&&Math.abs(bac.qty-2.5)<0.01&&Math.abs(bac.price-10)<0.01?'Lectura correcta: Bacalao 2,5 KG × 10,00 €':'La lectura no es la esperada ('+res.lines.length+' líneas)',!!(bac&&Math.abs(bac.qty-2.5)<0.01));
    if(res.warnings.length) step(res.warnings[0],false);
  }catch(e){
    if(rows.length&&rows[rows.length-1].ok===undefined) rows.pop();
    step((e.message||String(e))+(e.hint?' — '+e.hint:''),false);
  }
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={OcrError,ocrNum,ocrNormUnit,ocrFold,ocrSim,ocrMatchProduct,ocrParseJson,ocrNormDate,
    ocrNormalizeExtraction,ocrValidateLine,ocrCheckDocument,ocrBuildResult,ocrReadAlbaran,_ocrHttpError,OCR_MODELS};
}
