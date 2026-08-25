# Visibility is derived, not stored

A shareable record — an entry, a possession, a property — stores an `is_public` flag and its access rows (`<record>_audience` and `<record>_user`). It stores no visibility column. The level is read: **public** if the flag is set, **shared** if any access row exists, **private** if none does.

A stored `visibility` enum next to the same rows was the obvious alternative, and it was rejected because the two can disagree. An enum saying `shared` with zero rows, or `private` with three, forces every read to decide which one to believe — and the two writes that keep them in step sit in different parts of the edit flow.

## Consequences

"Who can see this" is a join, not a column read. The public site filters on `is_public`, which is cheap; the shared case joins two tables and takes the union. On a single-user CMS this is one indexed join.

Private stops being a state the owner sets. It is the state of not having shared yet, which is how the owner already thinks about it.

Removing the last member of an audience silently makes every record shared only to that audience private. This is accepted, not guarded: the edit screen shows the derived level, and the removal is not blocked. A guard would need to name the affected records at removal time, and the failure is safe — it hides, it does not expose.

A section, and a possession's money column, carries a `level` of `inherit`, `shared`, or `private`. A level can only narrow, so the record's derived visibility is the ceiling and one read of the record bounds everything under it.

Decided in [What can go public, and the public URL scheme](https://github.com/shreshthmohan/self/issues/5).
