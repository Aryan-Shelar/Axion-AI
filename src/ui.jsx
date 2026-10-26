import { useEffect, useState } from 'react'
export const inp = 'w-full rounded-lg border border-white/15 bg-ink/80 px-3 py-2.5 text-white placeholder:text-silver/50'
export const btn = 'rounded-full bg-signal px-5 py-2.5 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40'
export const ghost = 'rounded-full border border-white/25 px-5 py-2.5 text-white hover:bg-white/10 disabled:opacity-40'
export const sevC = { High: 'bg-signal/20 text-signal', Medium: 'bg-white/15 text-white', Low: 'bg-white/5 text-silver' }
export const Card = ({ children, className = '', ...p }) => <div {...p} className={`rounded-2xl border border-white/10 bg-char/80 p-5 backdrop-blur ${className}`}>{children}</div>
export const Page = ({ title, sub, children }) => <div><h1 className="text-3xl font-light text-white md:text-4xl">{title}</h1>{sub && <p className="mt-1 mb-6">{sub}</p>}{children}</div>
export const Badge = ({ s }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sevC[s] || 'bg-white/10 text-white'}`}>{s}</span>
export const Empty = ({ title, hint, action }) => <Card className="py-12 text-center"><p className="text-lg text-white">{title}</p><p className="mt-1">{hint}</p>{action && <div className="mt-5">{action}</div>}</Card>
export const ErrorBox = ({ msg, retry }) => <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-signal/60 bg-signal/10 p-4 text-white"><span>{msg}</span>{retry && <button onClick={retry} className={ghost}>Try again</button>}</div>
export const Skel = () => <div aria-busy className="space-y-4 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/5" />)}</div>
export const useLoad = (ms = 450) => { const [r, s] = useState(false); useEffect(() => { const t = setTimeout(() => s(true), ms); return () => clearTimeout(t) }, []); return r }
export const Hl = ({ text, findings }) => {
  const ks = [...new Set(findings.map(f => f.from).filter(Boolean))]
  if (!ks.length) return text
  return text.split(new RegExp(`(${ks.join('|')})`, 'ig')).map((p, i) => i % 2 ? <mark key={i} className="rounded bg-signal/30 px-0.5 text-white">{p}</mark> : p)
}
export function AddRow({ ph, onAdd }) {
  const [v, setV] = useState(ph.map(() => ''))
  return <form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (v[0].trim()) { onAdd(v.map(x => x.trim())); setV(ph.map(() => '')) } }}>
    {ph.map((p, i) => <input key={p} className={`${inp} flex-1 min-w-[140px]`} placeholder={p} value={v[i]} onChange={e => setV(v.map((x, k) => k === i ? e.target.value : x))} />)}
    <button className={ghost}>Add</button></form>
}
