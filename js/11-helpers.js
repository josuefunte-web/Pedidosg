/* ═══════════════ HELPERS ═══════════════ */
const WA_SVG=`<svg class="wa-ic" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

function fmt(n){ return (parseFloat(n)||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
// ── Escapes anti-XSS ─────────────────────────────────────────────────
// APLICAR SIEMPRE que un valor de usuario / Firebase / OCR se interpole
// dentro de un template literal que acabe en innerHTML. Sin esto, un
// nombre de producto con <script>...</script> se ejecuta en el navegador
// del admin al abrirlo.
function escHtml(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
// Para valores dentro de comillas de un atributo HTML (más estricto).
function escAttr(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
    .replace(/`/g,'&#96;');
}
// Alias cortos para usar en templates: ${_e(sup.name)}, ${_a(sup.name)}
const _e = escHtml;
const _a = escAttr;
// Precio efectivo de un producto según la unidad seleccionada por el usuario:
//   · Si la unidad seleccionada = unidad base (la del precio) → precio tal cual.
//   · Si no, multiplica el precio base por el factor de conversión definido en el producto.
//     Ejemplo: producto a 2€/KG, con conversión "1 Caja = 15 KG" → precio de 1 Caja = 30€.
//   · Si no hay conversión definida para esa unidad, devuelve el precio base (mejor esfuerzo).
function effectivePrice(prod, selUnit){
  const base=prod.unit||'KG';
  const price=parseFloat(prod.price)||0;
  if(!selUnit||selUnit===base) return price;
  const conv=(prod.conversions||[]).find(c=>c.fromUnit===selUnit);
  if(conv&&parseFloat(conv.factor)>0) return price*parseFloat(conv.factor);
  return price;
}
// Muestra la cantidad con conversión si aplica: "2 Cajas (18 Kg)"
function convQtyStr(qty, unit, baseUnit, conversions){
  if(!conversions||!conversions.length||unit===baseUnit) return `${qty} ${unit}`;
  const conv=(conversions||[]).find(c=>c.fromUnit===unit);
  if(!conv) return `${qty} ${unit}`;
  const bq=parseFloat((qty*conv.factor).toFixed(3));
  const bqFmt=bq%1===0?bq:bq.toFixed(2);
  return `${qty} ${unit} (${bqFmt} ${baseUnit})`;
}
function pkgLabel(p){
  const price=parseFloat(p.price)||0;
  const unit=(p.unit||'KG').trim();
  if(unit==='KG'||unit==='L') return `${fmt(price)} / ${unit}`;
  if(unit==='g') return `${fmt(price*1000)} / KG`;
  if(p.pesoGr&&p.pesoGr>0){
    const kgPrice=(price/p.pesoGr)*1000;
    return `${fmt(kgPrice)} / KG <span style="font-size:11px;color:var(--mut);font-weight:400">(${fmt(price)} ${unit})</span>`;
  }
  return `${fmt(price)} / ${unit}`;
}
function fmtD(iso){ try{return new Date(iso).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return iso||'—';} }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function total(o){ return (o.items||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0); }
function toast(msg,col='#222',dur=3500){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.background=col;t.style.display='block';
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',dur);
}
function waURL(phone,text){ return `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`; }
// El comercial de un proveedor puede variar según la zona/local que pide.
// Si el proveedor tiene un teléfono específico para ese local (phonesByLocal),
// se usa ese; si no, cae al teléfono general del proveedor.
function supPhoneFor(sup,restaurant){
  if(!sup) return '';
  const byLocal=sup.phonesByLocal&&restaurant?sup.phonesByLocal[restaurant]:null;
  return byLocal||sup.phone||'';
}

