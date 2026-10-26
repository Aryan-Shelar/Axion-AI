import { useContext, useState } from 'react'
import { Ctx, analyze, fixed, scoreOf, types, roles } from './data.js'
import { inp, btn, ghost, Card, Page, Badge, Empty, ErrorBox, Skel, useLoad, Hl, AddRow } from './ui.jsx'

export function Dashboard() {
  const { scans, audit, go } = useContext(Ctx); const ok = useLoad()
  if (!ok) return <Skel />
  const issues = scans.reduce((n, s) => n + s.findings.length, 0), pend = scans.filter(s => ['Pending', 'In review'].includes(s.status)).length
  const avg = Math.round(scans.reduce((n, s) => n + s.score, 0) / (scans.length || 1))
  return <Page title="Dashboard" sub="Your brand compliance overview. Figures update as you scan.">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[avg + '%', 'Brand health score'], [scans.length, 'Content scanned'], [issues, 'Critical and other issues'], [pend, 'Pending approvals']].map(([n, l]) => <Card key={l}><p className="text-4xl font-light text-white">{n}</p><p className="mt-1 text-sm">{l}</p></Card>)}</div>
    <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !border-signal/60"><div><p className="text-xl text-white">Scan new content</p><p>Check content before publishing.</p></div><button className={btn} onClick={() => go('scanner')}>Start scanning</button></Card>
    <h2 className="mt-8 mb-3 text-xl text-white">Recent activity</h2>
    {audit.length ? <Card className="divide-y divide-white/10 !p-0">{audit.slice(0, 5).map((a, i) => <p key={i} className="p-4"><span className="text-white">{a.who}</span> {a.action.toLowerCase()}: {a.detail}<span className="block text-xs">{a.t}</span></p>)}</Card> : <Empty title="No activity yet" hint="Run your first scan to see activity here." />}
  </Page>
}

export function Scanner() {
  const { rules, addScan, go } = useContext(Ctx)
  const [title, setTitle] = useState(''), [type, setType] = useState(types[0]), [text, setText] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [res, setRes] = useState(null)
  const file = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setText(String(r.result)); setTitle(t => t || f.name) }; r.onerror = () => setErr('Could not read that file. Upload a .txt or .md file, or paste the text.'); r.readAsText(f) }
  const run = () => {
    if (text.trim().length < 10) return setErr('Paste or upload at least a sentence of content to scan.')
    setErr(''); setBusy(true)
    setTimeout(() => { setRes(addScan({ title: title || 'Untitled content', type, text })); setBusy(false) }, 900)
  }
  return <Page title="AI Content Scanner" sub="Paste or upload content, select a content type, run a compliance scan and review highlighted problems.">
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><input className={inp} placeholder="Content title" value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" /><select className={inp} value={type} onChange={e => setType(e.target.value)} aria-label="Content type">{types.map(t => <option key={t}>{t}</option>)}</select></div>
      <textarea className={inp} rows={7} placeholder="Paste your content here…" value={text} onChange={e => setText(e.target.value)} aria-label="Content" />
      {err && <ErrorBox msg={err} />}
      <div className="flex flex-wrap items-center gap-3"><button className={btn} disabled={busy} onClick={run}>{busy ? 'Scanning…' : 'Run compliance scan'}</button><label className={`${ghost} cursor-pointer`}>Upload .txt / .md<input type="file" accept=".txt,.md,text/plain" hidden onChange={file} /></label></div>
    </Card>
    {busy && <div className="mt-4"><Skel /></div>}
    {res && !busy && <Card className="mt-4"><div className="flex items-center justify-between"><h2 className="text-xl text-white">Scan complete: score {res.score}%</h2><button className={ghost} onClick={() => go('detail', res.id)}>Open details</button></div>
      <p className="mt-4 leading-relaxed text-white"><Hl text={res.text} findings={res.findings} /></p>
      {res.findings.length ? <ul className="mt-4 space-y-2">{res.findings.map((f, i) => <li key={i} className="flex flex-wrap items-center gap-2"><Badge s={f.sev} /><span className="text-white">{f.issue}</span><span>{f.fix}</span></li>)}</ul> : <p className="mt-4 text-white">No issues found against your current guidelines.</p>}</Card>}
  </Page>
}

