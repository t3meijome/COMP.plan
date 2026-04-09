import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ─── CONSTANTS FROM DOCUMENT ─────────────────────────────────────────────────
const DOC = {
  year: 2026,
  region: "Metro Region Academic Medicine",
  department: "Ophthalmology",
  division: "Adult Ophthalmology",
  overallRate: 44.90,
  qualityPct: 0.05,
  qualityDeduction: 2.25,
  totalRate: 42.66,
  aiPct: 0.04,
  aiDeduction: 1.71,
  deptRaoPct: 0.06,
  deptRaoDeduction: 2.56,
  divRaoPct: 0.0,
  divRaoDeduction: 0.0,
  physCompRate: 38.39,
  academicPay: { assistant: 0, associate: 15000, professor: 30000 },
  chairLeverPct: 0.19,
  callPay: {
    generalFullWeek: 5000,
    generalWeekday: 600,
    generalWeekend: 1000,
    retinaFullWeek: 1572.55,
  },
  cosmeticAdminFee: 0.30,
  qualitySplitFte: 1 / 3,
  qualitySplitRvu: 2 / 3,
};

// ─── OPHTHALMOLOGY CPT/RVU DATABASE ──────────────────────────────────────────
const DEFAULT_CPT = [
  { category: "Office - New", code: "99203", desc: "New Patient Lv3", wRVU: 1.60, time: 30 },
  { category: "Office - New", code: "99204", desc: "New Patient Lv4", wRVU: 2.60, time: 45 },
  { category: "Office - New", code: "99205", desc: "New Patient Lv5", wRVU: 3.50, time: 60 },
  { category: "Office - Est", code: "99213", desc: "Est Patient Lv3", wRVU: 1.30, time: 15 },
  { category: "Office - Est", code: "99214", desc: "Est Patient Lv4", wRVU: 1.92, time: 20 },
  { category: "Office - Est", code: "99215", desc: "Est Patient Lv5", wRVU: 2.80, time: 30 },
  { category: "Procedure", code: "67028", desc: "Intravitreal Injection", wRVU: 1.80, time: 10 },
  { category: "Procedure", code: "66821", desc: "YAG Capsulotomy", wRVU: 3.23, time: 15 },
  { category: "Procedure", code: "65855", desc: "SLT", wRVU: 2.72, time: 15 },
  { category: "Procedure", code: "65426", desc: "Pterygium Excision", wRVU: 5.48, time: 30 },
  { category: "Surgery", code: "66984", desc: "Cataract (Phaco + IOL)", wRVU: 7.35, time: 30 },
  { category: "Surgery", code: "66989", desc: "Cataract + MIGS", wRVU: 8.79, time: 40 },
  { category: "Surgery", code: "66986", desc: "IOL Exchange", wRVU: 9.47, time: 45 },
  { category: "Surgery", code: "66985", desc: "Secondary IOL (Scleral Fix)", wRVU: 11.76, time: 60 },
];

