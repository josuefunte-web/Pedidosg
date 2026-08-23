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
  const sups=supList();
  if(!sups.length) return `<div class="nv-empty-state"><strong>Sin proveedores</strong><span>Añade proveedores para comenzar el análisis.</span></div>`;
  const allOrders=orders.filter(o=>o.status==='approved'||o.status==='received');
  if(!allOrders.length) return `<div class="nv-empty-state"><strong>Sin compras aprobadas</strong><span>El análisis aparecerá cuando existan pedidos aprobados o recibidos.</span></div>`;

  if(!S.supHistPeriod) S.supHistPeriod='all';
  if(S.supHistSearch==null) S.supHistSearch='';
  const now=new Date(), month=now.toISOString().slice(0,7), year=now.toISOString().slice(0,4);
  const inPeriod=o=>S.supHistPeriod==='month'?String(o.createdAt||'').startsWith(month):S.supHistPeriod==='year'?String(o.createdAt||'').startsWith(year):true;
  const filteredOrders=allOrders.filter(inPeriod);
  const query=String(S.supHistSearch||'').trim().toLowerCase();
  const periodLabel={all:'Todo el historial',month:'Este mes',year:'Este año'}[S.supHistPeriod];

  const data=sups.map(sup=>{
    const supOrders=filteredOrders.filter(o=>o.supId===sup.id);
    if(!supOrders.length) return null;
    const spend=supOrders.reduce((n,o)=>n+total(o),0);
    const last=supOrders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
    const byRest={};
    const products={};
    supOrders.forEach(o=>{
      byRest[o.restaurant]=(byRest[o.restaurant]||0)+total(o);
      (o.items||[]).forEach(it=>{
        const key=String(it.name||'Producto').trim();
        if(!products[key]) products[key]={name:key,unit:it.unit||'',qty:0,spend:0};
        products[key].qty+=parseFloat(it.qty)||0;
        products[key].spend+=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
      });
    });
    return {sup,orders:supOrders,count:supOrders.length,spend,last,byRest,products:Object.values(products).sort((a,b)=>b.spend-a.spend)};
  }).filter(Boolean).filter(x=>!query||String(x.sup.name||'').toLowerCase().includes(query)).sort((a,b)=>b.spend-a.spend);

  const totalSpend=data.reduce((n,x)=>n+x.spend,0);
  const totalOrders=data.reduce((n,x)=>n+x.count,0);
  const localSet=new Set(); data.forEach(x=>Object.keys(x.byRest).forEach(r=>localSet.add(r)));
  const maxSpend=Math.max(1,...data.map(x=>x.spend));

  const periodButtons=['all','month','year'].map(p=>`<button class="nv-period${S.supHistPeriod===p?' active':''}" onclick="nvSupHistSetPeriod('${p}')">${{all:'Todo',month:'Este mes',year:'Este año'}[p]}</button>`).join('');

  const rows=data.map((x,index)=>{
    const open=S.supHistOpen===x.sup.id;
    const restRows=Object.entries(x.byRest).sort((a,b)=>b[1]-a[1]);
    const productRows=x.products.slice(0,6);
    const detail=`<div class="nv-supplier-detail">
      <section><h3>Gasto por local</h3>${restRows.map(([name,value])=>{const pct=x.spend?Math.round(value/x.spend*100):0;return `<div class="nv-dist-row"><div><strong>${escHtml(name||'Sin local')}</strong><span>${fmt(value)} · ${pct}%</span></div><i><b style="width:${pct}%"></b></i></div>`}).join('')}</section>
      <section><h3>Productos principales</h3>${productRows.length?productRows.map(p=>`<div class="nv-product-row"><div><strong>${escHtml(p.name)}</strong><span>${p.qty%1===0?p.qty:p.qty.toFixed(1)} ${escHtml(p.unit)}</span></div><b>${fmt(p.spend)}</b></div>`).join(''):'<p class="nv-muted">Sin productos registrados</p>'}</section>
    </div>`;
    return `<article class="nv-supplier-row${open?' open':''}">
      <button class="nv-supplier-summary" onclick="nvSupHistToggle('${x.sup.id}')">
        <span class="nv-rank-no">${index+1}</span>
        <span class="nv-supplier-main"><strong>${escHtml(x.sup.name||'Proveedor')}</strong><small>${x.count} pedidos · ${Object.keys(x.byRest).length} locales · Último ${fmtD(x.last.createdAt)}</small></span>
        <span class="nv-supplier-bar"><i style="width:${Math.max(2,x.spend/maxSpend*100)}%"></i></span>
        <span class="nv-supplier-spend"><strong>${nvCompactMoney(x.spend)}</strong><small>${periodLabel}</small></span>
        <span class="nv-chevron">${open?'−':'+'}</span>
      </button>${open?detail:''}
    </article>`;
  }).join('');

  return `<div class="nv-supplier-analytics">
    <header class="nv-analytics-head"><div><span>Análisis de compras</span><h1>Compras por proveedor</h1><p>Volumen, concentración y productos principales</p></div></header>
    <div class="nv-analytics-toolbar"><div class="nv-periods">${periodButtons}</div><label class="nv-search"><span>Buscar</span><input value="${escHtml(S.supHistSearch||'')}" oninput="nvSupHistSearch(this.value)" placeholder="Proveedor"></label></div>
    <div class="nv-analytics-kpis"><article><small>Gasto total</small><strong>${fmt(totalSpend)}</strong><span>${periodLabel}</span></article><article><small>Proveedores activos</small><strong>${data.length}</strong><span>Con compras en el periodo</span></article><article><small>Pedidos</small><strong>${totalOrders}</strong><span>Aprobados y recibidos</span></article><article><small>Locales</small><strong>${localSet.size}</strong><span>Con actividad</span></article></div>
    <section class="nv-supplier-list"><div class="nv-list-head"><span>Proveedor</span><span>Volumen relativo</span><span>Gasto</span></div>${rows||`<div class="nv-empty-state"><strong>Sin resultados</strong><span>No hay proveedores para este periodo o búsqueda.</span></div>`}</section>
  </div>`;
}
