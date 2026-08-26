import { expect, test } from "@playwright/test";

import { renderBody } from "../../app/lib/markdown";
import { normaliseHtml, rendersTheSame } from "../../app/lib/fidelity-gate";

/**
 * The gate's comparator is only as good as the renderer under it.
 *
 * `marked` IGNORES a `Renderer` subclass passed as `options.renderer`: the
 * methods sit on the prototype, marked merges own properties only, and the
 * DEFAULT renderer runs — no warning, no type error. That defect already cost
 * this repo once, in #52, where it dropped every heading id and let a raw
 * `<script>` render as markup.
 *
 * It costs more here. The gate compares the rendered HTML of two strings, so a
 * gate built on the wrong renderer compares the wrong two strings and does not
 * fail — it PASSES. A green gate would then mean nothing.
 *
 * So the checks below read the renderer's own marks, not just an equality:
 * escaped HTML and a heading id are things the DEFAULT renderer does not do.
 */
test("the configured renderer runs, not marked's default", () => {
	const { html, headings } = renderBody("## A heading\n\n<script>x</script>\n");

	// The default renderer writes the tag through as markup.
	expect(html).toContain("&lt;script&gt;");
	expect(html).not.toContain("<script>");

	// The default renderer writes a bare `<h2>` and collects nothing.
	expect(html).toContain('id="a-heading"');
	expect(headings).toEqual([{ depth: 2, text: "A heading", id: "a-heading" }]);
});

/**
 * The comparator ignores what a reader cannot see, and nothing more. If it
 * normalised away more than whitespace and comments, it would start passing
 * rows the gate exists to refuse.
 */
test("normalisation drops comments and whitespace, and stops there", () => {
	expect(normaliseHtml("<p>a  b</p>\n<p>c</p>")).toBe("<p>a b</p><p>c</p>");
	expect(normaliseHtml("<p>a</p><!-- note -->")).toBe("<p>a</p>");
	expect(rendersTheSame("A **bold** word.", "A __bold__ word.")).toBe(true);
	expect(rendersTheSame("A **bold** word.", "A bold word.")).toBe(false);
});
