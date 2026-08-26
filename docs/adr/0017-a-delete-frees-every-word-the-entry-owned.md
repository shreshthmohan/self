# A delete frees every word the entry owned

Delete is a **hard** delete. The `entry` row goes, and its sections, its `entry_link` rows at both ends, and its access rows go with it by cascade. Alongside it, in the same `batch()`, go the entry's `path` rows: the live word and every `redirect` row that resolves to it. All of those words return to the pool at once.

## Why not a soft delete

A `deleted_at` column was the reflex, and it contradicts ADR 0003. Visibility is derived and never stored: an entry is public if the flag is set, shared if it has an access row, and **private** if it has neither. An entry nobody can read is therefore already private — so a soft-deleted entry and a private entry are one state under two names. Keeping them apart would put `deleted_at IS NULL` in every listing, every access join, and later in the FTS5 query, forever, to preserve a distinction the domain does not make.

The owner who wants an entry hidden unshares it. Delete has to mean gone, or it is a second spelling of private.

## Why the whole chain of words goes

ADR 0004 lets the owner free a path instead of redirecting it, and names the cost: a freed word can be claimed by another record, and an old inbound link then lands on something else. A delete takes that cost by definition, so it is not a second choice on the confirmation.

Freeing only the live word was refused. An entry renamed twice owns redirect rows pointing at the live word; leaving them turns each one into a hop to the Notice today, and into a **wrong-destination redirect** the day another record claims that word. That is the ADR 0004 hazard with an extra hop and no owner decision behind it.

Retiring the words as `reserved` rows was the other candidate. It is safe — `resolvePath` already answers nothing for a reserved word, and a reserved word is not an existence oracle — but it makes every delete leave a permanent row that nobody can read or reuse, and the registry fills with tombstones.

## The weight sits on the confirmation

Because the schema carries no undo, the confirmation does the work. It is a page, not a dialog: `confirm()` does not exist with JavaScript off, so `GET /a/:id/delete` renders the consequences and a form `POST`s back to the same route.

The page names what will be lost, because nothing else will:

- the entry title and its section count,
- every **inbound** link, with its relation. `entry_link` removes rows, never entries — deleting an ethos removes the fact that it justified three decisions, and the three decisions are untouched. The lost fact is invisible everywhere except here.
- the words about to be freed, live and redirect,
- the whole entry as markdown, in a read-only `<textarea>`: `gray-matter` frontmatter carrying kind, path slug, public flag, and per-section levels, then the title as `#` and each section heading as `##`, bodies in order. D1 is the only copy and export is not built, so this page is the last moment the text exists. The frontmatter shape is the one the previous site's issues used, so the rescued text is re-importable rather than only readable.

The form posts the version back, so the delete runs under the ADR 0011 guard: `SELECT` the version, then `DELETE FROM entry WHERE id = ? AND version = ?` as statement one of the batch. A mismatch re-renders the page with the current facts and the new version. Without it the list of losses is decorative — another tab can add a section or a link between the `GET` and the `POST`. The guard inherits ADR 0011's honest limit: the `SELECT` and the batch are not atomic, and a millisecond race survives. The race this guards is minutes long.

## Consequences

The delete link sits on the edit page. The entry page carries none: it is a reader's view, even for the owner.

ADR 0011's stale-tab half now resolves. A guarded `DELETE` and a guarded `UPDATE` fail the same way, so **Recreate as a new entry** runs the ordinary create path with the form's `pathSlug`. `freePathSlug` already holds the rule — it takes the old word when nothing has claimed it, and appends a suffix when something has. Reusing a free word is not undoing the delete: the delete released it, and the owner is the one asking for it back.

Backup and export are now the only thing standing between the owner and a mistake. The rescue textarea covers one entry at the moment of loss; nothing covers the database.

Set in [Delete an entry, and what becomes of its path](https://github.com/shreshthmohan/self/issues/61).
