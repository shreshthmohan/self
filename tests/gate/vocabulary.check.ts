// The DOM has to exist before TipTap loads. Keep this line first.
import "./dom";

import { expect, test } from "@playwright/test";

import { editorVocabulary } from "../../app/lib/fidelity-gate";

/**
 * The accepted vocabulary, pinned.
 *
 * ADR 0007 fixes it at StarterKit, Image, Table, TaskList and TaskItem, and
 * the reason is not taste: what the schema holds decides what the serialiser
 * keeps, so a new extension widens what the gate passes — silently, and for
 * every entry. Adding one has to be a decision, which means editing this list
 * and saying why.
 *
 * Dropping one is the same size of change in the other direction: entries that
 * passed the gate yesterday start to refuse today.
 */
test("the schema holds exactly the accepted vocabulary", () => {
	expect(editorVocabulary()).toEqual({
		nodes: [
			"blockquote",
			"bulletList",
			"codeBlock",
			"doc",
			"hardBreak",
			"heading",
			"horizontalRule",
			"image",
			"listItem",
			"orderedList",
			"paragraph",
			"table",
			"tableCell",
			"tableHeader",
			"tableRow",
			"taskItem",
			"taskList",
			"text",
		],
		marks: ["bold", "code", "italic", "link", "strike", "underline"],
	});
});
