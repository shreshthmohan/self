# One webfont, and a borrowed palette

The app wore the starter template: Inter, Tailwind's cool greys, no header, no navigation, no footer, and a bare "Log out" link floated right. It needed chrome of its own, in the same family as the two other things this author runs — the codeuncode site and the Tusker extension.

The chrome is a full-width rule under a header, a flat cream-ish ground, Fraunces headings, and a footer on a plain rule. **Fraunces is the only webfont on the site.** The greys are Tailwind's **stone** scale. The accent stays the family yellow, `#ffc93f`.

## The family is a palette and a serif, not a typeface set

Tusker's `src/styles.css` already borrowed codeuncode's palette so the extension would look like a member of the same family, and it added a full dark theme codeuncode has none of. Tusker is also the closer shape: an app, not a marketing page. So the tokens come from Tusker.

Typography splits from both. Both source sites set `--font-sans: var(--font-mono)` and read everything in JetBrains Mono. That works for a task list and for a landing page. This site is long-form prose, and mono at paragraph length is a reading cost neither of them pays.

What carries the resemblance instead is the serif headings, the light warm ground, and the yellow accent. Those three are enough.

## Only the headings earn a webfont

Measured off the Google Fonts `css2` endpoint, latin subset, woff2, as served to a Chrome user agent:

| face | roman | roman + italic |
| --- | ---: | ---: |
| Fraunces | 67.4 KB | 149.1 KB |
| Inter, the spec the template shipped | 73.0 KB | **152.8 KB** |
| Karla | 24.3 KB | 48.8 KB |
| Figtree | 20.2 KB | 41.0 KB |
| Public Sans | 26.6 KB | 55.0 KB |
| Instrument Sans | 29.9 KB | 61.7 KB |
| JetBrains Mono | 31.3 KB | — |
| Source Serif 4 | 122.2 KB | 252.1 KB |
| Newsreader | 131.8 KB | 278.9 KB |

The body face is a **system stack**: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`. The mono face is a system stack too: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Both cost nothing.

So the site loads **67.4 KB of Fraunces and nothing else**, against the 152.8 KB of Inter the template shipped. Chrome that looks like something costs 56 percent less than chrome that looked like nothing.

A body serif was priced and refused. Source Serif 4 alone is 1.7 times the whole previous budget, and Newsreader is worse.

**Fraunces loads roman only.** Its italic axis is 81.7 KB — more than any candidate body face, roman and italic together — and the headings on this site are entry titles and section headings, which are not italic. An italic heading falls back to a synthesised slant.

The accepted cost of the system stack is that the body texture differs per operating system: SF on macOS, Segoe UI on Windows, and whatever fontconfig resolves on Linux. Only the headings, the accent, and the greys are the same everywhere. That is the trade for 0 bytes, and it is the right one on a site where [React Router v8 partial hydration on read-only pages](https://github.com/shreshthmohan/self/issues/6) already measured about 100 KB gzip of client JavaScript on an article page, and where ADR 0002 requires every route to render with JavaScript off. A webfont that blocks paint hurts most on the path that has nothing else to wait for.

## The greys are stone, not Tusker's hexes

Tusker's fourteen greys — seven light, seven dark — were matched against Tailwind 4.1.17's `stone`, `zinc`, `neutral`, and `gray` scales, in CIE Lab, reading the palette out of `node_modules/tailwindcss/theme.css` rather than from memory.

**Stone was nearest on thirteen of the fourteen.** The exception is the light foreground, where `neutral-900` beats `stone-900` by 0.8 of a unit and both are near black. Zinc and gray lose badly on the mid greys, at 12 to 19 units, because they are cold and Tusker's are warm.

| token | Tusker | stone | ΔE | next best |
| --- | --- | --- | ---: | --- |
| bg | `#fdfdfa` | `stone-50` | 1.5 | zinc 1.8 |
| surface | `#f6f4ea` | `stone-100` | 4.8 | neutral 5.2 |
| border | `#e7e3d2` | `stone-200` | 8.3 | neutral 9.0 |
| fg | `#141411` | `stone-900` | 3.2 | neutral **2.4** |
| muted | `#5a584f` | `stone-600` | 2.9 | neutral 6.1 |
| dim | `#9b978a` | `stone-400` | 6.2 | neutral 8.3 |
| dark bg | `#16150f` | `stone-900` | 3.4 | neutral 3.8 |
| dark dim | `#807c6d` | `stone-500` | 6.8 | neutral 9.5 |

