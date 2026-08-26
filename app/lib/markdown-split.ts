import { Lexer, type Token } from "marked";

import type { Level } from "../db/vocabulary";

/**
 * One markdown blob, split into sections on level-2 headings. See #98.
 *
 * Pure: markdown in, sections out. It holds no request and touches no
 * database, so the route stays thin and the rules below are unit tested.
 *
 * It lexes with `marked` rather than matching line starts. A regex calls a
 * `##` inside a fenced code block a heading; the lexer knows the fence. The
 * renderer already depends on `marked`, so this costs nothing.
 *
 * The split sets every slug to the empty string and lets `resolveSectionSlugs`
 * fill it — a heading gives a readable slug, a headingless section gets a
 * generated one. That is the rule a manually created section already follows.
 *
 * It imports no database module on purpose. `entries.ts` carries `SectionInput`
 * and reaches Drizzle through it, and the unit tests run this file outside the
 * Worker. So the shape is restated below instead of imported; it is structural,
 * so `parseEntryForm` still assigns it straight into `SectionInput[]`.
 */

/** `SectionInput` in `entries.ts`, restated. See the note above. */
export type SplitSection = {
	slug: string;
	heading: string;
	body: string;
	position: number;
	level: Level;
};

export type SplitMarkdown = {
	/**
	 * The entry title, when the paste opens with a level-1 heading. `null`
	 * otherwise, and the caller keeps whatever the title field holds.
	 */
	title: string | null;
	sections: SplitSection[];
};

/**
 * Drop blank lines off both ends and nothing else. Canonical markdown is #37;
 * this must not quietly rewrite what the author pasted.
 */
function trimBlankLines(text: string): string {
	const lines = text.split("\n");
	while (lines.length > 0 && lines[0].trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
	return lines.join("\n");
}

export function splitMarkdown(markdown: string): SplitMarkdown {
	// The same flavour the renderer parses with, so the two agree on a fence.
	// A setext heading — the text with `---` under it — lexes to depth 2 here
	// and splits like a `##`. That is the level #98 asked for, written the
	// other way round.
	const tokens: Token[] = Lexer.lex(markdown, { gfm: true, breaks: false });

	// A level-1 heading is the title only when it opens the paste. The entry
	// renders its title as the h1, so a `#` left in a body would print twice.
	// Leading blank lines are not text, so they do not cost the paste its title.
	let title: string | null = null;
	let start = 0;
	while (start < tokens.length && tokens[start].type === "space") start++;
	const first = tokens[start];
	if (first && first.type === "heading" && first.depth === 1) {
		title = first.text.trim();
		start++;
	}

	const sections: SplitSection[] = [];
	let heading = "";
	let body: string[] = [];

	const flush = () => {
		const text = trimBlankLines(body.join(""));
		// Whitespace alone makes no section. A heading does, even with no body.
		if (heading !== "" || text !== "") {
			sections.push({
				slug: "",
				heading,
				body: text,
				position: sections.length,
				level: "inherit",
			});
		}
		heading = "";
		body = [];
	};

	for (const token of tokens.slice(start)) {
		if (token.type === "heading" && token.depth === 2) {
			flush();
			heading = token.text.trim();
			continue;
		}
		body.push(token.raw);
	}
	flush();

	return { title, sections };
}
