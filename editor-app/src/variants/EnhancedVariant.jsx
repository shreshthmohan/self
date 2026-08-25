import { useEffect, useRef, useState } from 'react'
import { initial, load, save, wipe, SAMPLE_IMAGE, fileToDataUri, kb } from '../store'
import { lineDiff, shorten } from '../diff'
import { marked } from 'marked'

/**
 * The gate compares what a READER would see, not the bytes.
 *
 * Byte equality refuses on a trailing newline and on table column padding, so
 * it refuses almost every entry. Comparing the parsed document misses a loss
 * that happens during the parse. Rendering both strings with the site's own
 * renderer catches a dropped table and ignores reformatting — and it stays
 * correct by construction, because it asks the renderer the site actually uses.
 */
const rendered = (md) =>
  marked
    .parse(md, { gfm: true })
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim()

export const name = 'A over C — textarea first, TipTap enhances it'
const V = 'D'

// The vocabulary the gate has to accept. TipTap's StarterKit knows none of
// tables or task items, so they load only if the extension is installed.
const TABLE_SAMPLE = `\n\n| Part | Cost |\n| --- | --- |\n| Washer | 40p |\n`
const RAW_HTML_SAMPLE = `\n\n<figure>\n  <img src="https://example.com/tap.jpg" alt="the tap">\n  <figcaption>Raw HTML has no extension.</figcaption>\n</figure>\n`

