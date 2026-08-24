/* ═══════════════════════════════════════════════════════════════════════
   COMPARAR PRECIOS — NOVENTIA
   Reescritura completa. Reemplaza la matriz tipo Excel anterior por una
   herramienta profesional con normalización de unidades, agrupación
   segura, KPIs reales, filtros y detalle desplegable inline.

   Contrato con el resto de la app:
   - Se llama desde renderAdminContent() cuando S.adminTab==='compare'.
   - Sólo depende de: supList(), fmt(n), escHtml() / _e(), _a(),
     PROD_CATS, PROD_CAT_COLORS, S. No lee ni escribe Firebase.
   - No cambia reglas, credenciales ni el worker.
   - Todo texto externo (nombres, unidades) va escapado con _e / _a
     antes de insertarse en innerHTML.

   Normalización:
   - Nombre: minúsculas + espacios colapsados + tildes → letra base.
     Coincidencia estricta tras esa normalización (nada de fuzzy).
   - Precio: se traduce a "unidad base" (KG o L) SOLO cuando hay una
     conversión inequívoca:
       · KG y L quedan tal cual.
       · g se convierte a KG (×1000).
       · Cualquier otra unidad (Caja, Bote, Bolsa, UN) exige que el
         producto declare `pesoGr` o una `conversion` explícita hacia KG/L.
       · En caso contrario, la oferta se marca "no comparable" con motivo,
         y la interfaz lo indica claramente en el detalle.
   ═══════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* ────────── Estado (persiste entre re-renders vía S) ────────── */
  function _initState(){
    if(typeof S==='undefined') return;
    if(S.cmpSearch===undefined)   S.cmpSearch='';
    if(S.cmpCat===undefined)      S.cmpCat='';
    if(S.cmpSup===undefined)      S.cmpSup='';
    if(S.cmpKind===undefined)     S.cmpKind='all';       // all | saving | single
    if(S.cmpSort===undefined)     S.cmpSort='saving';    // saving | price | name | pct
    if(!S.cmpOpen)                S.cmpOpen={};          // {groupKey: true}
  }

  /* ────────── Normalización de nombre (agrupación segura) ────────── */
  // Regla: coincidencia estricta tras normalizar (minúsculas + espacios
  // colapsados + tildes → letra base). No aplicamos stemming ni fuzzy
  // matching: "Tomate pera" y "Tomate triturado" NO deben agruparse.
  function normName(s){
    if(s==null) return '';
    return String(s)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'')  // quitar tildes
      .replace(/\s+/g,' ')
      .trim();
  }
  // Alias público por si más adelante se quiere usar desde otros módulos.
  window.cmpNormalizeProductName = normName;

  /* ────────── Precio en unidad base (KG o L) ────────── */
  // Sólo devolvemos comparable:true cuando podemos decir con certeza
  // cuál es el precio por unidad base. Si el producto se vende en Caja
  // sin pesoGr ni conversion explícita, marcamos no comparable. No
  // inventamos factores.
  function toBaseUnitPrice(prod){
    var price = parseFloat(prod && prod.price);
    if(!isFinite(price) || price<=0) return {comparable:false, reason:'sin_precio'};
    var unit  = (prod && prod.unit || '').trim();
    if(!unit) return {comparable:false, reason:'sin_unidad'};

    if(unit==='KG') return {comparable:true, baseUnit:'KG', basePrice:price};
    if(unit==='L')  return {comparable:true, baseUnit:'L',  basePrice:price};
    if(unit==='g')  return {comparable:true, baseUnit:'KG', basePrice:price*1000};

    // pesoGr suele venir en Caja/Bote/UN → "1 unidad pesa X gramos"
    var pesoGr = parseFloat(prod.pesoGr);
    if(isFinite(pesoGr) && pesoGr>0){
      return {comparable:true, baseUnit:'KG', basePrice:(price/pesoGr)*1000, viaPesoGr:true};
    }

    // Conversión explícita en el producto: {fromUnit:'KG', factor:X} donde
    // p.unit es Caja significaría "1 Caja = X KG" cuando el usuario ha
    // definido la conversión "hacia" la unidad base. La convención del
    // proyecto (ver 11-helpers.js effectivePrice) es más ambigua; por
    // seguridad sólo aceptamos conversions que declaren fromUnit igual a
    // KG o L con factor positivo, interpretándolas como el número de
    // unidades base por 1 unidad de venta.
    var conv = Array.isArray(prod.conversions) ? prod.conversions : [];
    var toKG = conv.find(function(c){ return c && c.fromUnit==='KG' && parseFloat(c.factor)>0; });
    var toL  = conv.find(function(c){ return c && c.fromUnit==='L'  && parseFloat(c.factor)>0; });
    if(toKG) return {comparable:true, baseUnit:'KG', basePrice: price / parseFloat(toKG.factor)};
    if(toL)  return {comparable:true, baseUnit:'L',  basePrice: price / parseFloat(toL.factor)};

    return {comparable:false, reason:'sin_conversion'};
  }

  /* ────────── Motor: construye grupos comparables ────────── */
  function buildGroups(){
    var sups = (typeof supList==='function') ? supList() : [];
    var groups = {};                    // key = normName(product) → group

    sups.forEach(function(sup){
      if(!sup) return;
      var prods;
      if(Array.isArray(sup.products)) prods = sup.products;
      else if(sup.products && typeof sup.products==='object') prods = Object.values(sup.products);
      else prods = [];

      prods.forEach(function(p){
        if(!p || !p.name) return;
        var key = normName(p.name);
        if(!key) return;

        var g = groups[key];
        if(!g){
          g = groups[key] = {
            key:    key,
            name:   String(p.name).trim(),
            cat:    p.category || 'Otros',
            offers: []
          };
        }
        if((g.cat==='Otros' || !g.cat) && p.category) g.cat = p.category;

        var base = toBaseUnitPrice(p);
        g.offers.push({
          supId:      sup.id,
          supName:    sup.name || '',
          rawPrice:   parseFloat(p.price) || 0,
          rawUnit:    (p.unit || '').trim(),
          basePrice:  base.comparable ? base.basePrice : null,
          baseUnit:   base.comparable ? base.baseUnit  : null,
          comparable: !!base.comparable,
          reason:     base.reason || '',
          viaPesoGr:  !!base.viaPesoGr
        });
      });
    });

    // Métricas por grupo (respetando familias KG vs L)
    return Object.values(groups).map(function(g){
      var byBase = {};
      g.offers.forEach(function(o){
        if(!o.comparable) return;
        (byBase[o.baseUnit] = byBase[o.baseUnit] || []).push(o);
      });
      var famKeys = Object.keys(byBase).sort(function(a,b){
        var da = byBase[a].length, db = byBase[b].length;
        if(da!==db) return db-da;
        return a==='KG' ? -1 : b==='KG' ? 1 : 0;
      });
      var famBase = famKeys[0] || null;
      var famOffers = famBase ? byBase[famBase] : [];

      // Ofertas de otra familia → no comparables entre sí con las de la dominante
      g.offers.forEach(function(o){
        if(o.comparable && famBase && o.baseUnit!==famBase){
          o.comparable = false;
          o.reason = 'familia_distinta';
          o.basePrice = null;
          o.baseUnit  = null;
        }
      });

      var prices = famOffers.map(function(o){ return o.basePrice; })
                            .filter(function(v){ return isFinite(v) && v>0; });
      var minP = prices.length ? Math.min.apply(null, prices) : null;
      var maxP = prices.length ? Math.max.apply(null, prices) : null;
      var best = famOffers.find(function(o){ return o.basePrice===minP; }) || null;

      g.famBase    = famBase;
      g.minPrice   = minP;
      g.maxPrice   = maxP;
      g.diffAbs    = (minP!=null && maxP!=null) ? (maxP - minP) : 0;
      g.diffPct    = (minP!=null && minP>0 && maxP!=null) ? ((maxP - minP)/minP)*100 : 0;
      g.bestSup    = best ? best.supName : '';
      g.compCount  = famOffers.length;
      g.totalCount = g.offers.length;
      g.isSingle   = g.totalCount<=1;
      g.hasSaving  = g.compCount>=2 && g.diffAbs>0.0001;
      return g;
    });
  }

  /* ────────── Filtrado y ordenación ────────── */
  function filterSort(groups){
    var q    = normName(S.cmpSearch || '');
    var cat  = S.cmpCat  || '';
    var sid  = S.cmpSup  || '';
    var kind = S.cmpKind || 'all';
    var sort = S.cmpSort || 'saving';

    var out = groups.filter(function(g){
      if(q   && normName(g.name).indexOf(q) < 0) return false;
      if(cat && (g.cat || 'Otros') !== cat)      return false;
      if(sid && !g.offers.some(function(o){ return o.supId===sid; })) return false;
      if(kind==='saving' && !g.hasSaving)        return false;
      if(kind==='single' && g.totalCount>1)      return false;
      return true;
    });

    out.sort(function(a,b){
      if(sort==='name')  return a.name.localeCompare(b.name,'es');
      if(sort==='price') return (a.minPrice==null?1e12:a.minPrice) - (b.minPrice==null?1e12:b.minPrice);
      if(sort==='pct')   return (b.diffPct||0) - (a.diffPct||0);
      return (b.diffAbs||0) - (a.diffAbs||0);      // 'saving' — mayor Δ €
    });
    return out;
  }

  /* ────────── KPIs reales ────────── */
  function calcKpis(allGroups){
    var comparables = allGroups.filter(function(g){ return g.compCount>=2; });
    var ahorro = comparables.reduce(function(s,g){ return s + (g.diffAbs||0); }, 0);
    var opor   = comparables.filter(function(g){ return g.hasSaving; }).length;
    var supsAnalyzed = new Set();
    allGroups.forEach(function(g){ g.offers.forEach(function(o){ supsAnalyzed.add(o.supId); }); });
    return {
      comparables: comparables.length,
      ahorro:      ahorro,
      supsCount:   supsAnalyzed.size,
      opor:        opor
    };
  }

  /* ────────── Render helpers ────────── */
  function _kpi(label, valueHtml, hint){
    return '<div class="cmp-kpi">'
      + '<div class="cmp-kpi-l">' + _e(label) + '</div>'
      + '<div class="cmp-kpi-v">' + valueHtml + '</div>'
      + (hint ? '<div class="cmp-kpi-h">' + _e(hint) + '</div>' : '')
      + '</div>';
  }
  function _catDot(cat){
    var col = (typeof PROD_CAT_COLORS!=='undefined' && PROD_CAT_COLORS[cat]) || '#94a3b8';
    return '<span class="cmp-dot" style="background:' + col + '"></span>';
  }
  function _sortSelect(){
    var opts = [
      ['saving','Mayor ahorro'],
      ['pct',   'Mayor diferencia %'],
      ['price', 'Menor precio'],
      ['name',  'Nombre']
    ];
    return '<select class="cmp-input" onchange="cmpSetSort(this.value)">'
      + opts.map(function(o){
          return '<option value="' + o[0] + '"' + (S.cmpSort===o[0]?' selected':'') + '>' + _e(o[1]) + '</option>';
        }).join('')
      + '</select>';
  }
  function _kindTabs(){
    var opts = [['all','Todos'],['saving','Con oportunidad'],['single','Sin alternativa']];
    return '<div class="cmp-kind">' + opts.map(function(o){
      return '<button type="button" class="cmp-kind-btn' + (S.cmpKind===o[0]?' act':'') + '" onclick="cmpSetKind(\'' + o[0] + '\')">' + _e(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function _catSelect(groups){
    var cats = Array.from(new Set(groups.map(function(g){ return g.cat || 'Otros'; }))).sort();
    return '<select class="cmp-input" onchange="cmpSetCat(this.value)">'
      + '<option value="">Todas las categorías</option>'
      + cats.map(function(c){ return '<option value="' + _a(c) + '"' + (S.cmpCat===c?' selected':'') + '>' + _e(c) + '</option>'; }).join('')
      + '</select>';
  }
  function _supSelect(){
    var sups = (typeof supList==='function') ? supList() : [];
    return '<select class="cmp-input" onchange="cmpSetSup(this.value)">'
      + '<option value="">Todos los proveedores</option>'
      + sups.map(function(s){ return '<option value="' + _a(s.id) + '"' + (S.cmpSup===s.id?' selected':'') + '>' + _e(s.name || '') + '</option>'; }).join('')
      + '</select>';
  }

  function _row(g){
    var open = !!(S.cmpOpen && S.cmpOpen[g.key]);
    var pctTxt = g.hasSaving ? ('−' + g.diffPct.toFixed(1) + '%') : '—';
    var pctCls = g.hasSaving ? 'cmp-pct-pos' : 'cmp-pct-mut';
    var priceMin = g.minPrice!=null
      ? (fmt(g.minPrice) + '<span class="cmp-unit"> / ' + _e(g.famBase||'') + '</span>')
      : '<span class="cmp-mut">—</span>';
    var priceMax = (g.maxPrice!=null && g.maxPrice!==g.minPrice)
      ? (fmt(g.maxPrice) + '<span class="cmp-unit"> / ' + _e(g.famBase||'') + '</span>')
      : '<span class="cmp-mut">—</span>';
    var diffAbs  = g.hasSaving ? fmt(g.diffAbs) : '<span class="cmp-mut">—</span>';
    var bestCell = g.compCount>=1 && g.bestSup
      ? _e(g.bestSup)
      : (g.totalCount===1 ? _e(g.offers[0].supName || '') : '<span class="cmp-mut">Sin comparables</span>');
    var altText  = g.totalCount + (g.totalCount!==g.compCount ? ' (' + g.compCount + ' comp.)' : '');

    // El key va como data-attribute (escape HTML puro) y se lee vía
    // dataset dentro del handler, para evitar cualquier vector XSS al
    // interpolarlo dentro de un `onclick="cmpToggle('...')"`.
    var head =
      '<tr class="cmp-row' + (open?' cmp-open':'') + '" data-cmp-key="' + _a(g.key) + '" onclick="cmpToggle(this.dataset.cmpKey)">' +
        '<td class="cmp-td cmp-td-name"><div class="cmp-name-w">' + _catDot(g.cat) + '<span class="cmp-name">' + _e(g.name) + '</span></div></td>' +
        '<td class="cmp-td cmp-td-cat">' + _e(g.cat || 'Otros') + '</td>' +
        '<td class="cmp-td cmp-td-num cmp-td-best">' + priceMin + '</td>' +
        '<td class="cmp-td cmp-td-sup">' + bestCell + '</td>' +
        '<td class="cmp-td cmp-td-num cmp-th-hide-md">' + priceMax + '</td>' +
        '<td class="cmp-td cmp-td-num cmp-th-hide-md">' + diffAbs + '</td>' +
        '<td class="cmp-td cmp-td-num"><span class="' + pctCls + '">' + pctTxt + '</span></td>' +
        '<td class="cmp-td cmp-td-alt cmp-th-hide-sm">' + altText + '</td>' +
        '<td class="cmp-td cmp-td-tog"><span class="cmp-caret">' + (open?'▾':'▸') + '</span></td>' +
      '</tr>';

    if(!open) return head;

    // Detalle: todas las ofertas ordenadas por precio base (no comparables al final).
    var offers = g.offers.slice().sort(function(a,b){
      var av = a.comparable ? a.basePrice : Infinity;
      var bv = b.comparable ? b.basePrice : Infinity;
      return av-bv;
    });
    var detailRows = offers.map(function(o){
      var isBest = o.comparable && g.minPrice!=null && Math.abs(o.basePrice - g.minPrice) < 1e-6;
      var normCell, diffCell, tag;
      if(o.comparable){
        normCell = fmt(o.basePrice) + '<span class="cmp-unit"> / ' + _e(o.baseUnit) + '</span>'
                 + (o.viaPesoGr ? ' <span class="cmp-mut" title="Calculado a partir del peso por unidad">(peso)</span>' : '');
        var d = g.minPrice!=null ? (o.basePrice - g.minPrice) : 0;
        diffCell = isBest ? '<span class="cmp-best-tag">Mejor</span>' : ('+' + fmt(d));
        tag = '';
      } else {
        normCell = '<span class="cmp-mut">No comparable</span>';
        diffCell = '<span class="cmp-mut">—</span>';
        tag = o.reason==='sin_precio'       ? 'Sin precio'
            : o.reason==='sin_unidad'       ? 'Sin unidad'
            : o.reason==='familia_distinta' ? 'Familia distinta'
            : o.reason==='sin_conversion'   ? 'Sin conversión definida'
            : 'No comparable';
      }
      return '<tr class="cmp-drow' + (isBest?' cmp-drow-best':'') + '">' +
        '<td class="cmp-dtd">' + _e(o.supName || '') + '</td>' +
        '<td class="cmp-dtd cmp-td-num">' + fmt(o.rawPrice) + '<span class="cmp-unit"> / ' + _e(o.rawUnit || '') + '</span></td>' +
        '<td class="cmp-dtd cmp-td-num">' + normCell + '</td>' +
        '<td class="cmp-dtd cmp-td-num">' + diffCell + '</td>' +
        '<td class="cmp-dtd">' + (tag ? '<span class="cmp-warn-tag">' + _e(tag) + '</span>' : '') + '</td>' +
      '</tr>';
    }).join('');

    var note = '';
    if(g.compCount<2 && g.totalCount>=2){
      note = '<div class="cmp-detail-note">Este producto tiene varias ofertas pero no son comparables entre sí. Añade una conversión al producto (por ejemplo "1 Caja = X KG") o define el peso por unidad para poder normalizar los precios.</div>';
    } else if(g.totalCount===1){
      note = '<div class="cmp-detail-note">Producto disponible en un solo proveedor. Sin alternativa para comparar.</div>';
    }

    var detail =
      '<tr class="cmp-detail-tr"><td colspan="9" class="cmp-detail-td">' +
        note +
        '<div class="cmp-detail-tbl-w"><table class="cmp-detail-tbl">' +
          '<thead><tr>' +
            '<th>Proveedor</th>' +
            '<th class="cmp-td-num">Precio original</th>' +
            '<th class="cmp-td-num">Precio normalizado</th>' +
            '<th class="cmp-td-num">Δ vs mejor</th>' +
            '<th>Estado</th>' +
          '</tr></thead>' +
          '<tbody>' + detailRows + '</tbody>' +
        '</table></div>' +
      '</td></tr>';

    return head + detail;
  }

  /* ────────── vCompare(): entry point ────────── */
  function vCompare(){
    _initState();
    var sups = (typeof supList==='function') ? supList() : [];

    if(!sups.length){
      return _headerHtml() + _kpiHtml(null) +
        '<div class="cmp-empty"><div class="cmp-empty-t">Sin proveedores</div><div class="cmp-empty-s">Añade proveedores desde el módulo Proveedores para comenzar a comparar precios.</div></div>';
    }
    if(sups.length===1){
      return _headerHtml() + _kpiHtml(null) +
        '<div class="cmp-empty"><div class="cmp-empty-t">Un único proveedor</div><div class="cmp-empty-s">Necesitas al menos dos proveedores registrados para poder comparar sus precios.</div></div>';
    }

    var groups = buildGroups();
    if(!groups.length){
      return _headerHtml() + _kpiHtml(null) +
        '<div class="cmp-empty"><div class="cmp-empty-t">Sin productos</div><div class="cmp-empty-s">Los proveedores no tienen productos cargados. Añade productos y precios en el módulo Proveedores.</div></div>';
    }

    var kpis     = calcKpis(groups);
    var filtered = filterSort(groups);

    var head    = _headerHtml();
    var kpiHtml = _kpiHtml(kpis);
    var filters = _filtersHtml(groups);

    var tableBody = filtered.length
      ? filtered.map(_row).join('')
      : '<tr><td class="cmp-td cmp-empty-cell" colspan="9">Ningún producto coincide con los filtros aplicados.</td></tr>';

    var table =
      '<div class="cmp-panel">' +
        '<div class="cmp-table-w">' +
          '<table class="cmp-table">' +
            '<thead><tr>' +
              '<th class="cmp-th cmp-th-name">Producto</th>' +
              '<th class="cmp-th cmp-th-cat">Categoría</th>' +
              '<th class="cmp-th cmp-th-num">Mejor precio</th>' +
              '<th class="cmp-th cmp-th-sup">Mejor proveedor</th>' +
              '<th class="cmp-th cmp-th-num cmp-th-hide-md">Precio más alto</th>' +
              '<th class="cmp-th cmp-th-num cmp-th-hide-md">Δ €</th>' +
              '<th class="cmp-th cmp-th-num">Δ %</th>' +
              '<th class="cmp-th cmp-th-alt cmp-th-hide-sm">Ofertas</th>' +
              '<th class="cmp-th cmp-th-tog"></th>' +
            '</tr></thead>' +
            '<tbody>' + tableBody + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    var count =
      '<div class="cmp-count">' +
        _e(filtered.length + ' producto' + (filtered.length===1?'':'s') + ' de ' + groups.length + ' analizado' + (groups.length===1?'':'s')) +
      '</div>';

    return head + kpiHtml + filters + count + table;
  }

  /* ────────── Trozos HTML fijos ────────── */
  function _headerHtml(){
    return '<div class="cmp-head">' +
      '<div class="cmp-head-t">Comparar precios</div>' +
      '<div class="cmp-head-s">Detecta el mejor proveedor y las principales oportunidades de ahorro</div>' +
    '</div>';
  }
  function _kpiHtml(k){
    if(!k){
      return '<div class="cmp-kpi-grid">' +
        _kpi('Productos comparables',   '<span class="cmp-mut">—</span>') +
        _kpi('Ahorro potencial',        '<span class="cmp-mut">—</span>', 'Suma Δ por unidad base') +
        _kpi('Proveedores analizados', '<span class="cmp-mut">—</span>') +
        _kpi('Oportunidades detectadas','<span class="cmp-mut">—</span>') +
      '</div>';
    }
    var ahorroVal = k.ahorro>0 ? fmt(k.ahorro) : '<span class="cmp-mut">—</span>';
    return '<div class="cmp-kpi-grid">' +
      _kpi('Productos comparables',    String(k.comparables)) +
      _kpi('Ahorro potencial',         ahorroVal, 'Suma Δ (peor − mejor) por unidad base') +
      _kpi('Proveedores analizados',   String(k.supsCount)) +
      _kpi('Oportunidades detectadas', String(k.opor)) +
    '</div>';
  }
  function _filtersHtml(groups){
    var val = _a(S.cmpSearch || '');
    return '<div class="cmp-filters">' +
      '<input class="cmp-input cmp-search" type="text" placeholder="Buscar producto..." value="' + val + '" oninput="cmpSetSearch(this.value)" />' +
      _catSelect(groups) +
      _supSelect() +
      _kindTabs() +
      '<div class="cmp-sort"><label class="cmp-sort-l">Ordenar</label>' + _sortSelect() + '</div>' +
    '</div>';
  }

  /* ────────── Handlers globales ────────── */
  function _rerender(){
    if(typeof renderAdminContent==='function') renderAdminContent();
  }
  window.cmpSetSearch = function(v){
    S.cmpSearch = v;
    _rerender();
    var el = document.querySelector('.cmp-search');
    if(el){ try{ el.focus(); el.setSelectionRange(v.length, v.length); }catch(e){} }
  };
  window.cmpSetCat  = function(v){ S.cmpCat  = v || '';       _rerender(); };
  window.cmpSetSup  = function(v){ S.cmpSup  = v || '';       _rerender(); };
  window.cmpSetKind = function(v){ S.cmpKind = v || 'all';    _rerender(); };
  window.cmpSetSort = function(v){ S.cmpSort = v || 'saving'; _rerender(); };
  window.cmpToggle  = function(k){
    if(!S.cmpOpen) S.cmpOpen = {};
    if(S.cmpOpen[k]) delete S.cmpOpen[k]; else S.cmpOpen[k] = true;
    _rerender();
  };

  /* ────────── Exponer vCompare ────────── */
  window.vCompare = vCompare;

})();
