/* NOVENTIA UI — integración no destructiva del editor de escandallos */
(function(){
  function syncEscEditor(){
    var editor=document.getElementById('esc-modal-ov');
    if(!editor) return;
    editor.classList.add('esc-edit-screen');
    var visible=editor.style.display==='block' || getComputedStyle(editor).display==='block';
    document.body.classList.toggle('noventia-esc-editor-open',visible);
  }
  function start(){
    syncEscEditor();
    var observer=new MutationObserver(syncEscEditor);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
