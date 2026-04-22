import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts";
import { saveData, onDataChange } from "./firebase";

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════
const fmt = n => { if(n==null||isNaN(n))return"$0"; const a=Math.abs(Math.round(n)); return(n<0?"-$":"$")+a.toString().replace(/\B(?=(\d{3})+(?!\d))/g,"."); };
const fmtS = n => { const a=Math.abs(n); if(a>=1e6)return`${(n/1e6).toFixed(1)}M`; if(a>=1e3)return`${Math.round(n/1e3)}K`; return`${Math.round(n)}`; };
const today = () => new Date().toISOString().split("T")[0];
const mKey = d => d.slice(0,7);
const mLabel = k => { const[y,m]=k.split("-"); return`${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+m-1]} ${y.slice(2)}`; };
const pct = (a,b) => b?Math.round(a/b*100):0;
const AUD_CLP = 625;

// ══════════════════════════════════════════════════════════════════════
// CONFIG & CATEGORIES
// ══════════════════════════════════════════════════════════════════════
const GROUPS = {"Vivienda":{i:"🏠",c:"#3B82F6"},"Alimentación":{i:"🍽",c:"#10B981"},"Transporte":{i:"🚗",c:"#F59E0B"},"Entretención":{i:"🎉",c:"#8B5CF6"},"Personal":{i:"👤",c:"#EC4899"},"Familia":{i:"👨‍👩‍👧",c:"#14B8A6"},"Financiero":{i:"🏦",c:"#F97316"},"Viajes":{i:"✈️",c:"#06B6D4"},"Otros":{i:"📦",c:"#64748B"}};

const CATS = [
  {n:"Arriendo",g:"Vivienda"},{n:"Gastos Comunes",g:"Vivienda"},{n:"Servicios",g:"Vivienda"},
  {n:"Supermercado",g:"Alimentación"},{n:"Comida Diaria",g:"Alimentación"},
  {n:"Bencina",g:"Transporte"},{n:"Cuota Auto",g:"Transporte"},{n:"Seguro Auto",g:"Transporte"},{n:"Mantención Auto",g:"Transporte"},{n:"Movilización",g:"Transporte"},
  {n:"Restoranes/Salidas",g:"Entretención"},{n:"Cervezas/Copas",g:"Entretención"},{n:"Gimnasio",g:"Entretención"},{n:"Recreación",g:"Entretención"},
  {n:"Farmacia",g:"Personal"},{n:"Celular",g:"Personal"},{n:"Ropa/Accesorios",g:"Personal"},{n:"Peluquería",g:"Personal"},{n:"Gastos Propios",g:"Personal"},
  {n:"Hermana",g:"Familia"},{n:"Regalos",g:"Familia"},{n:"Transferencias",g:"Familia"},
  {n:"Crédito Auto",g:"Financiero"},{n:"Intereses/Comisiones",g:"Financiero"},{n:"Suscripciones",g:"Financiero"},{n:"Pago Tarjeta",g:"Financiero"},
  {n:"Pasajes",g:"Viajes"},{n:"Alojamiento",g:"Viajes"},{n:"Otros",g:"Otros"},
];
const catGroup = cat => CATS.find(c=>c.n===cat)?.g||"Otros";

const INIT_DEBTS = [
  {id:"lc",name:"Línea de Crédito",cupo:1000000,usado:0,tasa:2.8},
  {id:"plat",name:"TC Santander Plat.",cupo:4000000,usado:0,tasa:3.2},
  {id:"life",name:"TC Santander Life",cupo:1700000,usado:0,tasa:3.2},
  {id:"cmr",name:"CMR Falabella",cupo:390000,usado:0,tasa:3.5},
];
const INIT_BUD = {"Vivienda":250000,"Alimentación":300000,"Transporte":200000,"Entretención":200000,"Personal":150000,"Familia":120000,"Financiero":80000,"Viajes":0,"Otros":50000};
const CARDS = ["TC SANT Plat","TC SANT Life","CMR Falabella","TD SANT","Línea Créd","Efectivo","CommBank AUS"];
const FIXED = [{name:"Crédito Auto",amount:180000},{name:"Mantención Hermana",amount:100000},{name:"CommBank Celular",amount:Math.round(40*AUD_CLP)}];
const INC = {audWeek:900,clpFixed:150000,rate:AUD_CLP};

