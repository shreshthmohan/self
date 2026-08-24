# Rich-text editor with markdown round-trip

Research for issue #7, part of map issue #1. All facts come from primary sources: official docs, package source, the npm registry, GitHub and Forgejo APIs, MDN, and the CommonMark spec. Facts checked on 2026-08-24. This note reports facts only. The choice comes later, in a prototype or grilling ticket.

Question from the ticket: the editor must round-trip to markdown, so the no-JS textarea path stays authoritative (Q5). Compare TipTap, Lexical, ProseMirror direct, and a markdown textarea with a toolbar.

## Summary table

| | TipTap 3 | Lexical | ProseMirror direct | Markdown textarea |
| --- | --- | --- | --- | --- |
| Markdown package | `@tiptap/markdown` (first-party, MIT) | `@lexical/markdown` (first-party, MIT) | `prosemirror-markdown` (first-party, MIT) | none needed for storage |
| Parser under it | `marked` 17 (CommonMark) | bespoke regular expressions | `markdown-it` 14 | your choice |
| Round-trip owner | TipTap core team | Meta | Marijn Haverbeke | you |
| Unknown node on export | dropped, empty string | no transformer, no output | throws, or ignores with `strict: false` | not applicable |
| Image in markdown | `![alt](src "title")` | you write the node and the transformer | `![alt](src "title")` | you type it |
| Client JS to edit | starter kit 105.3 kB gzip | core 53.8 kB gzip + plugins | about 90-110 kB gzip | 0 bytes |
| React 19 peer | `^17 \|\| ^18 \|\| ^19` | `>=18.x` | no React binding | not applicable |
| Licence | MIT (`@tiptap-pro/*` is commercial) | MIT | MIT | MIT, except DOMPurify |
| State 2026-08 | 3.30.3, weekly releases | 0.49.0, pre-1.0, breaking changes | active, bus factor 1, repos moved off GitHub | mixed, see below |

## TipTap 3

**Markdown round-trip.** TipTap ships an official markdown package, `@tiptap/markdown`. It lives in the monorepo at `packages/markdown` and the core team publishes it. First release 3.7.0 on 2025-10-14, announced the next day. It is MIT and public on npm, with no token or plan.
Sources: https://registry.npmjs.org/@tiptap/markdown , https://github.com/ueberdosis/tiptap/tree/main/packages/markdown , https://tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap

The parser is `marked` (`marked ^17.0.1` is the only runtime dependency), which is CommonMark compliant. GFM needs `Markdown.configure({ markedOptions: { gfm: true } })`.
Source: https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage

API: `editor.getMarkdown()`, `editor.commands.setContent(md, { contentType: 'markdown' })`, and `editor.markdown.parse()` / `editor.markdown.serialize()`. A custom extension adds `parseMarkdown` and `renderMarkdown` config fields.
Source: https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension

**Stated caveats.** The docs call the feature an "early release and can be subject to change or may have edge cases that may not be supported yet". Comments "are not supported yet" and "may be lost if replaced by Markdown content". A markdown table cell takes "only one child node per cell as the Markdown syntax can't represent multiple child nodes". The basic-usage page warns "Include all needed extensions or content may be lost" and tells you to test parse-then-serialize round-trips.
Source: https://tiptap.dev/docs/editor/markdown

The source confirms the loss. In `@tiptap/markdown@3.30.3`, `dist/index.js` lines 1203 and 1241 return an empty string when a node or mark has no `renderMarkdown` handler. An unknown node disappears without an error. On the parse side, raw `html` tokens go through each extension's `parseHTML` rules.

**Images.** `@tiptap/extension-image` is MIT, version 3.30.3. Attributes are `src`, `alt` and `title`. Options include `inline` (default `false`), `allowBase64`, and a resize node view. The docs state: "This extension is only responsible for displaying images. It doesn't upload images to your server." Paste and drop go through a separate free extension, `@tiptap/extension-file-handler`, but you still write the upload.
Sources: https://tiptap.dev/docs/editor/extensions/nodes/image , https://registry.npmjs.org/@tiptap/extension-file-handler

