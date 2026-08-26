# PROTOTYPE — the hydration gap in the editor (#89)

Throwaway. Nothing here ships. It sits next to `app/components/entry-editor.tsx`
because that is the file it is about.

## The question

The edit page paints server HTML first and hydrates a moment later. A person can
type in that window, and today React throws the typing away
([#89](https://github.com/shreshthmohan/self/issues/89)).

**Which way of writing the fields keeps what a person typed — the text, the
caret, the checkbox — and still leaves a working editor behind?**

## Run it

Open `hydration-gap.prototype.html`. One file, no server, no install.

The form in the page is real server HTML that is **not** hydrated. Type into it,
then press **Hydrate now** to land the runtime by hand. The table reports what
each field held before and after. Five strategies, six walkthroughs.

Rebuild after an edit to `src.jsx`, `hydration-guard.js` or `shell.html`:

```
node app/components/entry-editor.prototype/build.mjs
```

The bundle is React in development mode, so React's own hydration warnings show
up in the page.

## The pieces

| File | What it is |
| --- | --- |
| `hydration-guard.js` | The part meant to survive: `snapshotTyped(root)` and `restoreTyped(root, snap)`. Pure, no React. |
| `src.jsx` | The five strategies, the walkthroughs, the plain-DOM shell. Throwaway. |
| `shell.html` | Page frame and styles. Throwaway. |
| `build.mjs` | esbuild → one inline script. |
| `hydration-gap.prototype.html` | The built file. Committed so it opens with no install. |

## What it found

Measured in Chromium, React 19.2, the same version the app runs.

1. **Only the textarea loses text.** At baseline, `title`, `path-slug`, the
   heading, the anchor, the position, the checkbox and the dropdown all keep
   what was typed. React 19 hydrates an uncontrolled `<input>` by writing the
   *attribute*, not the live value. A `<textarea>` carries its text as children,
   and React rewrites that node's value. The issue reads the hole as
   editor-wide; it is one field type — which is the field that matters, because
   the body is where a person types.
2. **The caret goes too.** Baseline moved the caret from offset 9 to 12, the end
   of the server text. Text alone is not the whole loss.
3. **Three fixes hold, one does not.**
   - **2 — seed `defaultValue` from the DOM.** Text kept, caret kept, no
     warning.
   - **3 — restore in a layout effect.** Text kept, caret kept, no warning.
   - **4 — controlled from the snapshot.** Text kept, caret kept, no warning.
   - **5 — name no value on the client** (`suppressHydrationWarning`, no
     `defaultValue`). Keeps typed text, but **blanks an untouched textarea**:
     with no children in the client tree React empties the node. Rejected.
4. **Every fix still types afterwards.** Typing after hydration reaches the form
   data in all five.
5. **A fix must not fire when nobody typed.** The guard's dirty test is the
   browser's own — `value` against `defaultValue`, `checked` against
   `defaultChecked`. An untouched field is never restored, so a server value
   that changed between paint and hydration still wins.

## What it means for the real code

Strategies 2 and 3 both need the snapshot taken **before `hydrateRoot` runs**.
By the time a component effect fires, React has already rewritten the node. The
app has no `app/entry.client.tsx` yet — it runs React Router's default client
entry — so the fix needs one, with the snapshot as the first statement in it.

Strategy 3 is the smaller change: `entry-editor.tsx` keeps its uncontrolled
fields and ADR 0002 stands untouched. Strategy 2 threads a module-level snapshot
into the component's props. Strategy 4 rewrites every field and hands the editor
to React, which is the most change for the same result.