// ─── UTILITY ─────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// ─── TABS ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: "📋" },
  { id: "calculator", label: "Comp Calculator", icon: "💰" },
  { id: "rvu-planner", label: "RVU Planner", icon: "📊" },
  { id: "session", label: "Session Planner", icon: "🗓" },
  { id: "cpt", label: "CPT Database", icon: "🔬" },
  { id: "charts", label: "Charts", icon: "📈" },
];

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  // ─── Editable compensation parameters ───
  const [physRate, setPhysRate] = useState(DOC.physCompRate);
  const [overallRate, setOverallRate] = useState(DOC.overallRate);
  const [qualityPct, setQualityPct] = useState(DOC.qualityPct * 100);
  const [aiPct, setAiPct] = useState(DOC.aiPct * 100);
  const [deptRaoPct, setDeptRaoPct] = useState(DOC.deptRaoPct * 100);
  const [divRaoPct, setDivRaoPct] = useState(DOC.divRaoPct * 100);

  // ─── Physician parameters ───
  const [annualWRVU, setAnnualWRVU] = useState(5000);
  const [fte, setFte] = useState(1.0);
  const [rank, setRank] = useState("assistant");
  const [leverScores, setLeverScores] = useState([3, 3, 3]);
  const [callWeeks, setCallWeeks] = useState(4);
  const [callType, setCallType] = useState("general");
  const [extraWeekdays, setExtraWeekdays] = useState(0);
  const [extraWeekends, setExtraWeekends] = useState(0);
  const [cosmeticCollections, setCosmeticCollections] = useState(0);
  const [cosmeticConsumables, setCosmeticConsumables] = useState(0);
  const [qualityPoolTotal, setQualityPoolTotal] = useState(50000);
  const [poolPhysicians, setPoolPhysicians] = useState(8);
  const [chairPoolTotal, setChairPoolTotal] = useState(0);
  const [weeksWorked, setWeeksWorked] = useState(48);
  const [clinicDaysPerWeek, setClinicDaysPerWeek] = useState(4);
  const [orDaysPerWeek, setOrDaysPerWeek] = useState(1);

  // ─── CPT database ───
  const [cptData, setCptData] = useState(DEFAULT_CPT);

  // ─── Session planner visit mix ───
  const [targetDailyRVU, setTargetDailyRVU] = useState(0);
  const [sessionMix, setSessionMix] = useState({
    "99213": 4, "99214": 8, "99215": 2, "67028": 2, "66984": 0
  });

  // ─── Derived rate waterfall ───
  const rateWaterfall = useMemo(() => {
    const qAdj = overallRate * (qualityPct / 100);
    const totalRate = overallRate - qAdj;
    const aiAdj = overallRate * (aiPct / 100);
    const deptAdj = overallRate * (deptRaoPct / 100);
    const divAdj = overallRate * (divRaoPct / 100);
    const net = totalRate - aiAdj - deptAdj - divAdj;
    return { overallRate, qAdj, totalRate, aiAdj, deptAdj, divAdj, physRate: net };
  }, [overallRate, qualityPct, aiPct, deptRaoPct, divRaoPct]);

  // ─── Compensation calculation ───
  const comp = useMemo(() => {
    const rate = rateWaterfall.physRate;
    const productivity = annualWRVU * rate;
    const academicPay = DOC.academicPay[rank] * fte;

    // Chair lever: 19% of pool, each lever is 1/3 of that
    // Score 1 = best (100%), 5 = worst (0%). Linear: share = (5-score)/4
    const leverPool = chairPoolTotal * DOC.chairLeverPct;
    const perLeverPool = leverPool / 3;
    const leverPay = leverScores.reduce((sum, s) => sum + perLeverPool * ((5 - s) / 4), 0) / poolPhysicians;

    // Call pay
    let callPay = 0;
    if (callType === "general") {
      callPay = callWeeks * DOC.callPay.generalFullWeek;
      callPay += extraWeekdays * DOC.callPay.generalWeekday;
      callPay += extraWeekends * DOC.callPay.generalWeekend;
    } else {
      callPay = callWeeks * DOC.callPay.retinaFullWeek;
    }

    // Cosmetic
    const cosmeticNet = cosmeticCollections > 0
      ? (cosmeticCollections * (1 - DOC.cosmeticAdminFee) - cosmeticConsumables)
      : 0;

    // Quality (estimated)
    const qualityPerPhys = qualityPoolTotal / poolPhysicians;

    const total = productivity + academicPay + leverPay + callPay + cosmeticNet + qualityPerPhys;

    // Derived metrics
    const clinicHoursPerYear = weeksWorked * clinicDaysPerWeek * 8;
    const effectivePerHour = clinicHoursPerYear > 0 ? total / clinicHoursPerYear : 0;
    const sessionsPerYear = weeksWorked * clinicDaysPerWeek * 2; // 2 half-day sessions per clinic day
    const effectivePerSession = sessionsPerYear > 0 ? total / sessionsPerYear : 0;
    const marginalPerRVU = rate;
    const rvuPerWeek = weeksWorked > 0 ? annualWRVU / weeksWorked : 0;
    const rvuPerDay = clinicDaysPerWeek > 0 ? rvuPerWeek / clinicDaysPerWeek : 0;

    return {
      productivity, academicPay, leverPay, callPay, cosmeticNet, qualityPerPhys, total,
      effectivePerHour, effectivePerSession, marginalPerRVU, rvuPerWeek, rvuPerDay,
      rate
    };
  }, [annualWRVU, fte, rank, leverScores, callWeeks, callType, extraWeekdays, extraWeekends,
    cosmeticCollections, cosmeticConsumables, qualityPoolTotal, poolPhysicians,
    chairPoolTotal, weeksWorked, clinicDaysPerWeek, rateWaterfall.physRate]);

  // Auto-calculate target daily RVU from annual
  useEffect(() => {
    const totalClinicDays = weeksWorked * clinicDaysPerWeek;
    if (totalClinicDays > 0) setTargetDailyRVU(+(annualWRVU / totalClinicDays).toFixed(1));
  }, [annualWRVU, weeksWorked, clinicDaysPerWeek]);

  // Session planner: calculated RVU from mix
  const sessionRVU = useMemo(() => {
    return Object.entries(sessionMix).reduce((sum, [code, count]) => {
      const cpt = cptData.find(c => c.code === code);
      return sum + (cpt ? cpt.wRVU * count : 0);
    }, 0);
  }, [sessionMix, cptData]);

  const sessionTime = useMemo(() => {
    return Object.entries(sessionMix).reduce((sum, [code, count]) => {
      const cpt = cptData.find(c => c.code === code);
      return sum + (cpt ? cpt.time * count : 0);
    }, 0);
  }, [sessionMix, cptData]);

  // Compensation curve data
  const compCurve = useMemo(() => {
    const rate = rateWaterfall.physRate;
    const base = comp.total - comp.productivity;
    return Array.from({ length: 21 }, (_, i) => {
      const rvu = i * 500;
      return { rvu, total: base + rvu * rate, productivity: rvu * rate };
    });
  }, [rateWaterfall.physRate, comp]);

  // ─── Slider input component ───
  const Slider = ({ label, value, onChange, min, max, step = 1, prefix = "", suffix = "", fmt: fmtFn }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 13, color: "var(--c-text-dim)", fontWeight: 500 }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-accent)", fontFamily: "var(--ff-mono)" }}>
          {prefix}{fmtFn ? fmtFn(value) : value}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "var(--c-accent)" }} />
    </div>
  );

  // ─── Number input ───
  const NumInput = ({ label, value, onChange, prefix = "", suffix = "", step = 1, min, max, small }) => (
    <div style={{ marginBottom: small ? 8 : 14 }}>
      <label style={{ fontSize: 12, color: "var(--c-text-dim)", display: "block", marginBottom: 3 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 13, color: "var(--c-text-dim)" }}>{prefix}</span>}
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(+e.target.value)}
          style={{
            width: small ? 70 : 100, padding: "5px 8px", borderRadius: 6,
            border: "1px solid var(--c-border)", background: "var(--c-surface)",
            color: "var(--c-text)", fontSize: 14, fontFamily: "var(--ff-mono)"
          }} />
        {suffix && <span style={{ fontSize: 13, color: "var(--c-text-dim)" }}>{suffix}</span>}
      </div>
    </div>
  );

  // ─── Card component ───
  const Card = ({ title, children, accent, style: s }) => (
    <div style={{
      background: "var(--c-card)", borderRadius: 12, padding: 20,
      border: "1px solid var(--c-border)", position: "relative", overflow: "hidden", ...s
    }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />}
      {title && <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--c-text-dim)", marginBottom: 16 }}>{title}</h3>}
      {children}
    </div>
  );

  // ─── Stat ───
  const Stat = ({ label, value, sub, big, color }) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: big ? 28 : 22, fontWeight: 800, fontFamily: "var(--ff-mono)", color: color || "var(--c-accent)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--c-text-dim)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      "--c-bg": "#0a0f1a",
      "--c-card": "#111827",
      "--c-surface": "#1a2236",
      "--c-border": "#1e293b",
      "--c-text": "#e2e8f0",
      "--c-text-dim": "#94a3b8",
      "--c-accent": "#22d3ee",
      "--c-accent2": "#a78bfa",
      "--c-accent3": "#34d399",
      "--c-danger": "#f87171",
      "--c-warn": "#fbbf24",
      "--ff-body": "'DM Sans', 'Segoe UI', sans-serif",
      "--ff-mono": "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      "--ff-display": "'Space Grotesk', 'DM Sans', sans-serif",
      fontFamily: "var(--ff-body)",
      background: "var(--c-bg)",
      color: "var(--c-text)",
      minHeight: "100vh",
      fontSize: 14,
      lineHeight: 1.5,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        borderBottom: "1px solid var(--c-border)", padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)"
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-display)", margin: 0, letterSpacing: -0.5 }}>
            <span style={{ color: "var(--c-accent)" }}>IU</span> Ophth Comp Model
          </h1>
          <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginTop: 2 }}>
            {DOC.division} · FY{DOC.year} · Individual Productivity Plan
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: "rgba(34,211,238,.12)", border: "1px solid rgba(34,211,238,.25)",
            borderRadius: 8, padding: "6px 12px", fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 700
          }}>
            <span style={{ color: "var(--c-text-dim)", fontSize: 11, marginRight: 6 }}>RATE</span>
            {fmt2(rateWaterfall.physRate)}<span style={{ color: "var(--c-text-dim)", fontSize: 11 }}>/wRVU</span>
          </div>
        </div>
      </header>

      {/* TAB NAV */}
      <nav style={{
        display: "flex", gap: 0, overflowX: "auto", borderBottom: "1px solid var(--c-border)",
        background: "var(--c-card)", padding: "0 8px",
        scrollbarWidth: "none", WebkitOverflowScrolling: "touch"
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 14px", fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
            background: "none", border: "none", borderBottom: tab === t.id ? "2px solid var(--c-accent)" : "2px solid transparent",
            color: tab === t.id ? "var(--c-accent)" : "var(--c-text-dim)", cursor: "pointer",
            whiteSpace: "nowrap", transition: "all .15s"
          }}>
            <span style={{ marginRight: 5 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main style={{ padding: "20px 16px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {tab === "overview" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              Plan Structure & Extracted Parameters
            </h2>

            {/* Rate Waterfall */}
            <Card title="wRVU Rate Waterfall" accent="var(--c-accent)">
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { label: "Overall Rate", val: fmt2(overallRate), pct: "", color: "var(--c-text)" },
                  { label: "Quality Adjustment", val: `(${fmt2(overallRate * qualityPct / 100)})`, pct: `${qualityPct}%`, color: "var(--c-danger)" },
                  { label: "Total Rate", val: fmt2(overallRate - overallRate * qualityPct / 100), pct: "", color: "var(--c-text)", bold: true },
                  { label: "AI (Academic Incentive)", val: `(${fmt2(overallRate * aiPct / 100)})`, pct: `${aiPct}%`, color: "var(--c-danger)" },
                  { label: "Dept RAO", val: `(${fmt2(overallRate * deptRaoPct / 100)})`, pct: `${deptRaoPct}%`, color: "var(--c-danger)" },
                  { label: "Div RAO", val: `(${fmt2(overallRate * divRaoPct / 100)})`, pct: `${divRaoPct}%`, color: "var(--c-text-dim)" },
                  { label: "Physician Comp Rate", val: fmt2(rateWaterfall.physRate), pct: "", color: "var(--c-accent)", bold: true },
                ].map((r, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: r.bold ? "rgba(34,211,238,.08)" : "transparent",
                    borderBottom: r.bold ? "none" : "1px solid var(--c-border)"
                  }}>
                    <span style={{ fontSize: 13, color: r.bold ? "var(--c-text)" : "var(--c-text-dim)" }}>{r.label}</span>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      {r.pct && <span style={{ fontSize: 12, color: "var(--c-text-dim)", fontFamily: "var(--ff-mono)" }}>{r.pct}</span>}
                      <span style={{
                        fontSize: 14, fontWeight: r.bold ? 800 : 600, fontFamily: "var(--ff-mono)",
                        color: r.color, minWidth: 80, textAlign: "right"
                      }}>{r.val}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--c-surface)", borderRadius: 8, fontSize: 12, color: "var(--c-text-dim)", fontFamily: "var(--ff-mono)" }}>
                <strong style={{ color: "var(--c-text)" }}>Formula:</strong> Phys Rate = Overall − (Quality% + AI% + Dept RAO% + Div RAO%) × Overall<br />
                = {fmt2(overallRate)} − ({qualityPct}% + {aiPct}% + {deptRaoPct}% + {divRaoPct}%) × {fmt2(overallRate)} = <strong style={{ color: "var(--c-accent)" }}>{fmt2(rateWaterfall.physRate)}</strong>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16 }}>
              {/* Academic Rank Pay */}
              <Card title="Academic Rank Pay" accent="var(--c-accent2)">
                <div style={{ display: "grid", gap: 6 }}>
                  {[
                    { rank: "Assistant Professor", val: "$0" },
                    { rank: "Associate Professor", val: "$15,000" },
                    { rank: "Professor", val: "$30,000" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--c-border)", fontSize: 13 }}>
                      <span>{r.rank}</span>
                      <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginTop: 8 }}>Prorated by clinical FTE status</div>
              </Card>

              {/* Call Pay */}
              <Card title="Call Pay Schedule" accent="var(--c-accent3)">
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-accent3)", marginBottom: 4 }}>General Call</div>
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Full week</span><span style={{ fontFamily: "var(--ff-mono)" }}>$5,000</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Per weekday</span><span style={{ fontFamily: "var(--ff-mono)" }}>$600</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Per weekend day</span><span style={{ fontFamily: "var(--ff-mono)" }}>$1,000</span></div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-accent2)", marginBottom: 4 }}>Retina Call</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Full week</span><span style={{ fontFamily: "var(--ff-mono)" }}>$1,572.55</span></div>
                </div>
                <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginTop: 8 }}>Weekend: 8am-8pm · Weekday: 4pm-8am</div>
              </Card>

              {/* Chair Levers */}
              <Card title="Chair Lever Metrics" accent="var(--c-warn)">
                <div style={{ fontSize: 13, marginBottom: 8 }}>19% of Pool allocated across 3 levers</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {["Education", "Research", "Service/Citizenship"].map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, borderBottom: "1px solid var(--c-border)" }}>
                      <span>Lever {i + 1}: {l}</span>
                      <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12 }}>Score 1-5</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginTop: 8 }}>1 = Exceptional · 5 = Little/No Contribution</div>
              </Card>

              {/* Cosmetic */}
              <Card title="Cosmetic Comp" accent="var(--c-danger)">
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  70% of collections after 30% admin fee<br />
                  Consumable expenses deducted after admin fee<br />
                  <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-text-dim)" }}>
                    Phys Comp = (Collections × 0.70) − Consumables
                  </span>
                </div>
              </Card>

              {/* Quality */}
              <Card title="Quality Pay" accent="var(--c-accent)">
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Variable pool based on IUHMG metrics<br />
                  ⅓ distributed by FTE · ⅔ by year-end RVU production<br />
                  Must have no unsigned notes to be eligible
                </div>
              </Card>

              {/* Comp Equation */}
              <Card title="Total Compensation Equation" accent="var(--c-accent)" style={{ gridColumn: "1 / -1" }}>
                <div style={{
                  fontFamily: "var(--ff-mono)", fontSize: 13, lineHeight: 2,
                  padding: 16, background: "var(--c-surface)", borderRadius: 8
                }}>
                  <strong style={{ color: "var(--c-accent)" }}>Total Compensation =</strong><br />
                  &nbsp;&nbsp;(Annual wRVU × Phys Comp Rate)<br />
                  &nbsp;&nbsp;+ Academic Rank Pay × FTE<br />
                  &nbsp;&nbsp;+ Chair Lever Pay<br />
                  &nbsp;&nbsp;+ Call Pay<br />
                  &nbsp;&nbsp;+ Quality Pay<br />
                  &nbsp;&nbsp;+ Cosmetic Comp (if applicable)<br /><br />
                  <strong style={{ color: "var(--c-text-dim)" }}>Where:</strong><br />
                  &nbsp;&nbsp;Phys Comp Rate = Overall Rate × (1 − Quality% − AI% − Dept RAO% − Div RAO%)<br />
                  &nbsp;&nbsp;= {fmt2(overallRate)} × (1 − {qualityPct + aiPct + deptRaoPct + divRaoPct}%) = <strong style={{ color: "var(--c-accent)" }}>{fmt2(rateWaterfall.physRate)}/wRVU</strong>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════ CALCULATOR TAB ═══════════════ */}
        {tab === "calculator" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              Compensation Calculator
            </h2>

            {/* Top stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Compensation", value: fmt(comp.total), color: "var(--c-accent)" },
                { label: "Productivity Pay", value: fmt(comp.productivity), color: "var(--c-accent2)" },
                { label: "$/Hour (Effective)", value: fmt2(comp.effectivePerHour), color: "var(--c-accent3)" },
                { label: "$/Session", value: fmt(comp.effectivePerSession), color: "var(--c-warn)" },
                { label: "RVU/Week", value: fmtN(comp.rvuPerWeek), color: "var(--c-text)" },
                { label: "Marginal $/wRVU", value: fmt2(comp.rate), color: "var(--c-danger)" },
              ].map((s, i) => (
                <Card key={i}>
                  <Stat label={s.label} value={s.value} color={s.color} />
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {/* INPUT PANEL */}
              <Card title="Adjust Parameters" accent="var(--c-accent)">
                <Slider label="Annual wRVU" value={annualWRVU} onChange={setAnnualWRVU} min={0} max={12000} step={100} fmt={fmtN} />
                <Slider label="FTE" value={fte} onChange={setFte} min={0.1} max={1.0} step={0.05} />
                <Slider label="Weeks Worked" value={weeksWorked} onChange={setWeeksWorked} min={20} max={52} />
                <Slider label="Clinic Days/Week" value={clinicDaysPerWeek} onChange={setClinicDaysPerWeek} min={1} max={5} />

                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: "var(--c-text-dim)", marginBottom: 4, display: "block" }}>Academic Rank</label>
                  <select value={rank} onChange={e => setRank(e.target.value)} style={{
                    width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)",
                    background: "var(--c-surface)", color: "var(--c-text)", fontSize: 13
                  }}>
                    <option value="assistant">Assistant Professor ($0)</option>
                    <option value="associate">Associate Professor ($15,000)</option>
                    <option value="professor">Professor ($30,000)</option>
                  </select>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, color: "var(--c-text-dim)", marginBottom: 4, display: "block" }}>Chair Lever Scores (1=Best, 5=Worst)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["Edu", "Research", "Service"].map((l, i) => (
                      <div key={i} style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--c-text-dim)", marginBottom: 2 }}>{l}</div>
                        <select value={leverScores[i]} onChange={e => {
                          const ns = [...leverScores]; ns[i] = +e.target.value; setLeverScores(ns);
                        }} style={{
                          width: "100%", padding: "4px 6px", borderRadius: 6,
                          border: "1px solid var(--c-border)", background: "var(--c-surface)",
                          color: "var(--c-text)", fontSize: 13
                        }}>
                          {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <NumInput label="Call Weeks (Full)" value={callWeeks} onChange={setCallWeeks} min={0} max={52} small />
                  <div>
                    <label style={{ fontSize: 12, color: "var(--c-text-dim)", marginBottom: 3, display: "block" }}>Call Type</label>
                    <select value={callType} onChange={e => setCallType(e.target.value)} style={{
                      width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--c-border)",
                      background: "var(--c-surface)", color: "var(--c-text)", fontSize: 13
                    }}>
                      <option value="general">General ($5,000/wk)</option>
                      <option value="retina">Retina ($1,572.55/wk)</option>
                    </select>
                  </div>
                  <NumInput label="Extra Weekdays" value={extraWeekdays} onChange={setExtraWeekdays} min={0} small />
                  <NumInput label="Extra Weekend Days" value={extraWeekends} onChange={setExtraWeekends} min={0} small />
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <NumInput label="Quality Pool (Total)" value={qualityPoolTotal} onChange={setQualityPoolTotal} prefix="$" min={0} small />
                  <NumInput label="Pool Physicians" value={poolPhysicians} onChange={setPoolPhysicians} min={1} small />
                  <NumInput label="Chair Pool Total" value={chairPoolTotal} onChange={setChairPoolTotal} prefix="$" min={0} small />
                  <NumInput label="Cosmetic Collections" value={cosmeticCollections} onChange={setCosmeticCollections} prefix="$" min={0} small />
                </div>
              </Card>

              {/* BREAKDOWN */}
              <div>
                <Card title="Compensation Breakdown" accent="var(--c-accent2)">
                  <div style={{ display: "grid", gap: 6 }}>
                    {[
                      { label: "Productivity (wRVU × Rate)", val: comp.productivity, color: "var(--c-accent)", formula: `${fmtN(annualWRVU)} × ${fmt2(comp.rate)}` },
                      { label: "Academic Rank Pay", val: comp.academicPay, color: "var(--c-accent2)", formula: `${rank} × ${fte} FTE` },
                      { label: "Chair Lever Pay", val: comp.leverPay, color: "var(--c-warn)" },
                      { label: "Call Pay", val: comp.callPay, color: "var(--c-accent3)", formula: `${callWeeks}wk × ${fmt(callType === "general" ? DOC.callPay.generalFullWeek : DOC.callPay.retinaFullWeek)}` },
                      { label: "Quality Pay (Est.)", val: comp.qualityPerPhys, color: "var(--c-accent)" },
                      { label: "Cosmetic Comp", val: comp.cosmeticNet, color: "var(--c-danger)" },
                    ].map((r, i) => {
                      const pct = comp.total > 0 ? (r.val / comp.total * 100) : 0;
                      return (
                        <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--c-surface)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13 }}>{r.label}</span>
                            <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, color: r.color }}>{fmt(r.val)}</span>
                          </div>
                          <div style={{ height: 4, background: "var(--c-border)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: r.color, borderRadius: 2, transition: "width .3s" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: "var(--c-text-dim)", fontFamily: "var(--ff-mono)" }}>{r.formula || ""}</span>
                            <span style={{ fontSize: 11, color: "var(--c-text-dim)", fontFamily: "var(--ff-mono)" }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    marginTop: 16, padding: "12px 16px", borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(34,211,238,.1), rgba(167,139,250,.1))",
                    border: "1px solid rgba(34,211,238,.2)",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>TOTAL COMPENSATION</span>
                    <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 800, fontSize: 24, color: "var(--c-accent)" }}>{fmt(comp.total)}</span>
                  </div>
                </Card>

                {/* Rate editor */}
                <Card title="Edit Rate Components" accent="var(--c-danger)" style={{ marginTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <NumInput label="Overall Rate ($/wRVU)" value={overallRate} onChange={setOverallRate} prefix="$" step={0.01} small />
                    <NumInput label="Quality %" value={qualityPct} onChange={setQualityPct} suffix="%" step={0.5} small />
                    <NumInput label="AI %" value={aiPct} onChange={setAiPct} suffix="%" step={0.5} small />
                    <NumInput label="Dept RAO %" value={deptRaoPct} onChange={setDeptRaoPct} suffix="%" step={0.5} small />
                    <NumInput label="Div RAO %" value={divRaoPct} onChange={setDivRaoPct} suffix="%" step={0.5} small />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, fontFamily: "var(--ff-mono)", color: "var(--c-text-dim)" }}>
                    Net Rate: {fmt2(rateWaterfall.physRate)}/wRVU (after all deductions)
                  </div>
                </Card>
              </div>
            </div>

            {/* Reverse calculator */}
            <Card title="🔄 Reverse Calculator — Target Income → Required wRVU" accent="var(--c-accent3)" style={{ marginTop: 16 }}>
              <ReverseCalc comp={comp} rate={rateWaterfall.physRate} weeksWorked={weeksWorked} clinicDaysPerWeek={clinicDaysPerWeek} />
            </Card>
          </div>
        )}

        {/* ═══════════════ RVU PLANNER TAB ═══════════════ */}
        {tab === "rvu-planner" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              RVU Productivity Planner
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              <Card><Stat label="Target Annual wRVU" value={fmtN(annualWRVU)} color="var(--c-accent)" /></Card>
              <Card><Stat label="wRVU/Week" value={fmtN(comp.rvuPerWeek)} color="var(--c-accent2)" /></Card>
              <Card><Stat label="wRVU/Clinic Day" value={fmtN(comp.rvuPerDay)} color="var(--c-accent3)" /></Card>
              <Card><Stat label="Projected Comp" value={fmt(comp.total)} color="var(--c-warn)" /></Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              <Card title="Schedule Parameters" accent="var(--c-accent)">
                <Slider label="Annual wRVU Target" value={annualWRVU} onChange={setAnnualWRVU} min={0} max={12000} step={100} fmt={fmtN} />
                <Slider label="Weeks Worked" value={weeksWorked} onChange={setWeeksWorked} min={20} max={52} />
                <Slider label="Clinic Days/Week" value={clinicDaysPerWeek} onChange={setClinicDaysPerWeek} min={1} max={5} />
                <Slider label="OR Days/Week" value={orDaysPerWeek} onChange={setOrDaysPerWeek} min={0} max={3} />
              </Card>

              <Card title="Required Daily Output" accent="var(--c-accent2)">
                <ScheduleCalculator
                  targetDailyRVU={comp.rvuPerDay}
                  cptData={cptData}
                  clinicDays={clinicDaysPerWeek}
                  orDays={orDaysPerWeek}
                />
              </Card>
            </div>

            {/* Bidirectional: set schedule, get RVU */}
            <Card title="🔄 Bidirectional: Set Visit Mix → Get wRVU" accent="var(--c-accent3)" style={{ marginTop: 16 }}>
              <VisitMixCalculator cptData={cptData} weeksWorked={weeksWorked} clinicDaysPerWeek={clinicDaysPerWeek} rate={rateWaterfall.physRate} />
            </Card>
          </div>
        )}

        {/* ═══════════════ SESSION PLANNER TAB ═══════════════ */}
        {tab === "session" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              Session-Based Modeling
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              <Card title="Daily Visit Mix Builder" accent="var(--c-accent)">
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--c-text-dim)", marginBottom: 8 }}>Set number of each encounter per clinic day:</div>
                  {cptData.filter(c => c.category.includes("Office") || c.category === "Procedure").map(c => (
                    <div key={c.code} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: "1px solid var(--c-border)"
                    }}>
                      <div>
                        <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-accent)", marginRight: 6 }}>{c.code}</span>
                        <span style={{ fontSize: 13 }}>{c.desc}</span>
                        <span style={{ fontSize: 11, color: "var(--c-text-dim)", marginLeft: 6 }}>({c.wRVU} wRVU)</span>
                      </div>
                      <input type="number" min={0} max={50} value={sessionMix[c.code] || 0}
                        onChange={e => setSessionMix(prev => ({ ...prev, [c.code]: +e.target.value }))}
                        style={{
                          width: 55, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--c-border)",
                          background: "var(--c-surface)", color: "var(--c-text)", fontSize: 14,
                          fontFamily: "var(--ff-mono)", textAlign: "center"
                        }} />
                    </div>
                  ))}
                </div>
              </Card>

              <div>
                <Card title="Session Output" accent="var(--c-accent2)">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <Stat label="Daily wRVU" value={fmtN(sessionRVU)} color="var(--c-accent)" />
                    <Stat label="Minutes" value={sessionTime} color="var(--c-accent2)" />
                    <Stat label="Weekly wRVU" value={fmtN(sessionRVU * clinicDaysPerWeek)} color="var(--c-accent3)" />
                    <Stat label="Annual wRVU" value={fmtN(sessionRVU * clinicDaysPerWeek * weeksWorked)} color="var(--c-warn)" />
                  </div>
                  <div style={{
                    padding: "12px 16px", borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(34,211,238,.1), rgba(167,139,250,.1))",
                    border: "1px solid rgba(34,211,238,.2)", textAlign: "center"
                  }}>
                    <div style={{ fontSize: 12, color: "var(--c-text-dim)" }}>Projected Annual Compensation</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>
                      {fmt(sessionRVU * clinicDaysPerWeek * weeksWorked * rateWaterfall.physRate + comp.total - comp.productivity)}
                    </div>
                  </div>
                </Card>

                {/* OR Session */}
                <Card title="Surgery Day Add-On" accent="var(--c-accent3)" style={{ marginTop: 16 }}>
                  {cptData.filter(c => c.category === "Surgery").map(c => (
                    <div key={c.code} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: "1px solid var(--c-border)"
                    }}>
                      <div>
                        <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-accent3)", marginRight: 6 }}>{c.code}</span>
                        <span style={{ fontSize: 13 }}>{c.desc}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--c-text-dim)", fontFamily: "var(--ff-mono)" }}>{c.wRVU} wRVU · {c.time}min</span>
                        <input type="number" min={0} max={20} value={sessionMix[c.code] || 0}
                          onChange={e => setSessionMix(prev => ({ ...prev, [c.code]: +e.target.value }))}
                          style={{
                            width: 50, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--c-border)",
                            background: "var(--c-surface)", color: "var(--c-text)", fontSize: 14,
                            fontFamily: "var(--ff-mono)", textAlign: "center"
                          }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--c-text-dim)" }}>
                    Surgery wRVU/day: <strong style={{ color: "var(--c-accent3)" }}>
                      {fmtN(Object.entries(sessionMix).reduce((s, [code, cnt]) => {
                        const c = cptData.find(x => x.code === code && x.category === "Surgery");
                        return s + (c ? c.wRVU * cnt : 0);
                      }, 0))}
                    </strong> · Time: {Object.entries(sessionMix).reduce((s, [code, cnt]) => {
                      const c = cptData.find(x => x.code === code && x.category === "Surgery");
                      return s + (c ? c.time * cnt : 0);
                    }, 0)} min
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ CPT DATABASE TAB ═══════════════ */}
        {tab === "cpt" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              CPT / wRVU Database
            </h2>
            <Card accent="var(--c-accent)">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--c-border)" }}>
                      {["Category", "CPT", "Description", "wRVU", "Time (min)", "$/wRVU", "Revenue/Case"].map(h => (
                        <th key={h} style={{
                          padding: "8px 10px", textAlign: "left", fontSize: 11,
                          fontWeight: 700, color: "var(--c-text-dim)", textTransform: "uppercase", letterSpacing: 1
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cptData.map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--c-border)" }}>
                        <td style={{ padding: "6px 10px", fontSize: 12, color: "var(--c-text-dim)" }}>{c.category}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "var(--ff-mono)", color: "var(--c-accent)", fontWeight: 600 }}>{c.code}</td>
                        <td style={{ padding: "6px 10px" }}>{c.desc}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <input type="number" value={c.wRVU} step={0.01} min={0} style={{
                            width: 65, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--c-border)",
                            background: "var(--c-surface)", color: "var(--c-accent)", fontSize: 13,
                            fontFamily: "var(--ff-mono)", fontWeight: 700
                          }} onChange={e => {
                            const updated = [...cptData];
                            updated[i] = { ...updated[i], wRVU: +e.target.value };
                            setCptData(updated);
                          }} />
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          <input type="number" value={c.time} min={0} style={{
                            width: 55, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--c-border)",
                            background: "var(--c-surface)", color: "var(--c-text)", fontSize: 13,
                            fontFamily: "var(--ff-mono)"
                          }} onChange={e => {
                            const updated = [...cptData];
                            updated[i] = { ...updated[i], time: +e.target.value };
                            setCptData(updated);
                          }} />
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: "var(--ff-mono)", fontSize: 12 }}>{fmt2(rateWaterfall.physRate)}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-accent3)" }}>
                          {fmt2(c.wRVU * rateWaterfall.physRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setCptData([...cptData, { category: "Custom", code: "XXXXX", desc: "New Code", wRVU: 1.0, time: 15 }])}
                style={{
                  marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--c-accent)",
                  background: "rgba(34,211,238,.1)", color: "var(--c-accent)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600
                }}>
                + Add Row
              </button>
            </Card>
          </div>
        )}

        {/* ═══════════════ CHARTS TAB ═══════════════ */}
        {tab === "charts" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-display)", marginBottom: 20 }}>
              Visualizations
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {/* Comp vs RVU Curve */}
              <Card title="Compensation vs wRVU" accent="var(--c-accent)">
                <SVGChart data={compCurve} xKey="rvu" yKey="total" color="var(--c-accent)"
                  xLabel="Annual wRVU" yLabel="Total Comp ($)" currentX={annualWRVU}
                  height={220} />
              </Card>

              {/* Waterfall */}
              <Card title="Compensation Waterfall" accent="var(--c-accent2)">
                <WaterfallChart comp={comp} />
              </Card>

              {/* Marginal value */}
              <Card title="wRVU Value by Component" accent="var(--c-accent3)">
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    { label: "Overall Rate", val: overallRate, color: "var(--c-text-dim)" },
                    { label: "After Quality Adj", val: overallRate * (1 - qualityPct / 100), color: "var(--c-warn)" },
                    { label: "After AI", val: overallRate * (1 - qualityPct / 100 - aiPct / 100), color: "var(--c-accent2)" },
                    { label: "After Dept RAO", val: overallRate * (1 - qualityPct / 100 - aiPct / 100 - deptRaoPct / 100), color: "var(--c-accent3)" },
                    { label: "Net Phys Rate", val: rateWaterfall.physRate, color: "var(--c-accent)" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, flex: 1 }}>{r.label}</span>
                      <div style={{ flex: 2, height: 16, background: "var(--c-border)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${(r.val / overallRate) * 100}%`, background: r.color, borderRadius: 4, transition: "width .3s" }} />
                      </div>
                      <span style={{ fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 700, color: r.color, minWidth: 60, textAlign: "right" }}>{fmt2(r.val)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* RVU per Encounter */}
              <Card title="wRVU & Revenue per Encounter" accent="var(--c-warn)">
                <div style={{ display: "grid", gap: 4 }}>
                  {cptData.map((c, i) => {
                    const maxRVU = Math.max(...cptData.map(x => x.wRVU));
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--ff-mono)", color: "var(--c-text-dim)", minWidth: 48 }}>{c.code}</span>
                        <div style={{ flex: 1, height: 14, background: "var(--c-border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${(c.wRVU / maxRVU) * 100}%`, borderRadius: 3,
                            background: c.category === "Surgery" ? "var(--c-accent3)" : c.category === "Procedure" ? "var(--c-accent2)" : "var(--c-accent)",
                            transition: "width .3s"
                          }} />
                        </div>
                        <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, fontWeight: 600, minWidth: 35, textAlign: "right" }}>{c.wRVU}</span>
                        <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-dim)", minWidth: 55, textAlign: "right" }}>{fmt2(c.wRVU * rateWaterfall.physRate)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* RVU/Hour efficiency */}
              <Card title="wRVU per Hour Efficiency" accent="var(--c-danger)" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                  {cptData.map((c, i) => {
                    const rvuPerHour = c.time > 0 ? (c.wRVU / c.time) * 60 : 0;
                    const dollarPerHour = rvuPerHour * rateWaterfall.physRate;
                    return (
                      <div key={i} style={{ padding: "10px", borderRadius: 8, background: "var(--c-surface)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontFamily: "var(--ff-mono)", color: "var(--c-accent)", marginBottom: 4 }}>{c.code}</div>
                        <div style={{ fontSize: 10, color: "var(--c-text-dim)", marginBottom: 6 }}>{c.desc}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>{fmtN(rvuPerHour)}</div>
                        <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>wRVU/hr</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-accent3)", marginTop: 4 }}>{fmt(dollarPerHour)}</div>
                        <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>$/hr</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer style={{
        borderTop: "1px solid var(--c-border)", padding: "12px 20px", textAlign: "center",
        fontSize: 11, color: "var(--c-text-dim)"
      }}>
        IU Health Ophthalmology Compensation Model · FY2026 · All values from plan document · For reference only
      </footer>
    </div>
  );
}

// ─── REVERSE CALCULATOR COMPONENT ────────────────────────────────────────────
function ReverseCalc({ comp, rate, weeksWorked, clinicDaysPerWeek }) {
  const [targetIncome, setTargetIncome] = useState(350000);
  const nonProdIncome = comp.total - comp.productivity;
  const requiredProdPay = Math.max(0, targetIncome - nonProdIncome);
  const requiredRVU = rate > 0 ? requiredProdPay / rate : 0;
  const rvuPerWeek = weeksWorked > 0 ? requiredRVU / weeksWorked : 0;
  const rvuPerDay = clinicDaysPerWeek > 0 ? rvuPerWeek / clinicDaysPerWeek : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--c-text-dim)", marginBottom: 4 }}>Target Annual Income</div>
        <input type="range" min={100000} max={800000} step={5000} value={targetIncome}
          onChange={e => setTargetIncome(+e.target.value)}
          style={{ width: "100%", accentColor: "var(--c-accent3)" }} />
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent3)", marginTop: 4 }}>
          {fmt(targetIncome)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>{fmtN(requiredRVU)}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-dim)" }}>Required Annual wRVU</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent2)" }}>{fmtN(rvuPerWeek)}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-dim)" }}>wRVU/Week</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent3)" }}>{fmtN(rvuPerDay)}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-dim)" }}>wRVU/Clinic Day</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-warn)" }}>{fmt(nonProdIncome)}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-dim)" }}>Non-Prod Income</div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--ff-mono)", fontSize: 12, padding: 12, background: "var(--c-surface)", borderRadius: 8, color: "var(--c-text-dim)" }}>
        <strong style={{ color: "var(--c-text)" }}>Equation:</strong><br />
        Required wRVU = (Target − Non-Prod) / Rate<br />
        = ({fmt(targetIncome)} − {fmt(nonProdIncome)}) / {fmt2(rate)}<br />
        = <strong style={{ color: "var(--c-accent)" }}>{fmtN(requiredRVU)} wRVU</strong>
      </div>
    </div>
  );
}

