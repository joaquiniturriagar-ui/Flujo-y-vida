import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts";
import { saveData, onDataChange } from "./firebase";

// ══════════════════════════════════════════════════════════════════════
// HELPERS & CONFIG
// ══════════════════════════════════════════════════════════════════════
const fmt = n => { if(n==null||isNaN(n))return"$0"; const a=Math.abs(Math.round(n)); return(n<0?"-$":"$")+a.toString().replace(/\B(?=(\d{3})+(?!\d))/g,"."); };
const fmtS = n => { const a=Math.abs(n); if(a>=1e6)return`${(n/1e6).toFixed(1)}M`; if(a>=1e3)return`${Math.round(n/1e3)}K`; return`${Math.round(n)}`; };
const today = () => new Date().toISOString().split("T")[0];
const mKey = d => d ? d.slice(0,7) : today().slice(0,7);
const mLabel = k => { if(!k) return ""; const[y,m]=k.split("-"); return`${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+m-1]} ${y.slice(2)}`; };
const pct = (a,b) => b?Math.round(a/b*100):0;
const AUD_CLP = 625;

const GROUPS = {"Vivienda":{i:"🏠",c:"#3B82F6"},"Alimentación":{i:"🍽",c:"#10B981"},"Transporte":{i:"🚗",c:"#F59E0B"},"Entretención":{i:"🎉",c:"#8B5CF6"},"Personal":{i:"👤",c:"#EC4899"},"Familia":{i:"👨‍👩‍👧",c:"#14B8A6"},"Financiero":{i:"🏦",c:"#F97316"},"Viajes":{i:"✈️",c:"#06B6D4"},"Otros":{i:"📦",c:"#94A3B8"}};

const CATS = [
  {n:"Arriendo",g:"Vivienda"},{n:"Gastos Comunes",g:"Vivienda"},{n:"Servicios",g:"Vivienda"},
  {n:"Supermercado",g:"Alimentación"},{n:"Comida Diaria",g:"Alimentación"},
  {n:"Bencina",g:"Transporte"},{n:"Cuota Auto",g:"Transporte"},{n:"Seguro Auto",g:"Transporte"},{n:"Movilización",g:"Transporte"},
  {n:"Restoranes/Salidas",g:"Entretención"},{n:"Cervezas/Copas",g:"Entretención"},{n:"Otros",g:"Otros"},
];

const INIT_DEBTS = [
  {id:"lc",name:"Línea de Crédito",cupo:1000000,usado:0,tasa:2.8},
  {id:"plat",name:"TC Santander Plat.",cupo:4000000,usado:0,tasa:3.2},
  {id:"life",name:"TC Santander Life",cupo:1700000,usado:0,tasa:3.2},
  {id:"cmr",name:"CMR Falabella",cupo:390000,usado:0,tasa:3.5},
];

const X = {bg:"#0a0b12",card:"rgba(255,255,255,0.03)",bdr:"rgba(255,255,255,0.07)",tx:"#e2e2ec",txD:"rgba(255,255,255,0.35)",txM:"rgba(255,255,255,0.55)",ac:"#E86833",g:"#22C55E",r:"#EF4444",y:"#F59E0B",b:"#3B82F6",p:"#8B5CF6"};

// ══════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════
const Cd = ({children,s,alert,onClick}) => (
  <div onClick={onClick} style={{background:X.card,border:`1px solid ${alert?X.r:X.bdr}`,borderRadius:16,padding:"18px",position:"relative",overflow:"hidden",...s}}>{children}</div>
);

const St = ({icon,label,value,color=X.ac,sub}) => (
  <Cd s={{padding:"14px 16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
      <span style={{fontSize:14}}>{icon}</span>
      <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.3,color:X.txD,fontWeight:600}}>{label}</span>
    </div>
    <div style={{fontSize:20,fontWeight:700,color,fontFamily:"'JetBrains Mono'",letterSpacing:-0.3}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:X.txD,marginTop:2,whiteSpace:"nowrap"}}>{sub}</div>}
  </Cd>
);

