import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// AI HELPERS
// ═══════════════════════════════════════════════════════════════
async function callClaude(messages, systemPrompt = "") {
  try {
    const res = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    return data.text || "";
  } catch {
    return null;
  }
}

async function getAIAdvice(income, expenses, userName) {
  const total_exp = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = income - total_exp;
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const catSummary =
    Object.entries(byCategory)
      .map(([k, v]) => `${k}: TZS ${v.toLocaleString()}`)
      .join(", ") || "Hakuna matumizi bado";

  const system = `Wewe ni mshauri wa fedha wa kibinafsi kwa mtumiaji wa Tanzania anayeitwa ${userName}. 
Jibu KILA WAKATI kwa Kiswahili fasaha na kwa ufupi. Sentensi 2-3 tu. Tumia emoji 1-2. 
Kuwa wa kirafiki, wa kuhamasisha, na wa vitendo. Usiandike orodha.`;

  const result = await callClaude(
    [
      {
        role: "user",
        content: `Hali ya fedha leo: Mapato = TZS ${income.toLocaleString()}, Matumizi = TZS ${total_exp.toLocaleString()}, Salio = TZS ${balance.toLocaleString()}. Matumizi kwa aina: ${catSummary}. Nipe ushauri mfupi.`,
      },
    ],
    system
  );
  return (
    result ||
    "Hongera kwa kutumia Akili Pesa! Endelea kurekodi mapato na matumizi yako. 🌟"
  );
}

async function getWeeklyReport(weekData, userName) {
  const system = `Wewe ni mshauri wa fedha kwa mtumiaji wa Tanzania anayeitwa ${userName}. Jibu kwa Kiswahili. Toa ripoti fupi ya wiki (aya 2-3). Tumia emoji. Kuwa na heshima na wa kuhamasisha.`;
  const result = await callClaude(
    [
      {
        role: "user",
        content: `Data ya wiki hii: ${JSON.stringify(weekData)}. Toa muhtasari na ushauri wa wiki.`,
      },
    ],
    system
  );
  return result || "Wiki nzuri! Endelea na juhudi zako za kuweka akiba. 💪";
}

// ═══════════════════════════════════════════════════════════════
// STORAGE HELPERS  (window.storage with localStorage fallback)
// ═══════════════════════════════════════════════════════════════
async function storageSave(key, value) {
  const data = JSON.stringify(value);
  try {
    if (window.storage) {
      await window.storage.set(key, data);
      return;
    }
  } catch (_) {}
  try { localStorage.setItem(key, data); } catch (_) {}
}

