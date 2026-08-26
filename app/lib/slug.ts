/**
 * A human-readable, URL-safe word. Used two ways, with different lifetimes:
 * a `path` slug names a record in the root namespace, and a `section` slug is
 * the section's sticky identity and its durable anchor. See #2 and ADR 0004.
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

/** The shape a headingless section's generated slug takes, and its number. */
const GENERATED_SLUG = /^s-(\d+)$/;

/**
 * Section slugs for one entry, in position order.
 *
 * A slug the author typed is kept as typed. A blank one is generated from the
 * heading. A section with no heading gets `s-<n>`, a slug that carries no
 * meaning and exists only so the section can be addressed. See #69.
 *
 * A duplicate inside one entry is NOT quietly suffixed: the unique index would
 * reject it anyway, and #2 asked for a loud failure, so the caller gets the
 * offending slug back and re-renders the form.
 */
export function resolveSectionSlugs(
	sections: { slug: string; heading: string }[],
): { slugs: string[]; duplicate?: string } {
	// Pass one: every slug the author typed or a heading supplies. A headingless
	// section holds its place as `null` — its number reads the whole entry, so
	// it cannot be settled until every supplied slug is known.
	const supplied = sections.map((s) => {
		const typed = slugify(s.slug);
		if (typed) return typed;
		const fromHeading = slugify(s.heading);
		if (!fromHeading) return null;
		// `s-<n>` is reachable from a heading — "S 1" slugifies to `s-1` — so the
		// HEADING side yields, taking `-2` as ADR 0004's path collisions do. It
		// yields because `s-<n>` is a headingless section's ONLY identity and #2
		// made a slug sticky, while a heading-derived slug has a heading behind
		// it.
		//
		// The `-2` does NOT escalate to `-3` the way `freePathSlug` does. Two
		// headings that both read "S 1" both want `s-1-2`, and #2 asked a
		// duplicate inside one entry to fail loudly rather than be renamed
		// behind the author's back.
		return GENERATED_SLUG.test(fromHeading) ? `${fromHeading}-2` : fromHeading;
	});

	// Pass two: `n` is max+1 WITHIN THE ENTRY, never the position. A number read
	// off the position moves when the author reorders, which is the one thing a
	// slug promises not to do.
	let next =
		1 +
		supplied.reduce((max, slug) => {
			const match = slug?.match(GENERATED_SLUG);
			return match ? Math.max(max, Number(match[1])) : max;
		}, 0);

	const slugs: string[] = [];
	const seen = new Set<string>();
	for (const candidate of supplied) {
		const slug = candidate ?? `s-${next++}`;
		if (seen.has(slug)) return { slugs, duplicate: slug };
		seen.add(slug);
		slugs.push(slug);
	}
	return { slugs };
}
