import { useState, useEffect } from "react";
import ParticleBackground from './ParticleBackground.jsx'
import { Ctx, nav, initRules, initScans, initAudit, initNotes, initMembers, analyze, fixed, scoreOf } from './data.js'
import { inp, btn, ghost, Card, ErrorBox } from './ui.jsx'
import * as P from './pages.jsx'
import { analyzeBrandContent } from "./services/api";
import { saveScan, loadScans } from "./services/firestore";
import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { auth } from "./firebase";
import { saveAuditLog, loadAuditLogs } from "./services/firestore";


const Logo = ({ size = 28 }) => <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden><path d="M20 3 38 37 22 31l-4-2 8 0-6-14L11 37 2 33z" fill="currentColor" /></svg>

function Shell() {
  const { page, go, user, setUser, notes, setNotes, scans, q, setQ } = useCtx()
  const [menu, setMenu] = useState(false), [bell, setBell] = useState(false)
  if (!user) return null;
  const Page = { dashboard: P.Dashboard,home: P.Home, scanner: P.Scanner, compliance: P.Compliance, approval: P.Approval, analytics: P.Analytics, audit: P.Audit, settings: P.Settings, branddna: P.Settings, visualcheck: P.VisualBrandCheck, detail: P.Detail }[page]
  const unread = notes.filter(n => !n.read).length, hits = q ? scans.filter(s => s.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []
  return <div className="min-h-screen">
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-ink/85 px-4 backdrop-blur">
      <button className="rounded-lg border border-white/20 px-2.5 py-1.5 text-white lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
      <p className="flex items-center gap-2 text-white"><Logo /><span className="font-bold">AXION AI</span><span className="hidden text-sm text-silver md:inline">Brand governance platform</span></p>
      <div className="relative ml-auto w-full max-w-sm"><input className={inp} placeholder="Search content, scans and reports" value={q} onChange={e => setQ(e.target.value)} aria-label="Global search" />
        {hits.length > 0 && <ul className="absolute mt-1 w-full rounded-xl border border-white/15 bg-char p-1">{hits.map(s => <li key={s.id}><button className="w-full rounded-lg px-3 py-2 text-left text-white hover:bg-white/10" onClick={() => { go('detail', s.id); setQ('') }}>{s.title}</button></li>)}</ul>}</div>
      <div className="relative"><button aria-label="Notifications" className="relative rounded-lg border border-white/20 px-3 py-1.5 text-white" onClick={() => { setBell(!bell); setNotes(notes.map(n => ({ ...n, read: true }))) }}>🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-signal px-1.5 text-xs">{unread}</span>}</button>
        {bell && <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/15 bg-char p-2">{notes.length ? notes.map((n, i) => <p key={i} className="rounded-lg p-2 text-sm text-white">{n.m}</p>) : <p className="p-2 text-sm">No notifications</p>}</div>}</div>
      <button className="hidden text-sm text-white md:block" onClick={async () => { await signOut(auth); setUser(null); }}>{user.name} · Sign out</button>
    </header>
    <div className="lg:flex">
      <nav aria-label="Sections" className={`${menu ? 'block' : 'hidden'} fixed inset-x-0 top-16 z-20 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-white/10 bg-ink p-3 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-ink/70`}>
        <p className="px-3 pb-2 text-sm">Workspace</p>
        {nav.map(([id, l, ic]) => <button key={id} onClick={() => { go(id); setMenu(false) }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${page === id || (page === 'detail' && id === 'compliance') ? 'bg-signal text-white' : 'text-silver hover:bg-white/10'}`}><span aria-hidden>{ic}</span>{l}</button>)}
        <button className="mt-3 w-full rounded-xl px-3 py-2.5 text-left md:hidden" onClick={async () => { await signOut(auth); setUser(null); }}>Sign out ({user.name})</button>
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8"><Page /></main>
    </div></div>
}
import { useContext } from 'react'
const useCtx = () => useContext(Ctx)

export default function App() {
  const [user, setUser] = useState(null), [page, setPage] = useState('home'), [sel, setSel] = useState(null), [q, setQ] = useState('')
  const [rules, setRules] = useState(initRules), [scans, setScans] = useState(() => initScans(initRules)), [audit, setAudit] = useState(initAudit), [notes, setNotes] = useState(initNotes), [members, setMembers] = useState(initMembers)


useEffect(() => {
  if (!user?.uid) {
    setScans([]);
    setMembers([]);
    return;
  }

  let active = true;

  async function restoreScans() {
    try {
      console.log("Logged-in UID:", user.uid);

      const savedScans = await loadScans(user.uid);

      console.log("Loaded scans:", savedScans);
if (active) {
  // Restore this user's saved scans while preserving any scan created during the initial load.
  setScans(current => {
    const byId = new Map(savedScans.map(scan => [String(scan.id), scan]));
    current.filter(scan => scan.uid === user.uid).forEach(scan => {
      if (!byId.has(String(scan.id))) byId.set(String(scan.id), scan);
    });
    return Array.from(byId.values()).sort((a, b) =>
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
  });
}
    } catch (error) {
      console.error("Failed to load scans:", error);
    }
  }

  restoreScans();

  return () => {
    active = false;
  };
}, [user?.uid]);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      setUser({
        uid: firebaseUser.uid,
        name:
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          "User",
        email: firebaseUser.email
      });
    } else {
      setUser(null);
    }
  });

  return unsubscribe;
}, []);
useEffect(() => {
  if (!user?.uid) {
    setAudit([]);
    return;
  }

  let active = true;

  async function restoreAudit() {
    try {
      const savedLogs = await loadAuditLogs(user.uid);
      console.log("Audit UID:", user.uid);
console.log("Audit logs from Firestore:", savedLogs);

      if (active) {
        setAudit(savedLogs);
      }
    } catch (error) {
      console.error("Failed to load audit history:", error);
    }
  }

  restoreAudit();

  return () => {
    active = false;
  };
}, [user?.uid]);

const log = (action, detail, extra = {}) => {
  const entry = {
    t: new Date().toLocaleString(),
    who: user?.name || "You",
    action,
    detail,
    ...extra,
  };

  setAudit((prev) => [entry, ...prev]);

  if (user?.uid) {
    saveAuditLog(entry, user.uid).catch((error) => {
      console.error("Audit save failed:", error);
    });
  }
};
  const notify = m => setNotes(n => [{ m, read: false }, ...n])
  const go = (p, id = null) => { setPage(p); setSel(id); setQ(''); window.scrollTo(0, 0) }
const addScan = ({ title, type, text }) => {
  if (!user?.uid) {
    console.error("User not logged in!");
    return null;
  }

  const findings = analyze(text, rules);

  const s = {
    id: String(Date.now()),
    uid: user.uid,
    title,
    type,
    text,
    author: user.name,
    date: new Date().toLocaleDateString(),
    createdAt: new Date().toISOString(),
    status: "Pending",
    findings,
    score: scoreOf(findings),
  };

  setScans(prev => [s, ...prev]);

  saveScan(s)
    .then(() => console.log("SCAN SAVED:", s.id))
    .catch(err => console.error("SAVE ERROR:", err.code, err.message));

  log("Ran scan", title);
  return s;
};

const runAIAnalysis = async (content) => {
  try {
    const base = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Please sign in before using AI analysis.");
    const token = await currentUser.getIdToken();
    const response = await fetch(`${base}/api/brands`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Could not load brands (HTTP ${response.status})`);
    const brands = Array.isArray(payload.brands) ? payload.brands : [];
    const brand = brands.find(item => item.owner_uid === user?.uid) || brands[0];
    if (!brand?.id) throw new Error("No brand is configured. Add a brand in the backend before using AI analysis.");
    const result = await analyzeBrandContent(brand.id, content);
    console.log("AI Analysis Result:", result);
    return result;
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
};


const setStatus = async (id, status) => {
  const scan = scans.find(x => String(x.id) === String(id));
  if (!scan || !user?.uid) throw new Error("Scan or logged-in user not found.");
  const now = new Date().toISOString();
  const updatedScan = {
    ...scan, status, uid: user.uid, updatedAt: now, approvalUpdatedAt: now,
    approvedBy: status === "Approved" ? user.name : (scan.approvedBy || null),
  };
  // Persist first so the UI only reports success after Firestore confirms it.
  await saveScan(updatedScan);
  setScans(previous => previous.map(x => String(x.id) === String(id) ? updatedScan : x));
  log(status === "Approved" ? "Approved content" : status === "Rejected" ? "Rejected content" : "Sent for review", scan.title);
  if (status === "In review") notify(`Approval requested for ${scan.title}`);
  return updatedScan;
};


  const updateScan = async (scan) => {
    if (!user?.uid) throw new Error('Please sign in before saving a scan.');
    const updated = { ...scan, uid: user.uid, updatedAt: new Date().toISOString() };
    await saveScan(updated);
    setScans(previous => previous.map(item => String(item.id) === String(updated.id) ? updated : item));
    return updated;
  };

  const applyFix = async (id, text) => {
    const scan = scans.find(x => String(x.id) === String(id));
    if (!scan) throw new Error('Scan not found.');
    const findings = analyze(text, rules);
    const updated = { ...scan, text, findings, score: scoreOf(findings), status: 'Pending', updatedAt: new Date().toISOString() };
    await updateScan(updated);
    log('Accepted changes', scan.title, { before: scan.text, after: text });
    return updated;
  }
 if (!user) {
  return (
    <>
      <ParticleBackground />
      <P.Auth onLogin={setUser} />
    </>
  );
}
  return <Ctx.Provider value={{ user, setUser, page, sel, go, q, setQ, rules, setRules, scans, addScan, updateScan, setStatus, applyFix, audit, log, notes, setNotes, members, setMembers , runAIAnalysis }}><ParticleBackground /><Shell /></Ctx.Provider>
}
