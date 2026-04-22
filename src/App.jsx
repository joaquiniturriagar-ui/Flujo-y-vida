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

// BLINDAJE CONTRA FIREBASE: Fuerza a que todo sea un Array
const toArray = (data) => Array.isArray(data) ? data : Object.values(data || {});

const GROUPS = {
  "Vivienda":{i:"🏠",c:"#3B82F6"},
  "Alimentación":{i:"🍽",c:"#10B981"},
  "Transporte":{i:"🚗",c:"#F59E0B"},
  "Personal":{i:"👤",c:"#EC4899"},
  "Educación/Familia":{i:"👨‍👩‍👧",c:"#14B8A6"},
  "Entretención":{i:"🎉",c:"#8B5CF6"},
  "Financiero":{i:"🏦",c:"#F97316"},
  "Viajes":{i:"✈️",c:"#06B6D4"},
  "Otros":{i:"📦",c:"#94A3B8"}
};

// CATEGORÍAS EXACTAS SEGÚN TU IMAGEN
const CATS = [
  {n:"Arriendo", g:"Vivienda"},
  {n:"Gas", g:"Vivienda"},
  {n:"Gym", g:"Entretención"},
  {n:"Gastos Comunes", g:"Vivienda"},
  {n:"Comida General", g:"Alimentación"},
  {n:"Cuota Colegio", g:"Educación/Familia"},
  {n:"Auto Bencina", g:"Transporte"},
  {n:"Autoseguro", g:"Transporte"},
  {n:"Auto Cuota", g:"Transporte"},
  {n:"Auto Mantencion", g:"Transporte"},
  {n:"Celular", g:"Personal"},
  {n:"Arriendo Viaje", g:"Viajes"},
  {n:"Gastos Propios", g:"Personal"},
  {n:"Farmacia", g:"Personal"},
  {n:"Ropa", g:"Personal"},
  {n:"Retiro Cajero", g:"Personal"},
  {n:"Movilizacion / Pasajes", g:"Transporte"},
  {n:"Recreacion / Ocio", g:"Entretención"},
  {n:"Mantención Tarjetas", g:"Financiero"},
  {n:"Transferencias Varias / Deudas", g:"Financiero"},
  {n:"Aplicaciones", g:"Personal"},
  {n:"Otros", g:"Otros"}
];

const RULES = [
  {kw:["arriendo","rent"],cat:"Arriendo"},{kw:["gastos comunes","ggcc"],cat:"Gastos Comunes"},{kw:["gas ","luz ","agua ","leña"],cat:"Gas"},
  {kw:["lider","jumbo","santa isabel","super","mercado","coles","woolworth","comida","almuerzo","desayuno","sushi","pizza"],cat:"Comida General"},
  {kw:["bencina","petrobras","shell","copec","peaje"],cat:"Auto Bencina"},{kw:["cuota auto","credito auto"],cat:"Auto Cuota"},{kw:["seguro auto"],cat:"Autoseguro"},
  {kw:["mecanic","repuesto","bateria","mantencion","lavado"],cat:"Auto Mantencion"},
  {kw:["uber","metro","bus","pasaje","transfer","taxi","didi"],cat:"Movilizacion / Pasajes"},
  {kw:["restoran","bar ","cafe","cerveza","copete","cine","salida"],cat:"Recreacion / Ocio"},
  {kw:["gym","gimnasio","surfit"],cat:"Gym"},
  {kw:["farmacia","cruz verde","salcobrand","remedio","dentista"],cat:"Farmacia"},
  {kw:["celular","entel","movistar","felix"],cat:"Celular"},
  {kw:["ropa","zapato","zapatilla","polera","bolso"],cat:"Ropa"},
  {kw:["colegio","matricula","cuota col"],cat:"Cuota Colegio"},
  {kw:["netflix","spotify","apple","google","suscripcion","app"],cat:"Aplicaciones"},
  {kw:["mantencion tc","comision","iva"],cat:"Mantención Tarjetas"},
  {kw:["hotel","airbnb","alojamiento"],cat:"Arriendo Viaje"}
];
const autocat = (desc,custom=[]) => { const d=desc.toLowerCase().trim(); for(const r of custom)if(r.kw.some(k=>d.includes(k.toLowerCase())))return r.cat; for(const r of RULES)if(r.kw.some(k=>d.includes(k)))return r.cat; return null; };

