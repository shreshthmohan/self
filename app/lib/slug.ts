import { like } from "drizzle-orm";

import type { Db } from "../db";
import { path } from "../db/schema";

/**
 * A human-readable, URL-safe word. Used two ways, with different lifetimes:
 * a `path` slug names a record in the root namespace, and a `section` slug is
 * the section's sticky identity and its durable h2 anchor. See #2 and ADR 0004.
 */
export function slugify(input: string): string {
	return (
		input
			.normalize("NFKD")
			// Strip combining marks, so "café" becomes "cafe", not "caf".
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[\u2018\u2019']/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80)
			.replace(/-+$/g, "")
	);
}

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

/**
 * Section slugs for one entry, in position order.
 *
 * A slug the author typed is kept as typed. A blank one is generated from the
 * heading. A duplicate inside one entry is NOT quietly suffixed: the unique
 * index would reject it anyway, and #2 asked for a loud failure, so the caller
 * gets the offending slug back and re-renders the form.
 */
export function resolveSectionSlugs(
	sections: { slug: string; heading: string }[],
): { slugs: string[]; duplicate?: string } {
	const slugs: string[] = [];
	const seen = new Set<string>();
	for (const [index, s] of sections.entries()) {
		const slug = slugify(s.slug) || slugify(s.heading) || `section-${index + 1}`;
		if (seen.has(slug)) return { slugs, duplicate: slug };
		seen.add(slug);
		slugs.push(slug);
	}
	return { slugs };
}