In `packages/extension-image/src/image.ts` lines 136-150, `renderMarkdown` emits `![alt](src "title")`, or `![alt](src)` with no title. So width, height and the resize attributes are not in the markdown, and they are lost on a round-trip. A base64 image serializes as a data URI inside the parentheses.
Source: https://raw.githubusercontent.com/ueberdosis/tiptap/main/packages/extension-image/src/image.ts

**Size** (bundlephobia, 3.30.3, min+gzip): `@tiptap/core` 34.4 kB, `@tiptap/react` 7.8 kB, `@tiptap/starter-kit` 105.3 kB with 24 dependencies, which include ProseMirror through `@tiptap/pm`.
Source: https://bundlephobia.com/api/size?package=@tiptap/starter-kit@3.30.3

**React 19.** `@tiptap/react@3.30.3` peers are `react` and `react-dom` at `^17.0.0 || ^18.0.0 || ^19.0.0`. The install page makes no separate statement, so the peer range is the only formal signal.
Source: https://registry.npmjs.org/@tiptap/react

**Licence.** Every `@tiptap/*` package above reports MIT in the registry. The repo LICENSE.md reads "MIT License / Copyright (c) 2025, Tiptap GmbH" and the GitHub API reports `spdx_id: MIT`. `@tiptap/pro` does not exist on npm. The commercial code sits in the `@tiptap-pro/*` scope on a private registry. `@tiptap-pro/extension-export-markdown` is a paid Pro extension, and it is only a wrapper: it "requires the `@tiptap/markdown` extension … which provides the serialization logic". So the round-trip is free, and only the Conversion product is paid.
Sources: https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md , https://tiptap.dev/docs/conversion/export/markdown/editor-extension

**Maintenance.** Latest 3.30.3, published 2026-08-24. The monorepo publishes in lockstep. Eleven releases in the last seven weeks, so patches land about weekly and minors every two to three weeks. 58 commits in the 31 days to 2026-08-24. 38,144 stars, 752 open issues and 109 open pull requests.
Sources: https://registry.npmjs.org/@tiptap/core , https://api.github.com/repos/ueberdosis/tiptap

## Lexical

**Markdown round-trip.** `@lexical/markdown` is in-repo at `packages/lexical-markdown` and every file carries "Copyright (c) Meta Platforms, Inc. and affiliates." The API is `$convertFromMarkdownString`, `$convertToMarkdownString`, `$generateNodesFromMarkdownString`, `$convertSelectionToMarkdownString` and `registerMarkdownShortcuts`, plus the React plugin `MarkdownShortcutPlugin`.
Source: https://github.com/facebook/lexical/blob/v0.49.0/packages/lexical-markdown/src/index.ts

The default `TRANSFORMERS` list covers headings, quotes, unordered and ordered lists, code, inline code, bold, italic, highlight (`==x==`), strikethrough, and links. It does not cover tables, horizontal rules, images or check lists. `CHECK_LIST` is exported but not in the default set. Tables, rules, images, equations and tweets exist only in `PLAYGROUND_TRANSFORMERS`.
Sources: https://github.com/facebook/lexical/blob/v0.49.0/packages/lexical-markdown/src/MarkdownTransformers.ts , https://github.com/facebook/lexical/blob/v0.49.0/packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts

**Stated lossiness.** The `@lexical/markdown` doc page itself lists no limits and claims no CommonMark conformance. The mdast page carries the comparison. It gives `@lexical/markdown` a "bespoke regular expressions" parser against micromark for `@lexical/mdast`, and rates syntax preservation "partial" against "extensive".
Source: https://lexical.dev/docs/serialization/markdown-mdast

**`@lexical/mdast`, new in 2026.** Published at 0.49.0 on 2026-07-30, MIT, built on micromark and the mdast utilities, CommonMark plus GFM. It keeps literal syntax in NodeState (bullet character, fence style, setext against ATX, `_` against `*`), so "re-serializing produces minimally different Markdown". It is marked `@experimental` and "may change between any two Lexical releases — including breaking renames, signature changes, or behavior changes", and the docs state that "`@lexical/markdown` remains the supported default for production apps". It costs about 26 kB min+gzip more.
Sources: https://lexical.dev/docs/serialization/markdown-mdast , https://github.com/facebook/lexical/blob/v0.49.0/packages/lexical-mdast/README.md

