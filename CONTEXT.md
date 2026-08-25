# Personal CMS

A single-user CMS that holds everything the site publishes and everything it keeps private. One app, private by default; a record can be published.

## Language

**Entry**:
Anything prose-shaped the CMS holds — a note, an article, a decision, an ethos, a preference, a learning, an idea, a piece of purchase research, a project log, a rental-house record. An entry is a title and an ordered list of sections.
_Avoid_: Post, document, page, record

**Section**:
One heading and one markdown body, at a fixed position within an entry. A section is the unit a search result points at and the unit a deep link addresses.
_Avoid_: Block, chunk, part

**Slug**:
A section's stored, human-readable identity, unique within its entry. Generated from the heading when the section is created, then sticky — a rename does not recompute it. The user can regenerate it deliberately.
_Avoid_: Anchor, id, permalink

**Anchor**:
The fragment a deep link ends in. A section heading's anchor is its slug and is durable. A heading inside a section body is derived at render and is not.
_Avoid_: Fragment, hash

**Kind**:
The one primary axis an entry is classified on. Closed and single-valued: every entry has exactly one kind, drawn from a fixed list. A kind labels and filters; it never changes how an entry is edited or rendered. A concept that needs fields of its own is not a kind — it earns its own table.
_Avoid_: Type, category, class

**Tag**:
The open second axis on an entry. Free-form and many per entry. Where a kind is one word from a fixed list, tags are any words the owner wants, and they carry the overlap a single kind cannot hold.
_Avoid_: Label, keyword, topic

**Decision**:
An entry that records a *what* — a choice the owner made and no longer wants to re-argue. A decision is a kind, not a table: it holds prose and links, no fields of its own. Not to be confused with an ADR in `docs/adr/`, which records a decision about this code and is read next to it. Same word, two stores, on purpose.
_Avoid_: Choice, call, ruling

**Ethos**:
An entry that records a *why* — a standing belief the owner holds, which decisions rest on. A kind, like a decision. An ethos has no lifecycle: it is rewritten, never closed.
_Avoid_: Value, principle, belief

**Task**:
Something to do. **Not part of this domain.** A task carries live state that is read to be acted on and goes stale, which is the opposite of prose; it lives in Tusker. A task that bears on a decision is written as prose inside that decision.
_Avoid_: Todo, action item

**Link**:
A directed relation from one entry to another. Many per entry in both directions. A link is a fact on its own, not text inside a body, so the reverse view can be rendered — standing on an ethos and seeing every decision it justifies.
_Avoid_: Reference, connection, backlink

**Relation**:
The meaning a link carries, drawn from a fixed list: `justified-by` and `supersedes`. Each declares an inverse label, so one stored link reads both ways. A relation does not restrict which kinds sit at either end.
_Avoid_: Link type, edge, predicate

**Contact**:
A person the CMS tracks. Has its own table, because filtering on people earns the columns.

**Belonging**:
A movable physical thing the owner has, wants, or once had. One belonging covers the whole life of one thing — the research before it, the years of use, the disposal after. Rejected candidates are prose, not belongings.
_Avoid_: Item, asset, possession, purchase

**Property**:
Immovable real estate the owner holds — a house, a farm, an office. Not a belonging: its facts are ledger-shaped, tracked per period, and a belonging has no equivalent.
_Avoid_: Estate, land, premises, building

**Status**:
Where a belonging is in its life: `wanted`, `dropped`, `owned`, `sold`, `gone`. `dropped` means the owner decided against it. A status never leaves a record; it moves it out of the default view.
_Avoid_: State, stage, phase
