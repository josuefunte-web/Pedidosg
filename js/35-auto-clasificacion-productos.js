/* ═══════════════ AUTO-CLASIFICACIÓN DE PRODUCTOS ═══════════════ */
const PROD_CAT_KEYWORDS = {
  'Carnes': [
    'entrecot','lomo','pollo','pechuga','muslo','alita','ala ','conejo','pato','pavo','cordero','ternera','buey','jabalí','ciervo','vacuno','bovino','porcino','cerdo',
    'chuleta','chuletón','costilla','secreto','presa','pluma','solomillo','filete','bistec','burger','hamburguesa',
    'morcilla','chorizo','salchicha','longaniza','butifarra','butifarr','fuet','sobrasada','bacon','panceta','tocino',
    'jamón','jamon','lomo embuchado','mortadela','salami','pepperoni','embutido',
    'foie','higado','hígado','mollejas','riñón','rinon','tuétano','rabo','carrillera','morro','tripa','callos',
    'lacón','lacon','codillo','pernil','xoriç','xoric','chuleton','ossobuco','magret','pulled','albóndiga','albondiga',
    'manitas','papada','carrillo','pá','carn','porc','vedella','pollastre','xai',
    'hamburguesa','croqueta de jamon','croqueta de pollo','bull blanc','bull negre',
  ],
  'Pescados': [
    'merluza','bacalao','salmon','salmón','atún','atun','lubina','dorada','lenguado','rape','rodaballo',
    'boquerón','boqueron','anchoa','sardina','trucha','halibut','besugo','pargo','mero','corvina','palometa',
    'sepia','pulpo','calamar','chipirón','chiparon','jibia','gamba','langosta','langostino','quisquilla',
    'percebe','mejillón','almejas','ostra','navaja','berberecho','nécora','necora','centollo','bogavante',
    'buey de mar','vieira','coquina','zamburiña','marisco','pescado','peix','gambeta','llobregant',
    'gambas','gambón','gambeta','carabinero','camarón','langostí','llagosta','musclo','cloïssa',
    'bacallà','lluç','pop','calamar','sípia','anxova','sardina','verat','moll','rap','llobarro','orada',
    'cloïsses','escopinyes','tellerina','navalles','ostra','sèpia',
  ],
  'Verduras y Frutas': [
    'tomate','lechuga','cebolla','ajo ','ajos','pimiento','zanahoria','patata','papa ','coliflor','brocoli','brócoli',
    'espinaca','acelga','judía','guisante','champiñón','seta','espárrago','esparrago','alcachofa','berenjena',
    'calabacín','pepino','remolacha','apio','hinojo','rúcula','rucula','endivia','escarola','col ','repollo',
    'lombarda','puerro','nabo','boniato','batata','cardo','borraja','canónigos','berro','rabanito',
    'manzana','pera','naranja','limón','limon','fresa','frambuesa','arándano','arandano','cereza','melocotón',
    'melocoton','albaricoque','ciruela','uva ','sandía','sandia','melón','melon','mango','piña','pina ','kiwi',
    'plátano','platano','aguacate','higo','granada','mandarina','pomelo','lima ','coco','papaya','maracuyá',
    'mora','grosella','níspero','nispero','caqui','nectarina','membrillo','dátil','datel','verdura','fruta',
    'hortaliza','ensalada','vegetal','ecológic','ecologico','tomàquet','ceba','all ','mongeta','pastanaga',
    'carbassó','albergínia','bròquil','enciam','escarola','espinacs','xampinyó','bolet','espàrrec',
    'poma','pera ','maduixa','cirera','préssec','raïm','plàtan','taronja','llimona','mango','alvocat',
  ],
  'Lácteos': [
    'leche','nata ','crema de leche','mantequilla','queso','yogur','requesón','requeson','ricota','ricotta',
    'mozzarella','parmesano','gouda','emmental','brie','camembert','roquefort','gorgonzola','cheddar',
    'manchego','gruyere','gruyère','idiazábal','tetilla','mascarpone','burrata','feta','provolone',
    'pecorino','cottage','kéfir','kefir','buttermilk','cuajada','lactosuero','lacto',
    'llet','mantega','formatge','iogurt','mató','recuit','crema fresca',
  ],
  'Pasta y Arroces': [
    'pasta','espagueti','spaguetti','macarron','macarrón','tallarín','tallarin','tagliatelle','penne',
    'fusilli','rigatoni','fettuccine','lasaña','lasagna','lasanya','ravioli','tortellini','gnocchi','ñoqui',
    'arroz','risotto','cuscus','couscous','quinoa','polenta','bulgur','fideo','vermicelli','orzo',
    'farfalle','pappardelle','linguine','bucatini','conchiglie','fideuà','fideua','arros',
  ],
  'Conservas': [
    'conserva','en lata','en tarro','en bote','escabeche','encurtido','encurtit','pepinillo','alcaparra',
    'maíz en','maiz en','atún en','sardina en','mejillón en','tomate frito','tomate natural','tomate triturado',
    'passata','passata','caldo envasado','paté','pate ','foie en','trufa en','mermelada','compota','confitura',
    'en aceite','en salazón','en escabeche','en vinagre','anchoa en','oliva en','olive en',
    'aceituna rellena','aceituna negra','aceituna verde','tapenade',
  ],
  'Condimentos': [
    'sal ','sal marina','sal fina','pimienta','aceite','vinagre','mostaza','ketchup','mayonesa','salsa ',
    'salsa de soja','soja ','especias','hierbas','oregano','orégano','albahaca','tomillo','romero',
    'comino','pimenton','pimentón','paprika','canela','vainilla','jengibre','curcuma','cúrcuma',
    'azafran','azafrán','laurel','perejil','cilantro','menta','estragon','estragón','eneldo',
    'curry','tahini','miso','nuez moscada','cardamomo','clavo','anis','anís','azúcar','azucar','miel',
    'sirope','melaza','aliño','alioli','harissa','sriracha','tabasco','worcestershire','vinagreta',
    'aceite de oliva','aove','aceite virgen','aceite girasol','aceite trufa',
    'flor de sal','maldon','sal gruesa','sal ahumada',
    'salsa césar','salsa brava','salsa bechamel','salsa romesco','salsa verde',
    'ali-oli','alioli','romesco','chimichurri','pesto','tapenade',
  ],
  'Panadería': [
    'pan ','baguette','brioche','croissant','hojaldre','masa ','harina','panecillo','chapata','ciabatta',
    'focaccia','mollete','pita','levadura','bizcocho','tarta','galleta','churro','donut','muffin',
    'magdalena','ensaimada','coca ','kouign','palmera','éclair','profiterol',
    'pasta brisa','pasta choux','filo','phyllo','wonton','crepe','oblea','barquillo',
    'pa ','farina','brioix','croissant','full de pasta','pasta de full',
    'panettone','roscón','torrija','buñuelo',
  ],
  'Bebidas': [
    'agua ','refresco','zumo','jugo','café','cafe ','té ','te ','cerveza','vino ','cava ','champán','champan',
    'champagne','licor','ron ','vodka','whisky','whiskey','gin ','ginebra','brandy','cóctel','coctel',
    'soda','tónica','tonica','bitter','vermut','vermouth','sidra','horchata','granizado','infusión',
    'infusion','kombucha','sangría','sangria','refresc','cervesa','vi ','cava','conyac','licor',
    'agua mineral','agua con gas','sin gas','isotónico','bebida energética','batido','smoothie',
  ],
  'Limpieza': [
    'jabón','jabon','detergente','lejía','lejia','desinfectante','suavizante','bayeta','estropajo',
    'guante','esponja','papel cocina','papel alumini','film ','film plástico','bolsa ','envase',
    'contenedor','caja ','packaging','limpiasuelos','limpiacristales','friegasuelos','amoniaco',
    'papel absorbente','servilleta','mantel','rollo','basura','cubo de basura',
  ],
};