export function Guidelines() {
  const { rules, setRules, log } = useContext(Ctx); const ok = useLoad()
  if (!ok) return <Skel />
  const upd = (k, v, msg) => { setRules({ ...rules, [k]: v }); log('Updated guidelines', msg) }
  const Row = ({ a, b, del }) => <li className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span className="text-white">{a} {b && <span className="text-silver">→ {b}</span>}</span><button aria-label="Remove" className="text-signal" onClick={del}>✕</button></li>
  return <Page title="Brand Guidelines" sub="Brand voice, approved terminology, verified facts, prohibited claims, logos, colours and typography. The scanner checks content against these.">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-2 text-lg text-white">Brand voice</h2><textarea className={inp} rows={3} value={rules.voice} onChange={e => setRules({ ...rules, voice: e.target.value })} /></Card>
      <Card><h2 className="mb-2 text-lg text-white">Approved terminology</h2><ul className="space-y-2">{rules.terms.map((t, i) => <Row key={i} a={t.avoid} b={t.use} del={() => upd('terms', rules.terms.filter((_, k) => k !== i), `Removed term "${t.avoid}"`)} />)}</ul><AddRow ph={['Avoid', 'Use instead']} onAdd={([a, b]) => b && upd('terms', [...rules.terms, { avoid: a, use: b }], `Added term "${a}"`)} /></Card>
      <Card><h2 className="mb-2 text-lg text-white">Prohibited claims</h2><ul className="space-y-2">{rules.prohibited.map((p, i) => <Row key={i} a={p.phrase} b={p.alt} del={() => upd('prohibited', rules.prohibited.filter((_, k) => k !== i), `Removed claim "${p.phrase}"`)} />)}</ul><AddRow ph={['Prohibited phrase', 'Safer wording']} onAdd={([a, b]) => b && upd('prohibited', [...rules.prohibited, { phrase: a, alt: b }], `Added claim "${a}"`)} /></Card>
      <Card><h2 className="mb-2 text-lg text-white">Verified facts</h2><ul className="space-y-2">{rules.facts.map((f, i) => <Row key={i} a={f} del={() => upd('facts', rules.facts.filter((_, k) => k !== i), `Removed fact "${f}"`)} />)}</ul><AddRow ph={['New verified fact']} onAdd={([a]) => upd('facts', [...rules.facts, a], `Added fact "${a}"`)} /></Card>
      <Card className="lg:col-span-2"><h2 className="mb-3 text-lg text-white">Logos, colours and typography</h2>
        <div className="flex flex-wrap gap-3">{rules.colors.map(([n, h]) => <div key={h} className="flex items-center gap-2"><span className="h-8 w-8 rounded-lg border border-white/20" style={{ background: h }} /><span className="text-white">{n} <span className="text-silver">{h}</span></span></div>)}</div>
        <p className="mt-3"><span className="text-white">Typography:</span> {rules.typography}</p><p><span className="text-white">Logo:</span> {rules.logo}</p></Card>
    </div></Page>
}

export function Compliance() {
  const { scans, q, go } = useContext(Ctx); const ok = useLoad()
  const [st, setSt] = useState('All'), [sv, setSv] = useState('All')
  if (!ok) return <Skel />
  const cats = ['Tone', 'Facts', 'Messaging', 'Visual', 'Accessibility']
  const list = scans.filter(s => (st === 'All' || s.status === st) && (sv === 'All' || s.findings.some(f => f.sev === sv)) && s.title.toLowerCase().includes(q.toLowerCase()))
  return <Page title="Compliance Results" sub="Tone, facts, messaging, visual consistency and accessibility checks, with severity levels and recommended fixes.">
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{cats.map(c => <Card key={c} className="!p-4"><p className="text-2xl text-white">{scans.reduce((n, s) => n + s.findings.filter(f => f.cat === c).length, 0)}</p><p className="text-sm">{c}</p></Card>)}</div>
    <div className="mb-4 flex flex-wrap gap-2"><select className={`${inp} !w-auto`} value={st} onChange={e => setSt(e.target.value)} aria-label="Status">{['All', 'Pending', 'In review', 'Approved', 'Rejected'].map(x => <option key={x}>{x}</option>)}</select>
      <select className={`${inp} !w-auto`} value={sv} onChange={e => setSv(e.target.value)} aria-label="Severity">{['All', 'High', 'Medium', 'Low'].map(x => <option key={x}>{x}</option>)}</select></div>
    {list.length ? <div className="space-y-3">{list.map(s => <Card key={s.id} className="cursor-pointer hover:border-white/30" onClick={() => go('detail', s.id)}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-lg text-white">{s.title}</p><span>{s.status}</span></div><p className="text-sm">{s.type} · {s.author} · {s.date}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-white">Score {s.score}%</span>{s.findings.map((f, i) => <Badge key={i} s={f.sev} />)}</div></Card>)}</div>
      : <Empty title="No results match" hint="Change the filters or search, or scan new content." action={<button className={btn} onClick={() => go('scanner')}>Scan content</button>} />}
  </Page>
}