The mapping spreads the surfaces one step apart so they stay separable, rather than taking the nearest shade for each in isolation, which would collide `surface-2` and `border` on `stone-200`:

- light: `50`, `100`, `200`, `300` for ground, surface, surface-2, border; `900`, `600`, `400` for foreground, muted, dim.
- dark: `950`, `900`, `800`, `700`; `100`, `400`, `500`.

Stone is warm, but it is not cream. Tusker's surfaces are yellow-tinted and stone's are close to neutral, so the family resemblance thins in the surfaces and the borders. That is the price of a named scale, and it is paid on purpose: a hand-carried hex list is a second palette to maintain by hand, and Tailwind's scale is already in the bundle, already has the intermediate steps this site has not needed yet, and is already what a reader of the code expects behind `bg-surface`.

**The accent is not a Tailwind colour.** `#ffc93f` stays as it is, with `#1a1400` as its ink. No Tailwind yellow is the family's yellow, and the accent is the loudest thing the three properties share.

## The tokens keep Tusker's names, in Tailwind's slots

The colour tokens keep Tusker's names verbatim — `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-fg`, `--color-muted`, `--color-dim`, `--color-accent`, `--color-accent-ink` — so the two code bases share one vocabulary and a reader moving between them re-reads nothing. In Tailwind 4 they live in `@theme`, so they arrive as `bg-bg`, `bg-surface`, `border-border`, `text-fg`, `text-muted`, `text-dim`.

The three font tokens go into Tailwind's own slots: `--font-serif` for Fraunces, `--font-sans` for the body stack, `--font-mono` for the mono stack. The chrome therefore invents **no new utility names**, and `font-sans` staying the default body face means no route has to opt in.

Dark values are redefined on `:root` inside a `prefers-color-scheme` media query, not inside `@theme`, because the utilities read the variables at use time.

## What the chrome holds

The **header** is a full-width bottom rule with no fill: it separates chrome from content without making itself an object. It carries the site title linking home, an owner-only "New entry", and the existing "Log out". "New entry" had no link anywhere before this — the address was typed by hand.

Kind filters stay on the listing page. They are page state, not chrome.

The **footer** carries a name and a short link row on a plain top rule, with no surface fill.

**codeuncode's animated `sunshine` backdrop does not come along.** It is three fixed radial gradients in the accent, drifting on a 28-second loop. It is a marketing-page device, and this is a reading surface; a moving field behind a long article earns nothing.

This ADR settles `prefers-color-scheme` alone. The switcher that lets a reader override it is [ADR 0015](./0015-the-theme-choice-rides-a-cookie.md), from [Theme switcher: dark, light, system](https://github.com/shreshthmohan/self/issues/72).

## The prototype, and two CSS traps in it

The variants were judged on a throwaway route, `/proto-chrome`, on branch `prototype/site-chrome`: four axes as search parameters, so a variant is a link. It is not merged.

Two mistakes in the variant switch are worth remembering, because both look like the switch is broken:

1. `font-family` is **inherited**, not recomputed. Re-declaring the face token on a descendant changes nothing unless that descendant also re-declares `font-family`.
2. A custom property's computed value has its `var()` references **already substituted**, on the element that declares it. So `--font-sans: var(--font-body), …` on `:root` inherits downward already resolved, and overriding `--font-body` below has no effect at all.

Neither bears on the real app, which has one body face and one palette.
