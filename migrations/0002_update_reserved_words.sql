-- The reserved word list, reconciled.
--
-- `0001_seed_reserved_paths.sql` was EDITED to seed the corrected list: it now
-- adds `a`, and it names `login` and `logout` where it used to name `sign-in`
-- and `sign-out`. A database built from scratch therefore never sees the old
-- words, and this migration does nothing to it — the INSERT is
-- `OR IGNORE` and the DELETE matches no row.
--
-- This file exists for the databases where 0001 ALREADY RAN. Wrangler records
-- a migration by NAME, so editing 0001 does not re-run it on production `self`,
-- which applied it on the first migrated deploy. Without this file, `self` and
-- a fresh database would hold different lists and nothing would say so.
--
-- Editing an applied migration is normally wrong for exactly that reason. It
-- was allowed here because 0001 had run on ONE database, that database held no
-- entries, and this file closes the gap it opened.
--
-- Removing a reserved word is also normally forbidden (#51, ADR 0004): a freed
-- word can be claimed by a record, and an old inbound link then lands
-- somewhere else. That reason does not reach these two. The rule protects a
-- word that WAS live. `sign-in` and `sign-out` never served a request — no
-- route mounted there, no record held them, no link pointed at them.
--
-- The DELETE is narrowed to `target_type = 'reserved'` all the same. Had
-- either word been claimed, this leaves it alone rather than freeing a live
-- path.
--
-- Which URL Better Auth mounts at is #43's decision. These rows only hold the
-- words.
--
-- Hand-written, not generated: `drizzle-kit` writes schema, never data.

INSERT OR IGNORE INTO path (slug, target_type, target_id, redirect_to, created_at) VALUES
	('a',      'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('login',  'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer)),
	('logout', 'reserved', NULL, NULL, cast(unixepoch('subsecond') * 1000 as integer));

DELETE FROM path WHERE slug IN ('sign-in', 'sign-out') AND target_type = 'reserved';
