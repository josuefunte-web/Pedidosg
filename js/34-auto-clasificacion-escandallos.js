/* ═══════════════ AUTO-CLASIFICACIÓN DE ESCANDALLOS ═══════════════ */
// Llama a esta función desde la consola del navegador: escAutoClasificar()
function escAutoClasificar(){
  if(!fbDb){alert('Sin conexión Firebase');return;}
  const MAP = {
    // ── PRIMEROS ──
    'ALCACHOFA CON ROMESO':'Primeros','BRAVAS':'Primeros','BRAVAS (2)':'Primeros',
    'CANELON':'Primeros','CANELON DE HUMMUS':'Primeros',
    'COCA BON MOS':'Primeros','COCA BURRATA':'Primeros','COCA EMPORDA':'Primeros',
    'COCA POLLO':'Primeros','COCAPIZZA':'Primeros',
    'CROQUETAS DE BOLETUS':'Primeros','CROQUETAS DE JAMON':'Primeros',
    'CROQUETA DE GAMBA ROJA':'Primeros',
    'ENSALADA CESAR':'Primeros','ENSALADA DE CALABAZA':'Primeros',
    'ENSALADA DE QUINOA':'Primeros','ENSALADA DE TRIGUEROS':'Primeros',
    'ENSALADILLA RUSA':'Primeros','ESPAGUETIS':'Primeros','FINGUERS':'Primeros',
    'MACARRONES':'Primeros','MEJILLONES AL VAPOR':'Primeros',
    'MEJILLONES EN ESCABECHE':'Primeros','NACHOS CON GUACAMOLE':'Primeros',
    'RAVIOLIS':'Primeros','TARTAR DE SALMON':'Primeros',
    'TORTILLA DE PATATAS':'Primeros','ANCHOA CON PAN Y TOMATE':'Primeros',
    // ── SEGUNDOS ──
    'BACALAO':'Segundos','BUTIFARA':'Segundos',
    'CALAMAR ANDALUZA':'Segundos','CALAMAR POTERA':'Segundos',
    'CARRILLERA':'Segundos','CARRILLERA A LA BRASA':'Segundos',
    'COMBINADO PESCADO':'Segundos','COSTILLA BBQ':'Segundos',
    'ENTRECOT':'Segundos','HAMBURGUESA CON BEICON Y QUESO':'Segundos',
    'HAMBURGUESA MADURADA':'Segundos','LA MORENA':'Segundos',
    'LUBINA DONOSTIARRA':'Segundos','MAGRET':'Segundos',
    'MUSLO DE POLLO':'Segundos','PIES DE CERDO':'Segundos',
    'PULPO LUCIANA':'Segundos','SECRETO IBERICO':'Segundos','TACOS':'Segundos',
    // ── POSTRES ──
    'CRUMBLE DE ALMENDRAS':'Postres','HELADOS':'Postres','MUSSE DE PISTACHO':'Postres',
    // ── OTROS (bocadillos, bollería, salsas base) ──
    'BOCADILLO ATUN':'Otros','BOCADILLO BEICON':'Otros','BOCADILLO DE FUET':'Otros',
    'BOCADILLO DE JAMON SERRANO':'Otros','BOCADILLO DE QUESO TIERNO':'Otros',
    'BOCADILLO JAMON IBERICO':'Otros','BOCADILLO LOMO':'Otros',
    'BOCADILLO LONGANIZA':'Otros','BOCADILLO POLLO':'Otros',
    'BOCADILLO TORTILLA DE PATATAS':'Otros','BOCADILLO TORTILLA FRANCESA':'Otros',
    'BOLLERIA':'Otros','CROISANT IBERICO':'Otros','CROISANT JAMON':'Otros',
    'CROISANT NUTELA':'Otros','CROISANT PLANCHADO':'Otros','PLANCHADO':'Otros',
    'SALSA BRAVA':'Otros','SALSA TARTARA':'Otros',
  };
  fbDb.ref('escandallos').once('value', snap=>{
    const data=snap.val()||{};
    let actualizados=0, noEncontrados=[];
    const updates={};
    Object.entries(data).forEach(([key,e])=>{
      const nombre=(e.nombre||'').toUpperCase().trim();
      const nuevaCat=MAP[nombre];
      if(nuevaCat && nuevaCat!==e.categoria){
        updates[key+'/categoria']=nuevaCat;
        actualizados++;
      } else if(!nuevaCat){
        noEncontrados.push(e.nombre);
      }
    });
    if(Object.keys(updates).length===0){
      toast('Todos los escandallos ya están clasificados correctamente ✓','#16a34a');
      return;
    }
    fbDb.ref('escandallos').update(updates).then(()=>{
      toast(`${actualizados} escandallos actualizados`,'#16a34a');
      if(noEncontrados.length) console.warn('Sin clasificar (mantienen categoría actual):', noEncontrados);
    }).catch(e=>toast('Error: '+e.message,'#dc2626'));
  });
}
