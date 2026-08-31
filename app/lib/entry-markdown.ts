import type { Kind, Level } from "../db/vocabulary";

/**
 * The whole entry as one markdown document. The confirm page of a delete holds
 * this in a read-only `<textarea>`, and that is the last moment the words
 * exist: D1 is the only copy and export is not built. See ADR 0017.
 *
 * The frontmatter shape is `gray-matter`'s — a `---` fence around YAML — and
 * the same shape the previous site's issues used, so the rescued text is
 * re-importable rather than only readable.
 *
 * Pure: an entry in, a string out. It holds no request and touches no
 * database, so the route stays thin and the rules are unit tested.
 *
 * The YAML is written by hand rather than by a serialiser. Every value in it
 * is closed or slugified — a kind from `KINDS`, a level from `LEVELS`, a slug
 * of `[a-z0-9-]`, a boolean — so none of them can need a quote or an escape.
 * The title is NOT in the frontmatter for that reason: it is free text, and it
 * goes below the fence as the `#` heading instead.
 */

export type MarkdownSection = {
	slug: string;
	heading: string;
	body: string;
	level: Level;
};

export type MarkdownEntry = {
	title: string;
	kind: Kind;
	isPublic: boolean;
	/** The live word, or null while the entry owns none. */
	slug: string | null;
	sections: MarkdownSection[];
};

export function entryToMarkdown(entry: MarkdownEntry): string {
	const lines = [
		"---",
		`kind: ${entry.kind}`,
		// An entry with no path row writes an empty string rather than `null`,
		// so an importer reads one type here and not two.
		`path: ${entry.slug ?? '""'}`,
		`public: ${entry.isPublic}`,
	];

	// The levels ride a list keyed on the section slug, which is the section's
	// stored identity (#2). Position would not survive a reorder on the way
	// back in.
	if (entry.sections.length === 0) {
		lines.push("sections: []");
	} else {
		lines.push("sections:");
		for (const s of entry.sections) {
			lines.push(`  - slug: ${s.slug}`, `    level: ${s.level}`);
		}
	}

	lines.push("---", "", `# ${entry.title}`);

	for (const s of entry.sections) {
		// A headingless section contributes prose alone. The entry's `#` is
		// heading enough for it, exactly as the entry page renders it (#69).
		if (s.heading !== "") lines.push("", `## ${s.heading}`);
		if (s.body !== "") lines.push("", s.body);
	}

	// A trailing newline, so the document ends the way a file does.
	return `${lines.join("\n")}\n`;
}
