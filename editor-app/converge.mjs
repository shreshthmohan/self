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

const exts = [StarterKit, Image.configure({ allowBase64: true, inline: true }),
  T.Table, T.TableRow, T.TableCell, T.TableHeader, TaskList, TaskItem.configure({ nested: true }),
  Markdown.configure({ markedOptions: { gfm: true } })]
const e = new Editor({ element: document.createElement('div'), extensions: exts, content: '', contentType: 'markdown' })
const trip = (md) => { e.commands.setContent(md, { contentType: 'markdown' }); return e.getMarkdown() }

const cases = {
  PLAIN: `## Heading\n\nProse with **bold**.\n\n- one\n- two\n`,
  TABLE: `| Part | Cost |\n| --- | --- |\n| Washer | 40p |\n`,
  TASKS: `- [ ] Buy the washer\n- [x] Close the isolator\n`,
}
for (const [k, md] of Object.entries(cases)) {
  let cur = md
  const seen = [JSON.stringify(cur)]
  for (let i = 1; i <= 4; i++) {
    cur = trip(cur)
    const s = JSON.stringify(cur)
    const at = seen.indexOf(s)
    seen.push(s)
    if (at >= 0) { console.log(`${k.padEnd(6)} converged at pass ${i} (matches pass ${at})`); break }
    if (i === 4) console.log(`${k.padEnd(6)} STILL MOVING after 4 passes`)
  }
  console.log('   pass0', seen[0].slice(0, 120))
  console.log('   pass1', seen[1].slice(0, 120))
  if (seen[2]) console.log('   pass2', seen[2].slice(0, 120))
}
e.destroy()
