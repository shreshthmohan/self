import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import { initial, load, save, wipe, SAMPLE_IMAGE } from '../store'
import { RoundTripPanel } from '../RoundTripPanel'

export const name = 'TipTap 3 — WYSIWYG, markdown generated on save'
const V = 'A'

export function TiptapVariant() {
  const [heading, setHeading] = useState('Why the kitchen tap leaks')
  const [saved, setSaved] = useState(() => load(V))
  const [roundTripped, setRoundTripped] = useState(null)
  const file = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true, inline: true }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initial(V),
    contentType: 'markdown',
  })

  // On mount with a saved value, replay the real reload: parse the stored
  // markdown, then re-serialise it. Any gap is what TipTap silently drops.
  useEffect(() => {
    if (!editor || saved == null) return
    editor.commands.setContent(saved, { contentType: 'markdown' })
    setRoundTripped(editor.getMarkdown())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!editor) return <p>Loading editor…</p>

  const onSave = () => {
    const md = editor.getMarkdown()
    save(V, md)
    setSaved(md)
    editor.commands.setContent(md, { contentType: 'markdown' })
    setRoundTripped(editor.getMarkdown())
  }

  const insert = (src) => editor.chain().focus().setImage({ src, alt: 'pasted image' }).run()

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => insert(String(r.result))
    r.readAsDataURL(f)
  }

  return (
    <div>
      <input
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="Section heading"
        style={{ width: '100%', fontSize: 20, padding: 8, marginBottom: 8 }}
      />
      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12, minHeight: 260 }}>
        <EditorContent editor={editor} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={onSave}>Save</button>
        <button onClick={() => insert(SAMPLE_IMAGE)}>Insert sample image</button>
        <button onClick={() => file.current.click()}>Upload an image…</button>
        <input ref={file} type="file" accept="image/*" onChange={onFile} hidden />
        <button
          onClick={() => {
            wipe(V)
            setSaved(null)
            setRoundTripped(null)
          }}
        >
          Wipe store
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#555' }}>
        Paste and drag need <code>@tiptap/extension-file-handler</code>, which is not installed
        here. With JavaScript off this editor does not exist at all.
      </p>
      <RoundTripPanel
        saved={saved}
        roundTripped={roundTripped}
        note="Saved markdown against the same markdown parsed back into TipTap and re-serialised."
      />
    </div>
  )
}
