import { and, gte, lt } from "drizzle-orm";

import type { Db } from "../db";
import { path } from "../db/schema";
import { slugify } from "./slug";

/**
 * The path registry, read side.
 *
 * This lives apart from `slug.ts` because it needs a database and that one
 * does not. `slug.ts` is pure string work, so the fidelity-gate checks can
 * import the renderer that uses it without dragging `cloudflare:workers` and
 * every table into a test program. See #42.
 */

/**
 * A slug nothing has claimed yet. A collision appends `-2`, then `-3`, exactly
 * as it would against another record — the reserved words are ordinary rows in
 * the same table, so `/admin` collides like anything else. See ADR 0004.
 *
 * This reads before it writes, so two concurrent creates can pick the same
 * word. The insert still fails on the primary key, loudly, which is the point
 * of the registry: SQLite cannot express uniqueness across three tables, and
 * this one can.
 *
 * The prefix is read as a RANGE, and not as a LIKE pattern on `base%`. D1
 * caps a LIKE or GLOB pattern at 50 bytes. `slugify` emits ASCII only, so a
 * slug of 80 characters is 80 bytes, and every slug from 50 characters up made
 * a pattern too long. SQLite raised `SQLITE_ERROR` and no such entry could be
 * saved. See #106.
 *
 * `slug` is the primary key and SQLite compares text with the BINARY
 * collation, so the range is an index scan. It has no length limit and nothing
 * to escape, and it selects the same rows: `slugify` emits `[a-z0-9-]` only,
 * and none of those sorts above U+FFFF.
 *
 * A later prefix read must use a range too. `tests/long-title.spec.ts` tests
 * this one.
 */
export async function freePathSlug(
	db: Db,
	desired: string,
	options: { ignore?: string } = {},
): Promise<string> {
	const base = slugify(desired) || "entry";
	const taken = new Set(
		(
			await db
				.select({ slug: path.slug })
				.from(path)
				.where(and(gte(path.slug, base), lt(path.slug, `${base}\uffff`)))
		).map((row) => row.slug),
	);
	if (options.ignore) taken.delete(options.ignore);

	if (!taken.has(base)) return base;
	for (let n = 2; n < 1000; n++) {
		const candidate = `${base}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
	throw new Error(`No free path slug for "${base}" after 999 tries.`);
}
