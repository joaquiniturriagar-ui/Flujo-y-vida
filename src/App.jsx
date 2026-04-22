import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts";
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
// CATEGORIES & AUTO-CATEGORIZATION
// ══════════════════════════════════════════════════════════════════════
const GROUPS = {"Vivienda":{i:"🏠",c:"#3B82F6"},"Alimentación":{i:"🍽",c:"#10B981"},"Transporte":{i:"🚗",c:"#F59E0B"},"Entretención":{i:"🎉",c:"#8B5CF6"},"Personal":{i:"👤",c:"#EC4899"},"Familia":{i:"👨‍👩‍👧",c:"#14B8A6"},"Financiero":{i:"🏦",c:"#F97316"},"Viajes":{i:"✈️",c:"#06B6D4"},"Otros":{i:"📦",c:"#94A3B8"}};

const CATS = [
  {n:"Arriendo",g:"Vivienda"},{n:"Gastos Comunes",g:"Vivienda"},{n:"Servicios",g:"Vivienda"},
  {n:"Supermercado",g:"Alimentación"},{n:"Comida Diaria",g:"Alimentación"},
  {n:"Bencina",g:"Transporte"},{n:"Cuota Auto",g:"Transporte"},{n:"Seguro Auto",g:"Transporte"},{n:"Mantención Auto",g:"Transporte"},{n:"Movilización",g:"Transporte"},
  {n:"Restoranes/Salidas",g:"Entretención"},{n:"Cervezas/Copas",g:"Entretención"},{n:"Gimnasio",g:"Entretención"},{n:"Recreación",g:"Entretención"},
  {n:"Farmacia",g:"Personal"},{n:"Celular",g:"Personal"},{n:"Ropa/Accesorios",g:"Personal"},{n:"Peluquería",g:"Personal"},{n:"Gastos Propios",g:"Personal"},
  {n:"Hermana",g:"Familia"},{n:"Regalos",g:"Familia"},{n:"Transferencias",g:"Familia"},
  {n:"Crédito Auto",g:"Financiero"},{n:"Intereses/Comisiones",g:"Financiero"},{n:"Suscripciones",g:"Financiero"},{n:"Pago Tarjeta",g:"Financiero"},
  {n:"Pasajes",g:"Viajes"},{n:"Alojamiento",g:"Viajes"},
  {n:"Otros",g:"Otros"},
];
const catGroup = cat => CATS.find(c=>c.n===cat)?.g||"Otros";

const RULES = [
  {kw:["arriendo","rent"],cat:"Arriendo"},{kw:["gastos comunes","ggcc"],cat:"Gastos Comunes"},{kw:["gas ","luz ","agua ","leña"],cat:"Servicios"},
  {kw:["lider","jumbo","santa isabel","super","mercado","aldi","coles","iga","woolworth","bakehouse","feria","fruta","verdura","huevo","leche","pan ","carne","pescad","queso"],cat:"Supermercado"},
  {kw:["comida","almuerzo","desayuno","completo","empanada","sushi","pizza","hamburg","kebab","ramen","taco","warung","gohan","acai","helado","kuchen","postre","dulce","chocolate"],cat:"Comida Diaria"},
  {kw:["bencina","petrobras","shell","copec","peaje"],cat:"Bencina"},{kw:["cuota auto","credito auto"],cat:"Cuota Auto"},{kw:["seguro auto","permiso circ"],cat:"Seguro Auto"},
  {kw:["revision tec","mecanic","repuesto","bateria","cambio aceite","mantencion auto","balanceo","lavado","repco","disco"],cat:"Mantención Auto"},
  {kw:["uber","metro","bus","pasaje","transfer","transvip","grab","taxi","didi"],cat:"Movilización"},
  {kw:["cerveza","cerv","chela","copete","pisco","vino","gin","botiller"],cat:"Cervezas/Copas"},
  {kw:["restoran","gaucha","rolling","tropera","chalota","canalla","salmon","rails","bar ","cafe","café","starbuck","rappi","pedidos ya","subway","mcdonald","kfc","bagual"],cat:"Restoranes/Salidas"},
  {kw:["gym","gimnasio","surfit","rebox"],cat:"Gimnasio"},{kw:["cine","entrada","museo"],cat:"Recreación"},
  {kw:["farmacia","cruz verde","salcobrand","remedio","dentista","consulta"],cat:"Farmacia"},
  {kw:["celular","felix","entel","movistar"],cat:"Celular"},
  {kw:["ropa","polera","poleron","camisa","pantalon","boxer","zapato","chala","bolso","uniqlo","levis","mochila"],cat:"Ropa/Accesorios"},
  {kw:["peluquer","corte de pelo","barbero"],cat:"Peluquería"},{kw:["regalo"],cat:"Regalos"},
  {kw:["hermana","domi"],cat:"Hermana"},{kw:["mama","papa","mati","colo","vicente","seba","nico","isi","benja"],cat:"Transferencias"},
  {kw:["netflix","spotify","microsoft","apple","google","capcut","chatgpt","avast","d5"],cat:"Suscripciones"},
  {kw:["interes","mora","mantencion tc","mant tarj","mantencion plan","admin","comision","iva","impuesto"],cat:"Intereses/Comisiones"},
  {kw:["pago tarj"],cat:"Pago Tarjeta"},
  {kw:["hotel","hostal","aloj","airbnb"],cat:"Alojamiento"},{kw:["vuelo","avion","aerop","flight"],cat:"Pasajes"},
];
const autocat = (desc,custom=[]) => { const d=desc.toLowerCase().trim(); for(const r of custom)if(r.kw.some(k=>d.includes(k.toLowerCase())))return r.cat; for(const r of RULES)if(r.kw.some(k=>d.includes(k)))return r.cat; return null; };

