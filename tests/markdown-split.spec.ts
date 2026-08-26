import { expect, test } from "@playwright/test";

import { splitMarkdown } from "../app/lib/markdown-split";

/**
 * Unit tests for the split, driven straight at the pure function. No page and
 * no server: the split is markdown in and sections out, and #98 asked for it
 * to stay testable without a request.
 *
 * These run under both Playwright projects. That costs a second pass and buys
 * one place to put every test, which beats a second runner for one module.
 */

test("prose before the first level-2 heading becomes a headingless section", () => {
	const { title, sections } = splitMarkdown(
		"An opening line.\n\n## First\n\nUnder first.\n\n## Second\n\nUnder second.\n",
	);

	expect(title).toBeNull();
	expect(sections).toEqual([
		{ slug: "", heading: "", body: "An opening line.", position: 0, level: "inherit" },
		{ slug: "", heading: "First", body: "Under first.", position: 1, level: "inherit" },
		{ slug: "", heading: "Second", body: "Under second.", position: 2, level: "inherit" },
	]);
});

test("whitespace before the first level-2 heading makes no section", () => {
	const { sections } = splitMarkdown("\n   \n\n## Only\n\nBody.\n");

	expect(sections.map((s) => s.heading)).toEqual(["Only"]);
	expect(sections[0].position).toBe(0);
});

test("a level-2 heading inside a fenced code block does not split", () => {
	const markdown = [
		"## Real",
		"",
		"```md",
		"## Not a heading",
		"```",
		"",
		"After the fence.",
	].join("\n");

	const { sections } = splitMarkdown(markdown);

	expect(sections).toHaveLength(1);
	expect(sections[0].heading).toBe("Real");
	expect(sections[0].body).toContain("## Not a heading");
	expect(sections[0].body).toContain("After the fence.");
});

test("level-3 and deeper headings stay in the body", () => {
	const { sections } = splitMarkdown(
		"## Section\n\n### Deeper\n\nText.\n\n#### Deeper still\n\nMore.\n",
	);

	expect(sections).toHaveLength(1);
	expect(sections[0].body).toBe(
		"### Deeper\n\nText.\n\n#### Deeper still\n\nMore.",
	);
});

test("a paste with no level-2 heading makes one headingless section", () => {
	const { title, sections } = splitMarkdown("Just prose.\n\nTwo paragraphs.\n");

	expect(title).toBeNull();
	expect(sections).toEqual([
		{
			slug: "",
			heading: "",
			body: "Just prose.\n\nTwo paragraphs.",
			position: 0,
			level: "inherit",
		},
	]);
});

test("a leading level-1 heading becomes the title and leaves the body", () => {
	const { title, sections } = splitMarkdown(
		"# The title\n\nOpening prose.\n\n## First\n\nUnder first.\n",
	);

	expect(title).toBe("The title");
	expect(sections.map((s) => s.body)).toEqual([
		"Opening prose.",
		"Under first.",
	]);
});

test("a level-1 heading that is not first stays in the body", () => {
	const { title, sections } = splitMarkdown(
		"Opening prose.\n\n# Not the title\n\n## First\n\nUnder first.\n",
	);

	expect(title).toBeNull();
	expect(sections[0].body).toBe("Opening prose.\n\n# Not the title");
});

test("a setext heading splits like its level-2 twin", () => {
	// `Heading` with `---` under it IS a level-2 heading. #98 asked for level 2;
	// this is that level written the other way round, and it is pinned here so
	// nobody has to guess.
	const { sections } = splitMarkdown("Prose.\n\nUnderlined\n---\n\nBody.\n");

	expect(sections.map((s) => s.heading)).toEqual(["", "Underlined"]);
});

test("an empty paste makes no sections", () => {
	expect(splitMarkdown("   \n\n ")).toEqual({ title: null, sections: [] });
});
