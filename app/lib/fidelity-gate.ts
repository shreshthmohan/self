import { Editor, getSchema, type Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

import { renderBody } from "./markdown";

/**
 * The fidelity gate of ADR 0007.
 *
 * Markdown is the stored value and the textarea is the editor. TipTap may take
 * over that field only when it can parse the stored markdown and write it back
 * without changing what a reader sees. This module is that judgement, and
 * nothing else: it holds the accepted vocabulary, the round trip, and the
 * comparison. The route decides what to do with a refusal.
 *
 * The gate is silent when it is wrong — a gate that passes too readily lets
 * TipTap drop a table, and one that refuses too readily makes the rich editor
 * never appear. Neither shows an error. `tests/gate/` is why it stays honest.
 */

/**
 * The accepted vocabulary, as ADR 0007 fixes it: StarterKit, Image, Table,
 * TaskList and TaskItem. Nothing else. Table and TaskItem each drag their
 * child nodes with them, so the list of extensions is longer than the list of
 * five; the schema below is the honest measure of what the editor can hold.
 *
 * Raw HTML is absent on purpose. It is what the gate should keep refusing.
 */
export function editorExtensions(): Extensions {
	return [
		StarterKit,
		Image.configure({ allowBase64: true, inline: true }),
		Table,
		TableRow,
		TableCell,
		TableHeader,
		TaskList,
		TaskItem.configure({ nested: true }),
		Markdown.configure({ markedOptions: { gfm: true } }),
	];
}

/**
 * The node and mark names the vocabulary above actually yields. What the
 * schema cannot hold, the serialiser drops, so this list — not the extension
 * list — is the vocabulary a reader feels. Widening it is a decision, so a
 * test pins it.
 */
export function editorVocabulary(): { nodes: string[]; marks: string[] } {
	const schema = getSchema(editorExtensions());
	return {
		nodes: Object.keys(schema.nodes).sort(),
		marks: Object.keys(schema.marks).sort(),
	};
}

/**
 * Parse markdown into the editor's document model, then serialise it back.
 * Whatever the model cannot hold is gone by the time this returns — which is
 * the point. Needs a DOM, so it runs in the browser or under jsdom.
 */
export function roundTrip(markdown: string): string {
	const editor = new Editor({
		element: document.createElement("div"),
		extensions: editorExtensions(),
		content: markdown,
		contentType: "markdown",
	});
	try {
		return editor.getMarkdown();
	} finally {
		editor.destroy();
	}
}

/**
 * Two renderings are the same when a reader cannot tell them apart. Comments
 * carry nothing to a reader, and neither does the whitespace between tags or
 * a run of spaces inside one, so all three go before the comparison.
 *
 * This is why the gate compares rendered HTML and not bytes: serialisation
 * adds a trailing newline and pads table columns, so byte equality refuses
 * plain prose that holds no table at all (ADR 0007).
 */
export function normaliseHtml(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\s+/g, " ")
		.replace(/> </g, "><")
		.trim();
}

/**
 * The comparator. It renders with `renderBody` — the renderer the site itself
 * uses on a read page — so the gate measures what a reader sees, and stays
 * correct by construction: teach the site's renderer a new construct and the
 * gate starts to judge it with no change here.
 *
 * That shared renderer is load-bearing, and it has failed silently before:
 * `marked` ignores a `Renderer` subclass passed as `options.renderer` and runs
 * the default renderer with no warning. A gate built on the wrong renderer
 * compares the wrong two strings and PASSES. `tests/gate/renderer.check.ts`
 * checks the renderer is the configured one, not only that two strings match.
 */
export function rendersTheSame(before: string, after: string): boolean {
	return (
		normaliseHtml(renderBody(before).html) ===
		normaliseHtml(renderBody(after).html)
	);
}

export type GateVerdict = {
	/** True when TipTap may take over the field. */
	passes: boolean;
	/** What TipTap would write back. Shown in the diff when it refuses. */
	roundTripped: string;
};

/** The whole gate: round trip the stored markdown, then judge the difference. */
export function checkFidelity(markdown: string): GateVerdict {
	const roundTripped = roundTrip(markdown);
	return { passes: rendersTheSame(markdown, roundTripped), roundTripped };
}
