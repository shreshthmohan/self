import { useState } from 'react'
import { marked } from 'marked'
import { initial, load, save, wipe } from '../store'
import { RoundTripPanel } from '../RoundTripPanel'

export const name = 'Bare textarea — the no-JavaScript floor'
const V = 'C'

// Stands in for the server route. With JavaScript off the browser posts the
// form, the server appends the image line, and the page comes back rendered.
function serverHandleSubmit(form) {
  const markdown = String(form.get('body') ?? '').replace(/\r\n/g, '\n')
  const image = form.get('image')
  if (image && image.size > 0) {
    return new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(`${markdown}\n\n![${image.name}](${r.result})\n`)
      r.readAsDataURL(image)
    })
  }
  return Promise.resolve(markdown)
}

export function BareTextareaVariant() {
  const [value, setValue] = useState(() => initial(V))
  const [saved, setSaved] = useState(() => load(V))
  const [preview, setPreview] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    const md = await serverHandleSubmit(new FormData(e.currentTarget))
    save(V, md)
    setSaved(md)
    setValue(md)
  }

  return (
    <div>
      <form method="post" encType="multipart/form-data" onSubmit={onSubmit}>
        <input
          name="heading"
          defaultValue="Why the kitchen tap leaks"
          placeholder="Section heading"
          style={{ width: '100%', fontSize: 20, padding: 8, marginBottom: 8 }}
        />
        <textarea
          name="body"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={16}
          style={{
            width: '100%',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 13,
            padding: 10,
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" name="image" accept="image/*" />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setPreview((p) => !p)}>
            {preview ? 'Hide' : 'Show'} preview
          </button>
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
      <p style={{ fontSize: 13, color: '#555' }}>
        Zero bytes of editor JavaScript. The file input rides in the same multipart form, and the
        server appends the image line — there is no insert-at-cursor without JavaScript. The
        preview below is a stand-in for a server-rendered preview route.
      </p>
      {preview && (
        <div
          style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12, marginTop: 8 }}
          // PROTOTYPE ONLY. Real code sanitises. See the research note.
          dangerouslySetInnerHTML={{ __html: marked.parse(value, { gfm: true }) }}
        />
      )}
      <RoundTripPanel saved={saved} roundTripped={saved} note="Stored value is the markdown itself." />
    </div>
  )
}
