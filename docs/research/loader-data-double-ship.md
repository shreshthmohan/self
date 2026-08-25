# Loader data on a document request: can React Router v8 send an entry once?

Research for issue #17. Part of map issue #1. Facts only. No recommendation.

Date: 2026-08-25. Version under test: `react-router` 8.3.0, `@react-router/dev` 8.3.0, `@cloudflare/vite-plugin` 1.53.1, `wrangler` 4.125.0, Vite 8.2.2, React 19.2.7.

## Summary

1. React Router 8.3.0 has no option to skip loader data in the document. The server encodes the whole `loaderData` object with turbo-stream and writes it into the HTML. The only gate in the source is `<Scripts />`.
2. So on a document request with scripts on, an entry body goes over the wire twice. Measured on a 12,031-character entry: 28,340 bytes, against 12,469 bytes for the same page with no scripts.
3. Four levers change this. Each one removes the entry text from the rendered HTML, not from the serialized data. `clientLoader.hydrate` with a `HydrateFallback` sends the text once, as data, and the server renders the fallback. A `clientLoader` with no server `loader` sends the text zero times and needs a second request. `<Await>` sends the text twice and adds bytes. A read-back of the text from the DOM sends the text once, but the build rejects the only server-only source for it.
4. After compression the second copy is nearly free, except with gzip on a long entry. At 151,154 characters, brotli quality 11 costs 1,105 extra bytes for the doubling (2.0 percent) and zstd level 3 costs 1,101 (1.7 percent). Gzip costs 59,762 (96 percent), because the deflate window is 32 KiB and the two copies sit further apart than that.
5. Cloudflare picks the algorithm by plan: Zstandard on Free, Brotli on Pro and Business, Gzip on Enterprise.
6. **Point 4 holds only for local `zlib`. A real edge response costs much more.** Section 5 measures a deployed Worker: the doubling costs 24.9 percent on the encoding a browser gets, not 2 percent. Cloudflare compresses the response as a stream at a lower setting, so it does not keep a back-reference from the second copy to the first. Read section 5 before you use the section 3 table.

## Method

Primary sources are the shipped `react-router` 8.3.0 source in `node_modules`, the shipped docs in `node_modules/react-router/docs`, the Cloudflare Workers and Speed docs, and a real build.

The numbers come from a real app on the real runtime. Steps:

1. `npx degit cloudflare/templates/react-router-starter-template`. That template ships React Router 7.9.6, so raise `react-router` and `@react-router/dev` to 8.3.0, `@cloudflare/vite-plugin` to 1.53.1, `wrangler` to 4.125.0, and Vite to 8. Remove Tailwind and the welcome page.
2. Two edits are needed to make the template run on v8. Delete `future.unstable_viteEnvironmentApi` from `react-router.config.ts`, because v8 removes the flag and the build stops. Change `workers/app.ts` to pass `new RouterContextProvider()` to the request handler, because v8 rejects a plain object with `Invalid context value provided to handleRequest`.
3. Add one route per lever, all rendering the same `EntryView` component. Add a fixture module with one entry body at four lengths.
4. `npm run build`, then `vite preview`, which runs the built Worker in workerd through the Cloudflare Vite plugin.
5. `curl` each route at each length and save the document.
6. Measure each document with Node `zlib`: raw bytes, `gzipSync` level 9, `brotliCompressSync` quality 5 and 11, `zstdCompressSync` level 3.

The entry body is prose from *Moby-Dick* (Project Gutenberg ebook 2701), split into four spans of different text at 3,383, 12,031, 48,315 and 151,154 characters. Different spans, not one span repeated, so a copy inside one entry does not flatter the compressor.

Caveats:

- The test machine runs Node 22.19.0. React Router 8.3.0 asks for 22.22.0 or later and prints a warning. The build and workerd both ran.
- The measurements are of the document body that the Worker produces. They are not measurements of the Cloudflare edge. The compression levels are the ones this research chose, not the ones Cloudflare runs.
- The lever costs that need a browser — the fallback flash, the hydration match — are read from the documents and the docs. No browser ran.