// ══════════════════════════════════════════════════════════════════════
// DEFAULTS
// ══════════════════════════════════════════════════════════════════════
const INIT_DEBTS = [
  {id:"lc",name:"Línea de Crédito",cupo:1000000,usado:1000000,tasa:2.8},
  {id:"plat",name:"TC Santander Plat.",cupo:4000000,usado:2310740,tasa:3.2},
  {id:"life",name:"TC Santander Life",cupo:1700000,usado:740054,tasa:3.2},
  {id:"cmr",name:"CMR Falabella",cupo:390000,usado:383223,tasa:3.5},
];
const INIT_BUD = {"Vivienda":250000,"Alimentación":300000,"Transporte":200000,"Entretención":200000,"Personal":150000,"Familia":120000,"Financiero":80000,"Viajes":0,"Otros":50000};
const CARDS = ["TC SANT Plat","TC SANT Life","CMR Falabella","TD SANT","Línea Créd","Efectivo","CommBank AUS"];
const FIXED = [{name:"Crédito Auto",amount:180000},{name:"Mantención Hermana",amount:100000},{name:"CommBank Celular",amount:Math.round(40*AUD_CLP)}];
const INC = {audWeek:900,clpFixed:150000,rate:AUD_CLP};

// ══════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════
const X = {bg:"#0a0b12",card:"rgba(255,255,255,0.03)",bdr:"rgba(255,255,255,0.07)",tx:"#e2e2ec",txD:"rgba(255,255,255,0.35)",txM:"rgba(255,255,255,0.55)",ac:"#E86833",g:"#22C55E",r:"#EF4444",y:"#F59E0B",b:"#3B82F6",p:"#8B5CF6"};

// ══════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════
const Cd = ({children,s,alert,onClick}) => (
  <div onClick={onClick} style={{background:X.card,border:`1px solid ${alert?"rgba(239,68,68,0.25)":X.bdr}`,borderRadius:14,padding:"16px 18px",position:"relative",overflow:"hidden",cursor:onClick?"pointer":"default",...s}}>
    {alert&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#EF4444,#F59E0B)"}}/>}{children}
  </div>
);

const St = ({icon,label,value,color=X.ac,sub}) => (
  <Cd s={{padding:"14px 16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
      <span style={{fontSize:14}}>{icon}</span>
      <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.3,color:X.txD,fontWeight:600}}>{label}</span>
    </div>
    <div style={{fontSize:20,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:-0.3}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:X.txD,marginTop:2}}>{sub}</div>}
  </Cd>
);

