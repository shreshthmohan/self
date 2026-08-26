import { Marked, type Renderer, type Tokens } from "marked";

type RendererThis = { parser: Renderer["parser"] };

import { slugify } from "./slug";

/**
 * Markdown to HTML, with raw HTML ESCAPED rather than passed through.
 *
 * #10 fixed the accepted vocabulary as StarterKit, Image, Table, TaskList and
 * TaskItem, with no raw HTML. So a `<script>` in a body is not a thing to
 * sanitise, it is text the author typed, and it renders as text. This buys the
 * safety a sanitiser would, without a second dependency deciding what survives.
 *
 * `marked` is here already: ADR 0007 makes it the fidelity gate's comparator,
 * which compares the RENDERED HTML of the stored markdown against the
 * editor's re-serialisation. That gate is #42's work, not this module's; this
 * module is the renderer both sides will call.
 */

export type Heading = { depth: number; text: string; id: string };

export type RenderedBody = {
	html: string;
	/** Every heading in the body, in document order, with the id it rendered. */
	headings: Heading[];
};

const escapeHtml = (raw: string) =>
	raw
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/**
 * A heading inside a body is derived at render and is NOT durable — only a
 * section's stored slug is (CONTEXT.md, "Anchor"). Deriving it here, in the
 * same pass that collects it for the table of contents, is what keeps the
 * anchor and the link from drifting apart.
 */
function renderBody(markdown: string): RenderedBody {
	const headings: Heading[] = [];
	const used = new Map<string, number>();

	// `.use({ renderer })` is the documented override path: marked merges the
	// object's OWN properties over the default renderer. Passing a Renderer
	// SUBCLASS as `options.renderer` does not work — its methods live on the
	// prototype, so nothing is merged and the defaults render silently. That
	// failure is invisible in a unit test that only reads the HTML back, so it
	// is written down here: it let a raw `<script>` through once.
	const marked = new Marked({ gfm: true, breaks: false });

	marked.use({
		renderer: {
			html(token: Tokens.HTML | Tokens.Tag) {
				return escapeHtml(token.text);
			},

			heading(this: RendererThis, token: Tokens.Heading) {
				const text = this.parser.parseInline(token.tokens);
				const plain = text.replace(/<[^>]*>/g, "");
				const base = slugify(plain) || `heading-${headings.length + 1}`;
				const seen = used.get(base) ?? 0;
				used.set(base, seen + 1);
				const id = seen === 0 ? base : `${base}-${seen + 1}`;
				headings.push({ depth: token.depth, text: plain, id });
				return `<h${token.depth} id="${escapeHtml(id)}">${text}</h${token.depth}>\n`;
			},
		},
	});

	return { html: marked.parse(markdown, { async: false }), headings };
}

export type RenderedSection = {
	slug: string;
	heading: string;
	body: RenderedBody;
};

/**
 * One entry's sections, rendered. The section anchor is the section's STORED
 * slug, so a deep link survives a heading rename; the h3 anchors come from
 * `renderBody` and do not. See #2.
 */
export function renderSections(
	sections: { slug: string; heading: string; body: string }[],
): RenderedSection[] {
	return sections.map((s) => ({
		slug: s.slug,
		heading: s.heading,
		body: renderBody(s.body),
	}));
}

export type TocEntry = {
	id: string;
	text: string;
	children: { id: string; text: string }[];
};

/**
 * "On this page": one node per headed section, with the body's h3 headings
 * nested under it. Deeper headings render with an id and stay out of the list —
 * a table of contents that mirrors every level stops being a summary.
 *
 * A headingless section contributes nothing, and its h3s stay out with it: #2
 * made the top level durable on purpose, so nothing is promoted into it, and a
 * placeholder label would put a word on screen the author never wrote. See #69.
 * A one-section entry then reaches `entry.tsx` with an empty list, which its
 * `toc.length > 1` gate already suppresses.
 */
export function tableOfContents(sections: RenderedSection[]): TocEntry[] {
	return sections
		.filter((s) => s.heading !== "")
		.map((s) => ({
			id: s.slug,
			text: s.heading,
			children: s.body.headings
				.filter((h) => h.depth === 3)
				.map((h) => ({ id: h.id, text: h.text })),
		}));
}

export { renderBody };
