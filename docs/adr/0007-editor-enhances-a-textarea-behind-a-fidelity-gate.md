# The editor enhances a textarea, behind a fidelity gate

Markdown is the stored value. A named `<textarea>` inside a real `<form method="post">` is the editor: it posts with no JavaScript and needs no editor code. When JavaScript arrives, TipTap 3 loads from a dynamic import, takes over the same field, and writes markdown back into it on save. One route, one stored string, two ways to author it.

TipTap enhances only when it passes a **fidelity gate**. On mount it parses the stored markdown, re-serialises it, and compares. It takes over the field only if the comparison passes.

## Why a gate at all

TipTap generates markdown from a document model, so what the model cannot hold, the serialiser drops. Measured headlessly on one seeded section: a GFM table vanished whole, a task list lost its checkboxes, a raw `<figure>` flattened, and `[^1]` came back as `\[^1\]`. A second save then merged two lists into one, so the damage compounds across edits.

Two authoring paths over one stored string is the reason this matters. Without a gate, the weaker parser sets the vocabulary for both, and an entry written in the textarea loses content the moment a scripted browser opens it. The rule is: **losing a table is allowed, losing it without being asked is not.**

So a refusal is not an error. It keeps the textarea — a real editor, which holds everything TipTap cannot — and offers the author three ways out: keep editing as markdown, read the diff and accept the rewrite, or repair the markdown and re-check. Consented loss is allowed. Silent loss is not.

## Why the gate compares rendered HTML, not bytes

Byte equality was the first design, and measuring killed it. Serialisation adds a trailing newline and pads table columns, so byte equality refuses plain prose that holds no table at all, and it cannot tell a lost table from a padded one.

The gate renders both strings with `marked`, the renderer the site already uses, and compares the output. It measures what a reader sees. It also stays correct by construction: add a footnote plugin to `marked` later, and the gate starts to refuse footnote entries with no change to the gate itself.

Measured, against the vocabulary below:

| Case | bytes equal | rendered HTML equal — the gate |
| --- | --- | --- |
| Prose, lists, quote, code block, rule, image | no | pass |
| Table | no | pass |
| Task list | no | pass |
| Nested lists | no | pass |
| Raw HTML `<figure>` | no | refuse |
| Inline `<br>`, `<em>` | no | refuse |

## The accepted vocabulary

StarterKit, Image, Table, TaskList and TaskItem. Nothing else.

Table and task lists together cost 14.4 kB gzip, on a chunk only an edit session fetches. They move a table and a checklist from refused to accepted, and purchase research and rental-house records are table-shaped.

Footnotes are out because no TipTap extension exists and `marked` does not render them either, so nothing is lost that a reader ever saw. Raw HTML is out on purpose: it is what the gate should keep refusing, and to admit it drags DOMPurify and jsdom onto workerd — the one non-MIT, DOM-requiring dependency in the whole comparison.

## Considered options

**TipTap alone**, and **`@uiw/react-md-editor` alone**. Both fail [ADR 0002](0002-progressive-enhancement-over-selective-hydration.md): neither exists with JavaScript off. That rule is standing, so this is decisive, not a preference.

**`@uiw/react-md-editor` is not the light option.** [`docs/research/editor-markdown.md`](../research/editor-markdown.md) quoted 6 kB from bundlephobia and flagged it as not credible. One build per variant, against a bare React 19 build: TipTap 146 kB gzip, `@uiw/react-md-editor` **357 kB**, and 137 kB even through its `/nohighlight` entry, because the preview ships `react-markdown`, `rehype` and prism.

**The bare textarea alone** is a real answer, and it stays available — it is this decision with the enhancement switched off. The gate costs nothing today and adds the rich editor later with no migration.

## Consequences

**A read page pays nothing.** TipTap arrives as a lazy chunk on an edit route. First paint costs about 4 kB gzip over a bare React 19 build; TipTap adds about 151 kB after the gate passes.

**The gate is load-bearing and needs its own checks.** `roundtrip-check.mjs`, `vocab-check.mjs`, `converge.mjs` and `gate-check.mjs` on branch `prototype/editor` are the measurements behind every number here. Their production equivalents belong in CI, next to the JavaScript-off Playwright run that ADR 0002 requires.

**Two open questions stay open**, filed separately: who canonicalises markdown on save from both paths ([#37](https://github.com/shreshthmohan/self/issues/37)), and image upload to R2 with and without JavaScript ([#38](https://github.com/shreshthmohan/self/issues/38)). No variant answered the upload, because data URIs stood in for it.

Set in [Choose the rich-text editor](https://github.com/shreshthmohan/self/issues/10). Prototype and evidence on branch `prototype/editor`.