async function storageLoad(key) {
  try {
    if (window.storage) {
      const res = await window.storage.get(key);
      return res ? JSON.parse(res.value) : null;
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

async function storageRemove(key) {
  try {
    if (window.storage) { await window.storage.delete(key); return; }
  } catch (_) {}
  try { localStorage.removeItem(key); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════
let mockOTP = "";
function sendMockOTP() {
  mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
  return mockOTP;
}

function getGreeting(name) {
  const h = new Date().getHours();
  const sets = {
    morning: [
      `Habari za asubuhi, ${name}! ☀️`,
      `Karibu ${name}! Asubuhi njema 🌅`,
      `Asubuhi yenye baraka, ${name}! 🙏`,
    ],
    afternoon: [
      `Karibu tena, ${name}! 😄`,
      `Habari ya mchana, ${name}? 🦁`,
      `Mambo ${name}? Mchana mzuri 🌤️`,
    ],
    evening: [
      `Habari ya jioni, ${name}? ⭐`,
      `Karibu, ${name}! Jioni njema 🌙`,
      `Leo matumizi yako yakoje, ${name}? 💰`,
    ],
  };
  const set = h < 12 ? sets.morning : h < 17 ? sets.afternoon : sets.evening;
  return set[Math.floor(Math.random() * set.length)];
}

function fmtMoney(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function getDayLabel(daysAgo) {
  const days = ["J2", "J3", "J4", "Al", "Ij", "Jm", "J1"];
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return days[d.getDay()];
}

const CATEGORIES = [
  { id: "food", label: "Chakula", icon: "🍽️", color: "#FF6B6B" },
  { id: "transport", label: "Usafiri", icon: "🚌", color: "#4ECDC4" },
  { id: "bills", label: "Bili", icon: "📱", color: "#45B7D1" },
  { id: "entertainment", label: "Starehe", icon: "🎵", color: "#96CEB4" },
  { id: "shopping", label: "Ununuzi", icon: "🛍️", color: "#FFEAA7" },
  { id: "health", label: "Afya", icon: "💊", color: "#DDA0DD" },
  { id: "education", label: "Elimu", icon: "🎓", color: "#87CEEB" },
  { id: "other", label: "Mengine", icon: "📦", color: "#B0C4DE" },
];

const INCOME_SOURCES = [
  { id: "salary", label: "Mshahara", icon: "💼" },
  { id: "business", label: "Biashara", icon: "🏪" },
  { id: "boda", label: "Bodaboda", icon: "🏍️" },
  { id: "freelance", label: "Kazi ya nje", icon: "💻" },
  { id: "gift", label: "Zawadi", icon: "🎁" },
  { id: "other", label: "Mengine", icon: "💰" },
];

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

// ─── Micro-components ────────────────────────────────────────
function DonutChart({ segments, size = 130 }) {
  const r = 48,
    cx = size / 2,
    cy = size / 2,
    sw = 16;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={sw}
      />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap = circ - dash;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={(-offset * circ) / total - circ / 4}
            strokeLinecap="round"
            style={{ transition: "all 0.7s ease" }}
          />
        );
        offset += seg.value;
        return el;
      })}
    </svg>
  );
}

function BarChart({ data, color, T, height = 80 }) {
  const max = Math.max(...data.map((d) => d.val), 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        height: height + 20,
        paddingBottom: 20,
        position: "relative",
      }}
    >
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              width: "100%",
              height: Math.max(4, (d.val / max) * height),
              background: d.active ? color : `${color}40`,
              borderRadius: "4px 4px 0 0",
              transition: "height 0.6s ease",
              minHeight: 4,
            }}
          />
          <div
            style={{
              fontSize: 9,
              color: T.sub,
              position: "absolute",
              bottom: 0,
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// FIX #7: LineChart with ResizeObserver to get correct width
function LineChart({ dataIncome, dataExp, T, height = 100 }) {
  const svgRef = useRef(null);
  const [svgW, setSvgW] = useState(300);

  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setSvgW(w);
      }
    });
    observer.observe(svgRef.current);
    // Also set immediately
    const w = svgRef.current.getBoundingClientRect().width;
    if (w > 0) setSvgW(w);
    return () => observer.disconnect();
  }, []);

  const allVals = [...dataIncome, ...dataExp].filter(Boolean);
  const max = Math.max(...allVals, 1);
  const pts = (arr) =>
    arr
      .map((v, i) => {
        const x = arr.length > 1 ? (i / (arr.length - 1)) * svgW : svgW / 2;
        const y = height - (v / max) * (height - 10) - 5;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {dataIncome.length > 1 && (
        <>
          <polyline
            points={pts(dataIncome)}
            fill="none"
            stroke="#00D4AA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {dataIncome.map((v, i) => {
            const x =
              dataIncome.length > 1
                ? (i / (dataIncome.length - 1)) * svgW
                : svgW / 2;
            const y = height - (v / max) * (height - 10) - 5;
            return <circle key={i} cx={x} cy={y} r={3} fill="#00D4AA" />;
          })}
        </>
      )}
      {dataExp.length > 1 && (
        <>
          <polyline
            points={pts(dataExp)}
            fill="none"
            stroke="#FF6B6B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 3"
          />
          {dataExp.map((v, i) => {
            const x =
              dataExp.length > 1
                ? (i / (dataExp.length - 1)) * svgW
                : svgW / 2;
            const y = height - (v / max) * (height - 10) - 5;
            return <circle key={i} cx={x} cy={y} r={3} fill="#FF6B6B" />;
          })}
        </>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AkiliPesa() {
  // Auth
  const [screen, setScreen] = useState("splash");
  const [authStep, setAuthStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // FIX #4: OTP not shown in toast — stored separately, never displayed
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [sentOTP, setSentOTP] = useState("");
  const [authError, setAuthError] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [onboardDone, setOnboardDone] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const otpRefs = useRef([]);

  // App
  const [tab, setTab] = useState("dashboard");
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [goals, setGoals] = useState([
    {
      id: 1,
      name: "Kodi ya nyumba",
      target: 300000,
      saved: 120000,
      icon: "🏠",
      color: "#45B7D1",
    },
    {
      id: 2,
      name: "Simu mpya",
      target: 150000,
      saved: 45000,
      icon: "📱",
      color: "#96CEB4",
    },
  ]);
  const [incomeHistory, setIncomeHistory] = useState([]);

  // UI state
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showGoalSave, setShowGoalSave] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showWeekReport, setShowWeekReport] = useState(false);
  const [showDeleteExp, setShowDeleteExp] = useState(null);
  // FIX #6: Delete income modal
  const [showDeleteIncome, setShowDeleteIncome] = useState(null);
  // FIX #10: Custom confirm modal instead of window.confirm
  const [confirmModal, setConfirmModal] = useState(null); // {title, desc, onConfirm}

  // Form state
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeSource, setIncomeSource] = useState("salary");
  const [incomeNote, setIncomeNote] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("food");
  const [expNote, setExpNote] = useState("");
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalIcon, setNewGoalIcon] = useState("🎯");
  const [newGoalColor, setNewGoalColor] = useState("#00D4AA");
  const [goalSaveAmt, setGoalSaveAmt] = useState("");

  // AI
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [weekReport, setWeekReport] = useState("");
  const [weekLoading, setWeekLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Habari! Mimi ni mshauri wako wa fedha wa Akili Pesa 🦁. Niulize swali lolote kuhusu pesa zako au usimamizi wa fedha!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Misc
  const [greeting, setGreeting] = useState("");
  const [toast, setToast] = useState(null);
  // FIX #3: Voice input state with real browser SpeechRecognition
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const chatEndRef = useRef(null);
  // FIX #2: store email in a ref so persist() always has the latest value
  const emailRef = useRef("");

  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await new Promise((r) => setTimeout(r, 2400));
      // FIX #1: Use storageLoad instead of localStorage directly
      const stored = await storageLoad("akili_user");
      if (stored) {
        setName(stored.name);
        setEmail(stored.email);
        emailRef.current = stored.email;
        await loadUserData(stored.email);
        setOnboardDone(true);
        setScreen("app");
      } else {
        setScreen("auth");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (name) setGreeting(getGreeting(name));
  }, [name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadUserData(em) {
    const saved = await storageLoad(`akili_v2_${em}`);
    if (saved) {
      setIncome(saved.income || 0);
      setExpenses(saved.expenses || []);
      setGoals(saved.goals || goals);
      setIncomeHistory(saved.incomeHistory || []);
      setAiAdvice(saved.lastAdvice || "");
    }
  }

  // FIX #2: persist uses emailRef.current so it always has correct email
  async function persist(inc, exp, gls, ih, adv) {
    const payload = {
      income: inc,
      expenses: exp,
      goals: gls,
      incomeHistory: ih,
      lastAdvice: adv,
    };
    await storageSave(`akili_v2_${emailRef.current}`, payload);
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Theme ─────────────────────────────────────────────────
  const T = darkMode
    ? {
        bg: "#080D1A",
        card: "#101724",
        card2: "#18243A",
        card3: "#1E2D48",
        border: "rgba(255,255,255,0.07)",
        text: "#EDF2FF",
        sub: "#7A8BA4",
        accent: "#00D4AA",
        accent2: "#FFB347",
        accent3: "#7C8CF8",
        danger: "#FF6B6B",
        income: "#00D4AA",
        expense: "#FF6B6B",
        nav: "rgba(10,14,26,0.95)",
        input: "#18243A",
        shadow: "rgba(0,212,170,0.12)",
        chip: "#1E2D48",
      }
    : {
        bg: "#EEF4F0",
        card: "#FFFFFF",
        card2: "#F0FAF6",
        card3: "#E4F5ED",
        border: "rgba(0,0,0,0.07)",
        text: "#0D1F2D",
        sub: "#6B7C8D",
        accent: "#009E82",
        accent2: "#E8941A",
        accent3: "#5B6CF0",
        danger: "#D93535",
        income: "#009E82",
        expense: "#D93535",
        nav: "rgba(238,244,240,0.95)",
        input: "#EEF4F0",
        shadow: "rgba(0,158,130,0.15)",
        chip: "#E4F5ED",
      };

  // ── Auth handlers ─────────────────────────────────────────
  function handleSendOTP() {
    if (!email.includes("@") || !name.trim()) {
      setAuthError("Weka jina na barua pepe sahihi.");
      return;
    }
    const otp = sendMockOTP();
    setSentOTP(otp);
    setAuthError("");
    setAuthStep("otp");
    // FIX #4: Don't show OTP in toast — show a neutral confirmation message
    showToast("Nambari ya uthibitisho imetumwa! 📧", "info");
    // In a real app you'd send via email; for demo we log to console only
    console.log(`[DEMO OTP - visible in console only]: ${otp}`);
  }

  function handleOTPChange(val, idx) {
    const arr = [...otpInput];
    arr[idx] = val.slice(-1);
    setOtpInput(arr);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
  }

  async function handleVerifyOTP() {
    if (otpInput.join("") === sentOTP) {
      await storageSave("akili_user", { name, email });
      emailRef.current = email;
      await loadUserData(email);
      setScreen("onboard");
    } else {
      setAuthError("Nambari si sahihi. Jaribu tena.");
    }
  }

  // ── Financial handlers ────────────────────────────────────
  async function handleAddIncome() {
    const amt = parseInt(incomeInput.replace(/,/g, ""));
    // FIX #9: Validate amount is positive number
    if (!amt || amt <= 0 || isNaN(amt)) {
      showToast("Weka kiasi sahihi zaidi ya 0", "danger");
      return;
    }
    const newIncome = income + amt;
    const src = INCOME_SOURCES.find((s) => s.id === incomeSource);
    const entry = {
      id: Date.now(),
      amount: amt,
      source: incomeSource,
      label: src?.label,
      note: incomeNote || src?.label,
      date: new Date().toISOString(),
    };
    const newIH = [entry, ...incomeHistory];
    setIncome(newIncome);
    setIncomeHistory(newIH);
    setIncomeInput("");
    setIncomeNote("");
    setShowAddIncome(false);
    await persist(newIncome, expenses, goals, newIH, aiAdvice);
    showToast(`+TZS ${amt.toLocaleString()} imehifadhiwa! 💵`);
    fetchAI(newIncome, expenses, newIH);
  }

  async function handleAddExpense() {
    const amt = parseInt(expAmount.replace(/,/g, ""));
    // FIX #9: Validate amount
    if (!amt || amt <= 0 || isNaN(amt)) {
      showToast("Weka kiasi sahihi zaidi ya 0", "danger");
      return;
    }
    const cat = CATEGORIES.find((c) => c.id === expCategory);
    const entry = {
      id: Date.now(),
      amount: amt,
      category: expCategory,
      note: expNote || cat?.label,
      date: new Date().toISOString(),
    };
    const newExp = [entry, ...expenses];
    setExpenses(newExp);
    setExpAmount("");
    setExpNote("");
    setShowAddExpense(false);
    await persist(income, newExp, goals, incomeHistory, aiAdvice);
    showToast("Matumizi yamerekodiwa! ✅");
    fetchAI(income, newExp, incomeHistory);
  }

  async function handleDeleteExpense(id) {
    const newExp = expenses.filter((e) => e.id !== id);
    setExpenses(newExp);
    setShowDeleteExp(null);
    await persist(income, newExp, goals, incomeHistory, aiAdvice);
    showToast("Imefutwa", "danger");
  }

  // FIX #6: Delete income entry
  async function handleDeleteIncome(id) {
    const entry = incomeHistory.find((e) => e.id === id);
    if (!entry) return;
    const newIH = incomeHistory.filter((e) => e.id !== id);
    const newIncome = Math.max(0, income - entry.amount);
    setIncomeHistory(newIH);
    setIncome(newIncome);
    setShowDeleteIncome(null);
    await persist(newIncome, expenses, goals, newIH, aiAdvice);
    showToast("Mapato yamefutwa", "danger");
  }

  async function handleGoalSave() {
    const amt = parseInt(goalSaveAmt.replace(/,/g, ""));
    if (!amt || !showGoalSave || amt <= 0) return;
    const newGoals = goals.map((g) =>
      g.id === showGoalSave
        ? { ...g, saved: Math.min(g.target, g.saved + amt) }
        : g
    );
    setGoals(newGoals);
    setGoalSaveAmt("");
    setShowGoalSave(null);
    await persist(income, expenses, newGoals, incomeHistory, aiAdvice);
    showToast("Akiba imeongezwa kwenye lengo! 🎯");
  }

  async function handleAddGoal() {
    if (!newGoalName || !newGoalTarget) return;
    const target = parseInt(newGoalTarget);
    if (!target || target <= 0) {
      showToast("Weka lengo la pesa sahihi", "danger");
      return;
    }
    const newGoals = [
      {
        id: Date.now(),
        name: newGoalName,
        target,
        saved: 0,
        icon: newGoalIcon,
        color: newGoalColor,
      },
      ...goals,
    ];
    setGoals(newGoals);
    setNewGoalName("");
    setNewGoalTarget("");
    setShowAddGoal(false);
    await persist(income, expenses, newGoals, incomeHistory, aiAdvice);
    showToast("Lengo jipya limeongezwa! 🎯");
  }

  async function fetchAI(inc, exp, ih) {
    setAiLoading(true);
    const adv = await getAIAdvice(inc, exp, name);
    setAiAdvice(adv);
    setAiLoading(false);
    await persist(inc, exp, goals, ih || incomeHistory, adv);
  }

  async function fetchWeekReport() {
    setWeekLoading(true);
    setShowWeekReport(true);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const balance = income - totalExp;
    const bycat = CATEGORIES.map((c) => ({
      [c.label]: expenses
        .filter((e) => e.category === c.id)
        .reduce((s, e) => s + e.amount, 0),
    }));
    const data = {
      mapato: income,
      matumizi: totalExp,
      salio: balance,
      kwa_aina: bycat,
    };
    const report = await getWeeklyReport(data, name);
    setWeekReport(report);
    setWeekLoading(false);
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMsgs = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMsgs);
    setChatLoading(true);

    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const system = `Wewe ni mshauri wa fedha wa Akili Pesa kwa mtumiaji wa Tanzania anayeitwa ${name}. 
Hali yake ya sasa: Mapato leo = TZS ${income.toLocaleString()}, Matumizi = TZS ${totalExp.toLocaleString()}, Salio = TZS ${(income - totalExp).toLocaleString()}.
Jibu kwa Kiswahili fasaha daima. Kuwa mfupi (aya 1-2), wa kirafiki, na wa vitendo. Tumia emoji kidogo.`;

    const apiMsgs = newMsgs.map((m) => ({ role: m.role, content: m.content }));
    const reply = await callClaude(apiMsgs, system);
    const finalMsg = reply || "Samahani, kuna tatizo kidogo. Jaribu tena! 🙏";
    setChatMessages([...newMsgs, { role: "assistant", content: finalMsg }]);
    setChatLoading(false);
  }

  // FIX #3: Real browser SpeechRecognition with graceful fallback
  function handleVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast(
        "Kivinjari chako hakisaidii sauti. Jaribu Chrome au Edge 🎤",
        "info"
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "sw-TZ";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setVoiceActive(true);
    setVoiceText("Inasikiliza... Sema kiasi na aina ya matumizi");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(`Imesikia: "${transcript}"`);
      setChatInput(transcript);
      setVoiceActive(false);
      setTimeout(() => setVoiceText(""), 2500);
      setShowChat(true);
      showToast("Imesikiwa! Thibitisha kwenye chat 🎤");
    };

    recognition.onerror = (event) => {
      setVoiceActive(false);
      setVoiceText("");
      if (event.error === "not-allowed") {
        showToast("Ruhusa ya maikrofoni inahitajika 🎤", "danger");
      } else {
        showToast("Sauti haikueleweka. Jaribu tena.", "danger");
      }
    };

    recognition.onend = () => {
      setVoiceActive(false);
    };

    recognition.start();
  }

  // ── Derived data ──────────────────────────────────────────
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = income - totalExp;
  const savingsRate =
    income > 0 ? Math.round((balance / income) * 100) : 0;
  const catTotals = CATEGORIES.map((c) => ({
    ...c,
    total: expenses
      .filter((e) => e.category === c.id)
      .reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  const last7days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dayExp = expenses
      .filter((e) => new Date(e.date).toDateString() === ds)
      .reduce((s, e) => s + e.amount, 0);
    const dayInc = incomeHistory
      .filter((e) => new Date(e.date).toDateString() === ds)
      .reduce((s, e) => s + e.amount, 0);
    return { label: getDayLabel(6 - i), exp: dayExp, inc: dayInc, active: i === 6 };
  });

  // ── SCREENS ───────────────────────────────────────────────

  // SPLASH
  if (screen === "splash")
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(160deg,#080D1A 0%,#0B1830 50%,#040E1C 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI',sans-serif",
        }}
      >
        <style>{`
          @keyframes splIn { from{opacity:0;transform:scale(0.75) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
          @keyframes dot { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
          @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
        `}</style>
        <div
          style={{
            textAlign: "center",
            animation: "splIn 0.9s cubic-bezier(.17,.67,.3,1.3)",
          }}
        >
          <div
            style={{
              fontSize: 80,
              animation: "float 3s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            🦁
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              background: "linear-gradient(135deg,#00D4AA,#7CF5E0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: 8,
              letterSpacing: -2,
            }}
          >
            Akili Pesa
          </div>
          <div
            style={{
              color: "#4A6080",
              fontSize: 12,
              marginTop: 10,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Jua Pesa Yako Inaenda Wapi
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 48,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#00D4AA",
                  animation: `dot 1.6s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );

  // AUTH
  if (screen === "auth")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: darkMode
            ? "linear-gradient(160deg,#080D1A,#0B1830)"
            : "linear-gradient(160deg,#EEF4F0,#E0F0E8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          fontFamily: "'Segoe UI',sans-serif",
        }}
      >
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div
          style={{ width: "100%", maxWidth: 390, animation: "slideUp 0.5s ease" }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 56 }}>🦁</div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                color: "#00D4AA",
                marginTop: 6,
                letterSpacing: -1,
              }}
            >
              Akili Pesa
            </div>
            <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
              Mshauri wako wa fedha wa akili
            </div>
          </div>

          <div
            style={{
              background: T.card,
              borderRadius: 24,
              padding: "28px 24px",
              boxShadow: `0 24px 64px ${T.shadow}`,
            }}
          >
            {authStep === "email" ? (
              <>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: T.text,
                    marginBottom: 4,
                  }}
                >
                  Karibu! 👋
                </div>
                <div
                  style={{ color: T.sub, fontSize: 13, marginBottom: 24 }}
                >
                  Fungua akaunti yako ya bure — dakika 1 tu
                </div>
                {[
                  {
                    label: "JINA LAKO KAMILI",
                    val: name,
                    set: setName,
                    ph: "Mfano: Amina Mohamed",
                    type: "text",
                  },
                  {
                    label: "BARUA PEPE",
                    val: email,
                    set: setEmail,
                    ph: "mfano@gmail.com",
                    type: "email",
                  },
                ].map((f) => (
                  <div key={f.label} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        color: T.sub,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        marginBottom: 6,
                      }}
                    >
                      {f.label}
                    </div>
                    <input
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.ph}
                      type={f.type}
                      style={{
                        width: "100%",
                        padding: "13px 14px",
                        borderRadius: 12,
                        border: `1.5px solid ${T.border}`,
                        background: T.input,
                        color: T.text,
                        fontSize: 15,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
                {authError && (
                  <div
                    style={{
                      color: T.danger,
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    {authError}
                  </div>
                )}
                <button
                  onClick={handleSendOTP}
                  style={{
                    width: "100%",
                    padding: 15,
                    borderRadius: 14,
                    border: "none",
                    background:
                      "linear-gradient(135deg,#00D4AA,#00956E)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  Tuma Nambari ya Uthibitisho →
                </button>
                {/* FIX #4: Hint to check console for demo OTP */}
                <div
                  style={{
                    color: T.sub,
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 12,
                    background: `${T.accent}15`,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  💡 Demo: Fungua Console (F12) kuona OTP yako
                </div>
                <div
                  style={{
                    color: T.sub,
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 10,
                  }}
                >
                  Kwa kuendelea unakubali masharti ya matumizi 🔒
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 36 }}>📧</div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: T.text,
                      marginTop: 6,
                    }}
                  >
                    Thibitisha Barua Pepe
                  </div>
                  <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                    OTP imetumwa kwa{" "}
                    <b>
                      {email.slice(0, 3)}***@{email.split("@")[1]}
                    </b>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    margin: "24px 0",
                  }}
                >
                  {otpInput.map((v, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      value={v}
                      onChange={(e) => handleOTPChange(e.target.value, i)}
                      maxLength={1}
                      style={{
                        width: 46,
                        height: 56,
                        textAlign: "center",
                        borderRadius: 12,
                        border: `2.5px solid ${v ? T.accent : T.border}`,
                        background: T.input,
                        color: T.text,
                        fontSize: 24,
                        fontWeight: 800,
                        outline: "none",
                        transition: "border-color 0.2s",
                      }}
                    />
                  ))}
                </div>
                {authError && (
                  <div
                    style={{
                      color: T.danger,
                      fontSize: 13,
                      textAlign: "center",
                      marginBottom: 12,
                    }}
                  >
                    {authError}
                  </div>
                )}
                <button
                  onClick={handleVerifyOTP}
                  style={{
                    width: "100%",
                    padding: 15,
                    borderRadius: 14,
                    border: "none",
                    background:
                      "linear-gradient(135deg,#00D4AA,#00956E)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  Thibitisha Akaunti ✓
                </button>
                <button
                  onClick={() => setAuthStep("email")}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 14,
                    border: "none",
                    background: "transparent",
                    color: T.sub,
                    fontSize: 14,
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  ← Rudi Nyuma
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );

  // ONBOARDING
  if (screen === "onboard") {
    const slides = [
      {
        icon: "🦁",
        title: `Karibu, ${name}!`,
        desc: "Akili Pesa itakusaidia kujua pesa yako inaenda wapi na kukusaidia kuokoa zaidi.",
        color: "#00D4AA",
      },
      {
        icon: "💵",
        title: "Rekodi Mapato Yako",
        desc: "Kila siku rekodi pesa unayopata — mshahara, bodaboda, biashara, au kazi yoyote.",
        color: "#FFB347",
      },
      {
        icon: "🧾",
        title: "Fuatilia Matumizi",
        desc: "Rekodi kila unaotumia pesa na uone wapi unaweza kupunguza.",
        color: "#7C8CF8",
      },
      {
        icon: "🤖",
        title: "AI Inakusaidia",
        desc: "Mshauri wetu wa AI atakupatia ushauri wa kibinafsi kwa Kiswahili kila siku.",
        color: "#FF6B6B",
      },
    ];
    const s = slides[onboardStep];
    return (
      <div
        style={{
          minHeight: "100vh",
          background: darkMode ? "#080D1A" : "#EEF4F0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "60px 24px 40px",
          fontFamily: "'Segoe UI',sans-serif",
        }}
      >
        <style>{`@keyframes pop{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>
        <div />
        <div style={{ textAlign: "center" }}>
          <div
            key={onboardStep}
            style={{
              fontSize: 90,
              animation: "pop 0.4s cubic-bezier(.17,.67,.3,1.3)",
              display: "inline-block",
            }}
          >
            {s.icon}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: s.color,
              marginTop: 20,
              letterSpacing: -0.5,
            }}
          >
            {s.title}
          </div>
          <div
            style={{
              color: T.sub,
              fontSize: 15,
              marginTop: 12,
              lineHeight: 1.7,
              maxWidth: 300,
              margin: "12px auto 0",
            }}
          >
            {s.desc}
          </div>
        </div>
        <div>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            {slides.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === onboardStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === onboardStep ? s.color : T.border,
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              if (onboardStep < slides.length - 1)
                setOnboardStep(onboardStep + 1);
              else {
                setOnboardDone(true);
                setScreen("app");
              }
            }}
            style={{
              width: 320,
              padding: 16,
              borderRadius: 16,
              border: "none",
              background: `linear-gradient(135deg,${s.color},${s.color}CC)`,
              color: "#fff",
              fontWeight: 800,
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            {onboardStep < slides.length - 1 ? "Endelea →" : "Anza Sasa! 🚀"}
          </button>
          {onboardStep > 0 && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                onClick={() => setOnboardStep(onboardStep - 1)}
                style={{
                  background: "none",
                  border: "none",
                  color: T.sub,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ← Rudi Nyuma
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN APP ──────────────────────────────────────────────
  const inputStyle = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: `1.5px solid ${T.border}`,
    background: T.input,
    color: T.text,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const labelStyle = {
    color: T.sub,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 6,
    display: "block",
  };
  const fieldStyle = { marginBottom: 16 };

  // ── Dashboard ─────────────────────────────────────────────
  const Dashboard = () => (
    <div style={{ padding: "0 16px 110px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 0 10px",
        }}
      >
        <div>
          <div
            style={{
              color: T.sub,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            {new Date()
              .toLocaleDateString("sw-TZ", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
              .toUpperCase()}
          </div>
          <div
            style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 3 }}
          >
            {greeting}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: `1.5px solid ${T.border}`,
              background: T.card,
              color: T.text,
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => setShowChat(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: `1.5px solid ${T.accent}40`,
              background: `${T.accent}15`,
              color: T.accent,
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            🤖
          </button>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "linear-gradient(135deg,#00D4AA,#00956E)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {name[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Balance hero */}
      <div
        style={{
          background:
            "linear-gradient(135deg,#00C49A 0%,#00957A 50%,#006B58 100%)",
          borderRadius: 24,
          padding: "22px 22px 18px",
          marginBottom: 14,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,212,170,0.28)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: 20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 18,
            fontSize: 36,
            opacity: 0.15,
          }}
        >
          🦁
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
          }}
        >
          SALIO LA LEO
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 38,
            fontWeight: 900,
            marginTop: 4,
            letterSpacing: -1.5,
          }}
        >
          TZS {balance.toLocaleString()}
        </div>
        <div
          style={{
            display: "flex",
            gap: 0,
            marginTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: 14,
          }}
        >
          {[
            { label: "↑ Mapato", val: `TZS ${fmtMoney(income)}`, col: "#fff" },
            {
              label: "↓ Matumizi",
              val: `TZS ${fmtMoney(totalExp)}`,
              col: "#FFD4D4",
            },
            {
              label: "📊 Akiba",
              val: `${savingsRate}%`,
              col: savingsRate >= 20 ? "#CCFFEE" : "#FFE0B0",
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRight:
                  i < 2 ? "1px solid rgba(255,255,255,0.15)" : "none",
                paddingRight: 12,
                paddingLeft: i > 0 ? 12 : 0,
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
                {s.label}
              </div>
              <div
                style={{
                  color: s.col,
                  fontSize: 14,
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                {s.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <button
          onClick={() => setShowAddIncome(true)}
          style={{
            padding: "14px 8px",
            borderRadius: 16,
            border: `1.5px solid ${T.accent}25`,
            background: `${T.accent}12`,
            color: T.accent,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>💵</div>Mapato
        </button>
        <button
          onClick={() => setShowAddExpense(true)}
          style={{
            padding: "14px 8px",
            borderRadius: 16,
            border: `1.5px solid ${T.danger}25`,
            background: `${T.danger}12`,
            color: T.danger,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>🧾</div>Matumizi
        </button>
        <button
          onClick={handleVoiceInput}
          disabled={voiceActive}
          style={{
            padding: "14px 8px",
            borderRadius: 16,
            border: `1.5px solid ${T.accent2}25`,
            background: voiceActive ? `${T.accent2}30` : `${T.accent2}12`,
            color: T.accent2,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>
            {voiceActive ? "🔴" : "🎤"}
          </div>
          {voiceActive ? "Inasikia" : "Sauti"}
        </button>
      </div>
      {voiceActive && (
        <div
          style={{
            background: `${T.accent2}15`,
            border: `1px solid ${T.accent2}30`,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 14,
            color: T.accent2,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {voiceText}
        </div>
      )}

      {/* AI Advice */}
      <div
        style={{
          background: T.card,
          borderRadius: 20,
          padding: 18,
          marginBottom: 14,
          border: `1.5px solid ${T.accent}20`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            fontSize: 60,
            opacity: 0.05,
          }}
        >
          🤖
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              background: "linear-gradient(135deg,#00D4AA,#FFB347)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
              Ushauri wa AI
            </div>
            <div style={{ color: T.sub, fontSize: 11 }}>
              Msingi wa hali yako ya leo
            </div>
          </div>
          <button
            onClick={() => fetchAI(income, expenses, incomeHistory)}
            disabled={aiLoading}
            style={{
              marginLeft: "auto",
              padding: "5px 12px",
              borderRadius: 20,
              border: `1.5px solid ${T.accent}`,
              background: "transparent",
              color: T.accent,
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {aiLoading ? "..." : "↻ Pata"}
          </button>
        </div>
        {aiLoading ? (
          <div style={{ color: T.sub, fontSize: 13, fontStyle: "italic" }}>
            Inachambua... ⏳
          </div>
        ) : aiAdvice ? (
          <div style={{ color: T.text, fontSize: 13, lineHeight: 1.65 }}>
            {aiAdvice}
          </div>
        ) : (
          <div style={{ color: T.sub, fontSize: 13 }}>
            Bonyeza "↻ Pata" kupata ushauri wa kibinafsi kutoka AI 🧠
          </div>
        )}
        <button
          onClick={() => setShowChat(true)}
          style={{
            width: "100%",
            padding: "9px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.card2,
            color: T.sub,
            fontSize: 12,
            cursor: "pointer",
            marginTop: 12,
            textAlign: "left",
          }}
        >
          💬 Uliza swali lolote kuhusu pesa zako...
        </button>
      </div>

      {/* 7-day chart */}
      <div
        style={{
          background: T.card,
          borderRadius: 20,
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
            📈 Mwenendo wa Wiki
          </div>
          <button
            onClick={fetchWeekReport}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: `1px solid ${T.accent}`,
              background: "transparent",
              color: T.accent,
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Ripoti
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: T.income,
              }}
            />
            <span style={{ color: T.sub, fontSize: 11 }}>Mapato</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: T.expense,
              }}
            />
            <span style={{ color: T.sub, fontSize: 11 }}>Matumizi</span>
          </div>
        </div>
        <LineChart
          dataIncome={last7days.map((d) => d.inc)}
          dataExp={last7days.map((d) => d.exp)}
          T={T}
          height={90}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {last7days.map((d, i) => (
            <div
              key={i}
              style={{
                color: i === 6 ? T.accent : T.sub,
                fontSize: 10,
                textAlign: "center",
                flex: 1,
                fontWeight: i === 6 ? 700 : 400,
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown donut */}
      {catTotals.length > 0 && (
        <div
          style={{
            background: T.card,
            borderRadius: 20,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: T.text,
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            🍕 Matumizi kwa Aina
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <DonutChart
                segments={catTotals.map((c) => ({
                  value: c.total,
                  color: c.color,
                }))}
                size={130}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  textAlign: "center",
                }}
              >
                <div style={{ color: T.sub, fontSize: 9, fontWeight: 700 }}>
                  JUMLA
                </div>
                <div
                  style={{ color: T.text, fontSize: 13, fontWeight: 800 }}
                >
                  TZS {fmtMoney(totalExp)}
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {catTotals.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: c.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: T.sub, fontSize: 12 }}>
                      {c.icon} {c.label}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: T.text,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      TZS {fmtMoney(c.total)}
                    </div>
                    <div style={{ color: T.sub, fontSize: 10 }}>
                      {totalExp > 0
                        ? Math.round((c.total / totalExp) * 100)
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {expenses.length > 0 && (
        <div
          style={{ background: T.card, borderRadius: 20, overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 18px 14px",
            }}
          >
            <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
              🕐 Hivi Karibuni
            </div>
            <button
              onClick={() => setTab("history")}
              style={{
                color: T.accent,
                fontSize: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Ona Zote →
            </button>
          </div>
          {expenses.slice(0, 4).map((e) => {
            const cat = CATEGORIES.find((c) => c.id === e.category);
            return (
              <div
                key={e.id}
                onClick={() => setShowDeleteExp(e.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 18px",
                  borderTop: `1px solid ${T.border}`,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 11 }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      background: `${cat?.color}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    {cat?.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        color: T.text,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {e.note}
                    </div>
                    <div style={{ color: T.sub, fontSize: 11 }}>
                      {new Date(e.date).toLocaleDateString("sw")}
                    </div>
                  </div>
                </div>
                <div
                  style={{ color: T.danger, fontWeight: 800, fontSize: 14 }}
                >
                  -TZS {e.amount.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {income === 0 && expenses.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            color: T.sub,
          }}
        >
          <div style={{ fontSize: 52 }}>💰</div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: T.text,
              marginTop: 10,
            }}
          >
            Karibu Akili Pesa!
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Anza kwa kurekodi mapato ya leo
          </div>
        </div>
      )}
    </div>
  );

  // ── Analytics ─────────────────────────────────────────────
  const Analytics = () => (
    <div style={{ padding: "0 16px 110px" }}>
      <div
        style={{
          padding: "18px 0 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>
          📊 Takwimu
        </div>
        <button
          onClick={fetchWeekReport}
          style={{
            padding: "7px 14px",
            borderRadius: 20,
            border: `1.5px solid ${T.accent}`,
            background: "transparent",
            color: T.accent,
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Ripoti ya Wiki 📋
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          {
            label: "Jumla ya Mapato",
            val: `TZS ${income.toLocaleString()}`,
            icon: "📈",
            col: T.income,
          },
          {
            label: "Jumla ya Matumizi",
            val: `TZS ${totalExp.toLocaleString()}`,
            icon: "📉",
            col: T.expense,
          },
          {
            label: "Akiba",
            val: `TZS ${Math.max(0, balance).toLocaleString()}`,
            icon: "🏦",
            col: T.accent2,
          },
          {
            label: "Kiwango cha Akiba",
            val: `${savingsRate}%`,
            icon: "💡",
            col: savingsRate >= 20 ? T.income : T.expense,
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{ background: T.card, borderRadius: 16, padding: 16 }}
          >
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div
              style={{
                color: s.col,
                fontSize: 17,
                fontWeight: 900,
                marginTop: 6,
              }}
            >
              {s.val}
            </div>
            <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: T.card,
          borderRadius: 20,
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div
          style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}
        >
          📅 Matumizi ya Siku 7
        </div>
        <div style={{ color: T.sub, fontSize: 12, marginBottom: 14 }}>
          Kiasi kilichotumika kila siku
        </div>
        <BarChart
          data={last7days.map((d) => ({
            val: d.exp,
            label: d.label,
            active: d.active,
          }))}
          color={T.danger}
          T={T}
          height={90}
        />
      </div>

      <div
        style={{
          background: T.card,
          borderRadius: 20,
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div
          style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}
        >
          💵 Mapato ya Siku 7
        </div>
        <div style={{ color: T.sub, fontSize: 12, marginBottom: 14 }}>
          Kiasi kilichopatikana kila siku
        </div>
        <BarChart
          data={last7days.map((d) => ({
            val: d.inc,
            label: d.label,
            active: d.active,
          }))}
          color={T.income}
          T={T}
          height={90}
        />
      </div>

      {catTotals.length > 0 && (
        <div
          style={{
            background: T.card,
            borderRadius: 20,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: T.text,
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            🗂️ Matumizi Kwa Kila Aina
          </div>
          {catTotals.map((c) => (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>
                    {c.label}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: c.color, fontWeight: 700, fontSize: 13 }}>
                    TZS {c.total.toLocaleString()}
                  </span>
                  <span
                    style={{ color: T.sub, fontSize: 11, marginLeft: 6 }}
                  >
                    {totalExp > 0 ? Math.round((c.total / totalExp) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div
                style={{
                  background: T.card2,
                  borderRadius: 6,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${totalExp > 0 ? (c.total / totalExp) * 100 : 0}%`,
                    height: "100%",
                    background: c.color,
                    borderRadius: 6,
                    transition: "width 0.8s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {incomeHistory.length > 0 && (
        <div
          style={{
            background: T.card,
            borderRadius: 20,
            padding: 18,
          }}
        >
          <div
            style={{
              color: T.text,
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            💼 Vyanzo vya Mapato
          </div>
          {INCOME_SOURCES.map((src) => {
            const total = incomeHistory
              .filter((h) => h.source === src.id)
              .reduce((s, e) => s + e.amount, 0);
            if (total === 0) return null;
            return (
              <div
                key={src.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 20 }}>{src.icon}</span>
                  <span style={{ color: T.text, fontSize: 13 }}>
                    {src.label}
                  </span>
                </div>
                <span
                  style={{
                    color: T.income,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  TZS {total.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {expenses.length === 0 && incomeHistory.length === 0 && (
        <div
          style={{ textAlign: "center", padding: "40px 0", color: T.sub }}
        >
          <div style={{ fontSize: 48 }}>📊</div>
          <div
            style={{ marginTop: 12, fontWeight: 600, color: T.text }}
          >
            Bado hakuna data
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Rekodi mapato na matumizi kuona takwimu
          </div>
        </div>
      )}
    </div>
  );

  // ── Goals ─────────────────────────────────────────────────
  const Goals = () => (
    <div style={{ padding: "0 16px 110px" }}>
      <div
        style={{
          padding: "18px 0 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>
          🎯 Malengo ya Akiba
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          style={{
            padding: "7px 14px",
            borderRadius: 20,
            border: "none",
            background: T.accent,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Ongeza
        </button>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg,#1A2A4A,#0D1E35)",
          borderRadius: 20,
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ color: "#8AA4C4", fontSize: 12, marginBottom: 4 }}>
          Akiba yote kwa malengo
        </div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>
          TZS{" "}
          {goals.reduce((s, g) => s + g.saved, 0).toLocaleString()}
        </div>
        <div style={{ color: "#8AA4C4", fontSize: 12, marginTop: 4 }}>
          kati ya TZS{" "}
          {goals.reduce((s, g) => s + g.target, 0).toLocaleString()}{" "}
          inayotakiwa
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: 6,
            height: 6,
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${
                goals.reduce((s, g) => s + g.target, 0) > 0
                  ? Math.round(
                      (goals.reduce((s, g) => s + g.saved, 0) /
                        goals.reduce((s, g) => s + g.target, 0)) *
                        100
                    )
                  : 0
              }%`,
              height: "100%",
              background: "linear-gradient(90deg,#00D4AA,#FFB347)",
              borderRadius: 6,
            }}
          />
        </div>
      </div>

      {goals.map((g) => {
        const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
        const remaining = g.target - g.saved;
        const done = pct >= 100;
        return (
          <div
            key={g.id}
            style={{
              background: T.card,
              borderRadius: 20,
              padding: 20,
              marginBottom: 12,
              border: done
                ? `1.5px solid ${T.accent}`
                : `1.5px solid ${T.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: `${g.color}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  {g.icon}
                </div>
                <div>
                  <div
                    style={{ color: T.text, fontWeight: 800, fontSize: 15 }}
                  >
                    {g.name}
                  </div>
                  <div
                    style={{ color: T.sub, fontSize: 12, marginTop: 2 }}
                  >
                    {done
                      ? "✅ Umefika lengo!"
                      : `TZS ${remaining.toLocaleString()} imebaki`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: done ? T.accent : g.color,
                    fontWeight: 900,
                    fontSize: 22,
                  }}
                >
                  {pct}%
                </div>
              </div>
            </div>
            <div
              style={{
                background: T.card2,
                borderRadius: 8,
                height: 12,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 8,
                  background: done
                    ? `linear-gradient(90deg,${T.accent},${T.accent2})`
                    : `linear-gradient(90deg,${g.color},${g.color}99)`,
                  transition: "width 0.9s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: T.sub, fontSize: 11 }}>Imewekwa</div>
                <div
                  style={{ color: T.text, fontWeight: 700, fontSize: 13 }}
                >
                  TZS {g.saved.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: T.sub, fontSize: 11 }}>Lengo</div>
                <div
                  style={{ color: T.text, fontWeight: 700, fontSize: 13 }}
                >
                  TZS {g.target.toLocaleString()}
                </div>
              </div>
              {!done && (
                <button
                  onClick={() => {
                    setShowGoalSave(g.id);
                    setGoalSaveAmt("");
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: T.accent,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  + Weka Akiba
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── History ───────────────────────────────────────────────
  // FIX #5: Full history with pagination (show all, not just 5)
  const History = () => {
    const [filterCat, setFilterCat] = useState("all");
    // FIX #5: Show all, no artificial slice limit
    const filtered =
      filterCat === "all"
        ? expenses
        : expenses.filter((e) => e.category === filterCat);

    return (
      <div style={{ padding: "0 16px 110px" }}>
        <div style={{ padding: "18px 0 10px" }}>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>
            📋 Historia Yote
          </div>
          <div style={{ color: T.sub, fontSize: 13, marginTop: 2 }}>
            {expenses.length} matumizi · {incomeHistory.length} mapato
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 10,
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => setFilterCat("all")}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 20,
              border: `1.5px solid ${filterCat === "all" ? T.accent : T.border}`,
              background:
                filterCat === "all" ? `${T.accent}20` : T.chip,
              color: filterCat === "all" ? T.accent : T.sub,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Zote
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 20,
                border: `1.5px solid ${filterCat === c.id ? c.color : T.border}`,
                background:
                  filterCat === c.id ? `${c.color}20` : T.chip,
                color: filterCat === c.id ? c.color : T.sub,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* FIX #6: Income entries — all of them, with delete */}
        {incomeHistory.length > 0 && filterCat === "all" && (
          <div
            style={{
              background: T.card,
              borderRadius: 18,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${T.border}`,
                color: T.sub,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              MAPATO ({incomeHistory.length})
            </div>
            {incomeHistory.map((e) => {
              const src = INCOME_SOURCES.find((s) => s.id === e.source);
              return (
                <div
                  key={e.id}
                  onClick={() => setShowDeleteIncome(e.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderTop: `1px solid ${T.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        background: `${T.accent}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {src?.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          color: T.text,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {e.note || src?.label}
                      </div>
                      <div style={{ color: T.sub, fontSize: 11 }}>
                        {new Date(e.date).toLocaleDateString("sw")}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: T.income,
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      +TZS {e.amount.toLocaleString()}
                    </div>
                    <div style={{ color: T.sub, fontSize: 10 }}>
                      Gusa kufuta
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Expense entries — all of them */}
        {filtered.length > 0 ? (
          <div
            style={{
              background: T.card,
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${T.border}`,
                color: T.sub,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              MATUMIZI ({filtered.length})
            </div>
            {filtered.map((e) => {
              const cat = CATEGORIES.find((c) => c.id === e.category);
              return (
                <div
                  key={e.id}
                  onClick={() => setShowDeleteExp(e.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderTop: `1px solid ${T.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        background: `${cat?.color}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 17,
                      }}
                    >
                      {cat?.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          color: T.text,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {e.note}
                      </div>
                      <div style={{ color: T.sub, fontSize: 11 }}>
                        {cat?.label} ·{" "}
                        {new Date(e.date).toLocaleDateString("sw")}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: T.danger,
                        fontWeight: 800,
                        fontSize: 14,
                        textAlign: "right",
                      }}
                    >
                      -TZS {e.amount.toLocaleString()}
                    </div>
                    <div
                      style={{ color: T.sub, fontSize: 10, textAlign: "right" }}
                    >
                      Gusa kufuta
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{ textAlign: "center", padding: "40px 0", color: T.sub }}
          >
            <div style={{ fontSize: 40 }}>📭</div>
            <div style={{ marginTop: 12 }}>
              Hakuna matumizi{" "}
              {filterCat !== "all" ? "katika aina hii" : "bado"}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Profile ───────────────────────────────────────────────
  const Profile = () => {
    const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
    const txCount = expenses.length + incomeHistory.length;
    return (
      <div style={{ padding: "0 16px 110px" }}>
        <div style={{ padding: "18px 0 14px" }}>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>
            👤 Wasifu Wangu
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg,#00C49A,#006B58)",
            borderRadius: 24,
            padding: 24,
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: 30,
              margin: "0 auto 10px",
              border: "3px solid rgba(255,255,255,0.3)",
            }}
          >
            {name[0]?.toUpperCase()}
          </div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>
            {name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 }}>
            {email}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 8,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.15)",
            }}
          >
            <span style={{ color: "#AAFFEE", fontSize: 12 }}>
              ✓ Amethibitishwa
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {[
            { label: "Miamala", val: txCount, icon: "📊" },
            { label: "Akiba (TZS)", val: fmtMoney(totalSaved), icon: "🏦" },
            { label: "Malengo", val: goals.length, icon: "🎯" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: T.card,
                borderRadius: 14,
                padding: "14px 10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div
                style={{
                  color: T.accent,
                  fontWeight: 900,
                  fontSize: 16,
                  marginTop: 4,
                }}
              >
                {s.val}
              </div>
              <div style={{ color: T.sub, fontSize: 11 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: T.card,
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {[
            {
              icon: darkMode ? "☀️" : "🌙",
              label: darkMode ? "Badili hadi Mchana" : "Badili hadi Usiku",
              action: () => setDarkMode(!darkMode),
            },
            {
              icon: "🤖",
              label: "Zungumza na AI Mshauri",
              action: () => setShowChat(true),
            },
            {
              icon: "📈",
              label: "Ripoti ya Wiki",
              action: fetchWeekReport,
            },
            {
              icon: "🔔",
              label: "Arifa za App",
              action: () => showToast("Arifa zimewashwa! 🔔"),
            },
          ].map((item, i, arr) => (
            <div
              key={i}
              onClick={item.action}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 20px",
                borderBottom:
                  i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ color: T.text, fontSize: 14, flex: 1 }}>
                {item.label}
              </span>
              <span style={{ color: T.sub, fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>

        {/* FIX #10: Custom confirm modals instead of window.confirm */}
        <div
          style={{
            background: T.card,
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            onClick={() =>
              setConfirmModal({
                title: "Futa Data Yote",
                desc: "Una uhakika kutaka kufuta data yako yote? Hatua hii haiwezi kurudishwa.",
                danger: true,
                onConfirm: async () => {
                  await storageRemove("akili_user");
                  await storageRemove(`akili_v2_${emailRef.current}`);
                  // Reset all state
                  setIncome(0);
                  setExpenses([]);
                  setIncomeHistory([]);
                  setGoals([
                    { id: 1, name: "Kodi ya nyumba", target: 300000, saved: 120000, icon: "🏠", color: "#45B7D1" },
                    { id: 2, name: "Simu mpya", target: 150000, saved: 45000, icon: "📱", color: "#96CEB4" },
                  ]);
                  setAiAdvice("");
                  setConfirmModal(null);
                  setScreen("auth");
                  setAuthStep("email");
                  setEmail("");
                  setName("");
                },
              })
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>🗑️</span>
            <span
              style={{
                color: T.danger,
                fontSize: 14,
                flex: 1,
                fontWeight: 600,
              }}
            >
              Futa Data Yangu Yote
            </span>
          </div>
          <div
            onClick={() =>
              setConfirmModal({
                title: "Toka Akaunti",
                desc: "Una uhakika unataka kutoka?",
                danger: false,
                onConfirm: async () => {
                  await storageRemove("akili_user");
                  setConfirmModal(null);
                  setScreen("auth");
                  setAuthStep("email");
                  setEmail("");
                  setName("");
                },
              })
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderTop: `1px solid ${T.border}`,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>🚪</span>
            <span style={{ color: T.sub, fontSize: 14, flex: 1 }}>
              Toka Akaunti
            </span>
          </div>
        </div>

        <div style={{ textAlign: "center", color: T.sub, fontSize: 11 }}>
          Akili Pesa v2.1 · Imetengenezwa kwa ❤️ kwa Afrika Mashariki
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes gradShift{0%{background-position:0%}100%{background-position:200%}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        input,button,textarea{font-family:inherit;}
        ::-webkit-scrollbar{width:0;height:0;}
      `}</style>

      {/* Rainbow bar */}
      <div
        style={{
          height: 3,
          background:
            "linear-gradient(90deg,#00D4AA,#FFB347,#7C8CF8,#FF6B6B,#00D4AA)",
          backgroundSize: "300%",
          animation: "gradShift 6s linear infinite",
        }}
      />

      {/* Scrollable content */}
      <div
        style={{
          height: "calc(100vh - 3px)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {tab === "dashboard" && <Dashboard />}
        {tab === "analytics" && <Analytics />}
        {tab === "goals" && <Goals />}
        {tab === "history" && <History />}
        {tab === "profile" && <Profile />}
      </div>

      {/* Bottom Nav */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: T.nav,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          padding: "6px 0 18px",
          backdropFilter: "blur(24px)",
          zIndex: 50,
        }}
      >
        {[
          { id: "dashboard", icon: "🏠", label: "Nyumbani" },
          { id: "analytics", icon: "📊", label: "Takwimu" },
          { id: "goals", icon: "🎯", label: "Malengo" },
          { id: "history", icon: "📋", label: "Historia" },
          { id: "profile", icon: "👤", label: "Wasifu" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "4px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: 21,
                filter:
                  tab === t.id ? "none" : "grayscale(1) opacity(0.45)",
                transform:
                  tab === t.id
                    ? "scale(1.2) translateY(-1px)"
                    : "scale(1)",
                transition: "all 0.2s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              {t.icon}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: tab === t.id ? 700 : 400,
                color: tab === t.id ? T.accent : T.sub,
                transition: "color 0.2s",
              }}
            >
              {t.label}
            </div>
          </button>
        ))}
      </div>

      {/* ════ MODAL: Add Income ════ */}
      {showAddIncome && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowAddIncome(false)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: "26px 26px 0 0",
              padding: "28px 22px 44px",
              width: "100%",
              maxWidth: 430,
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.border,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 20,
                fontWeight: 900,
                marginBottom: 20,
              }}
            >
              💵 Ongeza Mapato
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>KIASI (TZS)</label>
              <input
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                placeholder="0"
                type="number"
                min="1"
                style={{ ...inputStyle, fontSize: 28, fontWeight: 900 }}
                autoFocus
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    setIncomeInput(
                      String(incomeInput ? parseInt(incomeInput) + a : a)
                    )
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${T.border}`,
                    background: T.chip,
                    color: T.text,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  +{fmtMoney(a)}
                </button>
              ))}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>CHANZO CHA MAPATO</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                {INCOME_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setIncomeSource(s.id)}
                    style={{
                      padding: "10px 6px",
                      borderRadius: 12,
                      border: `2px solid ${
                        incomeSource === s.id ? T.accent : T.border
                      }`,
                      background:
                        incomeSource === s.id
                          ? `${T.accent}18`
                          : T.input,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span
                      style={{ color: T.text, fontSize: 10, fontWeight: 600 }}
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>MAELEZO (Hiari)</label>
              <input
                value={incomeNote}
                onChange={(e) => setIncomeNote(e.target.value)}
                placeholder="Mfano: Mshahara wa Mei"
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleAddIncome}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg,#00D4AA,#00956E)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              Hifadhi Mapato ✓
            </button>
          </div>
        </div>
      )}

      {/* ════ MODAL: Add Expense ════ */}
      {showAddExpense && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowAddExpense(false)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: "26px 26px 0 0",
              padding: "28px 22px 44px",
              width: "100%",
              maxWidth: 430,
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.border,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 20,
                fontWeight: 900,
                marginBottom: 20,
              }}
            >
              🧾 Rekodi Matumizi
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>KIASI (TZS)</label>
              <input
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="0"
                type="number"
                min="1"
                style={{ ...inputStyle, fontSize: 28, fontWeight: 900 }}
                autoFocus
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    setExpAmount(
                      String(expAmount ? parseInt(expAmount) + a : a)
                    )
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${T.border}`,
                    background: T.chip,
                    color: T.text,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  +{fmtMoney(a)}
                </button>
              ))}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>AINA YA MATUMIZI</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 8,
                }}
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setExpCategory(c.id)}
                    style={{
                      padding: "10px 4px",
                      borderRadius: 12,
                      border: `2px solid ${
                        expCategory === c.id ? c.color : T.border
                      }`,
                      background:
                        expCategory === c.id ? `${c.color}20` : T.input,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span
                      style={{ color: T.text, fontSize: 9, fontWeight: 600 }}
                    >
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>MAELEZO (Hiari)</label>
              <input
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="Mfano: Chakula cha mchana"
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleAddExpense}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg,#FF6B6B,#D93535)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              Hifadhi Matumizi ✓
            </button>
          </div>
        </div>
      )}

      {/* ════ MODAL: Add Goal ════ */}
      {showAddGoal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowAddGoal(false)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: "26px 26px 0 0",
              padding: "28px 22px 44px",
              width: "100%",
              maxWidth: 430,
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.border,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 20,
                fontWeight: 900,
                marginBottom: 20,
              }}
            >
              🎯 Lengo Jipya la Akiba
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>JINA LA LENGO</label>
              <input
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="Mfano: Kodi ya nyumba"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>LENGO LA PESA (TZS)</label>
              <input
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                placeholder="Mfano: 500000"
                type="number"
                min="1"
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>CHAGUA EMOJI</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  "🏠","📱","🎓","🚗","💼","✈️","💊","🎯","🏍️","🛒","🌍","👶",
                ].map((em) => (
                  <button
                    key={em}
                    onClick={() => setNewGoalIcon(em)}
                    style={{
                      width: 44,
                      height: 44,
                      fontSize: 22,
                      borderRadius: 12,
                      border: `2.5px solid ${
                        newGoalIcon === em ? T.accent : T.border
                      }`,
                      background:
                        newGoalIcon === em ? `${T.accent}18` : T.input,
                      cursor: "pointer",
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>RANGI</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  "#00D4AA","#FF6B6B","#FFB347","#7C8CF8",
                  "#45B7D1","#96CEB4","#DDA0DD","#4ECDC4",
                ].map((col) => (
                  <button
                    key={col}
                    onClick={() => setNewGoalColor(col)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: col,
                      border: `3px solid ${
                        newGoalColor === col ? T.text : "transparent"
                      }`,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleAddGoal}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg,#00D4AA,#00956E)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              Ongeza Lengo ✓
            </button>
          </div>
        </div>
      )}

      {/* ════ MODAL: Goal Save ════ */}
      {showGoalSave && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowGoalSave(null)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: "26px 26px 0 0",
              padding: "28px 22px 44px",
              width: "100%",
              maxWidth: 430,
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.border,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 20,
                fontWeight: 900,
                marginBottom: 6,
              }}
            >
              🏦 Weka Akiba kwenye Lengo
            </div>
            <div style={{ color: T.sub, fontSize: 13, marginBottom: 20 }}>
              {goals.find((g) => g.id === showGoalSave)?.name}
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>KIASI (TZS)</label>
              <input
                value={goalSaveAmt}
                onChange={(e) => setGoalSaveAmt(e.target.value)}
                placeholder="Mfano: 20000"
                type="number"
                min="1"
                style={{ ...inputStyle, fontSize: 28, fontWeight: 900 }}
                autoFocus
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              {[5000, 10000, 20000, 50000].map((a) => (
                <button
                  key={a}
                  onClick={() => setGoalSaveAmt(String(a))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1.5px solid ${T.border}`,
                    background: T.chip,
                    color: T.text,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  TZS {fmtMoney(a)}
                </button>
              ))}
            </div>
            <button
              onClick={handleGoalSave}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg,#00D4AA,#00956E)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              Hifadhi Akiba 🎯
            </button>
          </div>
        </div>
      )}

      {/* ════ MODAL: Delete Expense ════ */}
      {showDeleteExp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowDeleteExp(null)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 24,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              animation: "fadeIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>
              🗑️
            </div>
            <div
              style={{
                color: T.text,
                fontSize: 18,
                fontWeight: 800,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Futa Matumizi
            </div>
            <div
              style={{
                color: T.sub,
                fontSize: 14,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Una uhakika unataka kufuta muamala huu?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteExp(null)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${T.border}`,
                  background: "transparent",
                  color: T.text,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Hapana
              </button>
              <button
                onClick={() => handleDeleteExpense(showDeleteExp)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: "none",
                  background: T.danger,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Futa ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Delete Income (FIX #6) ════ */}
      {showDeleteIncome && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowDeleteIncome(null)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 24,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              animation: "fadeIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>
              ↩️
            </div>
            <div
              style={{
                color: T.text,
                fontSize: 18,
                fontWeight: 800,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Futa Mapato
            </div>
            <div
              style={{
                color: T.sub,
                fontSize: 14,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Una uhakika? Kiasi hiki kitaondolewa kwenye jumla ya mapato yako.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteIncome(null)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${T.border}`,
                  background: "transparent",
                  color: T.text,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Hapana
              </button>
              <button
                onClick={() => handleDeleteIncome(showDeleteIncome)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: "none",
                  background: T.danger,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Futa ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Custom Confirm (FIX #10) ════ */}
      {confirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 24,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              animation: "fadeIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 40,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {confirmModal.danger ? "⚠️" : "🚪"}
            </div>
            <div
              style={{
                color: T.text,
                fontSize: 18,
                fontWeight: 800,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {confirmModal.title}
            </div>
            <div
              style={{
                color: T.sub,
                fontSize: 14,
                textAlign: "center",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              {confirmModal.desc}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${T.border}`,
                  background: "transparent",
                  color: T.text,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Hapana
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  border: "none",
                  background: confirmModal.danger ? T.danger : T.accent,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Ndio, Endelea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: AI Chat ════ */}
      {showChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.bg,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            maxWidth: 430,
            margin: "0 auto",
            left: 0,
            right: 0,
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: T.card,
            }}
          >
            <button
              onClick={() => setShowChat(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: `1.5px solid ${T.border}`,
                background: T.card2,
                color: T.text,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ←
            </button>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "linear-gradient(135deg,#00D4AA,#FFB347)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🤖
            </div>
            <div>
              <div style={{ color: T.text, fontWeight: 800, fontSize: 15 }}>
                Mshauri wa AI
              </div>
              <div
                style={{
                  color: T.accent,
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: T.accent,
                  }}
                />{" "}
                Mtandaoni
              </div>
            </div>
          </div>

          <div
            style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}
          >
            {chatMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                {m.role === "assistant" && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: "linear-gradient(135deg,#00D4AA,#FFB347)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      marginRight: 8,
                      flexShrink: 0,
                      alignSelf: "flex-end",
                    }}
                  >
                    🤖
                  </div>
                )}
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "11px 14px",
                    borderRadius:
                      m.role === "user"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    background:
                      m.role === "user"
                        ? "linear-gradient(135deg,#00D4AA,#00956E)"
                        : T.card,
                    color: m.role === "user" ? "#fff" : T.text,
                    fontSize: 14,
                    lineHeight: 1.55,
                    border:
                      m.role === "assistant"
                        ? `1px solid ${T.border}`
                        : "none",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: "linear-gradient(135deg,#00D4AA,#FFB347)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: 4,
                  }}
                >
                  {[0, 1, 2].map((j) => (
                    <div
                      key={j}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: T.accent,
                        animation: `pulse 1.2s ${j * 0.2}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {chatMessages.length === 1 && (
            <div
              style={{
                padding: "10px 16px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[
                "Nitumie ushauri wa akiba",
                "Matumizi yangu yako juu?",
                "Nawezaje kupunguza gharama?",
                "Nifanye nini na salio langu?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setChatInput(q)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${T.border}`,
                    background: T.chip,
                    color: T.text,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              padding: "12px 16px 28px",
              background: T.card,
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              gap: 10,
            }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Andika swali lako..."
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 24,
                border: `1.5px solid ${T.border}`,
                background: T.input,
                color: T.text,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                border: "none",
                background: chatInput.trim()
                  ? "linear-gradient(135deg,#00D4AA,#00956E)"
                  : T.border,
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* ════ MODAL: Weekly Report ════ */}
      {showWeekReport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 150,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowWeekReport(false)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: "26px 26px 0 0",
              padding: "28px 22px 44px",
              width: "100%",
              maxWidth: 430,
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.border,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: "linear-gradient(135deg,#7C8CF8,#00D4AA)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                📋
              </div>
              <div>
                <div
                  style={{ color: T.text, fontSize: 18, fontWeight: 900 }}
                >
                  Ripoti ya Wiki Hii
                </div>
                <div style={{ color: T.sub, fontSize: 12 }}>Muhtasari wa AI</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {[
                { label: "Mapato", val: `TZS ${fmtMoney(income)}`, col: T.income },
                { label: "Matumizi", val: `TZS ${fmtMoney(totalExp)}`, col: T.expense },
                { label: "Akiba", val: `${savingsRate}%`, col: T.accent2 },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: T.card2,
                    borderRadius: 12,
                    padding: "12px 8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ color: s.col, fontWeight: 900, fontSize: 14 }}
                  >
                    {s.val}
                  </div>
                  <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: T.card2,
                borderRadius: 16,
                padding: 16,
                minHeight: 100,
                border: `1px solid ${T.border}`,
              }}
            >
              {weekLoading ? (
                <div
                  style={{
                    color: T.sub,
                    fontSize: 13,
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  AI inachambua wiki yako... ⏳
                </div>
              ) : weekReport ? (
                <div
                  style={{ color: T.text, fontSize: 14, lineHeight: 1.7 }}
                >
                  {weekReport}
                </div>
              ) : (
                <div style={{ color: T.sub, fontSize: 13 }}>
                  Inapakia ripoti...
                </div>
              )}
            </div>

            <button
              onClick={() => setShowWeekReport(false)}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 14,
                border: `1.5px solid ${T.border}`,
                background: "transparent",
                color: T.text,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                marginTop: 16,
              }}
            >
              Funga
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              toast.type === "info"
                ? "#1A2A4A"
                : toast.type === "danger"
                ? T.danger
                : T.accent,
            color: "#fff",
            padding: "13px 22px",
            borderRadius: 16,
            fontWeight: 700,
            fontSize: 14,
            zIndex: 300,
            boxShadow: "0 10px 32px rgba(0,0,0,0.35)",
            maxWidth: 340,
            textAlign: "center",
            animation: "toastIn 0.3s ease",
            lineHeight: 1.4,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