## 1. Where the second copy comes from

`lib/server-runtime/server.js` builds the entry context for a document render:

```js
serverHandoffStream: encodeViaTurboStream(state, request.signal, build.entry.module.streamTimeout, serverMode),
```

`state` is `{ loaderData, actionData, errors }`. The whole object goes in. The function takes no filter, no allow-list, and no per-route flag. `encodeViaTurboStream` lives in `lib/server-runtime/single-fetch.js` and uses the vendored turbo-stream v2 under `dist/*/vendor/turbo-stream-v2/`.

`lib/dom/ssr/single-fetch.js` writes the encoded stream into the document, one script tag per chunk:

```js
dangerouslySetInnerHTML: { __html: `window.__reactRouterContext.streamController.enqueue(${escapeHtml(JSON.stringify(value))});` }
```

The first line of that same `StreamTransfer` component is the only gate:

```js
if (!context.renderMeta || !context.renderMeta.didRenderScripts) return null;
```

`didRenderScripts` is set in one place, `lib/dom/ssr/components.js` line 491, inside the `Scripts` component. So no `<Scripts />` means no data block, and `<Scripts />` means the full `loaderData`.

The docs state the same rule from the other side. `docs/start/framework/data-loading.md`: "Loader data is automatically serialized from loaders and deserialized in components."

The `Config` type in `@react-router/dev` 8.3.0 has no key that touches this. Neither does the `Scripts` component, which takes `scriptProps` only.

## 2. What each lever does

One route per lever, same 12,031-character entry, same component. "Copies" counts how many times a 40-character phrase from the entry appears in the document, once as HTML text and once inside the escaped data block.

| Lever | Route shape | Copies | Entry in the HTML? | Raw bytes |
|---|---|---:|---|---:|
| Baseline | server `loader`, `<Scripts />` | 2 | yes | 28,340 |
| No `<Scripts />` | server `loader`, no scripts | 1 | yes | 12,469 |
| `clientLoader.hydrate` + `HydrateFallback` | server `loader` + `clientLoader` | 1 | no, the fallback | 16,612 |
| `clientLoader.hydrate`, no fallback | server `loader` + `clientLoader` | 2 | yes | 28,823 |
| `clientLoader` only | no server `loader`, `HydrateFallback` | 0 | no, the fallback | 4,329 |
| `<Await>` on a promise | server `loader` returns a promise | 2 | yes | 29,470 |
| Read back from the DOM | server `loader` without the body | 1 | yes | 16,558 |

Read the table with section 3, which gives the compressed cost of the same documents.

### `clientLoader.hydrate` with a `HydrateFallback`

This is the one supported lever that removes a copy and keeps a single request. It removes the copy from the HTML, not from the data. The document holds `Loading the entry.` where the entry should be, and the entry body sits in the turbo-stream block.

`docs/explanation/hydration.md` gives the rule: a `HydrateFallback` "is only relevant when you are also setting `clientLoader.hydrate=true` on a given route". The measurement matches. With the fallback removed and everything else the same, the server renders the entry and the document goes back to two copies, at 28,823 bytes.

Costs:

- The server-rendered HTML carries no entry text. A reader with no JavaScript gets `Loading the entry.` and nothing else. That is the progressive-enhancement rule from issue #9 inverted for this route.
- The reader sees the fallback until React hydrates and the client loader resolves.
- The client JavaScript grows a little: 10 files and 320,717 raw bytes, against 8 files and 320,378 for the baseline. The extra files are the split `clientLoader` and `HydrateFallback` chunks.
- Compressed, the document saves almost nothing. See section 3.

### `clientLoader` with no server `loader`

The route has no server loader at all, so there is nothing to serialize and nothing to render. The document is 4,329 bytes at every entry length. The client loader then fetches the entry.

Costs:

