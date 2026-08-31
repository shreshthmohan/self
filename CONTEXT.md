# Personal CMS

A single-user CMS that holds everything the site publishes and everything it keeps private. One app, private by default; a record can be published.

## Language

**Entry**:
Anything prose-shaped the CMS holds — a note, an article, a decision, an ethos, a preference, a learning, an idea, a piece of purchase research, a project log, a rental-house record. An entry is a title and an ordered list of sections.
_Avoid_: Post, document, page, record

**Section**:
One markdown body, at a fixed position within an entry, with an optional heading. A section is the unit a search result points at and the unit a deep link addresses. A section with no heading reads as prose alone.
_Avoid_: Block, chunk, part

**Slug**:
A section's stored identity, unique within its entry. Generated from the heading when the section is created, and human-readable when a heading supplied it, then sticky — a rename does not recompute it. A section with no heading gets a generated identity instead, which carries no meaning and exists only so the section can be addressed. The user can regenerate a slug deliberately.
_Avoid_: Anchor, id, permalink

**Anchor**:
The fragment a deep link ends in. A section's anchor is its slug and is durable — it sits on the heading where there is one, and on the section itself where there is not. A heading inside a section body is derived at render and is not.
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

**Possession**:
A movable physical thing the owner has, wants, or once had. One possession covers the whole life of one thing — the research before it, the years of use, the disposal after. Rejected candidates are prose, not possessions.
_Avoid_: Item, asset, belonging, purchase

**Property**:
Immovable real estate the owner holds — a house, a farm, an office. Not a possession: its facts are ledger-shaped, tracked per period, and a possession has no equivalent.
_Avoid_: Estate, land, premises, building

**Status**:
Where a possession is in its life: `wanted`, `dropped`, `owned`, `sold`, `gone`. `dropped` means the owner decided against it. A status never leaves a record; it moves it out of the default view.
_Avoid_: State, stage, phase

**Local draft**:
Unsaved typing the editor keeps in one browser. It never reaches the database, it belongs to the tab that made it, and a save clears it. Not an unpublished entry — an entry nobody can read is private, which is a matter of visibility, not of being a draft.
_Avoid_: Draft, autosave, working copy

**Preview**:
The rendered view of one section, beside the textarea that holds it. It shows the section's heading and body as a reader gets them, from the same renderer the read page calls. A preview is an enhancement the browser adds after it loads: the author switches it off, and it is never there without JavaScript. It is never the stored value either — a save posts the markdown in the field, and nothing in a preview reaches the database. The code calls the element it renders into a pane.
_Avoid_: Render, WYSIWYG, live view

**Form identity**:
The identity a section carries while the editor holds it. The form mints one for a section that arrives without it, sends it back as the hidden field `section-uid`, and keys the section on it. It never reaches the database, and a save ignores it. Not a slug: a slug is stored, the author edits it, and a new section has none. The code calls it a uid.
_Avoid_: Key, temporary id, client id

**Visibility**:
Who can read a record. Read, never written: a record is public if its public flag is set, shared if it has any access row, and private if it has none. Private is not a state the owner sets — it is the state of having shared with nobody.
_Avoid_: Published, permission, privacy, access level

**Role**:
What a user is allowed to do, as against what a user is allowed to read. One of `owner` and `viewer`. There is one owner, who writes everything; a viewer only reads, and what a viewer reads is decided by visibility, not by role. The owner role is set once, by the claim; every other role is set by invitation. No form ever sets a role.
_Avoid_: Permission, admin, access level

**Claim**:
The one sign-in that makes a site its owner's. The first address to sign in takes the `owner` role, and registration closes behind it: every later unknown address is refused. A claim happens once in the life of a site, and it cannot be repeated or transferred.
_Avoid_: Bootstrap, first run, setup, install

**Audience**:
A named set of users a record is shared to — `family`, `climbing`. A record can also name a user directly; the two together decide who may read it.
_Avoid_: Group, circle, list, team

**Level**:
What a section, or a possession's money column, does to its record's visibility. One of `inherit`, `shared`, `private`. A level can only narrow: the record's visibility is the ceiling.
_Avoid_: Scope, mode, override

**Path**:
A root URL, and the row that owns it. One registry holds every path, so entries, possessions, and properties share one namespace and a collision fails loudly. A path is generated from the record's name, editable, and outlives a rename as a redirect unless the owner frees it. Deleting the record frees every word it owned — the live one and every redirect into it — so those words can be claimed again.
_Avoid_: Route, permalink, URL, vanity slug

**Notice**:
The one generic page an unpermitted reader gets — no title, no kind, no date, an invitation to sign in. Returned for a shared record read by a stranger, for a record shared with nobody, and for a slug that does not exist, so it tells a guesser nothing.
_Avoid_: Error page, 403, paywall

**Fidelity gate**:
The check that decides whether the rich editor may touch a stored body. It parses the markdown, writes it back, renders both with the site's own renderer, and compares. It passes only when a reader would see the same page. A refusal keeps the textarea and is not an error — losing a table is allowed, losing it without being asked is not.
_Avoid_: Validation, round-trip check, safety check, lint