// ══════════════════════════════════════════════════════════════════════
// LIGHT MODE DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════
const X = {
  bg:"#F8FAFC", 
  card:"#FFFFFF", 
  bdr:"#E2E8F0", 
  tx:"#0F172A", 
  txD:"#64748B", 
  txM:"#475569", 
  ac:"#E86833", 
  g:"#10B981", 
  r:"#EF4444", 
  y:"#F59E0B", 
  b:"#3B82F6", 
  p:"#8B5CF6"
};

// ══════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════
const Cd = ({children,s,alert,onClick}) => (
  <div onClick={onClick} style={{background:X.card, border:`1px solid ${alert?X.r:X.bdr}`, borderRadius:20, padding:"18px", boxShadow:"0 2px 12px rgba(0,0,0,0.03)", position:"relative", overflow:"hidden", cursor:onClick?"pointer":"default", ...s}}>
    {alert&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:X.r}}/>}{children}
  </div>
);

const St = ({icon,label,value,color=X.ac,sub}) => (
  <Cd s={{padding:"16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:X.txD,fontWeight:700}}>{label}</span>
    </div>
    <div style={{fontSize:22,fontWeight:800,color,fontFamily:"'JetBrains Mono'",letterSpacing:-0.5}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:X.txM,marginTop:4,fontWeight:500}}>{sub}</div>}
  </Cd>
);