- A second round trip on the wire, after the JavaScript loads and runs.
- No entry text in the document at all, at any point, for a reader with no JavaScript.
- The same 10 client files, 320,721 raw bytes.
- `docs/explanation/hydration.md` states that a `clientLoader` without a server `loader` "implies `clientLoader.hydrate=true`", and that without a `HydrateFallback` React Router "will not render your route component and will bubble up to any ancestor `HydrateFallback` component".

### `<Await>` on a deferred promise

The loader returns `{ title, body: Promise<string> }` and the component resolves it inside `<Suspense>`. This is worse than the baseline, not better. The document is 29,470 bytes against 28,340: the entry still appears twice, and React's out-of-order streaming adds a hidden `div`, a template, and the inline script that moves the content into place.

`<Await>` changes when the data arrives. It does not change how many times the data arrives.

### Read the text back from the DOM

The idea: the server `loader` returns no body, the component renders the body from some other source during SSR, and a `clientLoader` with `hydrate` reads the text back out of the rendered DOM for the client. The document then holds the entry once, as HTML.

It works as a document — 16,558 bytes, one copy — but it cannot get per-request data. The route component gets the body from a module import, and a route component's module graph ships to the browser. Measured: with 63,729 characters of fixture text in the imported module, the route chunk is 65,020 bytes; with 214,883 characters, the same chunk is 218,620 bytes. The text goes into the bundle verbatim. Total client JavaScript for that route is 539,033 raw bytes against 320,378 for the baseline.

The obvious fix does not build. Moving the fixture to `entry-text.server.ts` and importing it from the route component fails:

```
Error: Server-only module referenced by client
    '../entry-text.server' imported by 'app/routes/domread.tsx?route-chunk=main'
```

So the route component has one channel for per-request data, the loader, and everything on that channel is serialized. Two more costs sit on top: the client loader must rebuild the exact structure the server rendered, and after a client-side navigation to the route there is no rendered `<article>` to read from.

### Not levers

- Pre-rendering. `docs/how-to/pre-rendering.md` describes it, and the Cloudflare Workers guide for React Router says: "SPA mode and prerendering are not currently supported when using the Cloudflare Vite plugin."
- Config. There is no key in `ReactRouterConfig` and no prop on `Scripts` that touches serialization.

## 3. What the doubling costs after compression

Same routes, four entry lengths. Bytes of the document. `gzip 9` is Node `gzipSync` level 9. `br 5` and `br 11` are `brotliCompressSync` at those qualities. `zstd 3` is `zstdCompressSync` level 3.

| Entry chars | Route | Raw | gzip 9 | br 5 | br 11 | zstd 3 |
|---:|---|---:|---:|---:|---:|---:|
| 3,383 | baseline (2 copies) | 10,832 | 3,129 | 2,903 | 2,551 | 3,227 |
| 3,383 | hydrate + fallback (1) | 7,863 | 3,147 | 2,972 | 2,621 | 3,288 |
| 3,383 | no scripts (1, no JS) | 3,710 | 1,959 | 1,822 | 1,565 | 2,007 |
| 12,031 | baseline (2 copies) | 28,340 | 7,169 | 6,808 | 5,908 | 7,305 |
| 12,031 | hydrate + fallback (1) | 16,612 | 7,026 | 6,815 | 5,884 | 7,301 |
| 12,031 | no scripts (1, no JS) | 12,469 | 5,809 | 5,627 | 4,835 | 6,017 |
| 48,315 | baseline (2 copies) | 102,985 | 40,745 | 21,730 | 19,046 | 23,129 |
| 48,315 | hydrate + fallback (1) | 53,893 | 21,689 | 21,201 | 18,793 | 22,386 |
| 48,315 | no scripts (1, no JS) | 49,833 | 20,371 | 19,975 | 17,693 | 21,034 |
| 151,154 | baseline (2 copies) | 314,439 | 121,985 | 63,269 | 54,976 | 66,640 |
| 151,154 | hydrate + fallback (1) | 159,485 | 62,223 | 60,699 | 53,871 | 65,539 |
| 151,154 | no scripts (1, no JS) | 155,695 | 60,941 | 59,453 | 52,760 | 64,244 |

