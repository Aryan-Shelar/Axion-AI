import { useContext, useState , useEffect} from 'react'
import { Ctx, analyze, fixed, scoreOf, types, roles } from './data.js'
import { inp, btn, ghost, Card, Page, Badge, Empty, ErrorBox, Skel, useLoad, Hl, AddRow } from './ui.jsx'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import {
  saveCompanyProfile,
  loadCompanyProfile
} from "./services/firestore";

import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { listBrands, listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, uploadKnowledgeDocument, checkVisualBrand } from "./services/api";

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
  const { rules, addScan, updateScan, go, runAIAnalysis } = useContext(Ctx)
  const [title, setTitle] = useState(''), [type, setType] = useState(types[0]), [text, setText] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [res, setRes] = useState(null)
  const file = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setText(String(r.result)); setTitle(t => t || f.name) }; r.onerror = () => setErr('Could not read that file. Upload a .txt or .md file, or paste the text.'); r.readAsText(f) }



const run = async () => {
  if (text.trim().length < 10) {
    setErr("Paste at least a sentence of content to scan.");
    return;
  }

  setErr("");
  setBusy(true);
  setRes(null);

  try {
    // 1. Run local scanner first
    const localFindings = analyze(text, rules);

    console.log("Local findings:", localFindings);

    // 2. Save scan even if AI is unavailable
    const scan = addScan({
      title: title || "Untitled content",
      type,
      text,
    });

    if (!scan) {
      throw new Error("Scan could not be created. Please log in again.");
    }

    // 3. Try AI separately; local scan still works if AI fails
    let aiResult = null;
    let aiIssues = [];

    try {
      aiResult = await runAIAnalysis(text);

      aiIssues = (aiResult?.issues || []).map((item, index) => ({
        cat: item.category || "AI Analysis",
        sev: ["High", "Medium", "Low"].includes(item.severity)
          ? item.severity
          : "Medium",
        issue: item.issue || item.text || "Potential issue detected",
        fix: item.fix || "Review against brand guidelines",
        from: item.text || "",
        to: "",
        id: `ai-${index}`,
      }));
    } catch (aiError) {
      console.error("AI unavailable; local scan completed:", aiError);
      setErr("Local scan completed. AI analysis is temporarily unavailable.");
    }

    // 4. Combine findings
    const allFindings = [...localFindings, ...aiIssues];

    const uniqueFindings = allFindings.filter(
      (item, index, arr) =>
        arr.findIndex(
          other =>
            other.issue.toLowerCase() === item.issue.toLowerCase()
        ) === index
    );

    const combinedScan = {
      ...scan,
      findings: uniqueFindings,
      score: scoreOf(uniqueFindings),
      aiResult,
      brand_id: aiResult?.brand_id || scan.brand_id || null,
    };

    await updateScan(combinedScan);
    setRes(combinedScan);

    console.log("Scanner completed and saved:", combinedScan);
  } catch (error) {
    console.error("Scanner failed:", error);
    setErr(error.message || "Scanner failed. Please try again.");
  } finally {
    setBusy(false);
  }
};


  return <Page title="AI Content Scanner" sub="Paste or upload content, select a content type, run a compliance scan and review highlighted problems.">

    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><input className={inp} placeholder="Content title" value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" /><select className={inp} value={type} onChange={e => setType(e.target.value)} aria-label="Content type">{types.map(t => <option key={t}>{t}</option>)}</select></div>
      <textarea className={inp} rows={7} placeholder="Paste your content here…" value={text} onChange={e => setText(e.target.value)} aria-label="Content" />
      {err && <ErrorBox msg={err} />}
      <div className="flex flex-wrap items-center gap-3"><button className={btn} disabled={busy} onClick={run}>{busy ? 'Scanning…' : 'Run compliance scan'}</button><label className={`${ghost} cursor-pointer`}>Upload .txt / .md<input type="file" accept=".txt,.md,text/plain" hidden onChange={file} /></label></div>
    </Card>
    {busy && <div className="mt-4"><Skel /></div>}