export function EnhancedVariant() {
  const [value, setValue] = useState(() => initial(V))
  const [saved, setSaved] = useState(() => load(V))
  const [mode, setMode] = useState('plain') // plain | rich
  const [gate, setGate] = useState(null) // {ok, from, to}
  const [dismissed, setDismissed] = useState(false)
  const [delay, setDelay] = useState(2000)
  const [tick, setTick] = useState(0)

  const host = useRef(null)
  const textarea = useRef(null)
  const editor = useRef(null)
  const mount = useRef(null)
  const file = useRef(null)

  // The hydration gap, made visible. Until this fires the page is variant C:
  // a real form with a real textarea, usable with no editor JavaScript at all.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const [{ Editor }, SK, Img, MD, TBL, TL, TI] = await Promise.all([
        import('@tiptap/core'),
        import('@tiptap/starter-kit'),
        import('@tiptap/extension-image'),
        import('@tiptap/markdown'),
        import('@tiptap/extension-table'),
        import('@tiptap/extension-task-list'),
        import('@tiptap/extension-task-item'),
      ])
      if (cancelled) return

      // Never steal a textarea the author is typing in.
      if (document.activeElement === textarea.current) {
        textarea.current.addEventListener('blur', () => setTick((t) => t + 1), { once: true })
        return
      }

      const extensions = [
        SK.default,
        Img.default.configure({ allowBase64: true, inline: true }),
        TBL.Table,
        TBL.TableRow,
        TBL.TableCell,
        TBL.TableHeader,
        TL.TaskList,
        TI.TaskItem.configure({ nested: true }),
        MD.Markdown.configure({ markedOptions: { gfm: true } }),
      ]
      const makeMount = () => (md) => {
        editor.current = new Editor({ element: host.current, extensions, content: md, contentType: 'markdown' })
        setMode('rich')
      }
      const source = textarea.current ? textarea.current.value : value
      const probe = new Editor({
        element: document.createElement('div'),
        extensions,
        content: source,
        contentType: 'markdown',
      })
      const back = probe.getMarkdown()
      probe.destroy()

      // THE GATE. Enhance only when the rich editor gives the stored markdown
      // back unchanged. Otherwise the author keeps the textarea and keeps the
      // content.
      if (rendered(back) !== rendered(source)) {
        mount.current = makeMount()
        setGate({ ok: false, from: source, to: back })
        return
      }
      setGate({ ok: true, reformatted: back !== source })

      mount.current = makeMount()
      mount.current(source)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
      editor.current?.destroy()
      editor.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, tick])

  const current = () => (mode === 'rich' && editor.current ? editor.current.getMarkdown() : value)

  const onSubmit = (e) => {
    e.preventDefault()
    // With JavaScript off the browser posts the textarea. With it on, the rich
    // editor writes markdown back into that same field and the same route runs.
    const md = current()
    setValue(md)
    save(V, md)
    setSaved(md)
  }

  const insert = async (src) => {
    if (mode === 'rich' && editor.current) {
      editor.current.chain().focus().setImage({ src, alt: 'pasted image' }).run()
    } else {
      setValue((v) => `${v}\n\n![pasted image](${src})\n`)
    }
  }

  const toPlain = () => {
    const md = current()
    editor.current?.destroy()
    editor.current = null
    setValue(md)
    setMode('plain')
  }

  const rows = gate && !gate.ok ? lineDiff(gate.from, gate.to) : null

  return (
    <div>
      <div style={banner(mode, gate)}>
        {mode === 'plain' && !gate && `Not enhanced yet. Waiting ${delay} ms — this is the hydration gap, and the form works right now.`}
        {mode === 'plain' && gate && !gate.ok && !dismissed && 'Enhancement refused. This entry uses markdown the rich editor would change, so it stays as markdown. Nothing is broken — pick a way out below.'}
        {mode === 'plain' && dismissed && 'Editing as markdown, by your choice. The form posts the same way it always did.'}
        {mode === 'rich' &&
          (gate?.reformatted
            ? 'Enhanced. The rich editor renders the same page, though it will rewrite the markdown formatting when you save.'
            : 'Enhanced. The rich editor gave the stored markdown back unchanged.')}
      </div>

      <form method="post" encType="multipart/form-data" onSubmit={onSubmit}>
        <input
          name="heading"
          defaultValue="Why the kitchen tap leaks"
          style={{ width: '100%', fontSize: 20, padding: 8, margin: '12px 0 8px' }}
        />

        {/* Always in the DOM and always named, so the no-JS post carries it. */}
        <textarea
          ref={textarea}
          name="body"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={14}
          hidden={mode === 'rich'}
          style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, padding: 10 }}
        />
        <div
          ref={host}
          style={{
            display: mode === 'rich' ? 'block' : 'none',
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 12,
            minHeight: 260,
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit">Save</button>
          <button type="button" onClick={() => insert(SAMPLE_IMAGE)}>Insert sample image</button>
          <button type="button" onClick={() => file.current.click()}>Upload an image…</button>
          <input
            ref={file}
            type="file"
            name="image"
            accept="image/*"
            hidden
            onChange={async (e) => e.target.files?.[0] && insert(await fileToDataUri(e.target.files[0]))}
          />
          {mode === 'rich' && (
            <button type="button" onClick={toPlain}>Edit as markdown</button>
          )}
          <button
            type="button"
            onClick={() => {
              wipe(V)
              setSaved(null)
            }}
          >
            Wipe store
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <label>
          Hydration gap:&nbsp;
          <select value={delay} onChange={(e) => setDelay(Number(e.target.value))}>
            <option value={0}>instant</option>
            <option value={2000}>2 s</option>
            <option value={8000}>8 s — a bad connection</option>
            <option value={9999999}>never — JavaScript off</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            toPlain()
            setValue((v) => v + TABLE_SAMPLE)
            setGate(null)
            setDismissed(false)
            setTick((n) => n + 1)
          }}
        >
          Add a table (now passes)
        </button>
        <button
          type="button"
          onClick={() => {
            toPlain()
            setValue((v) => v + RAW_HTML_SAMPLE)
            setGate(null)
            setDismissed(false)
            setTick((n) => n + 1)
          }}
        >
          Add raw HTML (trips the gate)
        </button>
        <span style={{ color: '#666' }}>Body: {kb(value)}</span>
      </div>

      {rows && !dismissed && (
        <section style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 8px' }}>Why the gate refused</h3>
          <pre style={pre}>
            {rows.map((r, i) => (
              <div key={i} style={{ background: { same: 'transparent', gone: '#4a1c1c', new: '#14361c' }[r.kind] }}>
                {{ same: '  ', gone: '- ', new: '+ ' }[r.kind]}
                {shorten(r.text)}
              </div>
            ))}
          </pre>
          <p style={{ fontSize: 13, color: '#555', margin: '10px 0 8px' }}>
            Three ways out. Losing the lines is allowed — losing them without being asked is not.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setDismissed(true)}>
              Keep editing as markdown
            </button>
            <button
              type="button"
              onClick={() => {
                // Consented loss. The author has the diff in front of them.
                setValue(gate.to)
                setGate({ ok: true })
                mount.current?.(gate.to)
              }}
            >
              Accept these changes and enhance
            </button>
            <button
              type="button"
              onClick={() => {
                setGate(null)
                setTick((n) => n + 1)
              }}
            >
              I fixed it — check again
            </button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 8px' }}>Saved markdown</h3>
        <pre style={pre}>{saved == null ? 'Nothing saved yet.' : shorten(saved, 100000)}</pre>
      </section>
    </div>
  )
}

const pre = {
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: '#0f1115',
  color: '#d6dae1',
  padding: 12,
  borderRadius: 6,
  maxHeight: 300,
  overflow: 'auto',
  margin: 0,
}

const banner = (mode, gate) => ({
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: 13,
  background: mode === 'rich' ? '#e4f5e9' : gate && !gate.ok ? '#fde8e8' : '#eef2f7',
  color: '#222',
})
