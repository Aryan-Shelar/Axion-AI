import { createContext } from 'react'
export const Ctx = createContext()
export const nav = [['dashboard','Dashboard','▦'],['scanner','AI Content Scanner','◎'],['compliance','Compliance Results','⚑'],['approval','Review & Approval','✔'],['analytics','Reports & Analytics','▥'],['audit','Audit History','↺'],['branddna','Brand DNA & Documents','📄'],['visualcheck','Visual Brand Check','🎨'],['settings','Team & Settings','⚙']]
export const types = ['Social post','Blog article','Email','Ad copy','Press release','Web page']
// Default local compliance rules used by the scanner until workspace rules are configured.
export const initRules = {
  voice: 'Clear, confident and plain-spoken. Prefer active voice and specific claims over superlatives.',
  terms: [{ avoid: 'cheap', use: 'affordable' }, { avoid: 'users', use: 'customers' }],
  prohibited: [{ phrase: 'number one', alt: 'a leading' }, { phrase: 'best results', alt: 'strong results' }, { phrase: 'guaranteed', alt: 'designed to help' }, { phrase: '100% safe', alt: 'built with safeguards' }],
  facts: ['Founded in 2021', 'Available in 12 countries', 'Support hours: 9am–6pm IST'],
  colors: [['Charcoal', '#2A2A2A'], ['Silver', '#C0C0C0'], ['Signal Red', '#E10600']],
  typography: 'Archivo: headings 600, body 400', logo: 'Keep clear space equal to the height of the A mark.',
}
export function analyze(text, r) {
  const f = [], t = text.toLowerCase()
  r.prohibited.forEach(p => t.includes(p.phrase.toLowerCase()) && f.push({ cat: 'Facts', sev: 'High', issue: `Unsupported claim: "${p.phrase}"`, fix: `Use "${p.alt}"`, from: p.phrase, to: p.alt }))
  r.terms.forEach(x => new RegExp(`\\b${x.avoid}\\b`, 'i').test(text) && f.push({ cat: 'Messaging', sev: 'Medium', issue: `Non-approved term: "${x.avoid}"`, fix: `Use "${x.use}"`, from: x.avoid, to: x.use }))
  if ((text.match(/!/g) || []).length > 2) f.push({ cat: 'Tone', sev: 'Low', issue: 'Too many exclamation marks', fix: 'Keep a calm, confident tone' })
  if (/click here/i.test(text)) f.push({ cat: 'Accessibility', sev: 'Low', issue: 'Non-descriptive link text', fix: 'Describe where the link goes', from: 'click here', to: 'read more' })
  const bad = (text.match(/#[0-9a-f]{6}/gi) || []).filter(c => !r.colors.some(k => k[1].toLowerCase() === c.toLowerCase()))
  if (bad.length) f.push({ cat: 'Visual', sev: 'Medium', issue: `Off-palette colour ${bad[0]}`, fix: 'Use a colour from the brand palette' })
  return f
}
export const fixed = (text, f) => f.reduce((s, x) => x.from && x.to ? s.replace(new RegExp(x.from, 'ig'), x.to) : s, text)
export const scoreOf = f => Math.max(40, 100 - f.reduce((n, x) => n + { High: 15, Medium: 8, Low: 3 }[x.sev], 0))
const mk = (id, title, type, author, date, status, text, r) => { const findings = analyze(text, r); return { id, title, type, author, date, status, text, findings, score: scoreOf(findings) } }
export const initScans = () => [];
export const initAudit = [];

export const initNotes = [];
// Start with no fabricated team members; users add their real team members in Settings.
export const initMembers = []
export const roles = { Admin: 'Everything, including team and settings', 'Brand manager': 'Edit guidelines, approve content', Reviewer: 'Review and approve content', Editor: 'Scan content and apply fixes' }