const Br = ({p,color=X.ac,h=5}) => (
  <div style={{height:h,borderRadius:h/2,background:"rgba(255,255,255,0.06)",flex:1,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.max(0,Math.min(100,p))}%`,borderRadius:h/2,background:p>90?X.r:p>70?X.y:color,transition:"width 0.5s"}}/>
  </div>
);

const TT = ({active,payload,label}) => {
  if(!active||!payload?.length)return null;
  return(<div style={{background:"#14152a",border:`1px solid ${X.bdr}`,borderRadius:10,padding:"8px 12px",fontSize:11}}>
    <div style={{color:X.txD,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:5,color:p.color,marginBottom:2}}>
      <div style={{width:6,height:6,borderRadius:3,background:p.color}}/>{p.name}: {fmt(p.value)}
    </div>))}
  </div>);
};

// ══════════════════════════════════════════════════════════════════════
// QUICK ENTRY
// ══════════════════════════════════════════════════════════════════════
function QuickEntry({onClose,onSaveExp,onSavePay,expenses,custom,debts}) {
  const [mode,setMode]=useState("gasto");
  const [amt,setAmt]=useState("");
  const [desc,setDesc]=useState("");
  const [card,setCard]=useState("TC SANT Plat");
  const [cat,setCat]=useState("");
  const [date,setDate]=useState(today());
  const [sug,setSug]=useState(null);
  const [cur,setCur]=useState("CLP");
  const [tid,setTid]=useState(debts[0]?.id||"");
  const ref=useRef(null);

  useEffect(()=>{setTimeout(()=>ref.current?.focus(),100)},[]);
  useEffect(()=>{if(mode==="gasto"){const s=autocat(desc,custom);setSug(s);if(s&&!cat)setCat(s);}},[desc, custom, cat, mode]);

  const ac=useMemo(()=>{
    if(desc.length<2||mode==="pago")return[];
    const l=desc.toLowerCase(),seen=new Set();
    return expenses.filter(e=>e.desc.toLowerCase().includes(l)).filter(e=>{if(seen.has(e.desc))return false;seen.add(e.desc);return true}).slice(0,4);
  },[desc,expenses,mode]);

  const save=()=>{
    const n=parseInt(amt.replace(/\./g,""),10);if(!n)return;
    const clp=cur==="AUD"?Math.round(n*AUD_CLP):n;
    if(mode==="pago"){
      onSavePay({id:Date.now()+Math.random().toString(36).slice(2),date,amount:clp,originalAmount:n,currency:cur,debtId:tid,debtName:debts.find(d=>d.id===tid)?.name||"",desc:desc.trim()||`Pago ${debts.find(d=>d.id===tid)?.name||""}`});
    } else {
      if(!desc.trim())return;
      onSaveExp({id:Date.now()+Math.random().toString(36).slice(2),date,amount:clp,originalAmount:n,currency:cur,desc:desc.trim(),card,category:cat||"Otros",group:catGroup(cat||"Otros")});
    }
    onClose();
  };

  const fa=v=>{const n=v.replace(/\D/g,"");return n?parseInt(n,10).toLocaleString("es-CL").replace(/,/g,"."):"";};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <style>{`@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div style={{background:"#14152a",width:"100%",maxWidth:480,maxHeight:"94vh",overflowY:"auto",borderRadius:"20px 20px 0 0",padding:"20px 18px 32px",animation:"su 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden",border:`1px solid ${X.bdr}`}}>
            {[["gasto","💸 Gasto"],["pago","💳 Pago Deuda"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setMode(k);setAmt("");setDesc("");}} style={{padding:"9px 16px",border:"none",background:mode===k?"rgba(232,104,51,0.15)":"transparent",color:mode===k?X.ac:X.txM,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:X.txD,fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["CLP","AUD"].map(c=>(
            <button key={c} onClick={()=>setCur(c)} style={{flex:1,padding:"7px",borderRadius:10,border:`1px solid ${cur===c?"rgba(232,104,51,0.4)":X.bdr}`,background:cur===c?"rgba(232,104,51,0.1)":"transparent",color:cur===c?X.ac:X.txM,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{c==="CLP"?"$ CLP":"$ AUD"}</button>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:28,fontWeight:700,color:mode==="pago"?X.g:X.ac,fontFamily:"'JetBrains Mono',monospace"}}>{cur==="AUD"?"A$":"$"}</span>
            <input ref={ref} type="text" inputMode="numeric" placeholder="0" value={fa(amt)} onChange={e=>setAmt(e.target.value.replace(/\./g,""))}
              style={{flex:1,background:"transparent",border:"none",color:X.tx,fontSize:28,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",outline:"none",padding:0,width:"100%"}}/>
          </div>
          <div style={{height:2,background:`linear-gradient(90deg,${mode==="pago"?X.g:X.ac},transparent)`,marginTop:3}}/>
        </div>

        {mode==="pago"?(
          <>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:X.txD,fontWeight:600}}>¿A cuál deuda?</label>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                {debts.filter(d=>d.usado>0).map(d=>{
                  const p=pct(d.usado,d.cupo);const sel=tid===d.id;
                  return(<button key={d.id} onClick={()=>setTid(d.id)} style={{background:sel?"rgba(34,197,94,0.08)":"rgba(255,255,255,0.02)",border:`1px solid ${sel?"rgba(34,197,94,0.3)":X.bdr}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:700,color:sel?X.g:X.tx}}>{d.name}</span><span style={{fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:X.r}}>{fmt(d.usado)}</span></div>
                    <Br p={p} color={p>70?X.r:X.y} h={4}/>
                  </button>);
                })}
              </div>
            </div>
          </>
        ):(
          <>
            <div style={{marginBottom:14}}><label style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:X.txD,fontWeight:600}}>Descripción</label><input type="text" placeholder="Ej: Bencina, Uber..." value={desc} onChange={e=>setDesc(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${X.bdr}`,borderRadius:10,padding:"11px 14px",color:X.tx,fontSize:14,fontFamily:"inherit",outline:"none",marginTop:5,boxSizing:"border-box"}}/></div>
            <div style={{marginBottom:14}}><label style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:X.txD,fontWeight:600}}>Categoría</label><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>{CATS.map(({n,g})=>{const gr=GROUPS[g];return(<button key={n} onClick={()=>setCat(n)} style={{background:cat===n?`${gr.c}22`:"rgba(255,255,255,0.03)",border:`1px solid ${cat===n?gr.c:X.bdr}`,borderRadius:14,padding:"5px 9px",color:cat===n?gr.c:X.txM,fontSize:10,fontWeight:cat===n?700:400,cursor:"pointer",fontFamily:"inherit"}}>{gr.i} {n}</button>);})}</div></div>
            <div style={{marginBottom:14}}><label style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:X.txD,fontWeight:600}}>Medio de pago</label><div style={{display:"flex",gap:5,marginTop:5,overflowX:"auto",paddingBottom:4}}>{CARDS.map(c=>(<button key={c} onClick={()=>setCard(c)} style={{background:card===c?"rgba(232,104,51,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${card===c?"rgba(232,104,51,0.4)":X.bdr}`,borderRadius:10,padding:"7px 11px",color:card===c?X.ac:X.txM,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{c}</button>))}</div></div>
          </>
        )}
        <button onClick={save} disabled={!amt} style={{width:"100%",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:!amt?"rgba(255,255,255,0.06)":mode==="pago"?"linear-gradient(135deg,#22C55E,#10B981)":"linear-gradient(135deg,#E86833,#F59E0B)",color:!amt?X.txD:"#fff"}}>Guardar</button>
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
  const [rules,setRules]=useState([]);
  const [bud,setBud]=useState(INIT_BUD);
  const [debts,setDebts]=useState(INIT_DEBTS);
  const [show,setShow]=useState(false);
  const [cm,setCm]=useState(today().slice(0,7));
  const [dEx,setDEx]=useState(300000);
  const [dSt,setDSt]=useState("avalancha");
  const [savPct,setSavPct]=useState(15);
  const [synced,setSynced]=useState(false);
  const [saving,setSaving]=useState(false);
  const skipSync = useRef(false);

  const CARD_TO_DEBT = { "TC SANT Plat": "plat", "TC SANT Life": "life", "CMR Falabella": "cmr", "Línea Créd": "lc" };

  useEffect(()=>{
    const unsub = onDataChange((data)=>{
      if(skipSync.current){skipSync.current=false;return;}
      if(data.exps) setExps(data.exps);
      if(data.pays) setPays(data.pays);
      if(data.rules) setRules(data.rules);
      if(data.bud) setBud(data.bud);
      if(data.debts) setDebts(data.debts);
      if(data.savPct!=null) setSavPct(data.savPct);
      setSynced(true);
    });
    return ()=>unsub();
  },[]);

  const doSave = useCallback(()=>{
    setSaving(true);
    skipSync.current = true;
    saveData({exps,pays,rules,bud,debts,savPct}).then(()=>setSaving(false));
  },[exps,pays,rules,bud,debts,savPct]);

  useEffect(()=>{if(synced) {
    const t = setTimeout(doSave, 800);
    return () => clearTimeout(t);
  }},[exps,pays,rules,bud,debts,savPct,synced,doSave]);

  const addExp = e => {
    setExps(p => [e, ...p]);
    const debtId = CARD_TO_DEBT[e.card];
    if (debtId) {
      setDebts(prev => prev.map(d => d.id === debtId ? { ...d, usado: Number(d.usado) + Number(e.amount) } : d));
    }
  };

  const deleteExp = (id) => {
    const exp = exps.find(x => x.id === id);
    if (!exp) return;
    if (confirm("¿Eliminar gasto?")) {
      setExps(p => p.filter(x => x.id !== id));
      const debtId = CARD_TO_DEBT[exp.card];
      if (debtId) {
        setDebts(prev => prev.map(d => d.id === debtId ? { ...d, usado: Math.max(0, Number(d.usado) - Number(exp.amount)) } : d));
      }
    }
  };

  const addPay=p=>{
    setPays(prev=>[p,...prev]);
    setDebts(prev=>prev.map(d=>d.id===p.debtId?{...d,usado:Math.max(0,d.usado-p.amount)}:d));
  };

  const mE=useMemo(()=>exps.filter(e=>mKey(e.date)===cm),[exps,cm]);
  const mP=useMemo(()=>pays.filter(p=>mKey(p.date)===cm),[pays,cm]);
  const mT=mE.reduce((a,e)=>a+e.amount,0);
  const mPd=mP.reduce((a,p)=>a+p.amount,0);
  const grp=useMemo(()=>{const g={};mE.forEach(e=>g[e.group]=(g[e.group]||0)+e.amount);return g;},[mE]);
  const tB=Object.values(bud).reduce((a,b)=>a+b,0);
  const fxT=FIXED.reduce((a,f)=>a+f.amount,0);
  const audM=Math.round(INC.audWeek*4.33*INC.rate);
  const totInc=audM+INC.clpFixed;
  const disp=totInc-fxT;
  const savAmt=Math.round(disp*savPct/100);
  const pGastar=disp-savAmt;
  const flujo=pGastar-mT;
  const alerts=useMemo(()=>{const a=[];Object.entries(grp).forEach(([g,s])=>{const b=bud[g]||0;if(b>0&&s>b)a.push({g,over:s-b});});return a.sort((x,y)=>y.over-x.over);},[grp,bud]);
  const tDeuda=debts.reduce((a,d)=>a+d.usado,0);
  const tCupo=debts.reduce((a,d)=>a+d.cupo,0);

  const dPlan=useMemo(()=>{
    if(dEx<=0)return[];
    let list=debts.map(d=>({...d,bal:d.usado,min:Math.max(Math.round(d.usado*0.02),5000)})).filter(d=>d.bal>0);
    if(dSt==="avalancha")list.sort((a,b)=>b.tasa-a.tasa);else list.sort((a,b)=>a.bal-b.bal);
    const tl=[];let mo=0;
    while(list.some(d=>d.bal>0)&&mo<60){mo++;let ex=dEx;list.forEach(d=>{d.bal=Math.round(d.bal*(1+d.tasa/100));const p=Math.min(d.bal,d.min);d.bal-=p;});for(const d of list){if(ex<=0)break;const p=Math.min(d.bal,ex);d.bal=Math.max(0,d.bal-p);ex-=p;}tl.push({mes:mo,total:list.reduce((a,d)=>a+d.bal,0)});if(list.every(d=>d.bal<=0))break;}
    return tl;
  },[debts,dEx,dSt]);

  return(
    <div style={{minHeight:"100vh",background:X.bg,color:X.tx,fontFamily:"'DM Sans',sans-serif",paddingBottom:80}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"/>
      {saving&&<div style={{position:"fixed",top:8,left:"50%",transform:"translateX(-50%)",background:"rgba(232,104,51,0.2)",borderRadius:20,padding:"4px 12px",fontSize:10,color:X.ac,zIndex:200}}>Sincronizando...</div>}
      <div style={{padding:"16px 18px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h1 style={{fontSize:20,fontWeight:800,margin:0,background:"linear-gradient(135deg,#E86833,#F59E0B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Mi Flujo</h1>
          <input type="month" value={cm} onChange={e=>setCm(e.target.value)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${X.bdr}`,borderRadius:10,padding:"7px 10px",color:X.tx,colorScheme:"dark"}}/>
        </div>
      </div>

      <div style={{padding:"0 18px",maxWidth:900,margin:"0 auto"}}>
        {view==="home"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Cd s={{background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(59,130,246,0.04))"}}>
              <div style={{fontSize:9,textTransform:"uppercase",color:X.txD}}>Ingreso mensual</div>
              <div style={{fontSize:28,fontWeight:800,color:X.g,fontFamily:"'JetBrains Mono'"}}>{fmt(totInc)}</div>
            </Cd>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              <St label="Fijo" value={fmtS(fxT)} color={X.y}/>
              <St label="P/Gastar" value={fmtS(pGastar)} color={X.b}/>
              <St label="Flujo" value={fmtS(flujo)} color={flujo>=0?X.g:X.r}/>
            </div>
            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:X.txM}}>Gasto del Mes</span><span style={{fontSize:18,fontWeight:800}}>{fmt(mT)}</span></div>
              <Br p={tB>0?mT/tB*100:0}/>
            </Cd>
            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontWeight:700}}>Últimos Gastos</span></div>
              {mE.slice(0,5).map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${X.bdr}`}}>
                  <div style={{fontSize:12}}>{e.desc}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700}}>{fmt(e.amount)}</span>
                    <button onClick={()=>deleteExp(e.id)} style={{background:"transparent",border:"none",color:X.txD,cursor:"pointer"}}>×</button>
                  </div>
                </div>
              ))}
            </Cd>
            <Cd>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700}}>💳 Deudas</span></div>
              <div style={{fontSize:22,fontWeight:800,color:X.r}}>{fmt(tDeuda)}</div>
              <Br p={pct(tDeuda,tCupo)} color={X.r}/>
            </Cd>
          </div>
        )}

        {view==="list"&&(
          <Cd>
            <h3 style={{fontSize:12,marginBottom:10}}>Todos los Gastos</h3>
            {mE.map(e=>(
              <div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${X.bdr}`}}>
                <div><div style={{fontSize:13,fontWeight:600}}>{e.desc}</div><div style={{fontSize:9,color:X.txD}}>{e.card} · {e.date}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:14,fontWeight:700}}>{fmt(e.amount)}</span><button onClick={()=>deleteExp(e.id)} style={{fontSize:18,background:"transparent",border:"none",color:X.r,cursor:"pointer"}}>×</button></div>
              </div>
            ))}
          </Cd>
        )}

        {view==="budget"&&(
          <Cd>
            <h3 style={{fontSize:12,marginBottom:15}}>Presupuesto por Grupo</h3>
            {Object.entries(GROUPS).map(([g,info])=>(
              <div key={g} style={{marginBottom:15}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}><span>{info.i} {g}</span><span>{fmt(grp[g]||0)} / {fmt(bud[g]||0)}</span></div>
                <Br p={bud[g]>0?pct(grp[g]||0,bud[g]):0} color={info.c}/>
              </div>
            ))}
          </Cd>
        )}

        {view==="debt"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {debts.map((d,di)=>(
              <Cd key={d.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:700}}>{d.name}</span><span>{pct(d.usado,d.cupo)}%</span></div>
                <div style={{fontSize:16,fontWeight:800,color:X.r,marginBottom:8}}>{fmt(d.usado)}</div>
                <Br p={pct(d.usado,d.cupo)} color={X.r}/>
                <input type="number" value={d.usado} onChange={e=>setDebts(prev=>prev.map((x,i)=>i===di?{...x,usado:Number(e.target.value)}:x))} style={{width:"100%",marginTop:10,background:"rgba(255,255,255,0.05)",border:"none",padding:8,borderRadius:8,color:X.tx}}/>
              </Cd>
            ))}
          </div>
        )}
      </div>

      <button onClick={()=>setShow(true)} style={{position:"fixed",bottom:80,right:20,width:56,height:56,borderRadius:28,background:X.ac,border:"none",color:"#fff",fontSize:30,boxShadow:"0 4px 15px rgba(232,104,51,0.4)"}}>+</button>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0b12",borderTop:`1px solid ${X.bdr}`,display:"flex",padding:"10px 0"}}>
        {[["home","🏠"],["list","📋"],["budget","🎯"],["debt","💳"]].map(([k,ic])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,background:"transparent",border:"none",fontSize:20,filter:view===k?"grayscale(0)":"grayscale(1)"}}>{ic}</button>
        ))}
      </div>
      {show&&<QuickEntry onClose={()=>setShow(false)} onSaveExp={addExp} onSavePay={addPay} expenses={exps} debts={debts} custom={rules}/>}
    </div>
  );
}