**Images.** No published package holds an image node. A full recursive tree listing of tag v0.49.0 finds image node files at three paths only, all under `packages/lexical-playground/src/nodes/`. The playground is not on npm. `@lexical/mdast` also ships no image extension, and the included-extensions list has no image.
Source: https://lexical.dev/docs/extensions/included-extensions

So you write the `ImageNode` and its transformer. The playground transformer is about 20 lines and captures `alt` and `src` only, with no title. Without it, `![alt](src)` does not stay inert: the default `LINK` transformer matches the `[alt](src)` part and leaves a literal `!` before a link. That is a round-trip corruption in the default configuration.
Source: https://github.com/facebook/lexical/blob/v0.49.0/packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts#L78

**Size.** Bundlephobia gives `lexical` core 53,797 B gzip. A measurement of the published prod bundle gives 54,915 B gzip for core, 9,405 B for `@lexical/markdown` and 6,265 B for `@lexical/rich-text`. `@lexical/react` has 56 separate entry points that together gzip to 24,176 B, so the real cost is per plugin. NOTE: the docs claim "The core package of Lexical is only 22kb in file size (min+gzip)". That number is stale by a factor of about 2.5.
Sources: https://bundlephobia.com/api/size?package=lexical@0.49.0 , https://lexical.dev/docs/intro

**React 19.** `@lexical/react@0.49.0` peers are `react` and `react-dom` at `>=18.x`, plus optional `typescript >=5.2` and `yjs >=13.5.22`. The repo develops on React 19: the root and playground manifests pin `^19.2.5`, and Node is `>=20.19.0`. The FAQ discusses React 19 semantics directly: "In React 19, `useMemo` calls are cached across StrictMode re-renders, so only one editor will be used for both renders."
Sources: https://registry.npmjs.org/@lexical/react , https://lexical.dev/docs/react/faq

**Licence.** MIT for `lexical`, `@lexical/react`, `@lexical/markdown` and `@lexical/mdast`, in the registry and in the LICENSE file, which reads "Copyright (c) Meta Platforms, Inc. and affiliates."
Source: https://github.com/facebook/lexical/blob/main/LICENSE

**Maintenance.** Latest stable 0.49.0 on 2026-07-30. Nightly builds publish every weekday, unbroken to 2026-08-24. Releases land every two to four weeks. 739 commits in the last 52 weeks. 23,790 stars, 299 open issues, 40 open pull requests. The project is still pre-1.0 and still ships breaking changes: the v0.49.0 changelog lists a "Breaking Change" to command and node-transform generics, and v0.48 ported node classes to a new `config()` protocol.
Sources: https://registry.npmjs.org/lexical , https://github.com/facebook/lexical/blob/v0.49.0/CHANGELOG.md

## ProseMirror direct

**Repos moved.** All ProseMirror GitHub repos were archived on 2026-04-01 and moved to a Forgejo instance the author runs. The `prosemirror-view` GitHub repo reports `archived: true` with `pushed_at` 2026-04-01. The `prosemirror-markdown` README banner reads "This repository has moved to https://code.haverbeke.berlin/prosemirror/prosemirror-markdown". The npm `repository.url` for view, model and markdown now points at that host. The central tracker is the `prosemirror/prosemirror` meta repo, with 112 open issues.
Sources: https://api.github.com/repos/ProseMirror/prosemirror-view , https://github.com/ProseMirror/prosemirror-markdown , https://code.haverbeke.berlin/api/v1/repos/prosemirror/prosemirror

**Markdown round-trip.** `prosemirror-markdown` is first-party but non-core. Its README says: "This is a (non-core) module for ProseMirror." It "implements a ProseMirror schema that corresponds to the document schema used by CommonMark, and a parser and serializer to convert between ProseMirror documents in that schema and CommonMark/Markdown text." Exports are `schema`, `MarkdownParser`, `defaultMarkdownParser`, `MarkdownSerializer`, `MarkdownSerializerState` and `defaultMarkdownSerializer`. `MarkdownParser` "uses markdown-it to tokenize a file, and then runs the custom rules it is given over the tokens to create a ProseMirror document tree."
Source: https://github.com/ProseMirror/prosemirror-markdown

