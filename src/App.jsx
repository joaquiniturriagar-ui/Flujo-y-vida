import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { saveData, onDataChange } from "./firebase";

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════
const fmt = n => { if (n == null || isNaN(n)) return "$0"; const a = Math.abs(Math.round(n)); return (n < 0 ? "-$" : "$") + a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
const fmtAud = n => { if (n == null || isNaN(n)) return "A$0"; const a = Math.abs(Math.round(n)); return (n < 0 ? "-A$" : "A$") + a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
const fmtS = n => { const a = Math.abs(n); if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${Math.round(n / 1e3)}K`; return `${Math.round(n)}`; };
const today = () => new Date().toISOString().split("T")[0];
const mKey = d => d ? d.slice(0, 7) : today().slice(0, 7);
const mLabel = k => { if (!k) return ""; const [y, m] = k.split("-"); return `${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][+m - 1]} ${y.slice(2)}`; };
const weekNum = d => { const dt = new Date(d); const jan1 = new Date(dt.getFullYear(), 0, 1); return Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const toArray = d => Array.isArray(d) ? d : Object.values(d || {});
const AUD_CLP = 625;

// ══════════════════════════════════════════════════════════════════════
// CATEGORIES & AUTO-CATEGORIZATION
// ══════════════════════════════════════════════════════════════════════
const GROUPS = {
  "Vivienda": { i: "🏠", c: "#3B82F6" }, "Alimentación": { i: "🍽", c: "#10B981" },
  "Transporte": { i: "🚗", c: "#F59E0B" }, "Entretención": { i: "🎉", c: "#8B5CF6" },
  "Personal": { i: "👤", c: "#EC4899" }, "Familia": { i: "👨‍👩‍👧", c: "#14B8A6" },
  "Financiero": { i: "🏦", c: "#F97316" }, "Viajes": { i: "✈️", c: "#06B6D4" },
  "Otros": { i: "📦", c: "#94A3B8" },
};
const CATS = [
  { n: "Arriendo", g: "Vivienda" }, { n: "Gastos Comunes", g: "Vivienda" }, { n: "Servicios", g: "Vivienda" },
  { n: "Supermercado", g: "Alimentación" }, { n: "Comida Diaria", g: "Alimentación" },
  { n: "Bencina", g: "Transporte" }, { n: "Cuota Auto", g: "Transporte" }, { n: "Seguro Auto", g: "Transporte" },
  { n: "Mantención Auto", g: "Transporte" }, { n: "Movilización", g: "Transporte" },
  { n: "Restoranes/Salidas", g: "Entretención" }, { n: "Cervezas/Copas", g: "Entretención" },
  { n: "Gimnasio", g: "Entretención" }, { n: "Recreación", g: "Entretención" },
  { n: "Farmacia", g: "Personal" }, { n: "Celular", g: "Personal" }, { n: "Ropa/Accesorios", g: "Personal" },
  { n: "Peluquería", g: "Personal" }, { n: "Gastos Propios", g: "Personal" },
  { n: "Hermana", g: "Familia" }, { n: "Regalos", g: "Familia" }, { n: "Transferencias", g: "Familia" },
  { n: "Crédito Auto", g: "Financiero" }, { n: "Intereses/Comisiones", g: "Financiero" },
  { n: "Suscripciones", g: "Financiero" }, { n: "Pago Tarjeta", g: "Financiero" },
  { n: "Pasajes", g: "Viajes" }, { n: "Alojamiento", g: "Viajes" },
  { n: "Otros", g: "Otros" },
];
const catGroup = cat => CATS.find(c => c.n === cat)?.g || "Otros";
const RULES = [
  { kw: ["arriendo", "rent"], cat: "Arriendo" }, { kw: ["gastos comunes", "ggcc"], cat: "Gastos Comunes" }, { kw: ["gas ", "luz ", "agua ", "leña", "electri"], cat: "Servicios" },
  { kw: ["lider", "jumbo", "santa isabel", "super", "mercado", "aldi", "coles", "iga", "woolworth", "bakehouse", "feria", "fruta", "verdura", "huevo", "leche", "pan ", "carne", "pescad", "queso", "despensa"], cat: "Supermercado" },
  { kw: ["comida", "almuerzo", "desayuno", "completo", "empanada", "sushi", "pizza", "hamburg", "kebab", "ramen", "taco", "warung", "gohan", "acai", "helado", "kuchen", "postre", "dulce", "chocolate", "sandwich"], cat: "Comida Diaria" },
  { kw: ["bencina", "petrobras", "shell", "copec", "peaje", "petro", "bp "], cat: "Bencina" },
  { kw: ["cuota auto", "credito auto"], cat: "Cuota Auto" }, { kw: ["seguro auto", "permiso circ", "seguro pat"], cat: "Seguro Auto" },
  { kw: ["revision tec", "mecanic", "repuesto", "bateria", "cambio aceite", "mantencion auto", "balanceo", "lavado", "repco", "disco"], cat: "Mantención Auto" },
  { kw: ["uber", "metro", "bus ", "pasaje", "transfer", "transvip", "grab", "taxi", "didi", "tren"], cat: "Movilización" },
  { kw: ["cerveza", "cerv", "chela", "copete", "pisco", "vino", "gin ", "botiller", "cellar", "licor"], cat: "Cervezas/Copas" },
  { kw: ["restoran", "gaucha", "rolling", "tropera", "chalota", "canalla", "salmon", "rails", "bar ", "cafe", "café", "starbuck", "rappi", "pedidos ya", "subway", "mcdonald", "kfc", "bagual", "chipotl"], cat: "Restoranes/Salidas" },
  { kw: ["gym", "gimnasio", "surfit", "rebox"], cat: "Gimnasio" }, { kw: ["cine", "entrada", "museo", "teatro"], cat: "Recreación" },
  { kw: ["farmacia", "cruz verde", "salcobrand", "remedio", "dentista", "consulta", "crema", "detergent"], cat: "Farmacia" },
  { kw: ["celular", "felix", "entel", "movistar", "wom", "claro"], cat: "Celular" },
  { kw: ["ropa", "polera", "poleron", "camisa", "pantalon", "boxer", "zapato", "chala", "bolso", "uniqlo", "levis", "mochila", "jockey", "ghanda", "kmart"], cat: "Ropa/Accesorios" },
  { kw: ["peluquer", "corte de pelo", "barbero", "corte "], cat: "Peluquería" }, { kw: ["regalo"], cat: "Regalos" },
  { kw: ["hermana", "domi"], cat: "Hermana" }, { kw: ["mama", "papa", "mati", "colo ", "vicente", "seba", "nico ", "isi ", "benja"], cat: "Transferencias" },
  { kw: ["netflix", "spotify", "microsoft", "apple", "google", "capcut", "chatgpt", "chat gpt", "avast", "d5 ", "youtube"], cat: "Suscripciones" },
  { kw: ["interes", "mora", "mantencion tc", "mant tarj", "mantencion plan", "admin", "comision", "iva", "impuesto"], cat: "Intereses/Comisiones" },
  { kw: ["hotel", "hostal", "aloj", "airbnb", "hostel"], cat: "Alojamiento" }, { kw: ["vuelo", "avion", "aerop", "flight"], cat: "Pasajes" },
];
const autocat = (desc, custom = []) => { const d = desc.toLowerCase().trim(); if (!d) return null; for (const r of custom) if (r.kw.some(k => d.includes(k.toLowerCase()))) return r.cat; for (const r of RULES) if (r.kw.some(k => d.includes(k))) return r.cat; return null; };

// ══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════
const INIT_DEBTS = [
  { id: "lc", name: "Línea de Crédito", cupo: 1000000, usado: 1000000, tasa: 2.8 },
  { id: "plat", name: "TC Santander Plat.", cupo: 4000000, usado: 2310740, tasa: 3.2 },
  { id: "life", name: "TC Santander Life", cupo: 1700000, usado: 740054, tasa: 3.2 },
  { id: "cmr", name: "CMR Falabella", cupo: 390000, usado: 383223, tasa: 3.5 },
];
const INIT_BUD = { "Vivienda": 250000, "Alimentación": 300000, "Transporte": 200000, "Entretención": 200000, "Personal": 150000, "Familia": 120000, "Financiero": 80000, "Viajes": 0, "Otros": 50000 };
const CARDS = ["TC SANT Plat", "TC SANT Life", "CMR Falabella", "TD SANT", "Línea Créd", "Efectivo", "CommBank AUS"];
const CARD_TO_DEBT = { "TC SANT Plat": "plat", "TC SANT Life": "life", "CMR Falabella": "cmr", "Línea Créd": "lc" };
const FIXED = [{ name: "Crédito Auto", amount: 180000 }, { name: "Mantención Hermana", amount: 100000 }, { name: "CommBank Celular", amount: Math.round(40 * AUD_CLP) }];
const FIXED_TOTAL = FIXED.reduce((a, f) => a + f.amount, 0);
const INIT_INC = { audWeek: 900, clpFixed: 150000, audRate: AUD_CLP };

// ══════════════════════════════════════════════════════════════════════
// DESIGN
// ══════════════════════════════════════════════════════════════════════
const X = { bg: "#0a0b12", card: "rgba(255,255,255,0.03)", bdr: "rgba(255,255,255,0.07)", tx: "#e2e2ec", txD: "rgba(255,255,255,0.35)", txM: "rgba(255,255,255,0.55)", ac: "#E86833", g: "#22C55E", r: "#EF4444", y: "#F59E0B", b: "#3B82F6", p: "#8B5CF6" };

// ══════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════
const Cd = ({ children, s, alert }) => (
  <div style={{ background: X.card, border: `1px solid ${alert ? "rgba(239,68,68,0.25)" : X.bdr}`, borderRadius: 16, padding: "16px 18px", position: "relative", overflow: "hidden", ...s }}>
    {alert && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#EF4444,#F59E0B)" }} />}{children}
  </div>);
const St = ({ icon, label, value, color = X.ac, sub }) => (
  <Cd s={{ padding: "14px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><span style={{ fontSize: 14 }}>{icon}</span><span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600 }}>{label}</span></div>
    <div style={{ fontSize: 19, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -0.3 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: X.txD, marginTop: 2 }}>{sub}</div>}
  </Cd>);
const Br = ({ p, color = X.ac, h = 5 }) => (
  <div style={{ height: h, borderRadius: h / 2, background: "rgba(255,255,255,0.06)", flex: 1, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, p))}%`, borderRadius: h / 2, background: p > 90 ? X.r : p > 70 ? X.y : color, transition: "width 0.5s" }} />
  </div>);
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: "#14152a", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "8px 12px", fontSize: 11 }}>
    <div style={{ color: X.txD, marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 5, color: p.color, marginBottom: 2 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: p.color }} />{p.name}: {fmt(p.value)}</div>))}
  </div>);
};

