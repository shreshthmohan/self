# Entries link through one typed table

A decision rests on an ethos, and a later decision supersedes an earlier one. Both are entries, so both links are entry to entry, and they go in one generic table — `entry_link(from_entry_id, to_entry_id, relation)` — rather than a purpose-built `decision_ethos` table or a column on `entry`.

A column cannot hold it: one decision cites several ethos, and one ethos justifies several decisions. A purpose-built table works until the second pair of kinds wants a link, and then there are two mechanisms for one idea. The generic table puts the meaning in the `relation` column, which is the same move `kind` made — a label that never branches code.

## The shape

```sql
CREATE TABLE entry_link (
  from_entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  to_entry_id   INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  relation      TEXT    NOT NULL,
  PRIMARY KEY (from_entry_id, relation, to_entry_id)
);
CREATE INDEX entry_link_reverse ON entry_link (to_entry_id, relation);
```

There is no surrogate id, because the triple is the identity and the composite key makes a duplicate link impossible. The reverse index serves the backlink view — standing on an ethos and seeing what it has justified, which is the reason to link at all. Cascade removes the link rows when an entry goes; it does not touch the entry at the other end.

`relation` is a closed TypeScript union, validated at the app boundary and unconstrained in D1, for the reason given in [What 'kind' is on an entry](https://github.com/shreshthmohan/self/issues/3): SQLite cannot alter a `CHECK`, so a database-level enum makes every new relation a table rebuild. Two relations open the vocabulary — `justified-by` and `supersedes` — each declaring its inverse label in code. A link is stored once, directed; the reverse view is a query, not a second row.

A relation does not constrain the kinds at either end. The app is the only writer, and the links worth having are the ones nobody predicted.

## Consequences

**Two facts are derived from links, not stored.** A decision is superseded when a `supersedes` link points at it — there is no status column, so the state cannot fall out of step with the link, and it cannot be forgotten. A link is visible to a reader only when both of its entries are — a link carries no visibility of its own, so publishing a decision never forces its private ethos into public view. Both cost a join where a column read would do, which is nothing at this size.

**A whole-entry save rewrites its links.** Delete-then-insert inside one `batch()`, the same unit [Sections storage: JSON column or child table](https://github.com/shreshthmohan/self/issues/2) uses for sections, because D1 auto-commits and `batch()` is its only transaction.

**`references` was rejected as a third relation.** It would absorb every link not worth classifying, and the reverse view on every entry would fill with noise. A loose mention stays a markdown link in the prose. A third relation gets added when one specific pair of kinds asks for it.
