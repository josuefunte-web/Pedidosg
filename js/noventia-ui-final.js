/* NOVENTIA UI — integración no destructiva del editor de escandallos
   Solo observa el nodo #esc-modal-ov (no todo el document.body), y
   solo mira cambios en `style` y `class`. Coste ~cero. */
(function(){
  var body=document.body;
  function isVisible(el){
    if(!el) return false;
    // Solo el estilo en línea: el CSS fuerza display:block!important mientras
    // la clase está puesta, así que getComputedStyle nunca dejaría de ser
    // 'block' y el editor no se cerraría tras guardar.
    return !!(el.style && el.style.display==='block');
  }
  function sync(){
    var editor=document.getElementById('esc-modal-ov');
    if(!editor){ body.classList.remove('noventia-esc-editor-open'); return; }
    body.classList.toggle('noventia-esc-editor-open', isVisible(editor));
  }
  var attached=false;
  function attach(){
    if(attached) return;
    var editor=document.getElementById('esc-modal-ov');
    if(!editor) return;                       // aún no existe, se reintenta
    attached=true;
    sync();
    new MutationObserver(sync).observe(editor,{
      attributes:true, attributeFilter:['style','class']
    });
  }
  function start(){
    attach();
    if(!attached){
      // El modal se crea después del render inicial. Reintentar hasta
      // que aparezca, sin observers pesados sobre el body.
      var tries=0;
      var t=setInterval(function(){
        attach();
        if(attached || ++tries>40) clearInterval(t);   // max 20s
      },500);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