// ══════════════════════════════════════════════════════════════════════
// QUICK ENTRY — 3 modes: Gasto, Pago Deuda, Ingreso AUD
// ══════════════════════════════════════════════════════════════════════
function QuickEntry({ onClose, onSaveExp, onSavePay, onSaveDeposit, expenses, customRules, debts, audRate }) {
  const [mode, setMode] = useState("gasto");
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [card, setCard] = useState("TC SANT Plat");
  const [cat, setCat] = useState("");
  const [date, setDate] = useState(today());
  const [sug, setSug] = useState(null);
  const [cur, setCur] = useState("CLP");
  const [tid, setTid] = useState(debts[0]?.id || "");
  const ref = useRef(null);

  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);
  useEffect(() => { if (mode === "gasto") { const s = autocat(desc, customRules); setSug(s); if (s && !cat) setCat(s); } }, [desc]);

  const ac = useMemo(() => {
    if (desc.length < 2 || mode !== "gasto") return [];
    const l = desc.toLowerCase(), seen = new Set();
    return expenses.filter(e => e.desc && e.desc.toLowerCase().includes(l)).filter(e => { if (seen.has(e.desc)) return false; seen.add(e.desc); return true; }).slice(0, 4);
  }, [desc, expenses, mode]);

  const save = () => {
    const n = parseInt(amt.replace(/\D/g, ""), 10); if (!n) return;
    const clp = cur === "AUD" ? Math.round(n * audRate) : n;
    const id = Date.now() + Math.random().toString(36).slice(2);

    if (mode === "ingreso") {
      onSaveDeposit({
        id, date, currency: cur,
        audAmount: cur === "AUD" ? n : 0,
        clpAmount: cur === "CLP" ? n : clp,
        desc: desc.trim() || (cur === "AUD" ? "Ingreso AUD" : "Ingreso CLP"),
      });
    } else if (mode === "pago") {
      onSavePay({ id, date, amount: clp, originalAmount: n, currency: cur, debtId: tid, debtName: debts.find(d => d.id === tid)?.name || "", desc: desc.trim() || `Pago ${debts.find(d => d.id === tid)?.name || "deuda"}` });
    } else {
      if (!desc.trim()) return;
      onSaveExp({ id, date, amount: clp, originalAmount: n, currency: cur, desc: desc.trim(), card, category: cat || "Otros", group: catGroup(cat || "Otros"), audAmount: cur === "AUD" ? n : 0 });
    }
    onClose();
  };

  const fa = v => { const n = v.replace(/\D/g, ""); return n ? parseInt(n, 10).toLocaleString("es-CL").replace(/,/g, ".") : ""; };
  const modeColors = { gasto: X.ac, pago: X.g, ingreso: X.b };
  const modeLabels = { gasto: "Guardar Gasto", pago: "Registrar Pago", ingreso: "Registrar Ingreso" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(6px)" }}>
      <style>{`@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div style={{ background: "#14152a", width: "100%", maxWidth: 480, maxHeight: "94vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "20px 18px 32px", animation: "su 0.2s ease" }}>

        {/* Mode toggle — 3 modes */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden", border: `1px solid ${X.bdr}` }}>
            {[["gasto", "💸 Gasto"], ["pago", "💳 Pago"], ["ingreso", "💵 Ingreso"]].map(([k, l]) => (
              <button key={k} onClick={() => { setMode(k); setAmt(""); setDesc(""); setCat(""); }}
                style={{ padding: "9px 12px", border: "none", background: mode === k ? `${modeColors[k]}22` : "transparent", color: mode === k ? modeColors[k] : X.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: X.txD, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Currency (hidden in ingreso mode — always AUD) */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["CLP", "AUD"].map(c => (
            <button key={c} onClick={() => setCur(c)} style={{ flex: 1, padding: "7px", borderRadius: 10, border: `1px solid ${cur === c ? "rgba(232,104,51,0.4)" : X.bdr}`, background: cur === c ? "rgba(232,104,51,0.1)" : "transparent", color: cur === c ? X.ac : X.txM, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {c === "CLP" ? "🇨🇱 CLP" : "🇦🇺 AUD"}
            </button>))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: modeColors[mode], fontFamily: "'JetBrains Mono',monospace" }}>
              {cur === "AUD" ? "A$" : "$"}
            </span>
            <input ref={ref} type="text" inputMode="numeric" placeholder="0" value={fa(amt)} onChange={e => setAmt(e.target.value.replace(/\./g, ""))}
              style={{ flex: 1, background: "transparent", border: "none", color: X.tx, fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", outline: "none", padding: 0, width: "100%" }} />
          </div>
          <div style={{ height: 2, background: `linear-gradient(90deg,${modeColors[mode]},transparent)`, marginTop: 3 }} />
          {cur === "AUD" && amt && <div style={{ fontSize: 11, color: X.txD, marginTop: 4 }}>≈ {fmt(parseInt(amt.replace(/\D/g, ""), 10) * audRate)} CLP</div>}
        </div>

        {/* ── INGRESO MODE ── */}
        {mode === "ingreso" && (<>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Nota</label>
            <input type="text" placeholder="Ej: Pago semanal, propina, extra..." value={desc} onChange={e => setDesc(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "10px 14px", color: X.tx, fontSize: 13, fontFamily: "inherit", outline: "none", marginTop: 5, boxSizing: "border-box" }} />
          </div>
          <div style={{ background: cur === "AUD" ? "rgba(59,130,246,0.06)" : "rgba(34,197,94,0.06)", border: `1px solid ${cur === "AUD" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: X.txM }}>
            {cur === "AUD"
              ? "💡 Se suma a tu billetera AUD. Los gastos en AUD se descuentan automáticamente."
              : "💡 Se suma a tu billetera CLP. Los gastos con débito/efectivo se descuentan automáticamente."}
          </div>
        </>)}

        {/* ── PAGO MODE ── */}
        {mode === "pago" && (<>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>¿A cuál deuda?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {debts.filter(d => (d.usado || 0) > 0).map(d => {
                const p = pct(d.usado, d.cupo); const sel = tid === d.id;
                return (<button key={d.id} onClick={() => setTid(d.id)} style={{ background: sel ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${sel ? "rgba(34,197,94,0.3)" : X.bdr}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? X.g : X.tx }}>{d.name}</span><span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.r }}>{fmt(d.usado)}</span></div>
                  <Br p={p} color={p > 70 ? X.r : X.y} h={4} />
                </button>);
              })}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Nota (opcional)</label><input type="text" placeholder="Pago mínimo, abono..." value={desc} onChange={e => setDesc(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "10px 14px", color: X.tx, fontSize: 13, fontFamily: "inherit", outline: "none", marginTop: 5, boxSizing: "border-box" }} /></div>
        </>)}

        {/* ── GASTO MODE ── */}
        {mode === "gasto" && (<>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Descripción</label>
            <input type="text" placeholder="Ej: Bencina, Uber, Super..." value={desc} onChange={e => setDesc(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "11px 14px", color: X.tx, fontSize: 14, fontFamily: "inherit", outline: "none", marginTop: 5, boxSizing: "border-box" }} />
            {ac.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>{ac.map((e, i) => (<button key={i} onClick={() => { setDesc(e.desc); setCat(e.category); setCard(e.card); }} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 14, padding: "4px 10px", color: X.txM, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{e.desc}</button>))}</div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Categoría</label>{sug && sug === cat && <span style={{ fontSize: 9, color: X.g, fontWeight: 600 }}>✨ Auto</span>}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{CATS.map(({ n, g }) => { const gr = GROUPS[g]; return (<button key={n} onClick={() => setCat(n)} style={{ background: cat === n ? `${gr.c}22` : "rgba(255,255,255,0.03)", border: `1px solid ${cat === n ? gr.c : X.bdr}`, borderRadius: 14, padding: "5px 9px", color: cat === n ? gr.c : X.txM, fontSize: 10, fontWeight: cat === n ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>{gr.i} {n}</button>); })}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Medio de pago</label>
            <div style={{ display: "flex", gap: 5, marginTop: 5, overflowX: "auto", paddingBottom: 4 }}>{CARDS.map(c => (<button key={c} onClick={() => setCard(c)} style={{ background: card === c ? "rgba(232,104,51,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${card === c ? "rgba(232,104,51,0.4)" : X.bdr}`, borderRadius: 10, padding: "7px 11px", color: card === c ? X.ac : X.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{c}</button>))}</div>
          </div>
        </>)}

        {/* Date (all modes) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: X.txD, fontWeight: 600 }}>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "9px 14px", color: X.tx, fontSize: 13, fontFamily: "inherit", outline: "none", marginTop: 5, boxSizing: "border-box", colorScheme: "dark" }} />
        </div>

        <button onClick={save} disabled={!amt || (mode === "gasto" && !desc.trim())}
          style={{ width: "100%", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: (!amt || (mode === "gasto" && !desc.trim())) ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,${modeColors[mode]},${mode === "gasto" ? "#F59E0B" : mode === "pago" ? "#10B981" : "#3B82F6"})`, color: (!amt || (mode === "gasto" && !desc.trim())) ? X.txD : "#fff" }}>
          {modeLabels[mode]}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("home");
  const [exps, setExps] = useState([]);
  const [pays, setPays] = useState([]);
  const [deps, setDeps] = useState([]); // AUD deposits
  const [rules, setRules] = useState([]);
  const [debts, setDebts] = useState(INIT_DEBTS);
  const [bud, setBud] = useState(INIT_BUD);
  const [inc, setInc] = useState(INIT_INC);
  const [cm, setCm] = useState(today().slice(0, 7));
  const [show, setShow] = useState(false);
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dEx, setDEx] = useState(400000);
  const [dSt, setDSt] = useState("avalancha");
  const [savPct, setSavPct] = useState(15);
  const skipSync = useRef(false);

  // Firebase sync
  useEffect(() => {
    return onDataChange((data) => {
      if (skipSync.current) { skipSync.current = false; return; }
      if (data) {
        setExps(toArray(data.exps)); setPays(toArray(data.pays)); setDeps(toArray(data.deps));
        setRules(toArray(data.rules));
        if (data.debts) setDebts(toArray(data.debts));
        if (data.bud) setBud(data.bud);
        if (data.inc) setInc(data.inc);
        if (data.savPct != null) setSavPct(data.savPct);
        setSynced(true);
      }
    });
  }, []);

  const saveTimer = useRef(null);
  const doSave = useCallback((nE, nP, nD, nR, nDb, nB, nS, nI) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true); skipSync.current = true;
      saveData({ exps: nE, pays: nP, deps: nD, rules: nR, debts: nDb, bud: nB, savPct: nS, inc: nI }).then(() => setSaving(false));
    }, 600);
  }, []);

  // Actions
  const addExp = (e) => {
    const nE = [e, ...exps];
    const debtId = CARD_TO_DEBT[e.card];
    const nDb = debtId ? debts.map(d => d.id === debtId ? { ...d, usado: (d.usado || 0) + (e.amount || 0) } : d) : debts;
    const s = autocat(e.desc, rules); let nR = rules;
    if (s !== e.category) { const w = e.desc.toLowerCase().trim().split(/\s+/)[0]; if (w && w.length >= 3 && !rules.some(r => r.kw.includes(w) && r.cat === e.category)) { nR = [...rules, { kw: [w], cat: e.category }]; setRules(nR); } }
    setExps(nE); setDebts(nDb);
    doSave(nE, pays, deps, nR, nDb, bud, savPct, inc);
  };

  const deleteExp = (expense) => {
    if (!confirm("¿Eliminar?")) return;
    const nE = exps.filter(x => x.id !== expense.id);
    const debtId = CARD_TO_DEBT[expense.card];
    const nDb = debtId ? debts.map(d => d.id === debtId ? { ...d, usado: Math.max(0, (d.usado || 0) - (expense.amount || 0)) } : d) : debts;
    setExps(nE); setDebts(nDb);
    doSave(nE, pays, deps, rules, nDb, bud, savPct, inc);
  };

  const addPay = (p) => {
    const nP = [p, ...pays];
    const nDb = debts.map(d => d.id === p.debtId ? { ...d, usado: Math.max(0, (d.usado || 0) - (p.amount || 0)) } : d);
    setPays(nP); setDebts(nDb);
    doSave(exps, nP, deps, rules, nDb, bud, savPct, inc);
  };

  const addDeposit = (d) => {
    const nD = [d, ...deps]; setDeps(nD);
    doSave(exps, pays, nD, rules, debts, bud, savPct, inc);
  };

  const saveBudget = (nb) => { setBud(nb); doSave(exps, pays, deps, rules, debts, nb, savPct, inc); };
  const saveSavPct = (v) => { setSavPct(v); doSave(exps, pays, deps, rules, debts, bud, v, inc); };
  const saveDebtEdit = (nd) => { setDebts(nd); doSave(exps, pays, deps, rules, nd, bud, savPct, inc); };
  const saveInc = (ni) => { setInc(ni); doSave(exps, pays, deps, rules, debts, bud, savPct, ni); };

  // ── Computed ──
  const audMonthly = Math.round((inc.audWeek || 0) * 4.33 * (inc.audRate || AUD_CLP));
  const totalIncome = audMonthly + (inc.clpFixed || 0);
  const mE = useMemo(() => exps.filter(e => mKey(e.date) === cm), [exps, cm]);
  const mP = useMemo(() => pays.filter(p => mKey(p.date) === cm), [pays, cm]);
  const mD = useMemo(() => deps.filter(d => mKey(d.date) === cm), [deps, cm]);
  const mT = mE.reduce((a, e) => a + (e.amount || 0), 0);
  const mPd = mP.reduce((a, p) => a + (p.amount || 0), 0);
  const grp = useMemo(() => { const g = {}; mE.forEach(e => g[e.group] = (g[e.group] || 0) + (e.amount || 0)); return g; }, [mE]);
  const tB = Object.values(bud).reduce((a, b) => a + (b || 0), 0);
  const disp = totalIncome - FIXED_TOTAL;
  const savAmt = Math.round(disp * savPct / 100);
  const pGastar = disp - savAmt;
  const flujo = pGastar - mT;
  const tDeuda = debts.reduce((a, d) => a + (d.usado || 0), 0);
  const tCupo = debts.reduce((a, d) => a + (d.cupo || 0), 0);

  // AUD Wallet
  const totalDepsAud = deps.reduce((a, d) => a + (d.audAmount || 0), 0);
  const totalSpentAud = exps.reduce((a, e) => a + (e.audAmount || 0), 0);
  const audBalance = totalDepsAud - totalSpentAud;
  const mDepsAud = mD.reduce((a, d) => a + (d.audAmount || 0), 0);
  const mSpentAud = mE.reduce((a, e) => a + (e.audAmount || 0), 0);

  // CLP Wallet — deposits minus debit/cash expenses (credit card expenses don't touch this)
  const CLP_DEBIT_CARDS = ["TD SANT", "Efectivo"];
  const totalDepsCLP = deps.filter(d => d.currency === "CLP" || (!d.currency && !d.audAmount)).reduce((a, d) => a + (d.clpAmount || 0), 0);
  const totalSpentCLP = exps.filter(e => CLP_DEBIT_CARDS.includes(e.card)).reduce((a, e) => a + (e.amount || 0), 0);
  const clpBalance = totalDepsCLP - totalSpentCLP;
  const mDepsCLP = mD.filter(d => d.currency === "CLP").reduce((a, d) => a + (d.clpAmount || 0), 0);
  const mSpentCLP = mE.filter(e => CLP_DEBIT_CARDS.includes(e.card)).reduce((a, e) => a + (e.amount || 0), 0);

  // Weekly breakdown for wallet chart
  const walletChart = useMemo(() => {
    const all = [
      ...deps.map(d => ({ date: d.date, aud: d.audAmount || 0, type: "in" })),
      ...exps.filter(e => (e.audAmount || 0) > 0).map(e => ({ date: e.date, aud: -(e.audAmount || 0), type: "out" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    if (!all.length) return [];
    let bal = 0;
    const pts = [];
    for (const item of all) {
      bal += item.aud;
      const label = item.date.slice(5);
      pts.push({ date: label, balance: Math.max(0, bal) });
    }
    return pts.slice(-20);
  }, [deps, exps]);

  const alerts = useMemo(() => {
    const a = []; Object.entries(grp).forEach(([g, s]) => { const b = bud[g] || 0; if (b > 0 && s > b) a.push({ g, over: s - b }); });
    return a.sort((x, y) => y.over - x.over);
  }, [grp, bud]);

  const dPlan = useMemo(() => {
    if (dEx <= 0) return [];
    let list = debts.map(d => ({ ...d, bal: d.usado || 0, min: Math.max(Math.round((d.usado || 0) * 0.02), 5000) })).filter(d => d.bal > 0);
    if (dSt === "avalancha") list.sort((a, b) => (b.tasa || 0) - (a.tasa || 0)); else list.sort((a, b) => a.bal - b.bal);
    const tl = []; let mo = 0;
    while (list.some(d => d.bal > 0) && mo < 60) {
      mo++; let ex = dEx; list.forEach(d => { d.bal = Math.round(d.bal * (1 + (d.tasa || 0) / 100)); const p = Math.min(d.bal, d.min); d.bal -= p; });
      for (const d of list) { if (ex <= 0) break; const p = Math.min(d.bal, ex); d.bal = Math.max(0, d.bal - p); ex -= p; }
      tl.push({ mes: mo, total: list.reduce((a, d) => a + d.bal, 0) }); if (list.every(d => d.bal <= 0)) break;
    }
    return tl;
  }, [debts, dEx, dSt]);

  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: X.bg, color: X.tx, fontFamily: "'DM Sans',-apple-system,sans-serif", paddingBottom: 90 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style>{`*{-webkit-tap-highlight-color:transparent;box-sizing:border-box}input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7)}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}`}</style>
      {saving && <div style={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(232,104,51,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 10, color: X.ac, zIndex: 200, fontWeight: 600 }}>Sincronizando...</div>}

      {/* HEADER */}
      <div style={{ padding: "16px 18px 0", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: -0.5, background: "linear-gradient(135deg,#E86833,#F59E0B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Mi Flujo</h1>
            <p style={{ margin: "1px 0 0", fontSize: 10, color: X.txD }}>{mLabel(cm)} · {mE.length} gastos · {mP.length} pagos {synced && <span style={{ color: X.g }}>● sync</span>}</p>
          </div>
          <input type="month" value={cm} onChange={e => setCm(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 10, padding: "7px 10px", color: X.tx, fontSize: 11, fontFamily: "inherit", outline: "none", colorScheme: "dark" }} />
        </div>
        {alerts.length > 0 && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 11, color: "#FCA5A5" }}>🚨 {alerts.map(a => `${a.g} +${fmt(a.over)}`).join(" · ")}</div>}
      </div>

      <div style={{ padding: "0 18px 40px", maxWidth: 900, margin: "0 auto" }}>

        {/* ═══ HOME ═══ */}
        {view === "home" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* WALLETS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* AUD */}
            <Cd s={{ background: "linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,165,233,0.04))", border: "1px solid rgba(59,130,246,0.15)", padding: "14px 16px", cursor: "pointer" }} onClick={() => setView("wallet")}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600, marginBottom: 4 }}>🇦🇺 Billetera AUD</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: X.b, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -0.5 }}>{fmtAud(audBalance)}</div>
              <div style={{ fontSize: 10, color: X.txD, marginTop: 2 }}>≈ {fmt(audBalance * (inc.audRate || AUD_CLP))}</div>
              {(mDepsAud > 0 || mSpentAud > 0) && <div style={{ fontSize: 10, marginTop: 6, color: X.txD }}>
                {mDepsAud > 0 && <span style={{ color: X.g }}>↑{fmtAud(mDepsAud)} </span>}
                {mSpentAud > 0 && <span style={{ color: X.r }}>↓{fmtAud(mSpentAud)}</span>}
              </div>}
            </Cd>
            {/* CLP */}
            <Cd s={{ background: "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(16,185,129,0.04))", border: "1px solid rgba(34,197,94,0.15)", padding: "14px 16px", cursor: "pointer" }} onClick={() => setView("wallet")}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600, marginBottom: 4 }}>🇨🇱 Billetera CLP</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: clpBalance >= 0 ? X.g : X.r, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -0.5 }}>{fmt(clpBalance)}</div>
              <div style={{ fontSize: 10, color: X.txD, marginTop: 2 }}>Débito + Efectivo</div>
              {(mDepsCLP > 0 || mSpentCLP > 0) && <div style={{ fontSize: 10, marginTop: 6, color: X.txD }}>
                {mDepsCLP > 0 && <span style={{ color: X.g }}>↑{fmt(mDepsCLP)} </span>}
                {mSpentCLP > 0 && <span style={{ color: X.r }}>↓{fmt(mSpentCLP)}</span>}
              </div>}
            </Cd>
          </div>

          {/* Income */}
          <Cd s={{ background: "linear-gradient(135deg,rgba(34,197,94,0.06),rgba(59,130,246,0.04))" }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600 }}>Ingreso mensual (piso)</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: X.g, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -0.5, marginTop: 4 }}>{fmt(totalIncome)}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: X.txM }}><span>🇦🇺 {inc.audWeek} AUD/sem → {fmt(audMonthly)}</span><span>🇨🇱 {fmt(inc.clpFixed)}</span></div>
          </Cd>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <St icon="📤" label="Fijos" value={fmtS(FIXED_TOTAL)} color={X.y} sub="Créd+Hna+Cel" />
            <St icon="💰" label="P/Gastar" value={fmtS(pGastar)} color={X.b} sub={`Ahorro ${savPct}%`} />
            <St icon={flujo >= 0 ? "✅" : "🔴"} label="Flujo" value={fmtS(flujo)} color={flujo >= 0 ? X.g : X.r} />
          </div>

          <Cd>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: X.txM }}>Gasto del Mes</span><span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: mT > tB ? X.r : X.tx }}>{fmt(mT)}</span></div>
            <Br p={tB > 0 ? mT / tB * 100 : 0} color={X.ac} h={6} />
            <div style={{ fontSize: 10, color: X.txD, marginTop: 4, textAlign: "right" }}>{tB > 0 ? `${pct(mT, tB)}% de ${fmt(tB)}` : ""}</div>
          </Cd>

          <Cd>
            <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.txM }}>Por Grupo vs Presupuesto</h3>
            {Object.entries(GROUPS).map(([g, info]) => { const s = grp[g] || 0, b = bud[g] || 0; if (s === 0 && b === 0) return null; const p = b > 0 ? pct(s, b) : 0, ov = b > 0 && s > b; return (<div key={g} style={{ marginBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, color: ov ? X.r : X.txM }}>{info.i} {g} {ov && <span style={{ color: X.r, fontWeight: 700 }}>+{fmt(s - b)}</span>}</span><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: ov ? X.r : X.tx }}>{fmt(s)}<span style={{ color: X.txD }}>/{fmtS(b)}</span></span></div><Br p={b > 0 ? p : (s / Math.max(1, mT) * 100)} color={info.c} /></div>); })}
            {!Object.keys(grp).length && <div style={{ textAlign: "center", padding: 20, color: X.txD, fontSize: 11 }}>Toca <strong style={{ color: X.ac }}>+</strong> para agregar</div>}
          </Cd>

          <Cd><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.txM }}>📌 Pagos Fijos</h3>{FIXED.map((f, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${X.bdr}`, fontSize: 12 }}><span style={{ color: X.txM }}>{f.name}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{fmt(f.amount)}</span></div>))}<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: 13, fontWeight: 700 }}><span>Total</span><span style={{ color: X.y, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(FIXED_TOTAL)}</span></div></Cd>

          {mE.length > 0 && <Cd>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: X.txM }}>Últimos Gastos</span><button onClick={() => setView("list")} style={{ background: "transparent", border: "none", color: X.ac, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Ver todo →</button></div>
            {mE.slice(0, 5).map(e => { const gr = GROUPS[e.group] || GROUPS.Otros; return (<div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${X.bdr}` }}><div style={{ width: 30, height: 30, borderRadius: 8, background: `${gr.c}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{gr.i}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{e.category} · {e.card}{e.audAmount ? ` · A$${e.audAmount}` : ""}</div></div><div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{fmt(e.amount)}</div></div>); })}
          </Cd>}

          <Cd><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: X.txM }}>💳 Deudas</span><button onClick={() => setView("debt")} style={{ background: "transparent", border: "none", color: X.ac, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Ver plan →</button></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><div><div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: X.r }}>{fmt(tDeuda)}</div><div style={{ fontSize: 10, color: X.txD }}>{pct(tDeuda, tCupo)}% del cupo</div></div>{mPd > 0 && <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(mPd)}</div><div style={{ fontSize: 10, color: X.g }}>pagado ✓</div></div>}</div><Br p={pct(tDeuda, tCupo)} color={X.r} h={5} /></Cd>
        </div>)}

        {/* ═══ WALLET (AUD) ═══ */}
        {view === "wallet" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Cd s={{ background: "linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,165,233,0.04))", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600, marginBottom: 4 }}>🇦🇺 Saldo Actual</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: X.b, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -1 }}>{fmtAud(audBalance)}</div>
            <div style={{ fontSize: 13, color: X.txD, marginTop: 4 }}>≈ {fmt(audBalance * (inc.audRate || AUD_CLP))} CLP</div>
          </Cd>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <St icon="↑" label="Total In" value={fmtAud(totalDepsAud)} color={X.g} sub={`${deps.length} depósitos`} />
            <St icon="↓" label="Total Out" value={fmtAud(totalSpentAud)} color={X.r} sub="gastos en AUD" />
            <St icon="📅" label="Este Mes" value={fmtAud(mDepsAud - mSpentAud)} color={X.b} sub={`+${fmtAud(mDepsAud)} -${fmtAud(mSpentAud)}`} />
          </div>

          {/* Balance chart */}
          {walletChart.length > 1 && <Cd>
            <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.txM }}>Evolución del Saldo</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={walletChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs><linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={X.b} stopOpacity={0.3} /><stop offset="100%" stopColor={X.b} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: X.txD, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: X.txD, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TT />} />
                <Area type="monotone" dataKey="balance" stroke={X.b} fill="url(#gW)" strokeWidth={2} name="AUD" />
              </AreaChart>
            </ResponsiveContainer>
          </Cd>}

          {/* Deposit history */}
          <Cd>
            <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.g }}>↑ Ingresos AUD</h3>
            {deps.length === 0 && <div style={{ textAlign: "center", padding: 20, color: X.txD, fontSize: 11 }}>Toca + → 💵 Ingreso para registrar tu primer pago semanal</div>}
            {deps.slice(0, 15).map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: X.g }}>{d.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{d.date}</div></div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmtAud(d.audAmount)}</div>
                  <div style={{ fontSize: 9, color: X.txD }}>{fmt(d.clpAmount)}</div>
                </div>
              </div>
            ))}
          </Cd>

          {/* AUD expenses */}
          {exps.filter(e => (e.audAmount || 0) > 0).length > 0 && <Cd>
            <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.r }}>↓ Gastos en AUD</h3>
            {exps.filter(e => (e.audAmount || 0) > 0).slice(0, 15).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}>
                <div><div style={{ fontSize: 12, fontWeight: 600 }}>{e.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{e.date} · {e.card}</div></div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.r }}>{fmtAud(e.audAmount)}</div>
                  <div style={{ fontSize: 9, color: X.txD }}>{fmt(e.amount)}</div>
                </div>
              </div>
            ))}
          </Cd>}

          {/* ── CLP WALLET ── */}
          <div style={{ borderTop: `1px solid ${X.bdr}`, marginTop: 8, paddingTop: 16 }}>
            <Cd s={{ background: "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(16,185,129,0.04))", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600, marginBottom: 4 }}>🇨🇱 Saldo CLP</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: clpBalance >= 0 ? X.g : X.r, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -1 }}>{fmt(clpBalance)}</div>
              <div style={{ fontSize: 12, color: X.txD, marginTop: 4 }}>Solo débito (TD SANT) y efectivo — tarjetas de crédito no descuentan de acá</div>
            </Cd>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
              <St icon="↑" label="Ingresado" value={fmt(totalDepsCLP)} color={X.g} />
              <St icon="↓" label="Gastado" value={fmt(totalSpentCLP)} color={X.r} sub="débito+efectivo" />
              <St icon="📅" label="Este Mes" value={fmt(mDepsCLP - mSpentCLP)} color={mDepsCLP - mSpentCLP >= 0 ? X.g : X.r} />
            </div>

            {/* CLP deposits */}
            {deps.filter(d => d.currency === "CLP").length > 0 && <Cd s={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.g }}>↑ Ingresos CLP</h3>
              {deps.filter(d => d.currency === "CLP").slice(0, 10).map(d => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: X.g }}>{d.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{d.date}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(d.clpAmount)}</div>
                </div>
              ))}
            </Cd>}

            {/* CLP debit expenses */}
            {exps.filter(e => CLP_DEBIT_CARDS.includes(e.card)).length > 0 && <Cd s={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.r }}>↓ Gastos Débito/Efectivo</h3>
              {exps.filter(e => CLP_DEBIT_CARDS.includes(e.card)).slice(0, 10).map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600 }}>{e.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{e.date} · {e.card}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.r }}>{fmt(e.amount)}</div>
                </div>
              ))}
            </Cd>}
          </div>

          {/* ── TOTAL COMBINED ── */}
          <Cd s={{ background: "rgba(232,104,51,0.04)", border: "1px solid rgba(232,104,51,0.15)", marginTop: 8 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.3, color: X.txD, fontWeight: 600, marginBottom: 6 }}>💰 Ahorro Total (AUD + CLP)</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: X.ac, fontFamily: "'JetBrains Mono',monospace" }}>
              {fmt(clpBalance + audBalance * (inc.audRate || AUD_CLP))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: X.txM }}>
              <span>🇦🇺 {fmtAud(audBalance)}</span>
              <span>🇨🇱 {fmt(clpBalance)}</span>
            </div>
          </Cd>
        </div>)}
        {view === "list" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Cd><h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.txM }}>Gastos · {mLabel(cm)}</h3>
            {mE.length === 0 && <div style={{ textAlign: "center", padding: 24, color: X.txD, fontSize: 11 }}>Sin gastos</div>}
            {mE.map(e => { const gr = GROUPS[e.group] || GROUPS.Otros; return (<div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}><div style={{ width: 32, height: 32, borderRadius: 8, background: `${gr.c}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{gr.i}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{e.desc}</div><div style={{ fontSize: 9, color: X.txD }}>{e.category} · {e.card} · {e.date}{e.audAmount ? ` · A$${e.audAmount}` : ""}</div></div><div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(e.amount)}</div><button onClick={() => deleteExp(e)} style={{ background: "transparent", border: "none", color: X.txD, fontSize: 14, cursor: "pointer", padding: 2 }}>×</button></div>); })}
          </Cd>
          {mP.length > 0 && <Cd><h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: X.g }}>💳 Pagos a Deuda</h3>{mP.map(p => (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: X.g }}>{p.debtName}</div><div style={{ fontSize: 9, color: X.txD }}>{p.desc} · {p.date}</div></div><span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(p.amount)}</span></div>))}<div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "6px 0 0", borderTop: `1px solid ${X.bdr}` }}><span style={{ fontSize: 12, fontWeight: 700 }}>Total pagado</span><span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(mPd)}</span></div></Cd>}
          {mE.length > 0 && Object.keys(grp).length > 0 && <Cd><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.txM }}>Distribución</h3><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={Object.entries(grp).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ name: n, value: v }))} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">{Object.keys(grp).map((n, i) => <Cell key={i} fill={GROUPS[n]?.c || "#888"} />)}</Pie><Tooltip formatter={v => fmt(v)} contentStyle={{ background: "#14152a", border: `1px solid ${X.bdr}`, borderRadius: 10, fontSize: 10 }} /></PieChart></ResponsiveContainer></Cd>}
        </div>)}

        {/* ═══ BUDGET ═══ */}
        {view === "budget" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><St icon="🎯" label="Presupuesto" value={fmt(tB)} color={X.b} /><St icon={mT <= tB ? "✅" : "🚨"} label="Diferencia" value={fmt(tB - mT)} color={mT <= tB ? X.g : X.r} /></div>
          <Cd><h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: X.txM }}>Límites por Grupo</h3>{Object.entries(GROUPS).map(([g, info]) => { const s = grp[g] || 0, b = bud[g] || 0, p = b > 0 ? pct(s, b) : 0, ov = b > 0 && s > b; return (<div key={g} style={{ padding: "8px 0", borderBottom: `1px solid ${X.bdr}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}><span style={{ fontSize: 12, fontWeight: 600 }}>{info.i} {g}</span>{b > 0 && <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: ov ? X.r : p > 80 ? X.y : X.g }}>{p}%</span>}</div><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}><input type="number" value={b} step={10000} onChange={e => saveBudget({ ...bud, [g]: Math.max(0, +e.target.value) })} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 8, padding: "6px 10px", color: X.tx, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} /><span style={{ fontSize: 10, color: X.txD, minWidth: 65, textAlign: "right" }}>{fmt(s)}</span></div><Br p={b > 0 ? p : 0} color={info.c} h={5} /></div>); })}</Cd>
          <Cd s={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)" }}><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.g }}>💰 Ahorro</h3><div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="range" min={0} max={40} step={5} value={savPct} onChange={e => saveSavPct(+e.target.value)} style={{ flex: 1, accentColor: X.g }} /><span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: X.g, minWidth: 40 }}>{savPct}%</span></div><div style={{ fontSize: 12, color: X.txM, marginTop: 6 }}>{fmt(savAmt)}/mes → {fmt(savAmt * 12)}/año</div></Cd>
        </div>)}

        {/* ═══ DEBT ═══ */}
        {view === "debt" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}><St icon="💳" label="Deuda" value={fmt(tDeuda)} color={X.r} /><St icon="✅" label="Disponible" value={fmt(tCupo - tDeuda)} color={X.g} /><St icon="📊" label="Uso" value={`${pct(tDeuda, tCupo)}%`} color={X.y} /></div>
          {mPd > 0 && <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: X.g }}>✓ Pagado en {mLabel(cm)}</span><span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(mPd)}</span></div>}
          {debts.map((d, di) => { const p = pct(d.usado, d.cupo); const mp = mP.filter(pay => pay.debtId === d.id).reduce((a, pay) => a + (pay.amount || 0), 0); return (<Cd key={d.id} alert={p > 70}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{d.name}</h4><span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: p > 70 ? X.r : X.y }}>{p}%</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: X.txD, marginBottom: 5 }}><span>Usado: <span style={{ color: X.r, fontWeight: 700 }}>{fmt(d.usado)}</span></span><span>Cupo: {fmt(d.cupo)} · {d.tasa}%</span></div><Br p={p} color={p > 70 ? X.r : X.y} h={6} />{mp > 0 && <div style={{ marginTop: 6, fontSize: 10, color: X.g }}>✓ {fmt(mp)} pagado este mes</div>}<div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}><input type="number" value={d.usado || 0} step={10000} onChange={e => saveDebtEdit(debts.map((x, i) => i === di ? { ...x, usado: Math.max(0, +e.target.value) } : x))} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 8, padding: "6px 10px", color: X.tx, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} placeholder="Ajustar" /><span style={{ fontSize: 9, color: X.txD }}>editar</span></div></Cd>); })}
          <Cd><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.txM }}>🎯 Simulador</h3><div style={{ marginBottom: 10 }}><label style={{ fontSize: 10, color: X.txD }}>Extra/mes: <strong style={{ color: X.ac }}>{fmt(dEx)}</strong></label><input type="range" min={50000} max={1000000} step={50000} value={dEx} onChange={e => setDEx(+e.target.value)} style={{ width: "100%", accentColor: X.ac }} /></div><div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{[["avalancha", "🏔 Avalancha"], ["bolaNieve", "⛄ Bola Nieve"]].map(([k, l]) => (<button key={k} onClick={() => setDSt(k)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1px solid ${dSt === k ? "rgba(232,104,51,0.4)" : X.bdr}`, background: dSt === k ? "rgba(232,104,51,0.1)" : "transparent", color: dSt === k ? X.ac : X.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>))}</div>
            {dPlan.length > 0 && <><div style={{ display: "flex", gap: 10, marginBottom: 10 }}><div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "8px 14px", flex: 1 }}><div style={{ fontSize: 9, color: X.txD }}>LIBRE EN</div><div style={{ fontSize: 20, fontWeight: 800, color: X.g, fontFamily: "'JetBrains Mono',monospace" }}>{dPlan.length} meses</div><div style={{ fontSize: 10, color: X.txD }}>≈ {(dPlan.length / 12).toFixed(1)} años</div></div><div style={{ background: "rgba(232,104,51,0.08)", border: "1px solid rgba(232,104,51,0.2)", borderRadius: 10, padding: "8px 14px", flex: 1 }}><div style={{ fontSize: 9, color: X.txD }}>CON PROYECTO $3M</div><div style={{ fontSize: 20, fontWeight: 800, color: X.ac, fontFamily: "'JetBrains Mono',monospace" }}>{Math.max(1, dPlan.length - 6)} meses</div></div></div><ResponsiveContainer width="100%" height={160}><AreaChart data={dPlan} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={X.r} stopOpacity={0.3} /><stop offset="100%" stopColor={X.r} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" /><XAxis dataKey="mes" tick={{ fill: X.txD, fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: X.txD, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtS} /><Tooltip content={<TT />} /><Area type="monotone" dataKey="total" stroke={X.r} fill="url(#gD)" strokeWidth={2} name="Deuda" /></AreaChart></ResponsiveContainer></>}
          </Cd>
          <Cd s={{ background: "rgba(232,104,51,0.04)", border: "1px solid rgba(232,104,51,0.15)" }}><h3 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: X.ac }}>💡 Orden recomendado</h3><div style={{ fontSize: 12, color: X.txM, lineHeight: 1.7 }}>{debts.filter(d => (d.usado || 0) > 0).sort((a, b) => (b.tasa || 0) - (a.tasa || 0)).map((d, i) => (<div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ width: 20, height: 20, borderRadius: 10, background: `rgba(232,104,51,${0.3 - i * 0.05})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: X.ac, flexShrink: 0 }}>{i + 1}</span><span>{d.name} — {fmt(d.usado)} ({d.tasa}%)</span></div>))}<div style={{ marginTop: 8, fontSize: 11, color: X.txD }}>Paga primero la de mayor tasa para minimizar intereses.</div></div></Cd>
        </div>)}

        {/* ═══ CONFIG ═══ */}
        {view === "config" && (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Cd s={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>☁️</span><div><div style={{ fontSize: 13, fontWeight: 700, color: X.g }}>Sincronización {synced ? "activa" : "conectando..."}</div><div style={{ fontSize: 10, color: X.txD }}>Firebase · sync entre dispositivos en tiempo real</div></div></div></Cd>
          <Cd>
            <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: X.txM }}>Ingresos</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: X.txM }}>🇦🇺 AUD/semana</span>
                <span style={{ fontSize: 11, color: X.txD }}>→ {fmt(audMonthly)}/mes</span>
              </div>
              <input type="number" value={inc.audWeek || 0} step={50} onChange={e => saveInc({ ...inc, audWeek: Math.max(0, +e.target.value) })}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 8, padding: "8px 12px", color: X.tx, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: X.txM, marginBottom: 6 }}>🇨🇱 Ingreso fijo CLP/mes</div>
              <input type="number" value={inc.clpFixed || 0} step={10000} onChange={e => saveInc({ ...inc, clpFixed: Math.max(0, +e.target.value) })}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 8, padding: "8px 12px", color: X.tx, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: X.txM, marginBottom: 6 }}>💱 Tipo cambio AUD→CLP</div>
              <input type="number" value={inc.audRate || AUD_CLP} step={5} onChange={e => saveInc({ ...inc, audRate: Math.max(1, +e.target.value) })}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${X.bdr}`, borderRadius: 8, padding: "8px 12px", color: X.tx, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ background: "rgba(34,197,94,0.06)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: X.txM }}>Total mensual (piso)</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: X.g }}>{fmt(totalIncome)}</span>
            </div>
            <div style={{ fontSize: 10, color: X.txD, marginTop: 8 }}>📋 Proyectos: ~$3M c/u (al terminar)</div>
          </Cd>
          <Cd><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.txM }}>Pagos Fijos</h3>{FIXED.map((f, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${X.bdr}`, fontSize: 12 }}><span style={{ color: X.txM }}>{f.name}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{fmt(f.amount)}</span></div>))}<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: 13, fontWeight: 700 }}><span>Total</span><span style={{ color: X.y, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(FIXED_TOTAL)}</span></div></Cd>
          <Cd><h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: X.txM }}>Auto-categorización</h3><div style={{ fontSize: 11, color: X.txD, marginBottom: 6 }}>{RULES.length} predefinidas · <strong style={{ color: X.ac }}>{rules.length}</strong> aprendidas</div>{rules.length > 0 && rules.map((r, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 11 }}><span style={{ flex: 1 }}>"{r.kw[0]}" → <strong style={{ color: X.ac }}>{r.cat}</strong></span><button onClick={() => { const nR = rules.filter((_, idx) => idx !== i); setRules(nR); doSave(exps, pays, deps, nR, debts, bud, savPct, inc); }} style={{ background: "transparent", border: "none", color: X.r, fontSize: 12, cursor: "pointer" }}>×</button></div>))}</Cd>
          <Cd><button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ exps, pays, deps, rules, bud, debts, savPct, inc }, null, 2)); alert("Backup copiado"); }} style={{ width: "100%", background: "rgba(232,104,51,0.1)", border: "1px solid rgba(232,104,51,0.3)", borderRadius: 10, padding: "10px", color: X.ac, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📋 Copiar Backup Completo</button></Cd>
        </div>)}
      </div>

      {/* FAB */}
      <button onClick={() => setShow(true)} style={{ position: "fixed", bottom: 78, right: 18, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#E86833,#F59E0B)", border: "none", boxShadow: "0 6px 20px rgba(232,104,51,0.4)", color: "#fff", fontSize: 26, cursor: "pointer", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>

      {/* NAV — 6 tabs now */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,11,18,0.94)", backdropFilter: "blur(16px)", borderTop: `1px solid ${X.bdr}`, zIndex: 50, display: "flex", padding: "7px 0 calc(env(safe-area-inset-bottom,6px) + 6px)", maxWidth: 900, margin: "0 auto" }}>
        {[["home", "🏠", "Inicio"], ["wallet", "🇦🇺", "AUD"], ["list", "📋", "Gastos"], ["budget", "🎯", "Presup."], ["debt", "💳", "Deudas"], ["config", "⚙️", "Config"]].map(([k, ic, lb]) => (
          <button key={k} onClick={() => setView(k)} style={{ flex: 1, background: "transparent", border: "none", color: view === k ? X.ac : X.txD, fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 16 }}>{ic}</span>{lb}
          </button>
        ))}
      </div>

      {show && <QuickEntry onClose={() => setShow(false)} onSaveExp={addExp} onSavePay={addPay} onSaveDeposit={addDeposit} expenses={exps} customRules={rules} debts={debts} audRate={inc.audRate || AUD_CLP} />}
    </div>
  );
}
