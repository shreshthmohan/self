import { useRef, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { initial, load, save, wipe, SAMPLE_IMAGE, fileToDataUri } from '../store'
import { RoundTripPanel } from '../RoundTripPanel'

export const name = 'Markdown textarea + @uiw/react-md-editor toolbar'
const V = 'B'

export function MdEditorVariant() {
  const [heading, setHeading] = useState('Why the kitchen tap leaks')
  const [value, setValue] = useState(() => initial(V))
  const [saved, setSaved] = useState(() => load(V))
  const file = useRef(null)

  const onSave = () => {
    save(V, value)
    setSaved(value)
  }

  const insert = (src) => setValue((v) => `${v}\n\n![pasted image](${src})\n`)

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    insert(await fileToDataUri(f))
  }

  return (
    <div data-color-mode="light">
      <input
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="Section heading"
        style={{ width: '100%', fontSize: 20, padding: 8, marginBottom: 8 }}
      />
      <MDEditor value={value} onChange={(v) => setValue(v ?? '')} height={340} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={onSave}>Save</button>
        <button onClick={() => insert(SAMPLE_IMAGE)}>Insert sample image</button>
        <button onClick={() => file.current.click()}>Upload an image…</button>
        <input ref={file} type="file" accept="image/*" onChange={onFile} hidden />
        <button
          onClick={() => {
            wipe(V)
            setSaved(null)
          }}
        >
          Wipe store
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#555' }}>
        The markdown string is the stored value, so there is no round-trip to lose. An image
        appends at the end, not at the cursor — insert-at-cursor is a toolbar command you write.
        With JavaScript off the toolbar and the preview go, and a plain textarea remains.
      </p>
      <RoundTripPanel saved={saved} roundTripped={saved} note="Stored value is the markdown itself." />
    </div>
  )
}
