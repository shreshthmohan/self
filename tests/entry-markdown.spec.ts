import { expect, test } from "@playwright/test";

import { entryToMarkdown } from "../app/lib/entry-markdown";

/**
 * Unit tests for the rescue text, driven straight at the pure function. The
 * confirm page of #99 is the last moment an entry's words exist, so what this
 * emits has to be re-importable and not only readable — the frontmatter shape
 * is `gray-matter`'s, which the previous site's issues used (ADR 0017).
 */

test("the frontmatter carries kind, path, the public flag, and every level", () => {
	const markdown = entryToMarkdown({
		title: "A decision",
		kind: "decision",
		isPublic: true,
		slug: "a-decision",
		sections: [
			{ slug: "why", heading: "Why", body: "Because.", level: "inherit" },
			{ slug: "s-2", heading: "", body: "Prose alone.", level: "private" },
		],
	});

	expect(markdown).toBe(
		[
			"---",
			"kind: decision",
			"path: a-decision",
			"public: true",
			"sections:",
			"  - slug: why",
			"    level: inherit",
			"  - slug: s-2",
			"    level: private",
			"---",
			"",
			"# A decision",
			"",
			"## Why",
			"",
			"Because.",
			"",
			"Prose alone.",
			"",
		].join("\n"),
	);
});

test("an entry that owns no word writes an empty path", () => {
	const markdown = entryToMarkdown({
		title: "Unreachable",
		kind: "note",
		isPublic: false,
		slug: null,
		sections: [],
	});

	expect(markdown).toBe(
		["---", "kind: note", 'path: ""', "public: false", "sections: []", "---", "", "# Unreachable", ""].join(
			"\n",
		),
	);
});

test("a body keeps its own blank lines and its own headings", () => {
	const markdown = entryToMarkdown({
		title: "Kept",
		kind: "note",
		isPublic: false,
		slug: "kept",
		sections: [
			{
				slug: "one",
				heading: "One",
				body: "First.\n\n### Deeper\n\nSecond.",
				level: "inherit",
			},
		],
	});

	expect(markdown).toContain("## One\n\nFirst.\n\n### Deeper\n\nSecond.\n");
});
