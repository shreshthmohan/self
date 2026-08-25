// PROTOTYPE — headless version of the Round-trip check panel, so the verdict is
// a measured fact and not only something seen in a browser.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true })
global.DOMParser = dom.window.DOMParser
global.Node = dom.window.Node
global.Element = dom.window.Element
global.HTMLElement = dom.window.HTMLElement
global.getComputedStyle = dom.window.getComputedStyle

const { Editor } = await import('@tiptap/core')
const { default: StarterKit } = await import('@tiptap/starter-kit')
const { default: Image } = await import('@tiptap/extension-image')
const { Markdown } = await import('@tiptap/markdown')
const { SEED } = await import('./src/store.js')

const editor = new Editor({
  element: document.body,
  extensions: [
    StarterKit,
    Image.configure({ allowBase64: true, inline: true }),
    Markdown.configure({ markedOptions: { gfm: true } }),
  ],
  content: SEED,
  contentType: 'markdown',
})

const out = editor.getMarkdown()
const cut = (s) => s.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, 'data:image/…')
console.log('--- IN ---\n' + cut(SEED))
console.log('--- OUT ---\n' + cut(out))
console.log('--- identical:', SEED === out)

// Does the damage compound on a second save?
editor.commands.setContent(out, { contentType: 'markdown' })
const out2 = editor.getMarkdown()
console.log('--- SECOND PASS stable:', out === out2)
if (out !== out2) console.log(cut(out2))

// What does StarterKit actually give us?
console.log('--- StarterKit nodes:', Object.keys(editor.schema.nodes).join(', '))
console.log('--- StarterKit marks:', Object.keys(editor.schema.marks).join(', '))