{res && !busy && (
  <Card className="mt-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl text-white">
        Scan complete: score {res.score}%
      </h2>
      <button className={ghost} onClick={() => go('detail', res.id)}>
        Open details
      </button>
    </div>

    <p className="mt-2 text-sm">
      Local rules and AI analysis results
    </p>

    <p className="mt-4 leading-relaxed text-white">
      <Hl text={res.text} findings={res.findings} />
    </p>

    {res.findings.length ? (
      <ul className="mt-4 space-y-3">
        {res.findings.map((f, i) => (
          <li key={f.id || i} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge s={f.sev} />
              <span className="text-sm">{f.cat}</span>
            </div>
            <p className="mt-2 text-white">{f.issue}</p>
            <p className="mt-1">Recommended fix: {f.fix}</p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-4 text-white">
        No issues detected by local rules or AI analysis.
      </p>
    )}

    {res.aiResult && (
      <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-lg text-white">AI Analysis</h3>

        <p>Detected tone: {res.aiResult.tone}</p>
        <p>Clarity score: {res.aiResult.clarity_score}/100</p>
        <p>Brand alignment: {res.aiResult.brand_alignment_score}/100</p>

        <div className="mt-4 rounded-lg border border-white/10 p-3">
          <h4 className="text-white">Claim Detective · Evidence review</h4>
          <p className="mt-1 text-sm">Claims are checked against retrieved approved brand knowledge. Missing evidence means needs verification, not automatically false.</p>
          {res.aiResult.claim_assessments?.length ? (
            <ul className="mt-3 space-y-3">
              {res.aiResult.claim_assessments.map((assessment, i) => {
                const verdict = assessment.verdict || 'needs_verification';
                const label = { supported: 'Supported by evidence', contradicted: 'Contradicted by evidence', needs_verification: 'Needs verification', not_assessed: 'Not assessed' }[verdict] || 'Needs verification';
                const sources = (res.aiResult.knowledge_sources_used || []).filter(source => (assessment.evidence_ids || []).includes(source.id));
                return <li key={`${assessment.claim || 'claim'}-${i}`} className="rounded-lg bg-white/5 p-3">
                  <div className="flex flex-wrap items-center gap-2"><Badge s={verdict === 'supported' ? 'Low' : verdict === 'contradicted' ? 'High' : 'Medium'} /><span className="text-sm text-white">{label}</span></div>
                  <p className="mt-2 text-white">{assessment.claim}</p>
                  <p className="mt-1 text-sm">{assessment.explanation}</p>
                  {sources.length > 0 && <div className="mt-2"><p className="text-xs uppercase tracking-wide">Retrieved approved evidence</p><ul className="mt-1 space-y-1">{sources.map(source => <li key={source.id} className="text-sm text-white">{source.title} <span className="text-xs">({source.type || 'knowledge'}{source.source_document ? ` · ${source.source_document}` : ''}{source.page_number ? ` · page ${source.page_number}` : ''})</span>{source.source_url && <> · <a className="underline" href={source.source_url} target="_blank" rel="noreferrer">Source reference</a></>}{source.matched_passage && <blockquote className="mt-1 border-l-2 border-signal/70 pl-2 text-xs text-silver">“{source.matched_passage}”</blockquote>}{typeof source.retrieval_score === 'number' && <span className="ml-1 text-xs text-silver">· retrieval rank {source.retrieval_score} (not confidence)</span>}</li>)}</ul></div>}
                  {!sources.length && <p className="mt-2 text-sm">No matching approved evidence was retrieved for this claim.</p>}
                </li>;
              })}
            </ul>
          ) : <p className="mt-3 text-sm">No likely factual claims were identified for separate evidence review.</p>}
        </div>

        {(res.aiResult.knowledge_sources_used || []).length > 0 && <div className="mt-3"><h4 className="text-white">Approved knowledge used</h4><ul className="mt-2 list-disc space-y-1 pl-5">{res.aiResult.knowledge_sources_used.map(source => <li key={source.id} className="text-sm">{source.title} · {source.type || 'knowledge entry'}{source.source_document ? ` · ${source.source_document}` : ''}{source.page_number ? ` · page ${source.page_number}` : ''}</li>)}</ul></div>}

        {res.aiResult.suggestions?.length > 0 && (
          <>
            <h4 className="text-white">AI Suggestions</h4>
            <ul className="list-disc space-y-1 pl-5">
              {res.aiResult.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </>
        )}

        <h4 className="text-white">Suggested improved content</h4>
        <p className="rounded-lg bg-white/5 p-3 text-white">
          {res.aiResult.improved_content}
        </p>
      </div>
    )}
  </Card>
)}

  </Page>
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
  const [pick, setPick] = useState(sel || (scans[0] && scans[0].id)); const [draft, setDraft] = useState(null); const [saving, setSaving] = useState(false); const [actionError, setActionError] = useState("")
  const s = scans.find(x => x.id === pick)
  if (!s) return <Page title="Review & Approval"><Empty title="Nothing to review" hint="Scan content first." action={<button className={btn} onClick={() => go('scanner')}>Scan content</button>} /></Page>
  const sug = draft ?? fixed(s.text, s.findings), high = s.findings.some(f => f.sev === 'High')
  const perform = async (action) => {
    setSaving(true); setActionError("");
    try { await action(); } catch (error) { setActionError(error.message || "Could not save this change. Check your connection and try again."); } finally { setSaving(false); }
  }
  return <Page title="Review & Approval" sub="Edit suggestions, accept changes, send for review, approve or reject content. Nothing is published automatically.">
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">{scans.map(x => <button key={x.id} onClick={() => { setPick(x.id); setDraft(null) }} className={`w-full rounded-xl border p-3 text-left ${x.id === pick ? 'border-signal bg-signal/10' : 'border-white/10 bg-char/80'}`}><p className="text-white">{x.title}</p><p className="text-sm">{x.status}</p></button>)}</div>
      <Card><div className="flex items-center justify-between"><h2 className="text-xl text-white">{s.title}</h2><span>{s.status}</span></div>
        <p className="mt-4">Original</p><p className="text-white"><Hl text={s.text} findings={s.findings} /></p>
        <p className="mt-4">Suggested revision (editable)</p><textarea className={inp} rows={4} value={sug} onChange={e => setDraft(e.target.value)} />
        {high && <p className="mt-3 text-signal">High-severity issues remain. Accept changes before approving.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button className={btn} disabled={saving} onClick={() => perform(async () => { await applyFix(s.id, sug); setDraft(null); })}>Accept changes</button>
          <button className={ghost} disabled={saving} onClick={() => perform(() => setStatus(s.id, 'In review'))}>Send for review</button>
          <button className={ghost} disabled={saving || high} onClick={() => perform(() => setStatus(s.id, 'Approved'))}>Approve</button>
          <button className={ghost} disabled={saving} onClick={() => perform(() => setStatus(s.id, 'Rejected'))}>Reject</button></div>
        {saving && <p className="mt-3 text-sm">Saving to your account…</p>}
        {actionError && <p role="alert" className="mt-3 text-sm text-red-300">{actionError}</p>}</Card></div>
  </Page>
}

export function Analytics() {
  const { scans, audit } = useContext(Ctx); const ok = useLoad()
  if (!ok) return <Skel />
  const avg = Math.round(scans.reduce((n, s) => n + (Number(s.score) || 0), 0) / (scans.length || 1));
  const pass = scans.length ? Math.round(100 * scans.filter(s => (Number(s.score) || 0) >= 85).length / scans.length) : 0;
  // Use persisted scans only; no fabricated historical weeks.
  const trend = [...scans].slice(0, 5).reverse().map((scan) => ({ label: scan.date || 'Scan', score: Number(scan.score) || 0 }));
  const count = {};
  scans.forEach((scan) => (scan.findings || []).forEach((finding) => {
    const issue = finding.issue || finding.cat || 'Other issue';
    count[issue] = (count[issue] || 0) + 1;
  }));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const correctionEvents = [...new Set(audit.filter(item => item.action === "Accepted changes").map(item => item.detail).filter(Boolean))].length;
  const correctionRate = scans.length ? Math.round(100 * Math.min(correctionEvents, scans.length) / scans.length) : 0;
  const reviewDurations = scans.map(scan => {
    const start = Date.parse(scan.createdAt || "");
    const end = Date.parse(scan.approvalUpdatedAt || "");
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 60000 : null;
  }).filter(value => value !== null);
  const averageReviewMinutes = reviewDurations.length ? Math.round(reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length) : null;
  const exportReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Scans analyzed", scans.length],
      ["Average compliance score", `${avg}%`],
      ["Pass rate (score 85%+)", `${pass}%`],
      ["Distinct corrected content items", correctionEvents],
      ["Correction rate (approximate)", `${correctionRate}%`],
      ["Average review time in minutes", averageReviewMinutes ?? "Not enough timestamp data"],
      [],
      ["Recurring violation", "Count"],
      ...top.map(([issue, total]) => [issue, total]),
      [],
      ["Scan title", "Date", "Status", "Score", "Finding count"],
      ...scans.map(scan => [scan.title || "", scan.date || "", scan.status || "", Number(scan.score) || 0, (scan.findings || []).length])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\\r\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "axion-compliance-report.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <Page title="Reports & Analytics" sub="Compliance trends, recurring violations, correction signals and review timing from saved workspace data.">
    <div className="mb-4 flex justify-end"><button className={btn} onClick={exportReport} disabled={!scans.length}>Export compliance report (CSV)</button></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-4 text-lg text-white">Compliance trend</h2>
        {trend.length ? <>
          <div className="h-56 w-full" role="img" aria-label="Compliance score trend across your latest saved scans">
            <svg viewBox="0 0 500 180" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              {[0, 25, 50, 75, 100].map(level => <g key={level}><line x1="28" x2="492" y1={155 - level * 1.35} y2={155 - level * 1.35} stroke="rgba(255,255,255,.12)" strokeDasharray="3 4" /><text x="2" y={159 - level * 1.35} fill="rgba(255,255,255,.65)" fontSize="10">{level}</text></g>)}
              {trend.length > 1 && <polyline fill="none" stroke="#E10600" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={trend.map((item, i) => `${32 + i * (456 / (trend.length - 1))},${155 - Math.max(0, Math.min(100, item.score)) * 1.35}`).join(' ')} />}
              {trend.map((item, i) => { const x = trend.length === 1 ? 250 : 32 + i * (456 / (trend.length - 1)); const y = 155 - Math.max(0, Math.min(100, item.score)) * 1.35; return <g key={`${item.label}-${i}`}><circle cx={x} cy={y} r="4" fill="#E10600" stroke="#fff" strokeWidth="1.5"/><text x={x} y={Math.max(10, y - 10)} fill="#fff" fontSize="11" textAnchor="middle">{item.score}%</text></g> })}
            </svg>
          </div>
          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}>{trend.map((item, i) => <p key={`${item.label}-label-${i}`} className="truncate text-center text-xs" title={item.label}>{item.label}</p>)}</div>
        </> : <p className="py-12 text-center text-sm">Run and save a compliance scan to see your trend here.</p>}
      </Card>
      <Card><h2 className="mb-4 text-lg text-white">Pass rate (score 85%+)</h2><p className="text-5xl font-light text-white">{pass}%</p><div className="mt-4 h-2 rounded bg-white/10"><div className="h-2 rounded bg-signal" style={{ width: `${pass}%` }} /></div><p className="mt-3">{scans.length} scans · average score {avg}%</p></Card>
      <Card><h2 className="mb-2 text-lg text-white">Correction signal</h2><p className="text-4xl text-white">{correctionRate}%</p><p className="mt-1 text-sm">Approximate rate from distinct content items with an “Accepted changes” audit event. This is not proof that every issue was resolved.</p></Card>
      <Card><h2 className="mb-2 text-lg text-white">Average review time</h2><p className="text-4xl text-white">{averageReviewMinutes === null ? "N/A" : `${averageReviewMinutes} min`}</p><p className="mt-1 text-sm">Calculated only for scans with valid creation and approval timestamps.</p></Card>
      <Card className="lg:col-span-2"><h2 className="mb-3 text-lg text-white">Recurring violations</h2>{top.length ? <ul className="space-y-2">{top.map(([k, n]) => <li key={k} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span className="text-white">{k}</span><span>{n}×</span></li>)}</ul> : <p>No violations recorded.</p>}</Card>
    </div></Page>
}

export function Audit() {
  const { audit, q } = useContext(Ctx);
  const ok = useLoad();
  const [actionFilter, setActionFilter] = useState("All actions");
  const [localSearch, setLocalSearch] = useState("");
  if (!ok) return <Skel />;

  const actions = ["All actions", ...new Set(audit.map(item => item.action).filter(Boolean))];
  const queryText = `${q || ""} ${localSearch}`.trim().toLowerCase();
  const records = [...audit]
    .filter(item => actionFilter === "All actions" || item.action === actionFilter)
    .filter(item => `${item.who || ""} ${item.action || ""} ${item.detail || ""} ${item.before || ""} ${item.after || ""}`.toLowerCase().includes(queryText))
    .sort((a, b) => auditTimestamp(b) - auditTimestamp(a));

  return <Page title="Audit History" sub="A searchable record of scans, edits, corrections and approval decisions.">
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Card className="!p-4"><p className="text-sm">Total events</p><p className="mt-1 text-2xl font-semibold text-white">{audit.length}</p></Card>
      <Card className="!p-4"><p className="text-sm">Matching events</p><p className="mt-1 text-2xl font-semibold text-white">{records.length}</p></Card>
      <Card className="!p-4"><p className="text-sm">Event types</p><p className="mt-1 text-2xl font-semibold text-white">{Math.max(0, actions.length - 1)}</p></Card>
    </div>
    <Card className="mb-4 !p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input className={inp} value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder="Search people, actions or details" aria-label="Search audit history" />
        <select className={inp} value={actionFilter} onChange={e => setActionFilter(e.target.value)} aria-label="Filter by action">
          {actions.map(action => <option key={action} value={action}>{action}</option>)}
        </select>
        <button className={ghost} onClick={() => { setLocalSearch(""); setActionFilter("All actions"); }} type="button">Clear filters</button>
      </div>
      {q && <p className="mt-2 text-xs text-silver">Global search is also applied: “{q}”.</p>}
    </Card>
    {records.length ? <ol className="space-y-3 border-l border-white/15 pl-5">
      {records.map((item, index) => <li key={item.id || `${item.action || "event"}-${auditTimestamp(item)}-${index}`} className="relative">
        <span className="absolute -left-[25px] top-5 h-3 w-3 rounded-full border-2 border-signal bg-ink" aria-hidden="true" />
        <Card className="!p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-semibold text-white">{item.action || "Activity recorded"}</p><p className="mt-1 break-words">{item.detail || "No additional details were saved."}</p></div>
            <Badge>{item.action || "Event"}</Badge>
          </div>
          <p className="mt-3 text-xs text-silver">{item.who || "Unknown user"} <span aria-hidden="true">·</span> {auditDateLabel(item)}</p>
          {(item.before || item.after) && <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 text-sm md:grid-cols-2">
            {item.before && <div><p className="mb-1 font-semibold text-white">Before</p><p className="whitespace-pre-wrap break-words">{item.before}</p></div>}
            {item.after && <div><p className="mb-1 font-semibold text-white">After</p><p className="whitespace-pre-wrap break-words">{item.after}</p></div>}
          </div>}
        </Card>
      </li>)}
    </ol> : <Empty title={audit.length ? "No matching records" : "No audit records yet"} hint={audit.length ? "Try a different search term or clear the action filter." : "Scans, edits and approval decisions will appear here when recorded."} />}
  </Page>
}

function auditTimestamp(item) {
  const createdAt = item?.createdAt;
  if (typeof createdAt?.toMillis === "function") return createdAt.toMillis();
  if (typeof createdAt?.seconds === "number") return createdAt.seconds * 1000;
  const value = item?.timestamp ?? item?.t ?? item?.date;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function auditDateLabel(item) {
  const timestamp = auditTimestamp(item);
  return timestamp ? new Date(timestamp).toLocaleString() : (item?.t || "Time not recorded");
}


export function Settings() {
  const { members, setMembers, user, log, page } = useContext(Ctx);
  const ok = useLoad();


const [ws, setWs] = useState({
  name: "AXION Workspace",
  org: "",
  website: "",
  tone: "Professional",
  audience: "",
  rules: "Use consistent brand messaging. Verify facts before publishing. Avoid misleading claims."
});
const [saved, setSaved] = useState(false);
const [pref, setPref] = useState({ scan: true, approval: true });
const [profileLoading, setProfileLoading] = useState(true);
const [profileError, setProfileError] = useState("");
const [kbBrands, setKbBrands] = useState([]);
const [kbBrandId, setKbBrandId] = useState("");
const [kbEntries, setKbEntries] = useState([]);
const [kbLoading, setKbLoading] = useState(false);
const [kbError, setKbError] = useState("");
const [kbNotice, setKbNotice] = useState("");
const [kbQuery, setKbQuery] = useState("");
const [kbStatusFilter, setKbStatusFilter] = useState("all");
const [kbDraft, setKbDraft] = useState({ title: "", type: "fact", content: "", source_url: "", tags: "" });
const [kbUploadBusy, setKbUploadBusy] = useState(false);

useEffect(() => {
  if (page === 'branddna') {
    // Jump directly to the document and knowledge controls from the dedicated sidebar item.
    window.setTimeout(() => {
      document.getElementById('brand-dna-knowledge-base')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }
}, [page]);

useEffect(() => {
  let active = true;
  listBrands().then(brands => {
    if (!active) return;
    setKbBrands(brands);
    const matching = brands.find(item => item.owner_uid === user?.uid) || brands[0];
    if (matching?.id) setKbBrandId(matching.id);
  }).catch(error => {
    if (active) setKbError(`Could not load backend brands: ${error.message}`);
  });
  return () => { active = false; };
}, [user?.uid]);

useEffect(() => {
  if (!kbBrandId) { setKbEntries([]); return; }
  let active = true;
  setKbLoading(true);
  setKbError("");
  listKnowledge(kbBrandId).then(entries => { if (active) setKbEntries(entries); })
    .catch(error => { if (active) setKbError(`Could not load knowledge entries: ${error.message}`); })
    .finally(() => { if (active) setKbLoading(false); });
  return () => { active = false; };
}, [kbBrandId]);


useEffect(() => {
  if (!user?.uid) {
    setProfileLoading(false);
    return;
  }

  let active = true;

  loadCompanyProfile(user.uid)
    .then(profile => {
      if (active && profile) {
        setWs(prev => ({ ...prev, ...profile }));
        if (Array.isArray(profile.members)) setMembers(profile.members);
      }
    })
    .catch(error => {
      console.error("Profile load failed:", error);
      if (active) setProfileError("Could not load company profile.");
    })
    .finally(() => {
      if (active) setProfileLoading(false);
    });

  return () => {
    active = false;
  };
}, [user?.uid]);


  if (!ok) return <Skel />;

  const updateWs = (key, value) => {
    setWs(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <Page
      title="Company Profile"
      sub="Manage your company identity, team and preferences."
    >
      <div className="grid gap-4 lg:grid-cols-2">

        <Card>
          <h2 className="mb-3 text-lg text-white">Company Information</h2>

          <div className="space-y-3">
            <input
              className={inp}
              placeholder="Company name"
              value={ws.name}
              onChange={e => updateWs("name", e.target.value)}
            />

            <input
              className={inp}
              placeholder="Organisation details"
              value={ws.org}
              onChange={e => updateWs("org", e.target.value)}
            />

            <input
              className={inp}
              placeholder="Company website"
              value={ws.website}
              onChange={e => updateWs("website", e.target.value)}
            />

            <input
              className={inp}
              placeholder="Target audience"
              value={ws.audience}
              onChange={e => updateWs("audience", e.target.value)}
            />
          </div>

          <button
  className={`${btn} mt-3`}
  disabled={profileLoading}
  onClick={async () => {
    try {
      setSaved(false);
      setProfileError("");

      await saveCompanyProfile(user.uid, ws);

      log("Updated company profile", ws.name);
      setSaved(true);
    } catch (error) {
      console.error("Profile save failed:", error);
      setProfileError("Save failed. Please try again.");
    }
  }}
>
  {profileLoading ? "Loading..." : "Save Profile"}
</button>

{saved && <p className="mt-2 text-sm text-green-400">Company profile saved successfully!</p>}

{profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}



        </Card>


        <Card>
          <h2 className="mb-3 text-lg text-white">Preferences</h2>

          {[
            ["scan", "Notify me when a scan completes"],
            ["approval", "Notify me about approval requests"]
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 py-2 text-white"
            >
              {label}
              <input
                type="checkbox"
                className="h-5 w-5 accent-red-600"
                checked={pref[key]}
                onChange={e =>
                  setPref(prev => ({ ...prev, [key]: e.target.checked }))
                }
              />
            </label>
          ))}
        </Card>

        <Card className="lg:col-span-2">
          <div id="brand-dna-knowledge-base" className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg text-white">Brand DNA · Approved Knowledge Base</h2>
              <p className="mt-1 text-sm">Store verified facts, terminology, guidelines, references and asset notes. Only approved entries are passed to AI analysis.</p>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs">{kbEntries.filter(entry => entry.status === "approved").length} approved</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">Backend brand
              <select className={`${inp} mt-1`} value={kbBrandId} onChange={e => setKbBrandId(e.target.value)}>
                <option value="">Select a brand</option>
                {kbBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Search knowledge
              <input className={`${inp} mt-1`} value={kbQuery} onChange={e => setKbQuery(e.target.value)} placeholder="Search title, text or tags" />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-signal/50 bg-signal/[0.04] p-4">
            <h3 className="font-medium text-white">Upload and extract a document</h3>
            <p className="mt-1 text-sm">TXT, Markdown, PDF, Word (.docx), or an image. Maximum 10 MB. Extracted text is saved as a Draft, never auto-approved.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className={`${ghost} cursor-pointer ${(!kbBrandId || kbUploadBusy) ? "pointer-events-none opacity-50" : ""}`}>
                {kbUploadBusy ? "Extracting…" : "Choose document"}
                <input type="file" className="hidden" disabled={!kbBrandId || kbUploadBusy} accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp" onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) { setKbError("File is larger than the 10 MB upload limit."); return; }
                  setKbUploadBusy(true); setKbError(""); setKbNotice("");
                  try {
                    const result = await uploadKnowledgeDocument(kbBrandId, file);
                    setKbEntries(await listKnowledge(kbBrandId));
                    setKbNotice(`${result.message} Extracted ${result.entry?.content?.length || 0} characters from ${file.name}.`);
                    log("Uploaded knowledge document", file.name);
                  } catch (error) { setKbError(error.message || "Document extraction failed."); }
                  finally { setKbUploadBusy(false); }
                }} />
              </label>
              <span className="text-xs text-silver">PDF text extraction and image OCR depend on backend packages. Scanned PDFs and images also require Tesseract OCR installed on the backend machine.</span>
            </div>
          </div>

          <form className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4" onSubmit={async e => {
            e.preventDefault(); setKbError(""); setKbNotice("");
            if (!kbBrandId) { setKbError("Select a backend brand first. The brand must exist in the backend."); return; }
            try {
              const payload = { ...kbDraft, tags: kbDraft.tags.split(",").map(tag => tag.trim()).filter(Boolean), status: "draft" };
              await createKnowledge(kbBrandId, payload);
              setKbDraft({ title: "", type: "fact", content: "", source_url: "", tags: "" });
              setKbEntries(await listKnowledge(kbBrandId));
              setKbNotice("Knowledge entry saved as Draft. Approve it after verifying the source.");
              log("Added knowledge entry", payload.title);
            } catch (error) { setKbError(error.message); }
          }}>
            <h3 className="font-medium text-white">Add knowledge entry</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inp} required maxLength={160} placeholder="Title (e.g. Refund policy)" value={kbDraft.title} onChange={e => setKbDraft(prev => ({ ...prev, title: e.target.value }))} />
              <select className={inp} value={kbDraft.type} onChange={e => setKbDraft(prev => ({ ...prev, type: e.target.value }))}>
                <option value="fact">Verified fact</option><option value="terminology">Terminology</option><option value="guideline">Brand guideline</option><option value="reference">Reference</option><option value="asset">Brand asset</option>
              </select>
            </div>
            <textarea className={`${inp} min-h-24`} required maxLength={6000} placeholder="Knowledge content. Be specific and include dates or conditions when relevant." value={kbDraft.content} onChange={e => setKbDraft(prev => ({ ...prev, content: e.target.value }))} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inp} type="url" placeholder="Source URL (optional)" value={kbDraft.source_url} onChange={e => setKbDraft(prev => ({ ...prev, source_url: e.target.value }))} />
              <input className={inp} placeholder="Tags, separated by commas" value={kbDraft.tags} onChange={e => setKbDraft(prev => ({ ...prev, tags: e.target.value }))} />
            </div>
            <div><button className={btn} type="submit" disabled={!kbBrandId}>Save as Draft</button></div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm">Filter status:</span>
            {[["all", "All"], ["draft", "Draft"], ["approved", "Approved"], ["archived", "Archived"]].map(([value, label]) => <button key={value} className={`rounded-full border px-3 py-1 text-sm ${kbStatusFilter === value ? "border-signal bg-signal/20 text-white" : "border-white/15 text-silver"}`} onClick={() => setKbStatusFilter(value)} type="button">{label}</button>)}
          </div>
          {kbError && <p className="mt-3 text-sm text-red-300">{kbError}</p>}
          {kbNotice && <p className="mt-3 text-sm text-green-300">{kbNotice}</p>}
          {kbLoading ? <p className="mt-4 text-sm">Loading knowledge library…</p> : (() => {
            const visible = kbEntries.filter(entry => (kbStatusFilter === "all" || entry.status === kbStatusFilter) && (!kbQuery || `${entry.title} ${entry.content} ${(entry.tags || []).join(" ")}`.toLowerCase().includes(kbQuery.toLowerCase())));
            return visible.length ? <div className="mt-4 space-y-3">{visible.map(entry => <article key={entry.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium text-white">{entry.title}</h4><span className="rounded-full border border-white/15 px-2 py-0.5 text-xs">{entry.type}</span><span className={`rounded-full px-2 py-0.5 text-xs ${entry.status === "approved" ? "bg-green-500/15 text-green-300" : entry.status === "archived" ? "bg-white/10 text-silver" : "bg-amber-500/15 text-amber-200"}`}>{entry.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p>{entry.source_url && <a className="mt-2 block break-all text-sm text-sky-300 underline" href={entry.source_url} target="_blank" rel="noreferrer">{entry.source_url}</a>}{entry.tags?.length > 0 && <p className="mt-2 text-xs text-silver">Tags: {entry.tags.join(", ")}</p>}</div>
              <div className="flex shrink-0 flex-wrap gap-2">{entry.status !== "approved" && <button type="button" className={ghost} onClick={async () => { try { await updateKnowledge(kbBrandId, entry.id, { status: "approved" }); setKbEntries(await listKnowledge(kbBrandId)); setKbNotice(`Approved “${entry.title}”.`); setKbError(""); } catch (error) { setKbError(error.message); } }}>Approve</button>}{entry.status === "approved" && <button type="button" className={ghost} onClick={async () => { try { await updateKnowledge(kbBrandId, entry.id, { status: "draft" }); setKbEntries(await listKnowledge(kbBrandId)); setKbNotice(`Moved “${entry.title}” back to Draft.`); } catch (error) { setKbError(error.message); } }}>Unapprove</button>}<button type="button" className={ghost} onClick={async () => { if (!window.confirm(`Delete “${entry.title}”?`)) return; try { await deleteKnowledge(kbBrandId, entry.id); setKbEntries(await listKnowledge(kbBrandId)); setKbNotice("Knowledge entry deleted."); } catch (error) { setKbError(error.message); } }}>Delete</button></div></div>
            </article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-sm">{kbBrandId ? "No entries match this filter yet. Add a knowledge entry above." : "No backend brand selected. Create/configure a brand in the backend, then select it here."}</p>;
          })()}
          <p className="mt-4 text-xs text-silver">Important: approval is a human decision. Verify the source and its date before approving. Keyword matching is used to retrieve relevant entries; this is not semantic vector search yet.</p>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-lg text-white">
            Team Members and Roles
          </h2>

          {members.length ? <ul className="divide-y divide-white/10">
            {members.map(([name, role], i) => (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <span className="text-white">
                  {name}{name === user?.name && " (you)"}
                </span>

                <select
                  className={`${inp} !w-auto`}
                  value={role}
                  aria-label={`Role for ${name}`}
                  onChange={e => {
                    const newRole = e.target.value;
                    const nextMembers = members.map((member, index) =>
                      index === i ? [name, newRole] : member
                    );
                    setMembers(nextMembers);
                    saveCompanyProfile(user.uid, { members: nextMembers }).catch(error => {
                      console.error("Team roster save failed:", error);
                      setProfileError("Team change could not be saved. Please retry.");
                    });
                    log("Changed role", `${name} → ${newRole}`);
                  }}
                >
                  {Object.keys(roles).map(roleName => (
                    <option key={roleName} value={roleName}>
                      {roleName}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul> : <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm">No team members added yet. Add your real team members below; sample members are not preloaded.</p>}

          <AddRow
            ph={["New member name"]}
            onAdd={([name]) => {
              if (!name?.trim()) return;
              const nextMembers = [...members, [name.trim(), "Editor"]];
              setMembers(nextMembers);
              saveCompanyProfile(user.uid, { members: nextMembers }).catch(error => {
                console.error("Team roster save failed:", error);
                setProfileError("Team member could not be saved. Please retry.");
              });
              log("Added member", name.trim());
            }}
          />

          <h3 className="mb-2 mt-5 text-white">Permissions</h3>

          <ul className="space-y-1 text-sm">
            {Object.entries(roles).map(([role, permissions]) => (
              <li key={role}>
                <b className="text-white">{role}:</b> {permissions}
              </li>
            ))}
          </ul>
        </Card>

      </div>
    </Page>
  );
}


export function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setBusy(true);

    try {
      let credential;

      if (mode === "signup") {
        credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      } else {
        credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      }

      onLogin({
        uid: credential.user.uid,
        name:
          credential.user.displayName ||
          name.trim() ||
          email.split("@")[0],
        email: credential.user.email,
      });
    } catch (err) {
      const messages = {
        "auth/email-already-in-use": "This email is already registered. Please log in.",
        "auth/invalid-email": "Please enter a valid email.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Console.",
      };

      setError(
        messages[err.code] ||
        err.message ||
        "Authentication failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white">AXION AI</h1>
        <p className="mb-6 mt-2">
          {mode === "login"
            ? "Sign in to your brand governance workspace."
            : "Create your Axion AI account."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <input
              className={inp}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            className={inp}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className={inp}
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button className={`${btn} w-full`} disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-sm">
          {mode === "login"
            ? "New to Axion AI?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-white underline"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Log in"}
          </button>
        </p>
      </Card>
    </main>
  );
}
export function Home() {
  const { go, user, scans } = useContext(Ctx);

  return (
    <Page
      title={`Welcome to Axion AI, ${user?.name || "User"}`}
      sub="Protect your brand identity with AI-powered compliance."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-xl text-white">Brand Compliance</h2>
          <p className="mt-2">Check content against your brand standards.</p>
          <button className={`${btn} mt-4`} onClick={() => go("scanner")}>
            Start a Scan
          </button>
        </Card>

        <Card>
          <h2 className="text-xl text-white">Your Workspace</h2>
          <p className="mt-2">{scans.length} scans completed or saved.</p>
          <button className={`${btn} mt-4`} onClick={() => go("dashboard")}>
            Open Dashboard
          </button>
        </Card>

        <Card>
          <h2 className="text-xl text-white">Company Profile</h2>
          <p className="mt-2">Manage your company information and preferences.</p>
          <button className={`${btn} mt-4`} onClick={() => go("settings")}>
            Open Settings
          </button>
        </Card>
      </div>
    </Page>
  );
}

export function VisualBrandCheck() {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => { let active = true; listBrands().then(items => { if (!active) return; setBrands(items); if (items[0]?.id) setBrandId(items[0].id); }).catch(e => { if (active) setError(`Could not load brands: ${e.message}`); }); return () => { active = false; }; }, []);
  const run = async () => {
    if (!brandId) { setError("Select a backend brand first."); return; }
    if (!file) { setError("Choose a visual asset first."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image exceeds the 10 MB limit."); return; }
    setBusy(true); setError(""); setResult(null);
    try { setResult(await checkVisualBrand(brandId, file)); } catch (e) { setError(e.message || "Visual check failed."); } finally { setBusy(false); }
  };
  return <Page title="Visual Brand Check" sub="Review logos and creative assets for palette, logo treatment, readability and visual consistency.">
    <Card>
      <h2 className="text-lg text-white">Analyze a visual asset</h2>
      <p className="mt-1 text-sm">Upload a logo, social creative, banner, ad, or a screenshot of a branded document. Gemini vision checks the image against the selected brand profile.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">Backend brand<select className={`${inp} mt-1`} value={brandId} onChange={e => setBrandId(e.target.value)}><option value="">Select a brand</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="text-sm">Visual asset<input className={`${inp} mt-1`} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(""); }} /></label>
      </div>
      {file && <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 p-3"><img src={URL.createObjectURL(file)} alt="Selected asset preview" className="h-20 w-20 rounded-lg object-contain bg-white/5"/><div className="min-w-0"><p className="truncate text-sm text-white">{file.name}</p><p className="text-xs text-silver">{(file.size / 1024).toFixed(1)} KB · image preview</p></div></div>}
      <button className={`${btn} mt-4`} disabled={busy || !brandId || !file} onClick={run}>{busy ? "Analyzing visual asset…" : "Run visual brand check"}</button>
      {error && <ErrorBox msg={error} />}
    </Card>
    {result && <div className="mt-4 space-y-4">
      <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-silver">Visual brand score</p><p className="mt-1 text-4xl text-white">{result.score}<span className="text-lg text-silver">/100 AI advisory</span></p><p className="mt-1 text-xs text-silver">Rule-based checks: {result.rule_based_score ?? "N/A"}/100 · {result.image_dimensions ? `${result.image_dimensions.width}×${result.image_dimensions.height}` : "dimensions unavailable"} · exact logo: {result.logo_match_status || "not verified"}</p></div><span className={`rounded-full border px-3 py-1 text-sm ${result.overall_status === 'Pass' ? 'border-green-500/50 text-green-300' : result.overall_status === 'Fail' ? 'border-red-500/50 text-red-300' : 'border-amber-500/50 text-amber-200'}`}>{result.overall_status}</span></div><p className="mt-3 text-white">{result.summary}</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[["Logo treatment", result.logo_check],["Brand palette",result.palette_check],["Readability",result.readability_check]].map(([title, body]) => <div key={title} className="rounded-xl border border-white/10 p-3"><p className="mb-1 font-medium text-white">{title}</p><p className="text-sm">{body}</p></div>)}</div><div className="mt-4"><p className="mb-2 text-sm text-silver">Detected dominant colours</p><div className="flex flex-wrap gap-2">{(result.sampled_dominant_colors || result.dominant_colors || []).map((color,i) => <span key={`${color}-${i}`} className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-xs"><span className="h-5 w-5 rounded" style={{backgroundColor: color}} />{color}</span>)}</div></div></Card>
      {result.deterministic_findings?.length > 0 && <Card><h2 className="text-lg text-white">Deterministic checks</h2><p className="mt-1 text-xs text-silver">These are measurable heuristics, separate from the AI opinion.</p><div className="mt-3 space-y-3">{result.deterministic_findings.map((item,i) => <div key={i} className="rounded-xl border border-white/10 p-3"><p className="text-white">{item.category} · {item.severity}</p><p className="mt-1 text-sm">{item.observation}</p><p className="mt-1 text-sm text-signal">Recommendation: {item.recommendation}</p></div>)}</div></Card>}
      <Card><h2 className="text-lg text-white">Findings and recommendations</h2>{result.findings?.length ? <div className="mt-3 space-y-3">{result.findings.map((item,i) => <div key={i} className="rounded-xl border border-white/10 p-3"><div className="flex flex-wrap gap-2"><span className="text-white">{item.category || "Visual consistency"}</span><span className="text-xs text-silver">{item.severity || "Review"}</span></div><p className="mt-1 text-sm">{item.observation}</p><p className="mt-1 text-sm text-signal">Recommendation: {item.recommendation}</p></div>)}</div> : <p className="mt-2 text-sm">No specific findings were returned. Review the asset before publishing.</p>}<p className="mt-4 text-xs text-silver">{(result.limitations || []).join(" ")}</p></Card>
    </div>}
  </Page>;
}