`defaultMarkdownParser` is built as `new MarkdownParser(schema, MarkdownIt("commonmark", {html: false}), {...})`, so it parses "unextended CommonMark, without inline HTML". Raw HTML in markdown does not survive.
Source: https://github.com/ProseMirror/prosemirror-markdown/blob/master/src/from_markdown.ts

The schema is fixed: `doc`, `paragraph`, `blockquote`, `horizontal_rule`, `heading`, `code_block`, `ordered_list`, `bullet_list`, `list_item`, `text`, `image`, `hard_break`, with marks `em`, `strong`, `link` and `code`.

**Lossiness.** The serializer throws on anything outside the schema you give it: `throw new Error("Token type \`" + node.type.name + "\` not supported by Markdown renderer")` at `to_markdown.ts` lines 220-221 and 284-285. The `strict` option, added in 1.13.0 on 2024-05-20, "makes it possible to make the serializer ignore node and mark types it doesn't know". The markdown example page states that the schema "can express exactly the things that can be expressed in Markdown".
NOTE: the often-quoted line "not a general-purpose markdown library" is not in the current README, the reference manual, or the example page. Do not cite it.
Sources: https://github.com/ProseMirror/prosemirror-markdown/blob/master/CHANGELOG.md , https://prosemirror.net/examples/markdown/

`markdown-it` is pinned at `^14.0.0`, one major behind the current 15.0.0.

**Images.** `prosemirror-schema-basic` has an inline `image` node with `src` (required), `alt` and `title`. The serializer writes `![alt](src "title")` and the parser reads it back, so images round-trip. There is no width, height or alignment in the schema. Upload is your job: the official example says "The utility `uploadFile` returns a promise that resolves to the uploaded file's URL (in the demo it actually just waits for a bit and then returns a `data:` URL)". ProseMirror supplies only the placeholder-decoration pattern.
Sources: https://github.com/ProseMirror/prosemirror-schema-basic/blob/master/src/schema-basic.ts , https://prosemirror.net/examples/upload/

**Size** (bundlephobia, min+gzip, transitive dependencies included, so these overlap and do not sum): `prosemirror-view` 46.8 kB, `prosemirror-model` 14.5 kB, `prosemirror-state` 19.0 kB, `prosemirror-markdown` 69.4 kB, `prosemirror-schema-basic` 10.5 kB. `markdown-it` alone is 47.0 kB gzip, so it is most of the markdown package. A deduplicated editor lands near 90-110 kB gzip.
Source: https://bundlephobia.com/package/prosemirror-view

**React 19.** There is no first-party React binding. The ProseMirror Forgejo org has 24 repos and none is React related. `prosemirror-view` declares no peer dependencies and is plain DOM: `new EditorView(domNode, {state})`. The guide mentions React only to explain the word "props", and offers Redux-style advice: "If your whole app is using a data flow model like this, as with Redux and similar architectures, you can integrate ProseMirror's transactions in your main action-dispatching cycle." So the app owns the container ref, the effect that builds the view, `view.destroy()` on cleanup, `dispatchTransaction`, and the React 19 StrictMode double-effect problem.
Sources: https://code.haverbeke.berlin/api/v1/orgs/prosemirror/repos , https://prosemirror.net/docs/guide/

**Licence.** MIT in the registry for all five packages. The LICENSE file reads "Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others".
Source: https://github.com/ProseMirror/prosemirror-markdown/blob/master/LICENSE

**Maintenance.** `prosemirror-markdown` 1.13.6 on 2026-08-16. `prosemirror-view` 1.42.2 on 2026-07-24, eight releases since 2026-01-14. `prosemirror-model` 1.25.11 on 2026-07-11. `prosemirror-state` 1.4.4 on 2025-10-23 and quiet. `prosemirror-schema-basic` 1.2.4 on 2025-03-18. The last markdown commit is 2026-08-21.
Bus factor is 1. The sole npm maintainer for every package is `marijn`, nearly all commits are his, and since April 2026 the issue tracker, the pull requests and the repository availability all depend on infrastructure he runs himself.
Sources: https://registry.npmjs.org/prosemirror-markdown , https://code.haverbeke.berlin/api/v1/repos/prosemirror/prosemirror-markdown/commits

## Markdown textarea with a toolbar

