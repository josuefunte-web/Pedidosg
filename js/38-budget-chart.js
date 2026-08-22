/* ═══════════════ BUDGET TREND CHART ═══════════════ */
function renderBudgetTrendChart(){
  const canvas=document.getElementById('budget-trend-chart');
  if(!canvas) return;
  if(window._budgetTrendChart){window._budgetTrendChart.destroy();window._budgetTrendChart=null;}
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push(d.toISOString().slice(0,7));
  }
  const labels=months.map(m=>{const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleDateString('es',{month:'short',year:'2-digit'});});
  const spendData=months.map(m=>{
    const fromOrders=orders.filter(o=>(o.status==='approved'||o.status==='received')&&(o.createdAt||'').startsWith(m)).reduce((s,o)=>s+total(o),0);
    const fromExtra=Object.values(extraExpenses).filter(ex=>(ex.date||ex.createdAt||'').startsWith(m)).reduce((s,ex)=>s+(parseFloat(ex.amount)||0),0);
    return fromOrders+fromExtra;
  });
  const budgetData=months.map(m=>{
    return cfg.users.reduce((s,u)=>s+(budgets[u.id+'_'+m]||0),0);
  });
  window._budgetTrendChart=new Chart(canvas,{
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Gasto real',data:spendData,backgroundColor:'#e9456099',borderColor:'#e94560',borderWidth:1.5,borderRadius:4},
        {label:'Presupuesto',data:budgetData,backgroundColor:'#1a1a2e33',borderColor:'#1a1a2e',borderWidth:1.5,borderRadius:4,type:'line',fill:false,tension:0.3,pointRadius:4}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}},scales:{y:{ticks:{callback:v=>'€'+v.toLocaleString('es')},grid:{color:'#f0f0f0'}},x:{grid:{display:false}}}}
  });
}