function msgSupplier(o){
  const lines=(o.items||[]).map(it=>{
    const qty=parseFloat(it.qty)||0;
    const price=parseFloat(it.price)||0;
    const codeTag=it.code?` (${it.code})`:'';
    const priceLine=price>0?`\n   ${qty} ${it.unit} × ${fmt(price)} = ${fmt(qty*price)}`:`\n   ${qty} ${it.unit}`;
    return `• ${it.name}${codeTag}${priceLine}`;
  }).join('\n');
  const ref=(o.id||'').slice(-6).toUpperCase();
  const totalAmt=total(o);
  const totalLine=totalAmt>0?`\n\n*TOTAL: ${fmt(totalAmt)}*`:'';
  const isConsolidated=o.restaurant&&o.restaurant.includes('Consolidado');
  const restLine=isConsolidated?` ${o.restaurant}`:`━━━━━━━━━━━━━━━━━━\n🏪 *LOCAL: ${(o.restaurant||'').toUpperCase()}*\n━━━━━━━━━━━━━━━━━━`;
  const noteLine=o.notes?`\n📝 *Nota:* ${o.notes}`:'';
  const urgLine=o.urgent?'\n🚨 *PEDIDO URGENTE*':'';
  const delLine=o.deliveryDate?`\n📅 *Entrega solicitada:* ${o.deliveryDate}`:'';
  return `🧾 *PEDIDO* — Ref. ${ref}\n📅 ${new Date(o.createdAt).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}\n${restLine}${urgLine}${delLine}\n\n📦 *Productos:*\n${lines}${totalLine}${noteLine}\n\n_${cfg.adminName} — Jefe de Compras_`;
}
function msgLocal(o, supName){
  const lines=(o.items||[]).map(it=>`• ${it.name} (${it.unit}): ${it.qty}`).join('\n');
  const noteLine=o.notes?`\n *Nota:* ${o.notes}`:'';
  return `*PEDIDO ENVIADO*\n ${new Date().toLocaleDateString('es-ES')}\nTu pedido a *${supName}* ha sido aprobado y enviado.\n\n*Productos:*\n${lines}${noteLine}\n\n_${cfg.adminName} — Jefe de Compras_`;
}

let _waMsg='';
let _waNext=null; // {phone, msg, desc} para encadenar un segundo WA
function showWA(phone,msg,desc,next){
  _waMsg=msg;
  _waNext=next||null;
  document.getElementById('wa-desc').textContent=desc||'Pulsa para abrir WhatsApp.';
  document.getElementById('wa-msg-preview').textContent=msg;
  const btn=document.getElementById('wa-link-btn');
  const p=(phone||'').replace(/\D/g,'');
  btn.href=p.length>7?waURL(p,msg):'#';
  btn.style.opacity=p.length>7?'1':'.4';
  btn.style.pointerEvents=p.length>7?'auto':'none';
  if(p.length<=7) document.getElementById('wa-desc').textContent='Configura el número en Config.';
  document.getElementById('wa-ov').style.display='flex';
}
function closeWA(){
  document.getElementById('wa-ov').style.display='none';
  if(_waNext){const n=_waNext;_waNext=null;setTimeout(()=>showWA(n.phone,n.msg,n.desc),150);}
}
function copyWAMsg(){ navigator.clipboard.writeText(_waMsg).then(()=>toast('Copiado','#16a34a')); }

// ── "🔄 Actualizar datos" ─────────────────────────────────────────────────
// Autoservicio para usuarios cuya app se ha quedado con datos viejos en
// localStorage (proveedores, plantillas, etc.). Vacía las cachés locales y
// obliga a la app a volver a pedir todo a Firebase desde cero. La página
// se recarga para que los listeners re-establezcan y todo se pinte limpio.
function refreshData(){
  try{
    if(!confirm('Descargar todos los datos otra vez? Puede tardar unos segundos si tu conexión es lenta.')) return;
    // Borrar todas las cachés locales de datos sincronizados con Firebase
    // (mantener sesión, preferencias UI y cfg local que se regeneran solos)
    ['oc_suppliers','oc_orders','oc_albaranes','oc_templates','oc_priceHistory','oc_inventory','oc_inventoryMovements','oc_extraExpenses','oc_budgets','oc_revenue','oc_escandallos','oc_menus','oc_recetas','oc_authUsers','oc_foodcost']
      .forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    toast('Descargando datos frescos...','#0369a1',2000);
    // Recarga forzando URL nueva para saltarnos cualquier caché del navegador
    setTimeout(()=>{ location.replace(location.pathname+'?_r='+Date.now()); }, 800);
  }catch(e){
    console.warn('refreshData error:',e);
    toast('Error al actualizar','#dc2626');
  }
}