const Br = ({p,color=X.ac,h=5}) => (
  <div style={{height:h,borderRadius:h/2,background:"rgba(255,255,255,0.06)",flex:1,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.max(0,Math.min(100,p))}%`,borderRadius:h/2,background:p>90?X.r:p>70?X.y:color,transition:"width 0.5s"}}/>
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// QUICK ENTRY MODAL
// ══════════════════════════════════════════════════════════════════════
function QuickEntry({onClose,onSaveExp,onSavePay,debts}) {
  const [mode,setMode]=useState("gasto");
  const [amt,setAmt]=useState("");
  const [desc,setDesc]=useState("");
  const [card,setCard]=useState("TC SANT Plat");
  const [cat,setCat]=useState("Otros");
  const [tid,setTid]=useState(debts[0]?.id||"");
  const ref=useRef(null);
  useEffect(()=>{setTimeout(()=>ref.current?.focus(),100)},[]);

  const save=()=>{
    const n=parseInt(amt.replace(/\D/g,""),10); if(!n) return;
    if(mode==="pago"){
      onSavePay({id:Date.now(), date:today(), amount:n, debtId:tid, debtName:debts.find(d=>d.id===tid)?.name, desc:desc||"Pago Deuda"});
    } else {
      onSaveExp({id:Date.now(), date:today(), amount:n, desc:desc||"Gasto", card, category:cat, group:CATS.find(c=>c.n===cat)?.g || "Otros"});
    }
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <div style={{background:"#14152a",width:"100%",maxWidth:480,borderRadius:"24px 24px 0 0",padding:"20px 18px 32px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:12,padding:2}}>
            {["gasto","pago"].map(k=>(<button key={k} onClick={()=>setMode(k)} style={{padding:"8px 16px",border:"none",borderRadius:10,background:mode===k?X.ac:"transparent",color:"#fff",fontSize:12,fontWeight:700}}>{k.toUpperCase()}</button>))}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:X.txD,fontSize:24}}>×</button>
        </div>
        <div style={{textAlign:"center",marginBottom:20}}>
          <input ref={ref} type="text" inputMode="numeric" placeholder="$ 0" value={amt?parseInt(amt.replace(/\D/g,"")).toLocaleString("es-CL"):""} onChange={e=>setAmt(e.target.value.replace(/\./g,""))}
            style={{background:"transparent",border:"none",color:X.tx,fontSize:42,fontWeight:800,fontFamily:"'JetBrains Mono'",outline:"none",textAlign:"center",width:"100%"}}/>
        </div>
        {mode==="gasto" ? (
          <>
            <input type="text" placeholder="¿En qué gastaste?" value={desc} onChange={e=>setDesc(e.target.value)} style={{width:"100%",background:X.card,border:`1px solid ${X.bdr}`,borderRadius:14,padding:"14px",color:X.tx,marginBottom:16,outline:"none"}}/>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:16}}>{CARDS.map(c=>(<button key={c} onClick={()=>setCard(c)} style={{background:card===c?X.ac:X.card,border:`1px solid ${card===c?X.ac:X.bdr}`,borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{c}</button>))}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CATS.slice(0,10).map(c=>(<button key={c.n} onClick={()=>setCat(c.n)} style={{background:cat===c.n?X.b:X.card,border:`1px solid ${cat===c.n?X.b:X.bdr}`,padding:"6px 12px",borderRadius:20,fontSize:11,color:"#fff"}}>{c.n}</button>))}</div>
          </>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {debts.map(d=>(<button key={d.id} onClick={()=>setTid(d.id)} style={{background:tid===d.id?`${X.g}22`:X.card,border:`1px solid ${tid===d.id?X.g:X.bdr}`,borderRadius:12,padding:"12px",color:"#fff",textAlign:"left"}}>{d.name}</button>))}
          </div>
        )}
        <button onClick={save} style={{width:"100%",border:"none",borderRadius:16,padding:"16px",fontSize:16,fontWeight:800,background:mode==="pago"?X.g:X.ac,color:"#fff",marginTop:16}}>GUARDAR</button>
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
  const [dEx,setDEx]=useState(500000);
  const [dSt,setDSt]=useState("avalancha");

  const CARD_TO_DEBT = { "TC SANT Plat": "plat", "TC SANT Life": "life", "CMR Falabella": "cmr", "Línea Créd": "lc" };

  useEffect(()=>{
    onDataChange((data)=>{
      if(data){
        if(data.exps) setExps(data.exps);
        if(data.pays) setPays(data.pays);
        if(data.debts) setDebts(data.debts);
        if(data.bud) setBud(data.bud);
        setSynced(true);
      }
    });
  },[]);

  const addExp = e => {
    const nExps = [e, ...exps];
    const nDebts = debts.map(d => d.id === CARD_TO_DEBT[e.card] ? {...d, usado: Number(d.usado) + Number(e.amount)} : d);
    setExps(nExps); setDebts(nDebts);
    saveData({exps:nExps, debts:nDebts, pays, bud});
  };

  const deleteExp = id => {
    const exp = exps.find(x=>x.id===id); if(!exp || !confirm("¿Eliminar?")) return;
    const nExps = exps.filter(x=>x.id!==id);
    const nDebts = debts.map(d => d.id === CARD_TO_DEBT[exp.card] ? {...d, usado: Math.max(0, d.usado - exp.amount)} : d);
    setExps(nExps); setDebts(nDebts);
    saveData({exps:nExps, debts:nDebts, pays, bud});
  };

  const addPay = p => {
    const nPays = [p, ...pays];
    const nDebts = debts.map(d => d.id === p.debtId ? {...d, usado: Math.max(0, d.usado - p.amount)} : d);
    setPays(nPays); setDebts(nDebts);
    saveData({exps, debts:nDebts, pays:nPays, bud});
  };

  const mE = useMemo(()=> exps.filter(e => mKey(e.date) === cm), [exps, cm]);
  const mT = useMemo(()=> mE.reduce((a,e)=>a+e.amount, 0), [mE]);
  const tD = useMemo(()=> debts.reduce((a,d)=>a+d.usado, 0), [debts]);
  const tC = useMemo(()=> debts.reduce((a,d)=>a+d.cupo, 0), [debts]);
  const tB = Object.values(bud).reduce((a,b)=>a+b,0);
  const grp = useMemo(()=>{const g={};mE.forEach(e=>g[e.group]=(g[e.group]||0)+e.amount);return g;},[mE]);
  const totInc = Math.round(900 * 4.33 * 625) + 150000;

  // Cálculos Simulador
  const dPlan = useMemo(() => {
    let list = debts.map(d => ({ ...d, bal: d.usado, min: Math.max(Math.round(d.usado * 0.02), 5000) })).filter(d => d.bal > 0);
    if (dSt === "avalancha") list.sort((a, b) => b.tasa - a.tasa); else list.sort((a, b) => a.bal - b.bal);
    const tl = []; let mo = 0;
    while (list.some(d => d.bal > 0) && mo < 48) {
      mo++; let ex = dEx;
      list.forEach(d => { d.bal = Math.round(d.bal * (1 + d.tasa / 100)); const p = Math.min(d.bal, d.min); d.bal -= p; });
      for (const d of list) { if (ex <= 0) break; const p = Math.min(d.bal, ex); d.bal -= p; ex -= p; }
      tl.push({ mes: mo, total: list.reduce((a, d) => a + d.bal, 0) });
    }
    return tl;
  }, [debts, dEx, dSt]);

  return(
    <div style={{minHeight:"100vh", background:X.bg, color:X.tx, fontFamily:"'DM Sans',sans-serif", paddingBottom:100}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"/>
      
      {/* Header */}
      <div style={{padding:"24px 20px 10px", maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <h1 style={{fontSize:24, fontWeight:900, margin:0, background:"linear-gradient(135deg,#E86833,#F59E0B)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>Mi Flujo</h1>
          <p style={{fontSize:11, color:X.txD, margin:"2px 0 0"}}>{mLabel(cm)} · {mE.length} registros {synced&&<span style={{color:X.g}}>● sync</span>}</p>
        </div>
        <input type="month" value={cm} onChange={e=>setCm(e.target.value)} style={{background:X.card, border:`1px solid ${X.bdr}`, padding:"8px 12px", borderRadius:12, color:"#fff", colorScheme:"dark"}}/>
      </div>

      <div style={{padding:"0 20px", maxWidth:900, margin:"0 auto", display:"flex", flexDirection:"column", gap:16}}>
        
        {view === "home" && (
          <>
            <Cd s={{background:"linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))"}}>
              <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:1.5, color:X.txD, fontWeight:700}}>Ingreso mensual (Piso)</div>
              <div style={{fontSize:32, fontWeight:800, color:X.g, fontFamily:"'JetBrains Mono'", marginTop:6}}>{fmt(totInc)}</div>
              <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:X.txM}}><span>🇦🇺 900 AUD/sem → {fmt(Math.round(900*4.33*AUD_CLP))}</span><span>🇨🇱 {fmt(150000)}</span></div>
            </Cd>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <St icon="📤" label="Fijo" value="305K" color={X.y} sub="Créd+Hna+Cel"/>
              <St icon="💰" label="P/Gastar" value={fmtS(totInc-305000)} color={X.b} sub="Ahorro 15%"/>
              <St icon="✅" label="Flujo" value={fmtS(totInc-305000-mT)} color={X.g}/>
            </div>

            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:X.txM}}>Gasto del Mes</span>
                <span style={{fontSize:20,fontWeight:800}}>{fmt(mT)}</span>
              </div>
              <Br p={pct(mT,tB)} h={7}/>
              <div style={{textAlign:"right",fontSize:10,color:X.txD,marginTop:6}}>{pct(mT,tB)}% de {fmt(tB)}</div>
            </Cd>

            <Cd>
              <h3 style={{fontSize:12,fontWeight:800,margin:"0 0 14px",color:X.txM,textTransform:"uppercase",letterSpacing:1.2}}>Por Grupo vs Presupuesto</h3>
              {Object.entries(GROUPS).map(([g,info])=>{
                const s=grp[g]||0, b=bud[g]||0;
                return(<div key={g} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                    <span>{info.i} {g}</span>
                    <span style={{fontFamily:"'JetBrains Mono'"}}>{fmt(s)}<span style={{color:X.txD}}>/{fmtS(b)}</span></span>
                  </div>
                  <Br p={b>0?pct(s,b):0} color={info.c} h={4}/>
                </div>);
              })}
            </Cd>

            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h3 style={{fontSize:12,fontWeight:800,margin:0,color:X.txM,textTransform:"uppercase"}}>Últimos Gastos</h3><button onClick={()=>setView("list")} style={{background:"transparent",border:"none",color:X.ac,fontSize:11,fontWeight:700}}>Ver todo →</button></div>
              {mE.slice(0,3).map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${X.bdr}`}}>
                  <div style={{width:36,height:36,borderRadius:10,background:X.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{GROUPS[e.group]?.i || "📦"}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{e.desc}</div><div style={{fontSize:10,color:X.txD}}>{e.card}</div></div>
                  <div style={{fontSize:14,fontWeight:800}}>{fmt(e.amount)}</div>
                </div>
              ))}
            </Cd>
          </>
        )}

        {view === "list" && (
          <Cd><h3 style={{fontSize:14,fontWeight:800,marginBottom:16}}>Historial</h3>{mE.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${X.bdr}`}}><div><div style={{fontSize:14,fontWeight:700}}>{e.desc}</div><div style={{fontSize:10,color:X.txD}}>{e.date} · {e.card}</div></div><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{fontSize:15,fontWeight:800}}>{fmt(e.amount)}</div><button onClick={()=>deleteExp(e.id)} style={{color:X.r,background:"none",border:"none",fontSize:18}}>×</button></div></div>))}</Cd>
        )}

        {view === "budget" && (
          <Cd><h3 style={{fontSize:14,fontWeight:800,marginBottom:20,textTransform:"uppercase"}}>Configurar Límites</h3>
            {Object.entries(GROUPS).map(([g,info])=>(
              <div key={g} style={{marginBottom:18, padding:"12px", background:"rgba(255,255,255,0.02)", borderRadius:16, border:`1px solid ${X.bdr}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8, fontSize:13}}><span>{info.i} {g}</span><span style={{fontWeight:800}}>{fmt(bud[g]||0)}</span></div>
                <input type="range" min="0" max="1000000" step="10000" value={bud[g]||0} onChange={e=>setBud(p=>({...p,[g]:Number(e.target.value)}))} style={{width:"100%",accentColor:info.c}}/>
              </div>
            ))}
            <button onClick={()=>saveData({exps,debts,pays,bud})} style={{width:"100%",padding:14,background:X.g,borderRadius:12,border:"none",color:"#fff",fontWeight:800}}>GUARDAR PRESUPUESTO</button>
          </Cd>
        )}

        {view === "debt" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Cd s={{background:"rgba(239,68,68,0.02)",border:`1px solid ${X.r}33`}}>
              <h3 style={{fontSize:14,fontWeight:800,marginBottom:4,color:X.r}}>Simulador de Pago</h3>
              <label style={{fontSize:10,fontWeight:700,color:X.txD,display:"block",marginBottom:6}}>PAGO EXTRA MENSUAL: <span style={{color:X.ac}}>{fmt(dEx)}</span></label>
              <input type="range" min="50000" max="1000000" step="50000" value={dEx} onChange={e=>setDEx(Number(e.target.value))} style={{width:"100%",accentColor:X.ac,marginBottom:16}}/>
              <div style={{display:"flex",gap:8}}>
                {["avalancha","bola"].map(s=>(<button key={s} onClick={()=>setDSt(s)} style={{flex:1,padding:10,borderRadius:12,border:`1px solid ${dSt===s?X.ac:X.bdr}`,background:dSt===s?X.ac:"transparent",color:"#fff",fontSize:10,fontWeight:800}}>{s.toUpperCase()}</button>))}
              </div>
            </Cd>
            <Cd>
              <h3 style={{fontSize:12,fontWeight:800,marginBottom:15,color:X.txM}}>PROYECCIÓN DE SALDO</h3>
              <ResponsiveContainer width="100%" height={160}><AreaChart data={dPlan}><defs><linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={X.r} stopOpacity={0.3}/><stop offset="95%" stopColor={X.r} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)"/><XAxis dataKey="mes" tick={{fill:X.txD,fontSize:10}} axisLine={false}/><YAxis tick={{fill:X.txD,fontSize:10}} axisLine={false} tickFormatter={fmtS}/><Tooltip content={<TT/>}/><Area type="monotone" dataKey="total" stroke={X.r} fill="url(#gD)" strokeWidth={3}/></AreaChart></ResponsiveContainer>
              <div style={{textAlign:"center",marginTop:10,fontSize:14,fontWeight:800,color:X.g}}>¡Deuda pagada en {dPlan.length} meses! 🚀</div>
            </Cd>
            {debts.map((d,di)=>(<Cd key={d.id} s={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between"}}><span>{d.name}</span><span style={{fontWeight:800, color:X.r}}>{fmt(d.usado)}</span></div><Br p={pct(d.usado,d.cupo)} color={X.r} h={6}/><input type="number" value={d.usado} onChange={e=>setDebts(prev=>prev.map((x,i)=>i===di?{...x,usado:Number(e.target.value)}:x))} style={{width:"100%", background:X.bg, border:`1px solid ${X.bdr}`, padding:10, borderRadius:10, color:"#fff", marginTop:12, outline:"none"}}/></Cd>))}
          </div>
        )}

        {view === "config" && (
          <Cd><h3 style={{fontSize:14,fontWeight:800,marginBottom:10}}>Ingresos</h3>
            <div style={{fontSize:13,lineHeight:2.2,color:X.txM}}>
              <div>🇦🇺 900 AUD/sem → {fmt(2437500)}</div>
              <div>🇨🇱 Fijo → {fmt(150000)}</div>
              <div style={{marginTop:10, fontWeight:800, color:X.ac}}>TOTAL ESTIMADO: {fmt(totInc)}</div>
            </div>
          </Cd>
        )}
      </div>

      <button onClick={()=>setShow(true)} style={{position:"fixed",bottom:85,right:20,width:60,height:60,borderRadius:30,background:"linear-gradient(135deg,#E86833,#F59E0B)",color:"#fff",fontSize:32,border:"none",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,11,18,0.98)",backdropFilter:"blur(16px)",borderTop:`1px solid ${X.bdr}`,display:"flex",padding:"10px 0 24px",zIndex:90}}>
        {[["home","🏠","Inicio"],["list","📋","Gastos"],["budget","🎯","Presup."],["debt","💳","Deudas"],["config","⚙️","Config"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,background:"none",border:"none",color:view===k?X.ac:X.txD,fontSize:9,display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontWeight:700}}>
            <span style={{fontSize:20,filter:view===k?"none":"grayscale(1)"}}>{ic}</span>{lb}
          </button>
        ))}
      </div>
      {show && <QuickEntry onClose={()=>setShow(false)} onSaveExp={addExp} onSavePay={addPay} debts={debts}/>}
    </div>
  );
}
