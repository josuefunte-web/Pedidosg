/* NOVENTIA — ANALITICA PROFESIONAL POR PROVEEDOR */
function nvCompactMoney(value){
  const n=parseFloat(value)||0;
  if(Math.abs(n)>=1000000) return (n/1000000).toLocaleString('es-ES',{maximumFractionDigits:1})+' M€';
  if(Math.abs(n)>=10000) return (n/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+' k€';
  return fmt(n);
}
function nvSupHistSetPeriod(period){ S.supHistPeriod=period; S.supHistOpen=null; renderAdminContent(); }
function nvSupHistSearch(value){ S.supHistSearch=value; renderAdminContent(); }
function nvSupHistToggle(id){ S.supHistOpen=S.supHistOpen===id?null:id; renderAdminContent(); }
function vSupHistory(){
  if(!S.supHistPeriod) S.supHistPeriod='all';
  if(S.supHistSearch==null) S.supHistSearch='';
  if(S.supHistOpen==null) S.supHistOpen=null;
  const escape=v=>escHtml(String(v??''));
  const compact=v=>{const n=parseFloat(v)||0;return Math.abs(n)>=10000?(n/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+' k€':fmt(n);};
  const now=new Date(), month=now.toISOString().slice(0,7), year=now.toISOString().slice(0,4);
  const valid=o=>o.status==='approved'||o.status==='received';
  const inPeriod=o=>S.supHistPeriod==='month'?String(o.createdAt||'').startsWith(month):S.supHistPeriod==='year'?String(o.createdAt||'').startsWith(year):true;
  const query=String(S.supHistSearch||'').trim().toLowerCase();
  const previousMonth=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
  const currentMonth=month;
  const all=orders.filter(valid);
  const periodOrders=all.filter(inPeriod);
  const rows=supList().map(sup=>{
    const os=periodOrders.filter(o=>o.supId===sup.id);
    if(!os.length) return null;
    const spend=os.reduce((n,o)=>n+total(o),0), byRest={}, products={};
    os.forEach(o=>{
      const rest=o.restaurant||'Sin local'; byRest[rest]=(byRest[rest]||0)+total(o);
      (o.items||[]).forEach(it=>{const name=String(it.name||'Producto');products[name]??={name,unit:it.unit||'',qty:0,spend:0};products[name].qty+=parseFloat(it.qty)||0;products[name].spend+=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);});
    });
    const last=os.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
    const current=all.filter(o=>o.supId===sup.id&&String(o.createdAt||'').startsWith(currentMonth)).reduce((n,o)=>n+total(o),0);
    const previous=all.filter(o=>o.supId===sup.id&&String(o.createdAt||'').startsWith(previousMonth)).reduce((n,o)=>n+total(o),0);
    const change=previous>0?((current-previous)/previous*100):null;
    return {sup,os,spend,byRest,products:Object.values(products).sort((a,b)=>b.spend-a.spend),last,change};
  }).filter(Boolean).filter(x=>!query||String(x.sup.name||'').toLowerCase().includes(query)).sort((a,b)=>b.spend-a.spend);
  const totalSpend=rows.reduce((n,x)=>n+x.spend,0), totalOrders=rows.reduce((n,x)=>n+x.os.length,0), locals=new Set();
  rows.forEach(x=>Object.keys(x.byRest).forEach(r=>locals.add(r)));
  const top5=rows.slice(0,5).reduce((n,x)=>n+x.spend,0), concentration=totalSpend?top5/totalSpend*100:0, max=Math.max(1,...rows.map(x=>x.spend));
  const controls=['all','month','year'].map(p=>`<button class="nv-e-seg ${S.supHistPeriod===p?'act':''}" onclick="S.supHistPeriod='${p}';S.supHistOpen=null;renderAdminContent()">${{all:'Todo',month:'Este mes',year:'Este año'}[p]}</button>`).join('');
  const body=rows.map((x,i)=>{
    const open=S.supHistOpen===x.sup.id;
    const trend=x.change==null?'Sin comparativa':`${x.change>=0?'+':''}${x.change.toFixed(1)}% vs mes anterior`;
    const detail=`<div class="nv-e-supplier-detail"><section><h3>Gasto por local</h3>${Object.entries(x.byRest).sort((a,b)=>b[1]-a[1]).map(([name,value])=>{const pct=x.spend?Math.round(value/x.spend*100):0;return `<div class="nv-e-dist"><div><b>${escape(name)}</b><span>${fmt(value)} · ${pct}%</span></div><i><b style="width:${pct}%"></b></i></div>`}).join('')}</section><section><h3>Productos principales</h3>${x.products.slice(0,8).map(p=>`<div class="nv-e-product"><div><b>${escape(p.name)}</b><span>${p.qty%1===0?p.qty:p.qty.toFixed(1)} ${escape(p.unit)}</span></div><strong>${fmt(p.spend)}</strong></div>`).join('')||'<p>Sin productos</p>'}</section><section><h3>Últimos pedidos</h3>${x.os.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6).map(o=>`<div class="nv-e-order"><span>${fmtD(o.createdAt)} · ${escape(o.restaurant||'')}</span><b>${fmt(total(o))}</b></div>`).join('')}</section></div>`;
    return `<article class="nv-e-supplier-row"><button onclick="S.supHistOpen=S.supHistOpen==='${x.sup.id}'?null:'${x.sup.id}';renderAdminContent()"><em>${i+1}</em><span class="nv-e-supplier-name"><b>${escape(x.sup.name)}</b><small>${x.os.length} pedidos · ${Object.keys(x.byRest).length} locales · Último ${fmtD(x.last.createdAt)}</small></span><i class="nv-e-volume"><b style="width:${Math.max(2,x.spend/max*100)}%"></b></i><span class="nv-e-trend">${trend}</span><span class="nv-e-amount"><b>${compact(x.spend)}</b><small>${totalSpend?(x.spend/totalSpend*100).toFixed(1):0}% del total</small></span><span class="nv-e-plus">${open?'−':'+'}</span></button>${open?detail:''}</article>`;
  }).join('');
  return `<div class="nv-e-page"><header class="nv-e-head"><span>Análisis de compras</span><h1>Compras por proveedor</h1><p>Ranking, concentración, evolución y detalle operativo</p></header><div class="nv-e-toolbar"><div class="nv-e-segments">${controls}</div><input value="${escape(S.supHistSearch)}" oninput="S.supHistSearch=this.value;renderAdminContent()" placeholder="Buscar proveedor"></div><div class="nv-e-kpis"><article><small>Gasto total</small><b>${fmt(totalSpend)}</b></article><article><small>Proveedores activos</small><b>${rows.length}</b></article><article><small>Pedidos</small><b>${totalOrders}</b></article><article><small>Concentración top 5</small><b>${concentration.toFixed(1)}%</b></article></div><section class="nv-e-supplier-list">${body||'<div class="nv-e-empty">Sin resultados para este periodo</div>'}</section></div>`;
}
