import { like } from "drizzle-orm";

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
				.where(like(path.slug, `${base}%`))
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
