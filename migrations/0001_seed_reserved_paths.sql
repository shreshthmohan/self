-- Reserved words in the root namespace.
--
-- `path` owns one namespace across entries, possessions, and properties, so a
-- collision is a failed insert rather than a race (ADR 0004). These rows exist
-- only to hold a word: `target_type` is `reserved`, and both `target_id` and
-- `redirect_to` stay null. A record whose generated slug hits one of them gets
-- the `-2` suffix, exactly as it would against another record.
--
-- Hand-written, not generated: `drizzle-kit` writes schema, never data.
--
-- Adding a word later is a new migration. REMOVING one is not additive — a
-- freed word can be claimed by a record, and an old inbound link then lands
-- somewhere else. See ADR 0006.
--
-- `login` and `logout` replaced `sign-in` and `sign-out` here, and `a` was
-- added, after this file had already run on production `self`. Wrangler
-- records a migration by NAME and will not re-run an edited one, so `self` was
-- dropped and both migrations replayed from clean. That was safe only because
-- the database held no rows at all — no entry, no section, no user, no claimed
-- path. Editing an applied migration is otherwise wrong: the live database and
-- a fresh one build different lists, and nothing ever says so.
--
-- Do not repeat this once the database holds anything. A correction is then a
-- new migration, and the reserved list simply carries a dead word.

INSERT OR IGNORE INTO path (slug, target_type, target_id, redirect_to, created_at) VALUES
	-- Index paths (#5, section 7).
	('b',            'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('p',            'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('re',           'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	-- `/c/*` redirects to `/b`; the prefix itself stays free for tags later.
	('c',            'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),

	-- The owner's write surface: `/a/new`, `/a/<id>/edit`.
	('a',            'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),

	-- Auth and owner routes. Better Auth mounts under `/api/auth/*`.
	('api',          'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('login',        'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('logout',       'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('account',      'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('admin',        'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),

	-- Served by the asset handler or a route, never by a record.
	('assets',       'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('search',       'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('robots.txt',   'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('sitemap.xml',  'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('favicon.ico',  'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer));
