import { useEffect, useRef } from 'react'
// Silver particle wave field + drifting dust (pattern from the reference clip; colours from the AXION theme)
export default function ParticleBackground() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, g = c.getContext('2d')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w, h, d, t = 0, raf
    const N = 110, M = 60
    const dust = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 0.0004 + 0.0001 }))
    const resize = () => {
      d = Math.min(devicePixelRatio || 1, 2)
      w = c.width = innerWidth * d; h = c.height = innerHeight * d
      c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'
    }
    const draw = () => {
      g.clearRect(0, 0, w, h)
      if (!reduce) t += 0.006
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const wx = (i / N - 0.5) * 3.2, wz = (j / M) * 2 + 0.4
        const y = Math.sin(wx * 2.2 + t * 2) * 0.18 + Math.cos(wz * 3 - t * 1.5) * 0.14 + Math.sin((wx + wz) * 1.6 + t) * 0.1
        const p = 1 / (wz + 0.2)
        const sx = w / 2 + wx * p * w * 0.35, sy = h * 0.3 + (0.9 + y) * p * h * 0.22
        g.fillStyle = `rgba(192,192,192,${Math.min(1, p * 0.45)})`
        const s = Math.max(0.7, p * 1.1) * d
        g.fillRect(sx, sy, s, s)
      }
      g.fillStyle = 'rgba(192,192,192,.55)'
      dust.forEach(q => { if (!reduce) { q.y -= q.s; if (q.y < 0) q.y = 1 } g.fillRect(q.x * w, q.y * h, d, d) })
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    resize(); draw(); addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} aria-hidden className="fixed inset-0 -z-10 opacity-60" />
}
