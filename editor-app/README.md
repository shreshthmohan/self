# PROTOTYPE — choose the rich-text editor

Throwaway. It answers issue #10 on map issue #1. Do not merge it to `main`.

## Run it

```sh
cd editor-app
npm install
npm run prototype
```

Then open `http://localhost:5180/?variant=A`. The bottom bar switches variants;
the left and right arrow keys do the same when the cursor is not in the editor.

| Variant | What it is |
| --- | --- |
| A | TipTap 3, WYSIWYG, markdown generated on save |
| B | `@uiw/react-md-editor`, a textarea with a toolbar and a preview |
| C | A bare textarea, the no-JavaScript floor |

## What to look at

Each variant starts from the same seeded section. The seed holds a GFM table, a
task list, a raw HTML `<figure>`, a footnote, and an inline image, because those
are what a document model drops.

1. Type prose. Press **Insert sample image** or **Upload an image…**.
2. Press **Save**. The entry goes to `localStorage`, key
   `PROTOTYPE-editor-wipe-me:<variant>`.
3. Reload. The **Round-trip check** panel diffs the saved markdown against the
   same markdown parsed back in and re-serialised.

## Headless checks

```sh
node roundtrip-check.mjs        # TipTap parse -> serialise, and a second pass
```

Bundle sizes came from one build per variant, `vite.measure-*.config.js`, each
measured against a bare React 19 build.