const Br = ({p,color=X.ac,h=7}) => (
  <div style={{height:h,borderRadius:h/2,background:"#F1F5F9",flex:1,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.max(0,Math.min(100,p))}%`,borderRadius:h/2,background:p>90?X.r:p>70?X.y:color,transition:"width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)"}}/>
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// QUICK ENTRY
// ══════════════════════════════════════════════════════════════════════
function QuickEntry({onClose,onSaveExp,onSavePay,expenses,custom,debts}) {
  const [mode,setMode]=useState("gasto");
  const [amt,setAmt]=useState("");
  const [desc,setDesc]=useState("");
  const [card,setCard]=useState("TC SANT Plat");
  const [cat,setCat]=useState("");
  const [cur,setCur]=useState("CLP");
  const [tid,setTid]=useState(debts[0]?.id||"");
  const ref=useRef(null);

  useEffect(()=>{setTimeout(()=>ref.current?.focus(),100)},[]);

  const save=()=>{
    const n=parseInt(amt.replace(/\./g,""),10);if(!n)return;
    const clp=cur==="AUD"?Math.round(n*AUD_CLP):n;
    if(mode==="pago"){
      onSavePay({id:Date.now(), date:today(), amount:clp, debtId:tid, debtName:debts.find(d=>d.id===tid)?.name, desc:desc||"Pago Deuda"});
    } else {
      onSaveExp({id:Date.now(), date:today(), amount:clp, desc, card, category:cat||"Otros", group:catGroup(cat||"Otros")});
    }
    onClose();
  };

  const fa=v=>{const n=v.replace(/\D/g,"");return n?parseInt(n,10).toLocaleString("es-CL"):"";};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <div style={{background:X.card,width:"100%",maxWidth:500,borderRadius:"28px 28px 0 0",padding:"24px 20px 40px",boxShadow:"0 -10px 40px rgba(0,0,0,0.1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div style={{display:"flex",background:"#F1F5F9",borderRadius:14,padding:3}}>
            {["gasto","pago"].map(k=>(
              <button key={k} onClick={()=>setMode(k)} style={{padding:"10px 20px",border:"none",borderRadius:11,background:mode===k?X.ac:"transparent",color:mode===k?"#fff":X.txM,fontSize:13,fontWeight:700}}>{k.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={onClose} style={{background:"#F1F5F9",border:"none",borderRadius:"50%",width:36,height:36,fontSize:20,color:X.txD}}>×</button>
        </div>

        <div style={{marginBottom:24, textAlign:"center"}}>
          <span style={{fontSize:24,fontWeight:800,color:X.txD,fontFamily:"'JetBrains Mono'"}}>{cur==="AUD"?"A$":"$"}</span>
          <input ref={ref} type="text" inputMode="numeric" placeholder="0" value={fa(amt)} onChange={e=>setAmt(e.target.value.replace(/\./g,""))}
            style={{background:"transparent",border:"none",color:X.tx,fontSize:48,fontWeight:900,fontFamily:"'JetBrains Mono'",outline:"none",width:"220px",textAlign:"center"}}/>
        </div>

        {mode==="gasto" ? (
          <>
            <input type="text" placeholder="¿Qué compraste?" value={desc} onChange={e=>setDesc(e.target.value)} style={{width:"100%",padding:16,borderRadius:16,border:`1px solid ${X.bdr}`,marginBottom:16,fontSize:16,outline:"none"}}/>
            <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
              {CARDS.map(c=>(<button key={c} onClick={()=>setCard(c)} style={{background:card===c?X.ac:"#F1F5F9",color:card===c?"#fff":X.txM,border:"none",padding:"10px 16px",borderRadius:12,whiteSpace:"nowrap",fontWeight:600}}>{c}</button>))}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {CATS.slice(0,10).map(c=>(<button key={c.n} onClick={()=>setCat(c.n)} style={{background:cat===c.n?X.b:"#F1F5F9",color:cat===c.n?"#fff":X.txM,border:"none",padding:"8px 12px",borderRadius:20,fontSize:12}}>{c.n}</button>))}
            </div>
          </>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {debts.map(d=>(
              <button key={d.id} onClick={()=>setTid(d.id)} style={{padding:16,borderRadius:16,border:`2px solid ${tid===d.id?X.g:X.bdr}`,background:tid===d.id?`${X.g}08`:"#fff",textAlign:"left"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>{d.name}</span><span>{fmt(d.usado)}</span></div>
              </button>
            ))}
          </div>
        )}

        <button onClick={save} style={{width:"100%",marginTop:24,padding:18,borderRadius:18,border:"none",background:X.ac,color:"#fff",fontSize:17,fontWeight:800,boxShadow:`0 8px 20px ${X.ac}44`}}>Guardar Registro</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [view,setView]=useState("home");
  const [exps,setExps]=useState([]);
  const [pays,setPays]=useState([]);
  const [debts,setDebts]=useState(INIT_DEBTS);
  const [bud,setBud]=useState(INIT_BUD);
  const [cm,setCm]=useState(today().slice(0,7));
  const [show,setShow]=useState(false);
  const [synced,setSynced]=useState(false);
  
  // Simulador
  const [dEx,setDEx]=useState(300000);
  const [dSt,setDSt]=useState("avalancha");

  const CARD_TO_DEBT = { "TC SANT Plat": "plat", "TC SANT Life": "life", "CMR Falabella": "cmr", "Línea Créd": "lc" };

  useEffect(()=>{
    onDataChange((data)=>{
      if(data.exps) setExps(data.exps);
      if(data.pays) setPays(data.pays);
      if(data.debts) setDebts(data.debts);
      if(data.bud) setBud(data.bud);
      setSynced(true);
    });
  },[]);

  const addExp = e => {
    const newExps = [e, ...exps];
    const newDebts = debts.map(d => d.id === CARD_TO_DEBT[e.card] ? {...d, usado: Number(d.usado) + Number(e.amount)} : d);
    setExps(newExps);
    setDebts(newDebts);
    saveData({exps:newExps, debts:newDebts, pays, bud});
  };

  const deleteExp = id => {
    const exp = exps.find(x=>x.id===id);
    if(!exp || !confirm("¿Eliminar?")) return;
    const newExps = exps.filter(x=>x.id!==id);
    const newDebts = debts.map(d => d.id === CARD_TO_DEBT[exp.card] ? {...d, usado: Math.max(0, d.usado - exp.amount)} : d);
    setExps(newExps);
    setDebts(newDebts);
    saveData({exps:newExps, debts:newDebts, pays, bud});
  };

  const addPay = p => {
    const newPays = [p, ...pays];
    const newDebts = debts.map(d => d.id === p.debtId ? {...d, usado: Math.max(0, d.usado - p.amount)} : d);
    setPays(newPays);
    setDebts(newDebts);
    saveData({exps, debts:newDebts, pays:newPays, bud});
  };

  // Cálculos de Proyección
  const dPlan = useMemo(() => {
    let list = debts.map(d=>({...d, bal: d.usado, min: Math.max(Math.round(d.usado*0.02), 5000)})).filter(d=>d.bal>0);
    if(dSt==="avalancha") list.sort((a,b)=>b.tasa - a.tasa); else list.sort((a,b)=>a.bal - b.bal);
    const tl = []; let mo = 0;
    while(list.some(d=>d.bal>0) && mo < 48) {
      mo++; let ex = dEx;
      list.forEach(d => { d.bal = Math.round(d.bal * (1 + d.tasa/100)); const p = Math.min(d.bal, d.min); d.bal -= p; });
      for(const d of list) { if(ex<=0) break; const p = Math.min(d.bal, ex); d.bal -= p; ex -= p; }
      tl.push({ mes: mo, total: list.reduce((a,d)=>a+d.bal,0) });
    }
    return tl;
  }, [debts, dEx, dSt]);

  const mE = exps.filter(e => mKey(e.date) === cm);
  const mT = mE.reduce((a,e)=>a+e.amount, 0);
  const tB = Object.values(bud).reduce((a,b)=>a+b,0);
  const tD = debts.reduce((a,d)=>a+d.usado,0);
  const tC = debts.reduce((a,d)=>a+d.cupo,0);
  const totInc = Math.round(INC.audWeek * 4.33 * INC.rate) + INC.clpFixed;

  return(
    <div style={{minHeight:"100vh", background:X.bg, color:X.tx, fontFamily:"'DM Sans', sans-serif", paddingBottom:100}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"/>
      
      {/* Header */}
      <div style={{padding:"24px 20px 10px", maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <h1 style={{fontSize:24, fontWeight:900, margin:0, color:X.ac}}>Mi Flujo</h1>
          <p style={{fontSize:12, color:X.txD, margin:0}}>{mLabel(cm)} · {synced ? "Sincronizado" : "Conectando..."}</p>
        </div>
        <input type="month" value={cm} onChange={e=>setCm(e.target.value)} style={{background:X.card, border:`1px solid ${X.bdr}`, padding:"8px 12px", borderRadius:12}}/>
      </div>

      <div style={{padding:"0 20px", maxWidth:900, margin:"0 auto", display:"flex", flexDirection:"column", gap:16}}>
        
        {view === "home" && (
          <>
            <Cd s={{background:"linear-gradient(135deg, #10B981 0%, #3B82F6 100%)", color:"#fff", border:"none"}}>
              <div style={{fontSize:11, fontWeight:700, textTransform:"uppercase", opacity:0.9}}>Ingreso Estimado</div>
              <div style={{fontSize:34, fontWeight:900, fontFamily:"'JetBrains Mono'", marginTop:4}}>{fmt(totInc)}</div>
              <div style={{fontSize:12, marginTop:6, opacity:0.8}}>Sueldo + Proyectos + Remesas</div>
            </Cd>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <St icon="🏠" label="Fijos" value={fmtS(305000)} color={X.y}/>
              <St icon="💰" label="Gasto" value={fmtS(mT)} color={X.ac}/>
              <St icon="📈" label="Uso Deuda" value={`${pct(tD,tC)}%`} color={X.r}/>
            </div>

            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontWeight:700, color:X.txM}}>Presupuesto Mensual</span>
                <span style={{fontWeight:800}}>{fmt(mT)} / {fmtS(tB)}</span>
              </div>
              <Br p={pct(mT,tB)} color={X.b} h={10}/>
            </Cd>

            <Cd>
              <h3 style={{fontSize:14,fontWeight:800,marginBottom:15,textTransform:"uppercase"}}>Últimos Gastos</h3>
              {mE.slice(0,5).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${X.bdr}`}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700}}>{e.desc}</div>
                    <div style={{fontSize:11,color:X.txD}}>{e.card} · {e.category}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:800}}>{fmt(e.amount)}</span>
                    <button onClick={()=>deleteExp(e.id)} style={{color:X.r, border:"none", background:"none", fontSize:18}}>×</button>
                  </div>
                </div>
              ))}
            </Cd>
          </>
        )}

        {view === "debt" && (
          <>
            <Cd s={{background:"#FEF2F2", border:`1px solid ${X.r}44`}}>
              <h3 style={{color:X.r, margin:0, fontSize:15, fontWeight:800}}>Simulador de Desendeudamiento</h3>
              <p style={{fontSize:13, color:X.txM, marginTop:4}}>Proyecta cuánto tiempo tardarás en quedar en $0.</p>
              
              <div style={{marginTop:20}}>
                <label style={{fontSize:11, fontWeight:700, color:X.txD}}>PAGO EXTRA MENSUAL: <span style={{color:X.ac}}>{fmt(dEx)}</span></label>
                <input type="range" min={50000} max={1000000} step={50000} value={dEx} onChange={e=>setDEx(Number(e.target.value))} style={{width:"100%", accentColor:X.ac, marginTop:8}}/>
              </div>

              <div style={{display:"flex", gap:10, marginTop:15}}>
                {["avalancha","bola"].map(s=>(
                  <button key={s} onClick={()=>setDSt(s)} style={{flex:1, padding:10, borderRadius:12, border:`1px solid ${dSt===s?X.ac:X.bdr}`, background:dSt===s?X.ac:"#fff", color:dSt===s?"#fff":X.txM, fontWeight:700, fontSize:11}}>
                    {s === "avalancha" ? "🏔️ AVALANCHA" : "⛄ BOLA NIEVE"}
                  </button>
                ))}
              </div>
            </Cd>

            <Cd>
              <h3 style={{fontSize:13, fontWeight:800, marginBottom:15}}>PROYECCIÓN DE SALDO</h3>
              <div style={{height:180}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dPlan}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={X.r} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={X.r} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                    <XAxis dataKey="mes" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={fmtS} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>fmt(v)} labelFormatter={m=>`Mes ${m}`}/>
                    <Area type="monotone" dataKey="total" stroke={X.r} fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{textAlign:"center", marginTop:10, fontSize:14, fontWeight:800, color:X.g}}>
                ¡Deuda pagada en {dPlan.length} meses! 🚀
              </div>
            </Cd>

            {debts.map((d,di)=>(
              <Cd key={d.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:800, fontSize:15}}>{d.name}</span>
                  <span style={{fontSize:12, background:"#F1F5F9", padding:"4px 8px", borderRadius:8, fontWeight:700}}>{d.tasa}% tasa</span>
                </div>
                <div style={{fontSize:24, fontWeight:900, color:X.r, fontFamily:"'JetBrains Mono'", margin:"10px 0"}}>{fmt(d.usado)}</div>
                <Br p={pct(d.usado, d.cupo)} color={X.r} h={8}/>
                <input type="number" value={d.usado} onChange={e=>setDebts(prev=>prev.map((x,i)=>i===di?{...x, usado:Number(e.target.value)}:x))} 
                       style={{width:"100%", marginTop:12, padding:10, borderRadius:12, border:`1px solid ${X.bdr}`, outline:"none"}} placeholder="Ajustar saldo manual"/>
              </Cd>
            ))}
          </>
        )}
      </div>

      {/* FAB */}
      <button onClick={()=>setShow(true)} style={{position:"fixed", bottom:90, right:24, width:64, height:64, borderRadius:32, background:X.ac, color:"#fff", border:"none", fontSize:32, fontWeight:900, boxShadow:`0 10px 25px ${X.ac}66`, zIndex:100}}>+</button>

      {/* Nav */}
      <div style={{position:"fixed", bottom:0, left:0, right:0, background:"rgba(255,255,255,0.9)", backdropFilter:"blur(12px)", borderTop:`1px solid ${X.bdr}`, display:"flex", padding:"12px 0 calc(12px + env(safe-area-inset-bottom))", zIndex:90}}>
        {[["home","🏠","Inicio"],["debt","💳","Deudas"],["list","📋","Historial"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1, border:"none", background:"none", color:view===k?X.ac:X.txD, fontSize:11, fontWeight:700, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <span style={{fontSize:22}}>{ic}</span>{lb}
          </button>
        ))}
      </div>

      {show && <QuickEntry onClose={()=>setShow(false)} onSaveExp={addExp} onSavePay={addPay} debts={debts} expenses={exps}/>}
    </div>
  );
}