**Round-trip.** There is no round-trip. A `<textarea name="body">` submits its raw string with the form, so the markdown text is the stored value and no document model sits between. MDN describes the `name` attribute as "the name of the associated data point submitted to the server when the form is submitted". One normalization applies: with the default `wrap="soft"`, "the browser ensures that all line breaks in the entered value are a `CR+LF` pair, but no additional line breaks are added to the value", so the server must convert CRLF to LF before it stores or diffs the text.
Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea

The only extra part is a renderer for display and preview, plus a sanitizer. With JS off, a preview needs a POST to a preview route.

**Renderers.**

- `marked` 18.0.10, published 2026-08-18, MIT, zero runtime dependencies, 37,086 stars, repo pushed 2026-08-22. Its own site claims "CommonMark 0.31 (98%)" and "GitHub Flavored Markdown 0.29 (97%)". Sources: https://registry.npmjs.org/marked , https://marked.js.org/
- `markdown-it` 15.0.0, published 2026-07-30, MIT, six runtime dependencies. The README claims "Follows the CommonMark spec + adds syntax extensions & sugar" and "Safe by default." The defaults file confirms `html: false`, `linkify: false`, `typographer: false`, `breaks: false`. GFM is not built in and comes from plugins. Sources: https://github.com/markdown-it/markdown-it/blob/master/README.md , https://github.com/markdown-it/markdown-it/blob/master/src/presets/default.ts
- `remark` / `unified` / `rehype`, all MIT: `unified` 11.0.5 (2024-06-19), `remark` 15.0.1 (2023-09-18), `remark-parse` 11.0.0 (2023-09-18), `remark-rehype` 11.1.2 (2025-04-02), `rehype-stringify` 10.0.1 (2024-09-27), `remark-gfm` 4.0.1 (2025-02-10), `micromark` 4.0.2 (2025-02-27). The micromark README claims "100% to CommonMark" against "~650 CommonMark tests and more than 1.2k extra tests", "100% GFM" through `micromark-extension-gfm`, a size of "±14kb", and that it "makes any markdown safe by default, even if HTML is embedded or dangerous protocols are used, as it encodes or drops them." Source: https://github.com/micromark/micromark
- `react-markdown` 10.1.0, published 2025-03-07, MIT, peers `react >=18`, so React 19 satisfies it. Source: https://registry.npmjs.org/react-markdown

**Sanitization.** Markdown carries raw HTML by design. CommonMark 0.31.2 states that an HTML block "is a group of lines that is treated as raw HTML (and will not be escaped in HTML output)", and inline raw HTML passes through the same way.
Source: https://spec.commonmark.org/0.31.2/#raw-html

- `marked` ships no sanitizer and says so in a README banner: "Marked does not sanitize the output HTML. Please use a sanitize library, like DOMPurify (recommended), sanitize-html or insane on the *output* HTML!" Source: https://github.com/markedjs/marked/blob/master/README.md
- `markdown-it` is safe by default through `html: false`.
- remark and rehype drop raw HTML by default. `rehype-raw` 7.0.0 opts back in, and then you must sanitize.
- `rehype-sanitize` 6.0.0 (2023-08-26, MIT) "drops anything that isn't explicitly allowed by a schema", its `defaultSchema` "follows GitHub style sanitation", and the ordering rule is "Use `rehype-sanitize` after the last unsafe thing." Source: https://github.com/rehypejs/rehype-sanitize
- `DOMPurify` 3.4.14 (2026-08-19) is the one non-MIT item: `(MPL-2.0 OR Apache-2.0)`. It needs a DOM, so server-side use pulls in jsdom, and the README "strongly recommends" the newest jsdom because older versions have known XSS holes. It calls happy-dom "not considered safe". Sources: https://registry.npmjs.org/dompurify , https://github.com/cure53/DOMPurify

Mechanical point: server-side rendering (which the no-JS path needs anyway) makes DOMPurify drag in jsdom, while `rehype-sanitize` and `hast-util-sanitize` work on the AST and need no DOM.

**Toolbar libraries.**

