// Ejecutar: node tests/ocr-albaran.test.js
const assert=require('assert');
const O=require('../js/48-ocr-albaran.js');
let n=0; const t=async(name,fn)=>{ try{ await fn(); n++; console.log('  ok  '+name); }catch(e){ console.error('FALLA '+name+'\n',e.message); process.exitCode=1; } };

const catalog=[
  {id:'p1',code:'1234',name:'Bacalao desalado',unit:'KG',price:10},
  {id:'p2',code:'5678',name:'Aceite de oliva virgen extra 5L',unit:'UN',price:22.5},
  {id:'p3',code:'',name:'Tomate pera',unit:'KG',price:1.8}
];

(async()=>{
await t('ocrNum formatos españoles y ingleses',()=>{
  assert.strictEqual(O.ocrNum('1.234,56'),1234.56);
  assert.strictEqual(O.ocrNum('12,5'),12.5);
  assert.strictEqual(O.ocrNum('12.350'),12.35);       // peso con 3 decimales
  assert.strictEqual(O.ocrNum('1,234.56'),1234.56);
  assert.strictEqual(O.ocrNum('3,20 €'),3.2);
  assert.strictEqual(O.ocrNum('1.234.567'),1234567);
  assert.strictEqual(O.ocrNum(''),null);
  assert.strictEqual(O.ocrNum('abc'),null);
  assert.strictEqual(O.ocrNum(7),7);
});
await t('ocrNormUnit',()=>{
  assert.strictEqual(O.ocrNormUnit('Kgs.'),'KG');
  assert.strictEqual(O.ocrNormUnit('UDS'),'UN');
  assert.strictEqual(O.ocrNormUnit('cajas'),'Caja');
  assert.strictEqual(O.ocrNormUnit('xx'),null);
});
await t('ocrParseJson tolera ```json y texto alrededor',()=>{
  assert.deepStrictEqual(O.ocrParseJson('```json\n{"a":1}\n```'),{a:1});
  assert.deepStrictEqual(O.ocrParseJson('Aquí tienes: {"a":{"b":"}"}} fin'),{a:{b:'}'}});
  assert.deepStrictEqual(O.ocrParseJson('[{"x":1}]'),[{x:1}]);
  assert.strictEqual(O.ocrParseJson('sin json'),null);
});
await t('emparejado por código (con ceros) y por nombre con acentos/abreviado',()=>{
  assert.strictEqual(O.ocrMatchProduct({code:'01234',name:'xx'},catalog).product.id,'p1');
  assert.strictEqual(O.ocrMatchProduct({code:'',name:'ACEITE OLIVA VIRGEN EXTRA 5 L'},catalog).product.id,'p2');
  assert.strictEqual(O.ocrMatchProduct({code:'',name:'TOMATES PERA'},catalog).product.id,'p3');
  assert.strictEqual(O.ocrMatchProduct({code:'',name:'Detergente lavavajillas'},catalog),null);
});
await t('validación: cuadra, calcula precio, corrige peso, marca incoherencias',()=>{
  assert.strictEqual(O.ocrValidateLine({qty:2.5,price:10,amount:25,unit:'KG'}).confidence,'alta');
  const p=O.ocrValidateLine({qty:3,price:null,amount:67.5,unit:'UN'});
  assert.strictEqual(p.price,22.5); assert.ok(p.flags.includes('precio-calculado'));
  // 2 cajas pero facturado por 18,4 kg a 5 €/kg = 92 €: NO se cambia la cantidad, se sugiere
  const w=O.ocrValidateLine({qty:2,price:5,amount:92,unit:'UN'});
  assert.strictEqual(w.qty,2); assert.strictEqual(w.confidence,'baja'); assert.ok(/18\.4/.test(w.hint));
  const bad=O.ocrValidateLine({qty:2,price:10,amount:99,unit:'UN'});
  assert.strictEqual(bad.confidence,'baja'); assert.ok(bad.flags.includes('importe-no-cuadra'));
  // con descuento del 10%
  assert.strictEqual(O.ocrValidateLine({qty:10,price:5,amount:45,discountPct:10,unit:'KG'}).confidence,'alta');
});
await t('normalización: claves alternativas, fechas, basura de totales',()=>{
  const ex=O.ocrNormalizeExtraction({proveedor:'X',fecha:'12/03/26',lineas:[
    {codigo:'1234',descripcion:'Bacalao',cantidad:'2,5',unidad:'kgs',precio:'10,00',importe:'25,00'},
    {descripcion:'TOTAL',importe:'25'},{descripcion:'Base imponible',importe:'25'},{descripcion:''}]});
  assert.strictEqual(ex.header.date,'2026-03-12');
  assert.strictEqual(ex.lines.length,1); assert.strictEqual(ex.lines[0].qty,2.5); assert.strictEqual(ex.lines[0].unit,'KG');
});
await t('control de documento: suma vs base',()=>{
  const ok=O.ocrCheckDocument({base:92.5},[{amount:25},{amount:67.5}]);
  assert.strictEqual(ok.warnings.length,0);
  const ko=O.ocrCheckDocument({base:150},[{amount:25},{amount:67.5}]);
  assert.strictEqual(ko.warnings.length,1);
  assert.strictEqual(O.ocrCheckDocument({total:101.75},[{amount:25},{amount:67.5}]).warnings.length,0); // con 10% IVA
});

// ── Pipeline completo con Mistral simulado ──
const MD=`ALBARAN Nº 4471  12/03/2026\n| Cod | Descripción | Cant | Ud | Precio | Importe |\n|---|---|---|---|---|---|\n| 1234 | BACALAO DESALADO | 2,500 | KG | 10,00 | 25,00 |\n| 5678 | ACEITE OLIVA VIRGEN EXTRA 5L | 3 | UN | 22,50 | 67,50 |\nBase imponible 92,50`;
const JSON_OK=JSON.stringify({supplier:'Pescados SA',albaranNumber:'4471',date:'2026-03-12',baseAmount:92.5,totalAmount:101.75,lines:[
  {code:'1234',description:'BACALAO DESALADO',qty:2.5,unit:'KG',price:10,amount:25},
  {code:'5678',description:'ACEITE OLIVA VIRGEN EXTRA 5L',qty:3,unit:'UN',price:22.5,amount:67.5}]});
const chat=c=>({choices:[{message:{content:c}}]});

await t('pipeline feliz: OCR → extracción → emparejado',async()=>{
  const calls=[];
  const post=async(path,body)=>{ calls.push(path+':'+body.model);
    return path==='/mistral/ocr'?{pages:[{markdown:MD}]}:chat(JSON_OK); };
  const r=await O.ocrReadAlbaran('data:image/jpeg;base64,xx',false,{post,prepare:false,products:catalog});
  assert.strictEqual(r.lines.length,2);
  assert.strictEqual(r.lines[0].matched.id,'p1'); assert.strictEqual(r.lines[1].matched.id,'p2');
  assert.strictEqual(r.header.date,'2026-03-12'); assert.strictEqual(r.warnings.length,0);
  assert.deepStrictEqual(calls,['/mistral/ocr:mistral-ocr-latest','/mistral/chat/completions:mistral-medium-latest']);
});
await t('si el modelo de extracción devuelve basura, prueba el siguiente modelo',async()=>{
  let k=0;
  const post=async(path)=>{ if(path==='/mistral/ocr') return {pages:[{markdown:MD}]};
    return chat(k++===0?'no puedo ayudar':'```json\n'+JSON_OK+'\n```'); };
  const r=await O.ocrReadAlbaran('data:x',false,{post,prepare:false});
  assert.strictEqual(r.lines.length,2); assert.ok(r.meta.trace.some(x=>x.includes('mistral-small-latest')));
});
await t('si el OCR de texto no lee nada, cae a visión directa (imagen)',async()=>{
  const post=async(path,body)=>{ if(path==='/mistral/ocr') return {pages:[{markdown:''}]};
    assert.ok(Array.isArray(body.messages[1].content)); return chat(JSON_OK); };
  const r=await O.ocrReadAlbaran('data:x',false,{post,prepare:false});
  assert.ok(r.meta.trace.some(x=>x.startsWith('visión')));
});
await t('un PDF sin texto NO usa visión y da un error claro',async()=>{
  const post=async()=>({pages:[{markdown:''}]});
  await assert.rejects(O.ocrReadAlbaran('data:application/pdf;base64,xx',true,{post,prepare:false}),e=>e.code==='vacio');
});
await t('errores de configuración/sesión no se disfrazan de "no se leyó"',async()=>{
  const post=async()=>{ throw new O.OcrError('config','El OCR no está configurado.'); };
  await assert.rejects(O.ocrReadAlbaran('data:x',false,{post,prepare:false}),e=>e.code==='config');
});
await t('si el OCR falla por modelo pero la visión funciona, se recupera',async()=>{
  const post=async(path)=>{ if(path==='/mistral/ocr') throw new O.OcrError('peticion','422');
    return chat(JSON_OK); };
  const r=await O.ocrReadAlbaran('data:x',false,{post,prepare:false});
  assert.strictEqual(r.lines.length,2);
});
await t('suma que no cuadra con la base genera aviso',async()=>{
  const j=JSON.stringify({baseAmount:500,lines:[{description:'Bacalao',qty:2,unit:'KG',price:10,amount:20}]});
  const post=async(p)=>p==='/mistral/ocr'?{pages:[{markdown:MD}]}:chat(j);
  const r=await O.ocrReadAlbaran('data:x',false,{post,prepare:false});
  assert.strictEqual(r.warnings.length,1);
});
await t('mapeo de errores HTTP del Worker',()=>{
  assert.strictEqual(O._ocrHttpError(401,{error:'invalid_auth'}).code,'auth');
  assert.strictEqual(O._ocrHttpError(401,{message:'Unauthorized'}).code,'clave');
  assert.strictEqual(O._ocrHttpError(500,{error:'server_misconfigured'}).code,'worker');
  assert.strictEqual(O._ocrHttpError(404,{}).code,'worker');
  assert.strictEqual(O._ocrHttpError(422,{detail:[{msg:'x'}]}).code,'peticion');
});
console.log('\n'+n+' pruebas OK');
})();