The cost of the second copy, as baseline minus the one-copy variant that keeps `<Scripts />`:

| Entry chars | Raw | gzip 9 | br 5 | br 11 | zstd 3 |
|---:|---:|---:|---:|---:|---:|
| 3,383 | +2,969 | -18 | -69 | -70 | -61 |
| 12,031 | +11,728 | +143 | -7 | +24 | +4 |
| 48,315 | +49,092 | +19,056 | +529 | +253 | +743 |
| 151,154 | +154,954 | +59,762 | +2,570 | +1,105 | +1,101 |

Two facts come out of this.

**The second copy is nearly free under brotli and zstd, at every length measured.** At 151,154 characters the doubling adds 1,105 bytes to a 53,871-byte brotli document, 2.0 percent, and 1,101 bytes to a 65,539-byte zstd document, 1.7 percent. The two copies differ — one is HTML with `<p>` tags, the other is a JSON string with `\"` escapes and `\n\n` — but they are close enough that the compressor keeps back-references to the first copy.

**Gzip is the exception, and it breaks at a length this site will pass.** Deflate has a 32 KiB sliding window (RFC 1951). Under 32 KiB of separation the second copy costs nothing. At 48,315 characters the copies sit more than a window apart, and gzip pays 19,056 extra bytes, 88 percent. At 151,154 characters it pays 59,762, 96 percent — the second copy is compressed from scratch. Brotli's default window is 4 MiB at `lgwin` 22 (RFC 7932), and zstd level 3 also keeps a window larger than these documents, so neither one falls off that cliff.

At the smallest length the doubling is *negative*: the baseline document is smaller compressed than the one-copy variant, by 70 bytes with brotli. The `HydrateFallback` route adds its own strings and two extra script chunks, and at 3,383 characters that overhead is larger than what the deduplicated second copy costs.

Which algorithm runs is Cloudflare's choice, by plan. The Speed docs state: Free "Content is compressed by default using Zstandard", Pro and Business "using Brotli", Enterprise "using Gzip". The delivered algorithm also depends on "The values visitors provide in the `accept-encoding` request header".

## 4. Client JavaScript per lever

Total raw bytes of the JavaScript files the document references, at the 12,031-character entry.

| Lever | Files | Raw | gzip 9 |
|---|---:|---:|---:|
| Baseline | 8 | 320,378 | 102,958 |
| `clientLoader.hydrate`, no fallback | 9 | 320,524 | 103,094 |
| `<Await>` | 8 | 320,541 | 103,041 |
| `clientLoader.hydrate` + fallback | 10 | 320,717 | 103,265 |
| `clientLoader` only | 10 | 320,721 | 103,285 |
| Read back from the DOM | 9 | 539,033 | 189,112 |

Every lever except the DOM read-back sits within 350 bytes of the baseline. The DOM read-back carries the entry text in the bundle, which is why it is 218 KiB larger.

## 5. The same doubling on a deployed Worker

Sections 3 and 4 compress the document with Node `zlib` on the test machine. That is not what a reader gets. This section deploys the skeleton and reads real responses over the edge. It was added for issue #22.

### Method

1. Start from `cloudflare/templates/react-router-starter-template` and raise it to React Router 8.3.0. Four edits are needed; see issue #22 for the list.
2. Add two routes that render **the same HTML**. `/big` gets the entry text from a `loader`, so the text ships twice. `/big-single` holds the text in the component and has no `loader`, so the text ships once. Both render 284 paragraphs.
3. The entry text is the same 151,154-character span of *Moby-Dick* that section 3 uses.
4. `wrangler deploy` to `workers.dev`. Then request each route with `curl`, once per `Accept-Encoding` value, and read `content-encoding` and the byte count off the response.
5. The account is on the Free plan. `workers.dev` is not a zone, so no zone compression rule applies.

### What the edge served

`content-encoding` on a real response, by the `Accept-Encoding` the client sent:

