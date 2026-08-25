# Progressive enhancement, not selective hydration

React Router v8 hydrates every route, and the runtime costs 99 KiB gzip on a page whose own route module is 216 bytes. We keep it. Instead of cutting the runtime out of read-only pages, every route renders and every mutation submits with JavaScript off, and React only enhances.

The reason is the **hydration gap**, not the reader who disables JavaScript. Server-rendered HTML arrives and renders before the runtime lands. In that window — long on a degraded network, non-zero on every device — links must be real links and forms must be real forms, because the browser is the only thing running. So the discipline has to hold for writes, not only reads. A form that works only after hydration is broken for several seconds on every slow connection.

## Considered options

**Drop `<Scripts />` on read-only routes.** Measured: the same page falls from 99 KiB gzip and 3,346 bytes of HTML to zero JavaScript and 249 bytes. Rejected for two reasons. It loses client-side navigation outright. And the switch is per document, not per route — a `<Link>` from a scripted page into a scriptless route renders it in the browser anyway, so the split is a document boundary that needs a lint rule to hold. Facts in [`docs/research/rrv8-hydration.md`](../research/rrv8-hydration.md).

**Split by zone** — public reads scriptless, admin scripted. Same defects, plus a second rule about which links may cross.

**Degrade reads, require JavaScript for writes.** Fails exactly where the reason applies: the hydration gap hits form submits.

**A JavaScript budget instead of a rule** — restore hydration once the bundle fits under a stated size. Void once hydration is kept everywhere.

## Consequences

The rule admits named exceptions only, each with a no-JS equivalent: reordering sections becomes position numbers in a form, paste-to-upload becomes a file input, and rich-text editing falls back to a markdown textarea. Anything else that needs JavaScript to work at all is a design error, not an exception.

Admin state lives on the server. Every mutation is a route action reading standard form data, which rules out client-only editor state that never reaches a form.

An untested no-JS path rots within a month, and it rots silently, because every developer runs with JavaScript on. CI runs the core flows twice — the same Playwright specs under a second project with `javaScriptEnabled: false`.

With scripts on, an entry's text ships twice on a document request: once as rendered HTML, once as serialized loader data. The cost scales with entry length, which is the one thing here that grows without bound. Whether v8 can avoid it is open — see [Loader data serialized twice](https://github.com/shreshthmohan/self/issues/17).
