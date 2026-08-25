# A path registry owns the root namespace

Entries, possessions, and properties all take root URLs — `/my-article`, `/trek`, `/farm`. One table owns them:

```
path(slug PRIMARY KEY, target_type, target_id)
```

Routing is one primary-key lookup, then a fetch from the named table.

A `slug` column on each of the three tables was the obvious alternative. SQLite cannot express uniqueness across tables, so that check moves into application code, where it races: two writes can both find `/farm` free. The registry makes a collision a failed insert.

## Consequences

Redirects and aliases are rows, not routes. An old path points at a redirect target, so `/c/*` from the previous site is data rather than a special case, and a renamed record leaves its old path behind by default.

Reserved words — `/admin`, `/b`, `/p`, `/re` — are seeded rows. Nothing can take them, and the reserved list is queryable rather than duplicated in route code.

Every record gets a path row on creation, generated from its name and editable, including a record shared with nobody. A collision appends a suffix (`/trek-2`), shown on the edit screen, so creation never blocks on a naming decision.

Freeing an old path instead of redirecting is an explicit choice by the owner. A freed path can later be claimed by another record, so an old inbound link may land on something else. That is the cost of the option, and it is the owner's to take.

Two writes now create a record: the row and its path. They must go in one `batch()`, which is D1's only transactional unit.

Decided in [What can go public, and the public URL scheme](https://github.com/shreshthmohan/self/issues/5).