| `Accept-Encoding` sent | `content-encoding` served |
| --- | --- |
| `gzip, deflate, br, zstd` (Chrome) | `zstd` |
| `gzip, deflate, br` (Safari) | `br` |
| `gzip, deflate` | `gzip` |
| `gzip` | `gzip` |
| `identity` | none |

Zstandard on Free, as the Speed docs say. Cloudflare never served gzip to a client that offered anything better, so the 96 percent gzip cliff in section 3 does not fire by default. It fires only for a client that offers neither Brotli nor Zstandard.

### What the doubling costs over the edge

Bytes of the document, as `curl` counted them.

| `Accept-Encoding` | Served | `/big` (2 copies) | `/big-single` (1 copy) | Extra | Cost |
| --- | --- | --- | --- | --- | --- |
| `gzip, deflate, br, zstd` | `zstd` | 82,427 | 66,010 | +16,417 | **+24.9%** |
| `zstd` | `zstd` | 83,149 | 66,010 | +17,139 | +26.0% |
| `gzip, deflate, br` (Safari) | `br` | 88,295 | 65,269 | +23,026 | +35.3% |
| `br` | `br` | 87,983 | 65,269 | +22,714 | +34.8% |
| `gzip` | `gzip` | 128,519 | 65,209 | +63,310 | +97.1% |
| `identity` | none | 316,702 | 158,500 | +158,202 | +99.8% |

### Why this differs from section 3

Section 3 measured brotli quality 11 and zstd level 3 over a whole buffer in memory. Both keep a window larger than the document, so the compressor found the first copy and pointed the second at it. The extra cost was 1,105 bytes, 2.0 percent.

The edge does not do that. Cloudflare compresses the response as it streams, at a lower quality and a smaller effective window, so the second copy is largely compressed from scratch. The measured cost is 16,417 bytes, 24.9 percent — about 15 times the local figure.

**Use the edge numbers.** A local `zlib` run understates what the doubling costs a reader.

### What is still unmeasured

- A custom domain. `workers.dev` carries no zone, so zone-level Brotli and Compression Rules were not in play. The site will run on a zone.
- Any plan above Free. Brotli, the Pro and Business default, costs 34.8 percent here — worse than Zstandard, not better.

## Sources

- `react-router` 8.3.0 source in `node_modules/react-router/dist/development/`: `lib/server-runtime/server.js` (lines 250-300, `serverHandoffStream`), `lib/server-runtime/single-fetch.js` (`encodeViaTurboStream`), `lib/dom/ssr/single-fetch.js` (`StreamTransfer`, the `didRenderScripts` gate, the `enqueue` script), `lib/dom/ssr/components.js` (line 491, `renderMeta.didRenderScripts = true`), `vendor/turbo-stream-v2/`.
- `react-router` 8.3.0 docs in `node_modules/react-router/docs/`: `explanation/hydration.md`, `how-to/client-data.md`, `how-to/suspense.md`, `how-to/pre-rendering.md`, `start/framework/data-loading.md`.
- `node_modules/@react-router/dev/dist/config-t89niiFv.d.ts` at 8.3.0, type `ReactRouterConfig`.
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://developers.cloudflare.com/speed/optimization/content/compression/
- https://developers.cloudflare.com/workers/runtime-apis/fetch/
- RFC 1951, DEFLATE, 32 KiB window. RFC 7932, Brotli, window sizes and `lgwin`.
- Entry text: Project Gutenberg ebook 2701, *Moby-Dick*, https://www.gutenberg.org/files/2701/2701-0.txt
- Local build of `cloudflare/templates/react-router-starter-template`, raised to React Router 8.3.0, with seven route variants. Documents measured with Node 22.19.0 `zlib`.
- Deployed probe for section 5: `self-v8-probe.forsakenlegacy.workers.dev`, React Router 8.3.0, `@cloudflare/vite-plugin` 1.52.1, `wrangler` 4.123.0, Vite 7.3.6, React 19.2.8, Node 22.19.0, Free plan.
- Prior research in this repo: `docs/research/rrv8-hydration.md`, section 2, which first recorded the double ship on a two-field loader.
