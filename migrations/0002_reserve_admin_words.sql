-- Three more reserved words in the root namespace.
--
-- `a` holds the owner's write surface: `/a/new` and `/a/<id>/edit`. Without
-- this row an entry can claim `/a` and shadow every write route.
--
-- `login` and `logout` are the words the sign-in routes will use. `sign-in`
-- and `sign-out` stay seeded next to them, unused. A reserved word is NEVER
-- freed: a freed word can be claimed by a record, and an old inbound link
-- then lands somewhere else (#51, ADR 0004). Two dead words is the cost of
-- that rule holding.
--
-- Which URL Better Auth actually mounts at is #43's decision. These rows only
-- hold the words.
--
-- Hand-written, not generated: `drizzle-kit` writes schema, never data.

INSERT OR IGNORE INTO path (slug, target_type, target_id, redirect_to, created_at) VALUES
	('a',      'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('login',  'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('logout', 'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer));