// ─── SCHEDULE CALCULATOR ─────────────────────────────────────────────────────
function ScheduleCalculator({ targetDailyRVU, cptData, clinicDays, orDays }) {
  const scenarios = useMemo(() => {
    const est4 = cptData.find(c => c.code === "99214");
    const est5 = cptData.find(c => c.code === "99215");
    const inj = cptData.find(c => c.code === "67028");
    const cat = cptData.find(c => c.code === "66984");
    if (!est4 || !est5 || !inj || !cat) return [];

    // Option A: clinic-heavy
    const a14 = Math.floor(targetDailyRVU / est4.wRVU * 0.65);
    const a15 = Math.floor(targetDailyRVU / est5.wRVU * 0.15);
    const aInj = Math.floor((targetDailyRVU - a14 * est4.wRVU - a15 * est5.wRVU) / inj.wRVU);
    const aRVU = a14 * est4.wRVU + a15 * est5.wRVU + Math.max(0, aInj) * inj.wRVU;

    // Option B: balanced with surgery
    const bCat = 2;
    const remaining = targetDailyRVU - bCat * cat.wRVU;
    const b14 = Math.max(0, Math.floor(remaining / est4.wRVU));
    const bRVU = bCat * cat.wRVU + b14 * est4.wRVU;

    return [
      {
        label: "Option A: Clinic-Heavy",
        items: [
          { desc: `99214 visits`, count: a14, rvu: a14 * est4.wRVU },
          { desc: `99215 visits`, count: a15, rvu: a15 * est5.wRVU },
          { desc: `Injections`, count: Math.max(0, aInj), rvu: Math.max(0, aInj) * inj.wRVU },
        ],
        totalRVU: aRVU, totalPts: a14 + a15 + Math.max(0, aInj)
      },
      {
        label: "Option B: Balanced (Clinic + OR)",
        items: [
          { desc: `Cataracts`, count: bCat, rvu: bCat * cat.wRVU },
          { desc: `99214 visits`, count: b14, rvu: b14 * est4.wRVU },
        ],
        totalRVU: bRVU, totalPts: bCat + b14
      }
    ];
  }, [targetDailyRVU, cptData]);

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
        Target: <span style={{ color: "var(--c-accent)", fontFamily: "var(--ff-mono)" }}>{fmtN(targetDailyRVU)} wRVU/day</span>
      </div>
      {scenarios.map((s, i) => (
        <div key={i} style={{ padding: 12, background: "var(--c-surface)", borderRadius: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "var(--c-accent)" : "var(--c-accent3)", marginBottom: 8 }}>{s.label}</div>
          {s.items.map((item, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span>{item.count}× {item.desc}</span>
              <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-text-dim)" }}>{fmtN(item.rvu)} wRVU</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span>{s.totalPts} patients</span>
            <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>{fmtN(s.totalRVU)} wRVU</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── VISIT MIX CALCULATOR ────────────────────────────────────────────────────
function VisitMixCalculator({ cptData, weeksWorked, clinicDaysPerWeek, rate }) {
  const [mix, setMix] = useState({ "99213": 3, "99214": 10, "99215": 2, "67028": 3, "66984": 0 });

  const result = useMemo(() => {
    let dailyRVU = 0, dailyTime = 0, dailyPts = 0;
    Object.entries(mix).forEach(([code, count]) => {
      const c = cptData.find(x => x.code === code);
      if (c) { dailyRVU += c.wRVU * count; dailyTime += c.time * count; dailyPts += count; }
    });
    const annualRVU = dailyRVU * clinicDaysPerWeek * weeksWorked;
    return { dailyRVU, dailyTime, dailyPts, annualRVU, annualComp: annualRVU * rate };
  }, [mix, cptData, weeksWorked, clinicDaysPerWeek, rate]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 16 }}>
        {Object.keys(mix).map(code => {
          const c = cptData.find(x => x.code === code);
          return (
            <div key={code} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>{code}</div>
              <input type="number" min={0} max={40} value={mix[code]}
                onChange={e => setMix(prev => ({ ...prev, [code]: +e.target.value }))}
                style={{
                  width: 55, padding: "4px", borderRadius: 6, border: "1px solid var(--c-border)",
                  background: "var(--c-surface)", color: "var(--c-text)", fontSize: 16,
                  fontFamily: "var(--ff-mono)", textAlign: "center", fontWeight: 700
                }} />
              <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>/day</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent)" }}>{fmtN(result.dailyRVU)}</div>
          <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>Daily wRVU</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent2)" }}>{fmtN(result.annualRVU)}</div>
          <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>Annual wRVU</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-accent3)" }}>{fmt(result.annualComp)}</div>
          <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>Productivity Pay</div>
        </div>
        <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--c-surface)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-warn)" }}>{result.dailyPts}</div>
          <div style={{ fontSize: 10, color: "var(--c-text-dim)" }}>Patients/Day</div>
        </div>
      </div>
    </div>
  );
}

// ─── SVG CHART COMPONENT ─────────────────────────────────────────────────────
function SVGChart({ data, xKey, yKey, color, xLabel, yLabel, currentX, height = 200 }) {
  const W = 480, H = height, P = { top: 20, right: 20, bottom: 40, left: 65 };
  const iW = W - P.left - P.right, iH = H - P.top - P.bottom;

  const xMin = Math.min(...data.map(d => d[xKey]));
  const xMax = Math.max(...data.map(d => d[xKey]));
  const yMin = 0;
  const yMax = Math.max(...data.map(d => d[yKey])) * 1.1;

  const x = v => P.left + ((v - xMin) / (xMax - xMin || 1)) * iW;
  const y = v => P.top + iH - ((v - yMin) / (yMax - yMin || 1)) * iH;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(d[xKey])},${y(d[yKey])}`).join(" ");
  const areaD = pathD + ` L${x(data[data.length - 1][xKey])},${y(0)} L${x(data[0][xKey])},${y(0)} Z`;

  // Current marker
  const cIdx = data.findIndex(d => d[xKey] >= currentX);
  const cPoint = cIdx >= 0 ? data[cIdx] : data[data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", fontFamily: "var(--ff-mono)" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const yv = yMin + (yMax - yMin) * pct;
        return <g key={i}>
          <line x1={P.left} y1={y(yv)} x2={W - P.right} y2={y(yv)} stroke="var(--c-border)" strokeWidth={0.5} />
          <text x={P.left - 6} y={y(yv) + 4} fill="var(--c-text-dim)" fontSize={9} textAnchor="end">{fmt(yv)}</text>
        </g>;
      })}
      {/* Area + Line */}
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      {/* Current marker */}
      <circle cx={x(cPoint[xKey])} cy={y(cPoint[yKey])} r={5} fill={color} stroke="var(--c-bg)" strokeWidth={2} />
      <text x={x(cPoint[xKey])} y={y(cPoint[yKey]) - 12} fill={color} fontSize={10} textAnchor="middle" fontWeight={700}>
        {fmt(cPoint[yKey])}
      </text>
      {/* Axes labels */}
      <text x={W / 2} y={H - 5} fill="var(--c-text-dim)" fontSize={10} textAnchor="middle">{xLabel}</text>
      <text x={14} y={H / 2} fill="var(--c-text-dim)" fontSize={10} textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>{yLabel}</text>
      {/* X ticks */}
      {data.filter((_, i) => i % 4 === 0).map((d, i) => (
        <text key={i} x={x(d[xKey])} y={H - P.bottom + 16} fill="var(--c-text-dim)" fontSize={9} textAnchor="middle">
          {fmtN(d[xKey])}
        </text>
      ))}
    </svg>
  );
}

// ─── WATERFALL CHART ─────────────────────────────────────────────────────────
function WaterfallChart({ comp }) {
  const items = [
    { label: "Productivity", val: comp.productivity, color: "var(--c-accent)" },
    { label: "Academic", val: comp.academicPay, color: "var(--c-accent2)" },
    { label: "Chair Lever", val: comp.leverPay, color: "var(--c-warn)" },
    { label: "Call Pay", val: comp.callPay, color: "var(--c-accent3)" },
    { label: "Quality", val: comp.qualityPerPhys, color: "#818cf8" },
    { label: "Cosmetic", val: comp.cosmeticNet, color: "var(--c-danger)" },
  ].filter(i => i.val > 0);

  const total = items.reduce((s, i) => s + i.val, 0);
  const W = 480, H = 180, P = { left: 70, right: 20, top: 10, bottom: 30 };
  const iW = W - P.left - P.right, iH = H - P.top - P.bottom;
  const barW = Math.min(40, (iW / (items.length + 1)) * 0.7);
  const gap = iW / (items.length + 1);

  let cumulative = 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", fontFamily: "var(--ff-mono)" }}>
      {items.map((item, i) => {
        const x = P.left + (i + 0.5) * gap - barW / 2;
        const barH = (item.val / total) * iH;
        const yBottom = P.top + iH - (cumulative / total) * iH;
        const yTop = yBottom - barH;
        cumulative += item.val;
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={barW} height={barH} fill={item.color} rx={3} opacity={0.85} />
            <text x={x + barW / 2} y={yTop - 5} fill={item.color} fontSize={8} textAnchor="middle" fontWeight={700}>
              {fmt(item.val)}
            </text>
            <text x={x + barW / 2} y={P.top + iH + 14} fill="var(--c-text-dim)" fontSize={8} textAnchor="middle">
              {item.label}
            </text>
          </g>
        );
      })}
      {/* Total bar */}
      <rect x={P.left + (items.length + 0.5) * gap - barW / 2} y={P.top} width={barW} height={iH} fill="var(--c-accent)" rx={3} opacity={0.3} />
      <rect x={P.left + (items.length + 0.5) * gap - barW / 2} y={P.top} width={barW} height={iH}
        fill="none" stroke="var(--c-accent)" strokeWidth={1.5} rx={3} />
      <text x={P.left + (items.length + 0.5) * gap} y={P.top - 5} fill="var(--c-accent)" fontSize={10} textAnchor="middle" fontWeight={800}>
        {fmt(total)}
      </text>
      <text x={P.left + (items.length + 0.5) * gap} y={P.top + iH + 14} fill="var(--c-text-dim)" fontSize={8} textAnchor="middle">
        TOTAL
      </text>
    </svg>
  );
}
