import { useEffect } from 'react'

export function PrototypeSwitcher({ variants, current, onChange }) {
  if (import.meta.env.PROD) return null

  const i = variants.findIndex((v) => v.key === current)
  const go = (step) => onChange(variants[(i + step + variants.length) % variants.length].key)

  useEffect(() => {
    const onKey = (e) => {
      const t = document.activeElement
      const typing =
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (typing) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#111',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: 999,
        boxShadow: '0 6px 24px rgba(0,0,0,.35)',
        fontSize: 13,
        zIndex: 1000,
      }}
    >
      <button onClick={() => go(-1)} style={btn}>←</button>
      <span>
        <strong>{current}</strong> — {variants[i]?.name}
      </span>
      <button onClick={() => go(1)} style={btn}>→</button>
    </div>
  )
}

const btn = {
  background: '#333',
  color: '#fff',
  border: 0,
  borderRadius: 999,
  width: 26,
  height: 26,
  cursor: 'pointer',
}
