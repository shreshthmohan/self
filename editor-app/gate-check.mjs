// Byte equality refuses on padding. Structural equality misses a loss that
// happens at parse. Compare the RENDERED HTML of both strings instead.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window; global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.DOMParser = dom.window.DOMParser; global.Node = dom.window.Node
global.Element = dom.window.Element; global.HTMLElement = dom.window.HTMLElement
global.getComputedStyle = dom.window.getComputedStyle

const { Editor } = await import('@tiptap/core')
const { default: StarterKit } = await import('@tiptap/starter-kit')
const { default: Image } = await import('@tiptap/extension-image')
const { Markdown } = await import('@tiptap/markdown')
const T = await import('@tiptap/extension-table')
const { TaskList } = await import('@tiptap/extension-task-list')
const { TaskItem } = await import('@tiptap/extension-task-item')
const { marked } = await import('marked')

const norm = (md) =>
  marked.parse(md, { gfm: true })
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim()

const CASES = {
  PLAIN: `## Heading\n\nProse with **bold**, *italic*, \`code\`, a [link](https://e.com).\n\n- one\n- two\n\n1. a\n2. b\n\n> Quote.\n\n\`\`\`js\nconst x = 1\n\`\`\`\n\n---\n\n![alt](https://e.com/a.png)\n`,
  TABLE: `| Part | Cost |\n| --- | --- |\n| Washer | 40p |\n`,
  TASKS: `- [ ] Buy the washer\n- [x] Close the isolator\n`,
  FOOTNOTE: `A claim[^1].\n\n[^1]: The source.\n`,
  RAWHTML: `<figure>\n  <img src="https://e.com/a.png" alt="a">\n  <figcaption>Caption.</figcaption>\n</figure>\n`,
  NESTED: `- outer\n  - inner\n    - deeper\n`,
  TIGHT: `Text with a <br> and an <em>inline tag</em>.\n`,
}

const md = Markdown.configure({ markedOptions: { gfm: true } })
const img = Image.configure({ allowBase64: true, inline: true })
const SETS = {
  'StarterKit only': [StarterKit, img, md],
  'StarterKit + table + tasks': [StarterKit, img, T.Table, T.TableRow, T.TableCell, T.TableHeader, TaskList, TaskItem.configure({ nested: true }), md],
}

for (const [label, exts] of Object.entries(SETS)) {
  const e = new Editor({ element: document.createElement('div'), extensions: exts, content: '', contentType: 'markdown' })
  console.log(`\n===== ${label} =====`)
  console.log('case      bytes-equal  html-equal   <- the gate')
  for (const [k, src] of Object.entries(CASES)) {
    e.commands.setContent(src, { contentType: 'markdown' })
    const out = e.getMarkdown()
    console.log(`${k.padEnd(9)} ${String(src === out).padEnd(12)} ${String(norm(src) === norm(out))}`)
  }
  e.destroy()
}