export function Detail() {
  const { scans, sel, go } = useContext(Ctx); const s = scans.find(x => x.id === sel)
  if (!s) return <ErrorBox msg="That scan could not be found." retry={() => go('compliance')} />
  return <Page title={s.title} sub={`${s.type} · ${s.author} · ${s.date} · ${s.status}`}>
    <button className={`${ghost} mb-4`} onClick={() => go('compliance')}>Back to results</button>
    <div className="grid gap-4 lg:grid-cols-2"><Card><h2 className="mb-2 text-lg text-white">Original · score {s.score}%</h2><p className="leading-relaxed text-white"><Hl text={s.text} findings={s.findings} /></p></Card>
      <Card><h2 className="mb-2 text-lg text-white">Suggested revision</h2><p className="leading-relaxed text-white">{fixed(s.text, s.findings)}</p><button className={`${btn} mt-4`} onClick={() => go('approval', s.id)}>Review and approve</button></Card></div>
    <h2 className="mt-6 mb-3 text-xl text-white">Findings</h2>
    {s.findings.length ? <div className="space-y-2">{s.findings.map((f, i) => <Card key={i} className="!p-4"><div className="flex flex-wrap items-center gap-2"><Badge s={f.sev} /><span className="text-sm">{f.cat}</span></div><p className="mt-1 text-white">{f.issue}</p><p>Recommended fix: {f.fix}</p></Card>)}</div> : <Empty title="No findings" hint="This content matches your current guidelines." />}
  </Page>
}

