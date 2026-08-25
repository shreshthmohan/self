# A version guards the whole-entry save

The no-JS editor posts the **whole** entry — every section body — in one form, and the save is a delete-then-insert of every section in one D1 `batch()` (ADR in [Sections storage](https://github.com/shreshthmohan/self/issues/2)). That write is last-write-wins across the entry, so one stale tab silently discards sections it never showed. The CMS has one user, so this is never a race between people; it is one person with a laptop tab left open for a day and a phone in their pocket.

`entry` therefore carries a `version` integer. The editor form posts it back in a hidden field. A save reads the current version, compares, and runs the batch with `UPDATE entry SET version = version + 1 WHERE id = ? AND version = ?` as statement one. Every save bumps, including a save that changes nothing: skipping the bump needs a comparison that costs more than the write.

## Why not the alternatives

**Accept it** was the cheapest answer and the one a single-user CMS invites. It was rejected on blast radius, not on frequency: the loss is not the paragraph you were editing, it is every section in the entry, including ones the stale tab never rendered. A guard that is an integer column and a hidden field is not worth arguing about.

**Per-section writes** would shrink the blast radius, but they reopen a settled decision — the URL would have to name a section — and they break the one-form editor that decision chose.

**Autosave with a draft row** does not prevent the overwrite, only makes it recoverable, and it needs JavaScript, so the no-JS path would stay unguarded. Worse, autosave turns a stale tab from a passive hazard into an active one: it can overwrite an entry you edited elsewhere while you touch nothing.

## The guard is not atomic, and that is enough

D1 `batch()` rolls back when a statement **errors**, but a `WHERE version = ?` that matches no row is not an error — it returns zero changes and the batch commits regardless. So the check cannot live purely inside the batch; it is a `SELECT` first, then the batch. A millisecond race survives that gap. The race this guards against is hours long.

## What the author sees

Never a reject-and-reload. A rejection that discards your typing is worse than the overwrite it prevented, so the submitted text is re-rendered into the editor with a banner, and the server lists the sections that differ — added, removed, reordered, or rewritten — with a markdown diff for each. **Save anyway** carries the version from the banner, so a further change while you read re-fires the conflict.

A section whose **rendered** HTML is unchanged is grouped as "formatting only" and collapsed, reusing the fidelity gate's comparison from ADR 0007. This matters because two authoring paths write one string: TipTap re-serialises markdown even when it loses nothing, so a source diff between a JS tab and a no-JS tab lights up with changes no one made. Grouping keeps the source as the truth while sorting signal from churn. When [Canonical markdown](https://github.com/shreshthmohan/self/issues/37) settles, the group is simply always empty.

If the entry was **deleted** while the tab was open, the guarded `UPDATE` matches nothing for a different reason. The page is the same, worded for the delete, with no diff, and **Save anyway** becomes **Recreate as a new entry** — a fresh insert taking a new path, because the old slug may already be freed or redirected. Recreating it silently at the old id would quietly undo a deliberate delete.

## Scope

The version covers the `entry` row and its `section` rows, which is exactly the unit the form posts. Writes to `entry_link`, the access tables, and the `path` registry are separate facts in separate rows and never bump it. Toggling the public flag from a list page **does** bump, because that flag is a column on `entry`, and it does invalidate an open editor tab. That is correct: the row you are about to overwrite did change.

## Consequences

**There is no autosave.** Nothing reaches D1 that the author did not ask to send. A **local draft** covers the crashed tab instead: `localStorage` holds the section bodies and the version they were based on, and never writes to D1. On mount it restores silently while that version still matches the server, because then it is unambiguously your own unsaved typing in the same tab. When it does not match, it is the conflict case and gets the same banner. A draft that auto-applied regardless would be this same bug moved into the browser.

**A new entry has no version to check**, so the duplicate it invites is guarded differently: the save redirects to the entry's own URL, so a refresh re-fetches instead of re-posting. The back button can still double-post. That is accepted; a one-time token needs a store and a sweep for the unused ones.

Set in [Lost updates when a whole entry is saved](https://github.com/shreshthmohan/self/issues/12).