const INIT_DEBTS = [
  {id:"lc",name:"Línea de Crédito",cupo:1000000,usado:0,tasa:2.8},
  {id:"plat",name:"TC Santander Plat.",cupo:4000000,usado:0,tasa:3.2},
  {id:"life",name:"TC Santander Life",cupo:1700000,usado:0,tasa:3.2},
  {id:"cmr",name:"CMR Falabella",cupo:390000,usado:0,tasa:3.5},
];

const INIT_BUD = {"Vivienda":250000,"Alimentación":300000,"Transporte":200000,"Entretención":200000,"Personal":150000,"Educación/Familia":120000,"Financiero":80000,"Viajes":0,"Otros":50000};
const CARDS = ["TC SANT Plat","TC SANT Life","CMR Falabella","TD SANT","Línea Créd","Efectivo","CommBank AUS"];

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
// QUICK ENTRY MODAL (CONVERSIÓN AUD Y TODAS LAS CATEGORÍAS)
// ══════════════════════════════════════════════════════════════════════
function QuickEntry({onClose,onSaveExp,onSavePay,debts}) {
  const [mode,setMode]=useState("gasto");
  const [amt,setAmt]=useState("");
  const [desc,setDesc]=useState("");
  const [card,setCard]=useState("TC SANT Plat");
  const [cat,setCat]=useState("Otros");
  const [tid,setTid]=useState(debts[0]?.id||"");
  const [cur,setCur]=useState("CLP");
  const ref=useRef(null);
  
  useEffect(()=>{setTimeout(()=>ref.current?.focus(),100)},[]);

  const save=()=>{
    const n=parseInt(amt.replace(/\D/g,""),10); if(!n) return;
    const clpAmount = cur === "AUD" ? Math.round(n * AUD_CLP) : n;

    if(mode==="pago"){
      onSavePay({id:Date.now(), date:today(), amount:clpAmount, originalAmount:n, currency:cur, debtId:tid, debtName:debts.find(d=>d.id===tid)?.name, desc:desc||"Pago Deuda"});
    } else {
      onSaveExp({id:Date.now(), date:today(), amount:clpAmount, originalAmount:n, currency:cur, desc:desc||"Gasto", card, category:cat, group:CATS.find(c=>c.n===cat)?.g || "Otros"});
    }
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <div style={{background:"#14152a",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",borderRadius:"24px 24px 0 0",padding:"20px 18px 32px"}}>
        
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:12,padding:2}}>
            {["gasto","pago"].map(k=>(<button key={k} onClick={()=>setMode(k)} style={{padding:"8px 16px",border:"none",borderRadius:10,background:mode===k?X.ac:"transparent",color:"#fff",fontSize:12,fontWeight:700}}>{k.toUpperCase()}</button>))}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:X.txD,fontSize:24}}>×</button>
        </div>

        {/* Currency Toggle */}
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {["CLP","AUD"].map(c=>(
            <button key={c} onClick={()=>setCur(c)} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${cur===c?X.ac:X.bdr}`,background:cur===c?"rgba(232,104,51,0.1)":"transparent",color:cur===c?X.ac:X.txM,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {c==="CLP"?"$ CLP":"$ AUD"}
            </button>
          ))}
        </div>

        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:32,fontWeight:800,color:mode==="pago"?X.g:X.ac,fontFamily:"'JetBrains Mono'"}}>{cur==="AUD"?"A$":"$"}</span>
            <input ref={ref} type="text" inputMode="numeric" placeholder="0" value={amt?parseInt(amt.replace(/\D/g,"")).toLocaleString("es-CL"):""} onChange={e=>setAmt(e.target.value.replace(/\./g,""))}
              style={{background:"transparent",border:"none",color:X.tx,fontSize:42,fontWeight:800,fontFamily:"'JetBrains Mono'",outline:"none",textAlign:"center",width:"180px"}}/>
          </div>
          {cur==="AUD"&&amt&&<div style={{fontSize:12,color:X.txD,marginTop:4}}>≈ {fmt(parseInt(amt.replace(/\D/g,""),10)*AUD_CLP)} CLP</div>}
        </div>

        {mode==="gasto" ? (
          <>
            <input type="text" placeholder="¿En qué gastaste?" value={desc} onChange={e=>setDesc(e.target.value)} style={{width:"100%",background:X.card,border:`1px solid ${X.bdr}`,borderRadius:14,padding:"14px",color:X.tx,marginBottom:16,outline:"none"}}/>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:16}}>{CARDS.map(c=>(<button key={c} onClick={()=>setCard(c)} style={{background:card===c?X.ac:X.card,border:`1px solid ${card===c?X.ac:X.bdr}`,borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{c}</button>))}</div>
            
            {/* Todas las categorías (Flex Wrap) */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {CATS.map(c=>(<button key={c.n} onClick={()=>setCat(c.n)} style={{background:cat===c.n?X.b:X.card,border:`1px solid ${cat===c.n?X.b:X.bdr}`,padding:"6px 12px",borderRadius:20,fontSize:11,color:"#fff"}}>{c.n}</button>))}
            </div>
          </>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {debts.map(d=>(<button key={d.id} onClick={()=>setTid(d.id)} style={{background:tid===d.id?`${X.g}22`:X.card,border:`1px solid ${tid===d.id?X.g:X.bdr}`,borderRadius:12,padding:"12px",color:"#fff",textAlign:"left"}}>{d.name}</button>))}
          </div>
        )}
        <button onClick={save} style={{width:"100%",border:"none",borderRadius:16,padding:"16px",fontSize:16,fontWeight:800,background:mode==="pago"?X.g:X.ac,color:"#fff",marginTop:20}}>GUARDAR</button>
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
    return onDataChange((data)=>{
      if(data){
        setExps(toArray(data.exps));
        setPays(toArray(data.pays));
        setDebts(data.debts ? toArray(data.debts) : INIT_DEBTS);
        setBud(data.bud || INIT_BUD);
        setSynced(true);
      }
    });
  },[]);

  const addExp = e => {
    const nExps = [e, ...exps];
    const nDebts = debts.map(d => d.id === CARD_TO_DEBT[e.card] ? {...d, usado: Number(d.usado||0) + Number(e.amount||0)} : d);
    setExps(nExps); setDebts(nDebts);
    saveData({exps:nExps, debts:nDebts, pays, bud});
  };

  const deleteExp = id => {
    const exp = exps.find(x=>x.id===id); 
    if(!exp || !window.confirm("¿Eliminar gasto?")) return;
    const nExps = exps.filter(x=>x.id!==id);
    const nDebts = debts.map(d => d.id === CARD_TO_DEBT[exp.card] ? {...d, usado: Math.max(0, (d.usado||0) - (exp.amount||0))} : d);
    setExps(nExps); setDebts(nDebts);
    saveData({exps:nExps, debts:nDebts, pays, bud});
  };

  const addPay = p => {
    const nPays = [p, ...pays];
    const nDebts = debts.map(d => d.id === p.debtId ? {...d, usado: Math.max(0, (d.usado||0) - (p.amount||0))} : d);
    setPays(nPays); setDebts(nDebts);
    saveData({exps, debts:nDebts, pays:nPays, bud});
  };

  const mE = useMemo(()=> exps.filter(e => mKey(e.date) === cm), [exps, cm]);
  const mT = useMemo(()=> mE.reduce((a,e)=>a+(e.amount||0), 0), [mE]);
  const tD = useMemo(()=> debts.reduce((a,d)=>a+(d.usado||0), 0), [debts]);
  const tC = useMemo(()=> debts.reduce((a,d)=>a+(d.cupo||0), 0), [debts]);
  const tB = useMemo(()=> Object.values(bud).reduce((a,v)=>a+(v||0), 0) || 1, [bud]);
  
  const totInc = Math.round(900 * 4.33 * 625) + 150000;

  const dPlan = useMemo(() => {
    if (dEx <= 0 || debts.length === 0) return [];
    let list = debts.map(d=>({...d, bal: d.usado||0, min: Math.max(Math.round((d.usado||0)*0.02), 5000)})).filter(d=>d.bal>0);
    if(dSt==="avalancha") list.sort((a,b)=>(b.tasa||0) - (a.tasa||0)); else list.sort((a,b)=>(a.bal||0) - (b.bal||0));
    const tl = []; let mo = 0;
    while(list.some(d=>d.bal>0) && mo < 48) {
      mo++; let ex = dEx;
      list.forEach(d => { d.bal = Math.round(d.bal * (1 + (d.tasa||0)/100)); const p = Math.min(d.bal, d.min); d.bal -= p; });
      for(const d of list) { if(ex<=0) break; const p = Math.min(d.bal, ex); d.bal -= p; ex -= p; }
      tl.push({ mes: mo, total: list.reduce((a,d)=>a+d.bal,0) });
    }
    return tl;
  }, [debts, dEx, dSt]);

  return(
    <div style={{minHeight:"100vh", background:X.bg, color:X.tx, fontFamily:"sans-serif", paddingBottom:100}}>
      
      <div style={{padding:"20px 18px", maxWidth:480, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h1 style={{fontSize:22, fontWeight:800, color:X.ac}}>Mi Flujo</h1>
        <input type="month" value={cm} onChange={e=>setCm(e.target.value)} style={{background:X.card, border:`1px solid ${X.bdr}`, borderRadius:10, color:"#fff", padding:"5px 10px", colorScheme:"dark"}}/>
      </div>

      <div style={{padding:"0 18px", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", gap:16}}>
        {view === "home" && (
          <>
            <Cd s={{background:"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.05))"}}>
              <div style={{fontSize:10, color:X.txD}}>INGRESO MENSUAL</div>
              <div style={{fontSize:32, fontWeight:800, color:X.g, fontFamily:"'JetBrains Mono'"}}>{fmt(totInc)}</div>
            </Cd>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
              <St label="Fijo" value="305K" color={X.y}/>
              <St label="Gasto" value={fmtS(mT)} color={X.ac}/>
              <St label="Uso" value={`${pct(tD,tC)}%`} color={X.r}/>
            </div>
            <Cd>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}><span style={{fontSize:12, color:X.txM}}>Gasto vs Presupuesto</span><span>{fmt(mT)}</span></div>
              <Br p={pct(mT, tB)} color={X.b}/>
            </Cd>
            <Cd>
              <h3 style={{fontSize:12, marginBottom:10, color:X.txD}}>ÚLTIMOS GASTOS</h3>
              {mE.slice(0,4).map(e=>(
                <div key={e.id} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${X.bdr}`}}>
                  <span style={{fontSize:13}}>{e.desc}</span>
                  <span style={{fontWeight:700}}>{fmt(e.amount)}</span>
                </div>
              ))}
            </Cd>
          </>
        )}

        {view === "list" && (
          <Cd>
            <h3 style={{fontSize:14, marginBottom:16}}>HISTORIAL</h3>
            {mE.map(e=>(<div key={e.id} style={{display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:`1px solid ${X.bdr}`}}>
              <div><div style={{fontWeight:700}}>{e.desc}</div><div style={{fontSize:10, color:X.txD}}>{e.currency==="AUD"?`A$${e.originalAmount}`:""} {e.card}</div></div>
              <div style={{display:"flex", alignItems:"center", gap:10}}><span style={{fontWeight:700}}>{fmt(e.amount)}</span><button onClick={()=>deleteExp(e.id)} style={{color:X.r, background:"none", border:"none", fontSize:18}}>×</button></div>
            </div>))}
          </Cd>
        )}

        {view === "budget" && (
          <Cd>
            <h3 style={{fontSize:14, marginBottom:20}}>CONFIGURAR PRESUPUESTO</h3>
            {Object.keys(GROUPS).map(g=>(
              <div key={g} style={{marginBottom:15}}>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5}}><span>{g}</span><span>{fmt(bud[g]||0)}</span></div>
                <input type="range" min="0" max="1000000" step="10000" value={bud[g]||0} onChange={e=>setBud(p=>({...p, [g]:Number(e.target.value)}))} style={{width:"100%", accentColor:X.ac}}/>
              </div>
            ))}
            <button onClick={()=>saveData({exps,debts,pays,bud})} style={{width:"100%", padding:12, background:X.g, border:"none", borderRadius:10, color:"#fff", fontWeight:700}}>GUARDAR CAMBIOS</button>
          </Cd>
        )}

        {view === "debt" && (
          <>
            <Cd s={{background:"rgba(239,68,68,0.05)"}}>
              <h3 style={{color:X.r, fontSize:14}}>SIMULADOR</h3>
              <input type="range" min="50000" max="1000000" step="50000" value={dEx} onChange={e=>setDEx(Number(e.target.value))} style={{width:"100%", accentColor:X.ac}}/>
              <div style={{display:"flex", gap:10, marginTop:10}}>
                {["avalancha","bola"].map(s=>(<button key={s} onClick={()=>setDSt(s)} style={{flex:1, padding:8, borderRadius:8, background:dSt===s?X.ac:"#1e293b", color:"#fff", border:"none", fontSize:10}}>{s.toUpperCase()}</button>))}
              </div>
            </Cd>
            <Cd>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={dPlan}><Area type="monotone" dataKey="total" stroke={X.r} fill={X.r} fillOpacity={0.1}/></AreaChart>
              </ResponsiveContainer>
              <div style={{textAlign:"center", fontWeight:800, color:X.g, marginTop:10}}>¡LIBRE EN {dPlan.length} MESES!</div>
            </Cd>
            {debts.map((d,di)=>(<Cd key={d.id} s={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between"}}><span>{d.name}</span><span style={{fontWeight:800, color:X.r}}>{fmt(d.usado)}</span></div><Br p={pct(d.usado,d.cupo)} color={X.r}/><input type="number" value={d.usado} onChange={e=>setDebts(prev=>prev.map((x,i)=>i===di?{...x,usado:Number(e.target.value)}:x))} style={{width:"100%", background:X.bg, border:`1px solid ${X.bdr}`, padding:8, borderRadius:8, color:"#fff", marginTop:10}}/></Cd>))}
          </>
        )}

        {view === "config" && (
          <Cd>
            <h3 style={{fontSize:14, marginBottom:10}}>INFO INGRESOS</h3>
            <div style={{fontSize:13, lineHeight:1.8, color:X.txM}}>
              <div>🇦🇺 900 AUD/sem → {fmt(2437500)}</div>
              <div>🇨🇱 Fijo → {fmt(150000)}</div>
              <div style={{marginTop:10, fontWeight:700, color:X.ac}}>TOTAL: {fmt(totInc)}</div>
            </div>
          </Cd>
        )}
      </div>

      <button onClick={()=>setShow(true)} style={{position:"fixed", bottom:85, right:"max(20px, calc(50vw - 220px))", width:64, height:64, borderRadius:32, background:X.ac, color:"#fff", fontSize:32, border:"none", boxShadow:"0 8px 20px rgba(0,0,0,0.4)", zIndex:100}}>+</button>

      <div style={{position:"fixed", bottom:0, left:0, right:0, margin:"0 auto", maxWidth:480, background:"rgba(10,11,18,0.98)", borderTop:`1px solid ${X.bdr}`, display:"flex", padding:"10px 0 20px", zIndex:90}}>
        {[["home","🏠","Inicio"],["list","📋","Gastos"],["budget","🎯","Presup."],["debt","💳","Deudas"],["config","⚙️","Config"]].map(([k,ic,lb])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1, background:"none", border:"none", color:view===k?X.ac:X.txD, fontSize:9, display:"flex", flexDirection:"column", alignItems:"center", gap:3}}>
            <span style={{fontSize:20}}>{ic}</span>{lb}
          </button>
        ))}
      </div>
      {show && <QuickEntry onClose={()=>setShow(false)} onSaveExp={addExp} onSavePay={addPay} debts={debts}/>}
    </div>
  );
}