export function Approval() {
  const { scans, sel, setStatus, applyFix, go } = useContext(Ctx)
  const [pick, setPick] = useState(sel || (scans[0] && scans[0].id)); const [draft, setDraft] = useState(null)
  const s = scans.find(x => x.id === pick)
  if (!s) return <Page title="Review & Approval"><Empty title="Nothing to review" hint="Scan content first." action={<button className={btn} onClick={() => go('scanner')}>Scan content</button>} /></Page>
  const sug = draft ?? fixed(s.text, s.findings), high = s.findings.some(f => f.sev === 'High')
  return <Page title="Review & Approval" sub="Edit suggestions, accept changes, send for review, approve or reject content. Nothing is published automatically.">
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">{scans.map(x => <button key={x.id} onClick={() => { setPick(x.id); setDraft(null) }} className={`w-full rounded-xl border p-3 text-left ${x.id === pick ? 'border-signal bg-signal/10' : 'border-white/10 bg-char/80'}`}><p className="text-white">{x.title}</p><p className="text-sm">{x.status}</p></button>)}</div>
      <Card><div className="flex items-center justify-between"><h2 className="text-xl text-white">{s.title}</h2><span>{s.status}</span></div>
        <p className="mt-4">Original</p><p className="text-white"><Hl text={s.text} findings={s.findings} /></p>
        <p className="mt-4">Suggested revision (editable)</p><textarea className={inp} rows={4} value={sug} onChange={e => setDraft(e.target.value)} />
        {high && <p className="mt-3 text-signal">High-severity issues remain. Accept changes before approving.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button className={btn} onClick={() => { applyFix(s.id, sug); setDraft(null) }}>Accept changes</button>
          <button className={ghost} onClick={() => setStatus(s.id, 'In review')}>Send for review</button>
          <button className={ghost} disabled={high} onClick={() => setStatus(s.id, 'Approved')}>Approve</button>
          <button className={ghost} onClick={() => setStatus(s.id, 'Rejected')}>Reject</button></div></Card></div>
  </Page>
}

export function Analytics() {
  const { scans } = useContext(Ctx); const ok = useLoad()
  if (!ok) return <Skel />
  const avg = Math.round(scans.reduce((n, s) => n + s.score, 0) / (scans.length || 1)), pass = Math.round(100 * scans.filter(s => s.score >= 85).length / (scans.length || 1))
  const trend = [78, 82, 85, 88, avg], count = {}
  scans.forEach(s => s.findings.forEach(f => count[f.issue] = (count[f.issue] || 0) + 1))
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return <Page title="Reports & Analytics" sub="Compliance trends, pass rates, recurring violations and performance summaries. Earlier weeks are sample data.">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-4 text-lg text-white">Compliance trend</h2><div className="flex h-40 items-end gap-3">{trend.map((v, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><span className="text-sm text-white">{v}%</span><div className="w-full rounded-t bg-signal" style={{ height: `${v}%` }} /><span className="text-xs">{i === 4 ? 'Now' : `W${i + 1}`}</span></div>)}</div></Card>
      <Card><h2 className="mb-4 text-lg text-white">Pass rate (score 85%+)</h2><p className="text-5xl font-light text-white">{pass}%</p><div className="mt-4 h-2 rounded bg-white/10"><div className="h-2 rounded bg-signal" style={{ width: `${pass}%` }} /></div><p className="mt-3">{scans.length} scans · average score {avg}%</p></Card>
      <Card className="lg:col-span-2"><h2 className="mb-3 text-lg text-white">Recurring violations</h2>{top.length ? <ul className="space-y-2">{top.map(([k, n]) => <li key={k} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span className="text-white">{k}</span><span>{n}×</span></li>)}</ul> : <p>No violations recorded.</p>}</Card>
    </div></Page>
}

export function Audit() {
  const { audit, q } = useContext(Ctx); const ok = useLoad()
  if (!ok) return <Skel />
  const l = audit.filter(a => (a.who + a.action + a.detail).toLowerCase().includes(q.toLowerCase()))
  return <Page title="Audit History" sub="Previous scans, before-and-after content, corrections and approval records.">
    {l.length ? <ol className="space-y-3 border-l border-white/15 pl-5">{l.map((a, i) => <li key={i}><Card className="!p-4"><p className="text-white">{a.action}: {a.detail}</p><p className="text-sm">{a.who} · {a.t}</p>{a.before && <div className="mt-2 grid gap-2 text-sm md:grid-cols-2"><p><b className="text-white">Before:</b> {a.before}</p><p><b className="text-white">After:</b> {a.after}</p></div>}</Card></li>)}</ol> : <Empty title="No records" hint="Actions and decisions will be recorded here." />}
  </Page>
}

export function Settings() {
  const { members, setMembers, user, log } = useContext(Ctx); const ok = useLoad()
  const [ws, setWs] = useState({ name: 'AXION Workspace', org: '' }), [saved, setSaved] = useState(false), [pref, setPref] = useState({ scan: true, approval: true })
  if (!ok) return <Skel />
  return <Page title="Team & Settings" sub="Workspace profile, team members, roles, permissions and preferences.">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 text-lg text-white">Workspace profile</h2><div className="space-y-2"><input className={inp} value={ws.name} onChange={e => setWs({ ...ws, name: e.target.value })} aria-label="Workspace name" /><input className={inp} placeholder="Organisation details" value={ws.org} onChange={e => setWs({ ...ws, org: e.target.value })} aria-label="Organisation" /></div>
        <button className={`${btn} mt-3`} onClick={() => { log('Updated workspace', ws.name); setSaved(true) }}>Save changes</button>{saved && <span className="ml-3" aria-live="polite">Saved</span>}</Card>
      <Card><h2 className="mb-3 text-lg text-white">Preferences</h2>{[['scan', 'Notify me when a scan completes'], ['approval', 'Notify me about approval requests']].map(([k, l]) => <label key={k} className="flex items-center justify-between py-2 text-white">{l}<input type="checkbox" className="h-5 w-5 accent-red-600" checked={pref[k]} onChange={e => setPref({ ...pref, [k]: e.target.checked })} /></label>)}</Card>
      <Card className="lg:col-span-2"><h2 className="mb-3 text-lg text-white">Team members and roles</h2>
        <ul className="divide-y divide-white/10">{members.map(([n, r], i) => <li key={n} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="text-white">{n}{n === user.name && ' (you)'}</span><select className={`${inp} !w-auto`} value={r} aria-label={`Role for ${n}`} onChange={e => { setMembers(members.map((m, k) => k === i ? [n, e.target.value] : m)); log('Changed role', `${n} → ${e.target.value}`) }}>{Object.keys(roles).map(x => <option key={x}>{x}</option>)}</select></li>)}</ul>
        <AddRow ph={['New member name']} onAdd={([n]) => { setMembers([...members, [n, 'Editor']]); log('Added member', n) }} />
        <h3 className="mt-5 mb-2 text-white">Permissions</h3><ul className="space-y-1 text-sm">{Object.entries(roles).map(([k, v]) => <li key={k}><b className="text-white">{k}:</b> {v}</li>)}</ul></Card>
    </div></Page>
}