- `@uiw/react-md-editor` 4.1.2, published 2026-08-21, MIT, peers `react >=16.8.0`, last commit 2026-08-21. Its README states it is "Based on `textarea` encapsulation, does not depend on any modern code editors", so it is the only listed option that really is a textarea plus a toolbar. The toolbar is configurable through `commands` and `extraCommands`, preview runs through `@uiw/react-markdown-preview`, and its own docs say "markdown needs to be sanitized if you do not completely trust your authors". Sources: https://registry.npmjs.org/@uiw/react-md-editor , https://github.com/uiwjs/react-md-editor
- `react-simplemde-editor` is stale. Version 5.2.0 published 2022-10-01, repo last pushed 2023-10-07, not archived, 776 stars, 11 open issues, MIT, peers `react >=16.8.2`. React 19 shipped after its last publish, so no release ever tested it. Source: https://api.github.com/repos/RIP21/react-simplemde-editor
- `easymde` 2.21.0, published 2026-05-03, MIT, repo pushed 2026-08-11, still maintained. It is not a textarea: "CodeMirror is the backbone of the project", and it replaces the textarea with a CodeMirror instance. It has built-in image upload (`uploadImage`, drag-drop, paste, file browser) and a `sanitizerFunction`. Source: https://github.com/Ionaru/easy-markdown-editor
- The `@primer/react` MarkdownEditor no longer exists in the public package. Commit `04e8c9c4` on 2024-09-17, "Delete deprecated `MarkdownEditor`, `MarkdownInput`, `InlineAutocomplete`, and related code (#4953)", removed it, and GitHub now keeps it as an internal component. The published dist of `@primer/react` 38.36.0 has no matching file. The package itself is healthy: 38.36.0 on 2026-08-19, MIT, peer `react: "18.x || 19.x"`, which is an explicit React 19 declaration. Sources: https://github.com/primer/react/discussions/5165 , https://primer.style/product/internal-components/markdown-editor/ , https://registry.npmjs.org/@primer/react

So one maintained, textarea-based, React-19-compatible toolbar library remains: `@uiw/react-md-editor`.

**Images.** Paste upload and drag upload need JS. MDN states that `DataTransfer.files` "can only be accessed from within the `drop` and `paste` events. For all other events, the `files` property will be empty". Without JS, a paste inserts text at the cursor and nothing uploads.
Sources: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files , https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event

The no-JS path needs a separate `<input type="file">`. MDN: file inputs "let the user choose one or more files from their device storage. Once chosen, the files can be uploaded to a server using form submission, or manipulated using JavaScript code and the File API." The form shape is `<form method="post" enctype="multipart/form-data">`. The `accept` attribute is a hint only, because users "can toggle an option in the file chooser", so the server must validate the type.
Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file

Consequence: one multipart form can carry both the textarea and the file input, but there is no insert-at-cursor step without JS. The server must append the `![](url)` line to the markdown, or the user pastes the returned URL.

**Size** (bundlephobia, min / gzip): `marked` 42,620 / 12,726; `markdown-it` 111,431 / 47,019; `react-markdown` 113,614 / 34,090; `rehype-sanitize` 8,009 / 3,281; `dompurify` 27,005 / 10,694; `easymde` 324,994 / 107,228.
CAUTION: the `@uiw/react-md-editor` figure of 36,122 / 6,092 is not credible as a total. Its npm `unpackedSize` is 4,287,692 bytes and it pulls in `@uiw/react-markdown-preview`, `rehype` and `rehype-prism-plus`. Bundlephobia appears to treat those as external.

Baseline: a bare textarea with server-side rendering ships 0 bytes of editor JS. The renderer runs on the server and enters the client bundle only for a live preview.

## Cross-cutting facts

- Every option in this note is MIT, except DOMPurify (`MPL-2.0 OR Apache-2.0`) and the `@tiptap-pro/*` scope, which is commercial and off the public registry.
- Three of the four rich-text options put the markdown parser in the client bundle: `marked` for TipTap, `markdown-it` for ProseMirror, and micromark for `@lexical/mdast`. Only `@lexical/markdown` uses regular expressions instead.
- No option ships an image upload. TipTap, ProseMirror and Lexical all leave the upload to the app. Only EasyMDE has one built in, and EasyMDE is CodeMirror, not a textarea.
- Only the textarea keeps the markdown authoritative by construction. The other three store a document model and generate markdown from it, so an extension without a serializer rule loses content: TipTap drops it silently, Lexical emits nothing for it, and ProseMirror throws unless you set `strict: false`.
