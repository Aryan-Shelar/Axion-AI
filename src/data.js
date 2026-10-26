import { createContext } from 'react'
export const Ctx = createContext()
export const nav = [['dashboard','Dashboard','▦'],['scanner','AI Content Scanner','◎'],['guidelines','Brand Guidelines','❡'],['compliance','Compliance Results','⚑'],['approval','Review & Approval','✔'],['analytics','Reports & Analytics','▥'],['audit','Audit History','↺'],['settings','Team & Settings','⚙']]
export const types = ['Social post','Blog article','Email','Ad copy','Press release','Web page']
// Sample brand data: replace with your own in Brand Guidelines.
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
export const initScans = r => [
  mk(1, 'Spring campaign post', 'Social post', 'Isha Kulkarni', '20 Oct 2026', 'Pending', 'Our service is the number one choice for every cheap deal! Click here to learn more!!!', r),
  mk(2, 'Product launch email', 'Email', 'Rohan Patil', '22 Oct 2026', 'In review', 'Our users get the best results, guaranteed. Colour your day with #FF00AA.', r),
  mk(3, 'About us page', 'Web page', 'Neha Joshi', '24 Oct 2026', 'Approved', 'Founded in 2021, we help customers plan content with confidence. Available in 12 countries.', r),
]
export const initAudit = [
  { t: '24 Oct 2026, 11:10', who: 'Neha Joshi', action: 'Approved content', detail: 'About us page' },
  { t: '22 Oct 2026, 16:42', who: 'Rohan Patil', action: 'Sent for review', detail: 'Product launch email' },
  { t: '20 Oct 2026, 09:05', who: 'Isha Kulkarni', action: 'Ran scan', detail: 'Spring campaign post' },
]
export const initNotes = [{ m: 'Spring campaign post was flagged: 4 issues found', read: false }, { m: 'Approval requested for Product launch email', read: false }]
export const initMembers = [['Aarav Mehta', 'Admin'], ['Isha Kulkarni', 'Brand manager'], ['Rohan Patil', 'Reviewer'], ['Neha Joshi', 'Editor']]
export const roles = { Admin: 'Everything, including team and settings', 'Brand manager': 'Edit guidelines, approve content', Reviewer: 'Review and approve content', Editor: 'Scan content and apply fixes' }
