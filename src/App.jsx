import { useState } from 'react'
import ParticleBackground from './ParticleBackground.jsx'
import { Ctx, nav, initRules, initScans, initAudit, initNotes, initMembers, analyze, fixed, scoreOf } from './data.js'
import { inp, btn, ghost, Card, ErrorBox } from './ui.jsx'
import * as P from './pages.jsx'

const Logo = ({ size = 28 }) => <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden><path d="M20 3 38 37 22 31l-4-2 8 0-6-14L11 37 2 33z" fill="currentColor" /></svg>

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login'), [f, setF] = useState({ name: '', email: '', pw: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = e => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email address.')
    if (f.pw.length < 6) return setErr('Password must be at least 6 characters.')
    if (mode === 'signup' && !f.name.trim()) return setErr('Enter your name.')
    setErr(''); setBusy(true); setTimeout(() => onLogin({ name: f.name.trim() || f.email.split('@')[0] }), 800)
  }
  return <main className="flex min-h-screen items-center justify-center px-5"><Card className="w-full max-w-md !p-8">
    <p className="flex items-center gap-2 text-2xl font-bold text-white"><Logo size={32} />AXION AI</p><p className="mb-6 mt-1">Brand governance platform. Search the truth. Build the trust.</p>
    <form onSubmit={submit} className="space-y-3">
      {mode === 'signup' && <input className={inp} placeholder="Full name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} aria-label="Full name" />}
      <input className={inp} placeholder="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} aria-label="Email" />
      <input className={inp} placeholder="Password" type="password" value={f.pw} onChange={e => setF({ ...f, pw: e.target.value })} aria-label="Password" />
      {err && <ErrorBox msg={err} />}
      <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Signing in…' : mode === 'login' ? 'Log in' : 'Create account'}</button></form>
    <button className="mt-4 text-sm underline" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr('') }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</button>
    <p className="mt-4 text-xs">Demo sign-in: any valid email and a 6+ character password. Real authentication connects here later.</p></Card></main>
}

function Shell() {
  const { page, go, user, setUser, notes, setNotes, scans, q, setQ } = useCtx()
  const [menu, setMenu] = useState(false), [bell, setBell] = useState(false)
  const Page = { dashboard: P.Dashboard, scanner: P.Scanner, guidelines: P.Guidelines, compliance: P.Compliance, approval: P.Approval, analytics: P.Analytics, audit: P.Audit, settings: P.Settings, detail: P.Detail }[page]
  const unread = notes.filter(n => !n.read).length, hits = q ? scans.filter(s => s.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []
  return <div className="min-h-screen">
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-ink/85 px-4 backdrop-blur">
      <button className="rounded-lg border border-white/20 px-2.5 py-1.5 text-white lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
      <p className="flex items-center gap-2 text-white"><Logo /><span className="font-bold">AXION AI</span><span className="hidden text-sm text-silver md:inline">Brand governance platform</span></p>
      <div className="relative ml-auto w-full max-w-sm"><input className={inp} placeholder="Search content, scans and reports" value={q} onChange={e => setQ(e.target.value)} aria-label="Global search" />
        {hits.length > 0 && <ul className="absolute mt-1 w-full rounded-xl border border-white/15 bg-char p-1">{hits.map(s => <li key={s.id}><button className="w-full rounded-lg px-3 py-2 text-left text-white hover:bg-white/10" onClick={() => { go('detail', s.id); setQ('') }}>{s.title}</button></li>)}</ul>}</div>
      <div className="relative"><button aria-label="Notifications" className="relative rounded-lg border border-white/20 px-3 py-1.5 text-white" onClick={() => { setBell(!bell); setNotes(notes.map(n => ({ ...n, read: true }))) }}>🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-signal px-1.5 text-xs">{unread}</span>}</button>
        {bell && <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/15 bg-char p-2">{notes.length ? notes.map((n, i) => <p key={i} className="rounded-lg p-2 text-sm text-white">{n.m}</p>) : <p className="p-2 text-sm">No notifications</p>}</div>}</div>
      <button className="hidden text-sm text-white md:block" onClick={() => setUser(null)}>{user.name} · Sign out</button>
    </header>
    <div className="lg:flex">
      <nav aria-label="Sections" className={`${menu ? 'block' : 'hidden'} fixed inset-x-0 top-16 z-20 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-white/10 bg-ink p-3 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-ink/70`}>
        <p className="px-3 pb-2 text-sm">Workspace</p>
        {nav.map(([id, l, ic]) => <button key={id} onClick={() => { go(id); setMenu(false) }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${page === id || (page === 'detail' && id === 'compliance') ? 'bg-signal text-white' : 'text-silver hover:bg-white/10'}`}><span aria-hidden>{ic}</span>{l}</button>)}
        <button className="mt-3 w-full rounded-xl px-3 py-2.5 text-left md:hidden" onClick={() => setUser(null)}>Sign out ({user.name})</button>
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8"><Page /></main>
    </div></div>
}
import { useContext } from 'react'
const useCtx = () => useContext(Ctx)

export default function App() {
  const [user, setUser] = useState(null), [page, setPage] = useState('dashboard'), [sel, setSel] = useState(null), [q, setQ] = useState('')
  const [rules, setRules] = useState(initRules), [scans, setScans] = useState(() => initScans(initRules)), [audit, setAudit] = useState(initAudit), [notes, setNotes] = useState(initNotes), [members, setMembers] = useState(initMembers)
  const log = (action, detail, extra = {}) => setAudit(a => [{ t: new Date().toLocaleString(), who: user ? user.name : 'You', action, detail, ...extra }, ...a])
  const notify = m => setNotes(n => [{ m, read: false }, ...n])
  const go = (p, id = null) => { setPage(p); setSel(id); setQ(''); window.scrollTo(0, 0) }
  const addScan = ({ title, type, text }) => {
    const findings = analyze(text, rules), s = { id: Date.now(), title, type, text, author: user.name, date: new Date().toLocaleDateString(), status: 'Pending', findings, score: scoreOf(findings) }
    setScans(x => [s, ...x]); log('Ran scan', title); notify(`${title} scanned: ${findings.length} issue${findings.length === 1 ? '' : 's'} found`); return s
  }
  const setStatus = (id, status) => { const s = scans.find(x => x.id === id); setScans(scans.map(x => x.id === id ? { ...x, status } : x)); log(status === 'Approved' ? 'Approved content' : status === 'Rejected' ? 'Rejected content' : 'Sent for review', s.title); if (status === 'In review') notify(`Approval requested for ${s.title}`) }
  const applyFix = (id, text) => { const s = scans.find(x => x.id === id), findings = analyze(text, rules); setScans(scans.map(x => x.id === id ? { ...x, text, findings, score: scoreOf(findings) } : x)); log('Accepted changes', s.title, { before: s.text, after: text }) }
  if (!user) return <><ParticleBackground /><Auth onLogin={setUser} /></>
  return <Ctx.Provider value={{ user, setUser, page, sel, go, q, setQ, rules, setRules, scans, addScan, setStatus, applyFix, audit, log, notes, setNotes, members, setMembers }}><ParticleBackground /><Shell /></Ctx.Provider>
}
