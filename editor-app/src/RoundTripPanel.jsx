import { lineDiff, shorten } from './diff'

const box = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: '#0f1115',
  color: '#d6dae1',
  padding: 12,
  borderRadius: 6,
  maxHeight: 320,
  overflow: 'auto',
  margin: 0,
}

const tint = { same: 'transparent', gone: '#4a1c1c', new: '#14361c' }
const mark = { same: '  ', gone: '- ', new: '+ ' }

/**
 * The whole point of the prototype. `saved` is what went into the store.
 * `roundTripped` is what comes back after the editor parses it and re-serialises.
 * A clean editor makes these identical.
 */
export function RoundTripPanel({ saved, roundTripped, note }) {
  if (saved == null) return <p style={{ color: '#666' }}>Nothing saved yet. Press Save.</p>
  const rows = roundTripped == null ? null : lineDiff(saved, roundTripped)
  const lost = rows ? rows.filter((r) => r.kind === 'gone').length : 0
  const added = rows ? rows.filter((r) => r.kind === 'new').length : 0
  const clean = rows && lost === 0 && added === 0

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 4px' }}>Round-trip check</h3>
      {note && <p style={{ margin: '0 0 8px', color: '#555', fontSize: 13 }}>{note}</p>}
      {rows && (
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: clean ? '#1a7f37' : '#b42318' }}>
          {clean
            ? 'Identical. Nothing was lost.'
            : `${lost} line(s) lost, ${added} line(s) changed.`}
        </p>
      )}
      {rows ? (
        <pre style={box}>
          {rows.map((r, i) => (
            <div key={i} style={{ background: tint[r.kind] }}>
              {mark[r.kind]}
              {shorten(r.text)}
            </div>
          ))}
        </pre>
      ) : (
        <>
          <h4 style={{ margin: '8px 0 4px' }}>Saved markdown</h4>
          <pre style={box}>{shorten(saved, 100000)}</pre>
        </>
      )}
    </section>
  )
}
