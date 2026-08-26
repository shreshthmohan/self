# Every uncontrolled field is guarded across the hydration gap

[ADR 0002](0002-progressive-enhancement-over-selective-hydration.md) promises that a form works before the runtime lands. On the editor the promise does not hold on its own: text typed between the first paint and hydration is discarded, and the save that follows posts the server's text.

**A guard snapshots the typed fields before `hydrateRoot` runs and restores them in a layout effect after.** The editor keeps its uncontrolled fields, so ADR 0002 stands untouched.

## The gap is real and it is one field type

Playwright, the edit page, CPU throttled 20x, the body filled as soon as the HTML committed:

```
t=1069ms  textarea.value = "edited body"   <- typed
t=1232ms  textarea.value = "created body"  <- hydration rewrote it
```

The DOM node is the same object at both samples — a marker property set at 1069 is still there at 1232. This is not a remount and not a mismatch recovery. React writes the value back on the node it hydrated.

Measured in Chromium against React 19.2, only the textarea loses text. The title, path, heading, anchor, position, checkbox and dropdown all keep what was typed. React 19 hydrates an uncontrolled `<input>` by writing the **attribute**, not the live value. A `<textarea>` carries its text as children, so React rewrites that node. The hole is one field type — and it is the body, the field that matters.

The caret goes with the text. Offset 9 before hydration, offset 12 after: the end of the server text.

The window is about a second under a 20x throttle and much shorter in production, but it is not zero. A slow phone on a cold cache paints long before it hydrates, and the editor is the one page where a person starts typing at once.

## Considered options

Five strategies, measured on the prototype:

| | text | caret | untouched form | types after |
| --- | --- | --- | --- | --- |
| 1 — today | lost | lost | ok | ok |
| 2 — seed `defaultValue` from the DOM | kept | kept | ok | ok |
| 3 — restore in a layout effect | kept | kept | ok | ok |
| 4 — controlled from the snapshot | kept | kept | ok | ok |
| 5 — client names no value | kept | kept | **blanks the textarea** | ok |

**Strategy 5 — render no value on the client.** Rejected on measurement, not taste. With no children in the client tree React empties a textarea nobody touched, which turns a rare lost edit into a routine lost entry.

**Strategy 4 — make the fields controlled from the snapshot.** It works, and it reopens ADR 0002: a controlled field is React state, and state is the thing a form must not depend on before the runtime lands.

**Strategy 2 — seed `defaultValue` from the live DOM.** Also works, and costs the same snapshot. It is the larger change, because every field in the editor has to read from the snapshot instead of from the loader.

**Strategy 3** is the smallest of the three that work. The editor's fields stay uncontrolled and stay seeded from the loader; one effect puts the typing back.

## The snapshot has to run before React does

2 and 3 both need the snapshot taken **before** `hydrateRoot`. By the time a component effect fires, React has already rewritten the node and the typing is gone.

There is no `app/entry.client.tsx` in this repo, so the fix adds one — `react-router reveal` gives the default client entry — with the snapshot as its first statement.

The guard itself is `app/lib/hydration-guard.ts`: `snapshotTyped(root)` and `restoreTyped(root, snap)`, pure, a DOM root in and plain data out, no React. That keeps the part with the measurements behind it testable on its own.

The mutable half lives apart, in `app/lib/hydration-snapshot.ts`: the client entry captures into it, and the editor takes from it. A module, not a property on `window`, so it stays typed. It is read once and cleared, which is what makes the restore fire once per document.

## The browser decides what counts as typed

The dirty test is the browser's own — `value` against `defaultValue`, `checked` against `defaultChecked`. Typing moves one and not the other.

Two properties follow, and both are the reason to use it rather than a diff against loader data:

- A field nobody touched is never restored, so the guard cannot over-fire.
- A server value that changed between paint and hydration still wins, because the field it changed is not dirty.

The restore writes through **React's own value setter**, not the element's. React 19 tracks the last value it wrote on the node; a plain assignment leaves that tracker stale and the next `input` event is swallowed — the field goes read-only in a way nothing reports.

## Consequences

**The guard runs once per document, not per navigation.** A client-side navigation into the editor has no gap and needs no restore.

**With JavaScript off the guard is a no-op**, because there is no hydration to guard against. Nothing in the no-JS path changes.

**The checks are the report.** `tests/hydration-gap.spec.ts` holds the client entry on the wire, so the page paints and takes typing with no runtime — the gap is real, not simulated. It then releases the entry and asserts the typed text survives, the caret stays where it was, and the save posts the typed body. A second case leaves the form untouched, so the guard cannot over-fire. Both run under the no-JS project as well, where there is no hydration and the guard never runs.

With the restore removed, the first case fails exactly as #89 reported: the textarea reads back the server's body.

**The guard is general, and the editor is the only caller.** It walks every named control under a root, so a second form gets the same protection by calling it. Nothing else asks for that yet.

**This is React 19 behaviour, not a contract.** Only the textarea loses text today. If a later React hydrates uncontrolled inputs by writing the value, the guard already covers them and the specs above catch the change.

Set in [Typing before hydration is lost](https://github.com/shreshthmohan/self/issues/89). Prototype and evidence on branch `prototype/hydration-gap`, at `app/components/entry-editor.prototype/`.