function _normalizarTexto(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}
function clasificarProductoAuto(name){
  if(!name) return 'Otros';
  const norm=_normalizarTexto(name);
  // Palabras del nombre (sin acentos, sin signos). Evita falsos positivos por
  // subcadena: antes "Tomate" caía en Bebidas porque contenía "te ".
  const palabras=norm.split(/[^a-z0-9]+/).filter(Boolean);
  const setPalabras=new Set(palabras);
  // Prioridad: Bebidas > Lácteos > Carnes > Pescados > Panadería > Verduras > Pasta > Conservas > Condimentos > Limpieza
  const order=['Bebidas','Lácteos','Carnes','Pescados','Panadería','Verduras y Frutas','Pasta y Arroces','Conservas','Condimentos','Limpieza'];
  for(const cat of order){
    const keywords=PROD_CAT_KEYWORDS[cat]||[];
    for(let kw of keywords){
      kw=_normalizarTexto(kw).trim();
      if(!kw) continue;
      if(kw.includes(' ')){
        // Palabra clave de varias palabras → buscar la frase completa
        if(norm.includes(kw)) return cat;
      } else {
        // Palabra clave simple → coincidencia por palabra completa o plural,
        // y prefijo solo si la palabra clave es larga (≥5) para evitar errores.
        for(const w of setPalabras){
          if(w===kw || w===kw+'s' || w===kw+'es' || (kw.length>=5 && w.startsWith(kw))) return cat;
        }
      }
    }
  }
  return 'Otros';
}

// forzar=false → solo clasifica productos sin categoría (suave)
// forzar=true  → corrige TAMBIÉN los mal clasificados, pero nunca degrada a "Otros"
function autoClasificarProductos(forzar){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  let total=0, clasificados=0, corregidos=0, sinCat=[];
  Object.entries(suppliers).forEach(([sid,sup])=>{
    if(!Array.isArray(sup.products)) return;
    sup.products.forEach(p=>{
      total++;
      const cat=clasificarProductoAuto(p.name);
      const vacia=!p.category||p.category==='Otros'||p.category==='📦 Otros';
      if(cat==='Otros'){ if(vacia) sinCat.push(p.name); return; }
      if(vacia){ p.category=cat; clasificados++; }
      else if(forzar && p.category!==cat){ p.category=cat; corregidos++; }
    });
  });

  if(!clasificados && !corregidos){
    toast(`Nada que cambiar — ${total} productos revisados`,'#16a34a');
    if(sinCat.length) console.info('Sin clasificar (revisar a mano):', sinCat);
    return;
  }
  saveSups();
  const partes=[];
  if(clasificados) partes.push(`${clasificados} nuevos`);
  if(corregidos) partes.push(`${corregidos} corregidos`);
  toast(`Clasificación actualizada: ${partes.join(' · ')} (${total} revisados)`,'#16a34a',5000);
  if(sinCat.length) console.info(`${sinCat.length} sin clasificar (quedan en su categoría / revisar a mano):`, sinCat);
  renderAdminContent();
}
function reclasificarTodo(){
  const n=Object.values(suppliers).reduce((a,s)=>a+((Array.isArray(s.products)?s.products.length:0)),0);
  if(!confirm(`Revisar y CORREGIR la categoría de los ${n} productos.\n\nSe reasignarán los que estén mal clasificados. Los que el sistema no reconozca se quedan como están (no se ponen en "Otros"). ¿Continuar?`)) return;
  autoClasificarProductos(true);
}
