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
  S.albPhoto=out.toDataURL('image/jpeg',0.85);
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
  // Imagen o PDF → base64. Las imágenes se reducen (máx. 1800 px, JPEG 0.8): una
  // foto de móvil a resolución completa pesa 5-10 MB, ralentiza el OCR y se
  // guardaba entera en la base de datos.
  const reader=new FileReader();
  reader.onload=async e=>{
    const isImg=file.type.startsWith('image');
    let data=e.target.result;
    if(isImg){
      try{ data=await ocrPrepareImage(data); }
      catch(err){ toast((err&&err.message)||'No se ha podido abrir la imagen','#dc2626',5000); return; }
    }
    S.albPhoto=data;
    S.albFileName=file.name;
    S.albFileType=isImg?'image':'pdf';
    S.albOcrMsg=null;
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

// El OCR (runOCR y compañía) vive ahora en js/48-ocr-albaran.js

function saveAlbaran(){
  const rest=S.session&&!S.session.isAdmin?S.session.restaurant:(document.getElementById('alb-rest')?.value||S.albRestaurant);
  const supId=document.getElementById('alb-sup')?.value||S.albSupId;
  const date=document.getElementById('alb-date')?.value||S.albDate;
  if(!rest){toast('Selecciona el restaurante','#dc2626');return;}
  const valid=S.albItems.filter(it=>it.name&&it.qty>0).map(it=>({...it,iva:albLineIva(it)}));
  if(!valid.length){toast('Añade al menos un producto con nombre y cantidad','#dc2626');return;}
  // Vincular/añadir productos del albarán al catálogo del proveedor por código
  let nuevos=0, vinculados=0, actualizados=0;
  const sup=suppliers[supId];
  if(sup){
    if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
    const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    valid.forEach(it=>{
      const code=String(it.code||'').trim();
      const nuevoPrecio=parseFloat(it.price||0)||0;
      const nuevoIva=albLineIva(it);
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
  const a={id:uid(),restaurant:rest,supId,date,photo:S.albPhoto,items:valid,createdAt:new Date().toISOString(),...(S.albTotalManual!==null?{totalManual:S.albTotalManual}:{})};
  saveAlb(a);
  const msgParts=[];
  if(nuevos>0) msgParts.push(`${nuevos} nuevo${nuevos!==1?'s':''}`);
  if(vinculados>0) msgParts.push(`${vinculados} vinculado${vinculados!==1?'s':''} por código`);
  if(actualizados>0) msgParts.push(`${actualizados} precio${actualizados!==1?'s':''} actualizado${actualizados!==1?'s':''}`);
  toast(msgParts.length?`Albarán guardado · ${msgParts.join(' · ')} en catálogo`:'Albarán guardado','#16a34a');
  if(S.session&&S.session.isAdmin){ S.adminTab='albaranes';goAdmin(); } else goOrder();
}
