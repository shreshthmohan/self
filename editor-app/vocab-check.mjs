// PROTOTYPE — does widening the vocabulary make the gate pass?
// Runs the same parse-and-re-serialise as variant D's gate, once per extension set.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.DOMParser = dom.window.DOMParser
global.Node = dom.window.Node
global.Element = dom.window.Element
global.HTMLElement = dom.window.HTMLElement
global.getComputedStyle = dom.window.getComputedStyle

const { Editor } = await import('@tiptap/core')
const { default: StarterKit } = await import('@tiptap/starter-kit')
const { default: Image } = await import('@tiptap/extension-image')
const { Markdown } = await import('@tiptap/markdown')
const T = await import('@tiptap/extension-table')
const { TaskList } = await import('@tiptap/extension-task-list')
const { TaskItem } = await import('@tiptap/extension-task-item')

const TABLE = `| Part | Cost | Where |\n| --- | --- | --- |\n| Washer | 40p | Screwfix |\n`
const TASKS = `- [ ] Buy the washer\n- [x] Close the isolator\n`
const PLAIN = `## Heading\n\nProse with **bold**, *italic*, \`code\` and a [link](https://example.com).\n\n- one\n- two\n\n1. first\n2. second\n\n> A quote.\n\n\`\`\`js\nconst x = 1\n\`\`\`\n\n---\n\n![alt](https://example.com/a.png)\n`
const FOOTNOTE = `A claim[^1].\n\n[^1]: The source.\n`
const RAWHTML = `<figure>\n  <img src="https://example.com/a.png" alt="a">\n  <figcaption>Caption.</figcaption>\n</figure>\n`

function trip(exts, md) {
  const e = new Editor({ element: document.createElement('div'), extensions: exts, content: md, contentType: 'markdown' })
  const out = e.getMarkdown()
  const out2 = (() => { e.commands.setContent(out, { contentType: 'markdown' }); return e.getMarkdown() })()
  e.destroy()
  return { out, fixedPoint: out === out2 }
}

const base = [StarterKit, Image.configure({ allowBase64: true, inline: true }), Markdown.configure({ markedOptions: { gfm: true } })]
const wide = [
  StarterKit, Image.configure({ allowBase64: true, inline: true }),
  T.Table, T.TableRow, T.TableCell, T.TableHeader,
  TaskList, TaskItem.configure({ nested: true }),
  Markdown.configure({ markedOptions: { gfm: true } }),
]

const cases = { PLAIN, TABLE, TASKS, FOOTNOTE, RAWHTML }
for (const [set, exts] of [['StarterKit only', base], ['StarterKit + table + tasks', wide]]) {
  console.log(`\n===== ${set} =====`)
  for (const [k, md] of Object.entries(cases)) {
    const { out, fixedPoint } = trip(exts, md)
    const identical = out === md
    console.log(`${k.padEnd(9)} identical=${String(identical).padEnd(5)} stable-on-2nd-pass=${fixedPoint}`)
    if (!identical) console.log('   ->', JSON.stringify(out).slice(0, 200))
  }
}
