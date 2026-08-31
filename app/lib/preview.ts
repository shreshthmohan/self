/**
 * The preview: the rendered view of one section, beside its textarea.
 *
 * Two things live here, and both belong to the browser alone.
 *
 * The CHOICE. It rides a cookie the browser writes and reads, as ADR 0015
 * settled for the theme. Nothing on the server reads it: the preview is an
 * enhancement (ADR 0002), so no loader and no route hands it down. Only "off"
 * is ever written — absence of the cookie means on.
 *
 * The RENDERER. `renderBody` is the one renderer the read page and the
 * fidelity gate call (ADR 0007), and the preview calls the same function. It
 * arrives by dynamic import, so `marked` reaches the browser on the editor and
 * on no read page. The promise is held here, so N panes on one page share one
 * fetch and one module.
 */

import { readCookie, writeCookie } from "./cookie";

export const PREVIEW_COOKIE = "preview";

/**
 * Is the preview on? Only the exact word `off` turns it off, so a hand-edited
 * cookie leaves the author with a working editor and a pane.
 */
export function previewFromCookie(): boolean {
	return readCookie(document.cookie, PREVIEW_COOKIE) !== "off";
}

/** Store the choice. On is the default, so on drops the cookie. */
export function rememberPreview(on: boolean) {
	writeCookie(PREVIEW_COOKIE, on ? null : "off");
}

/**
 * A body, rendered for a pane: the site's HTML with every heading id removed.
 *
 * `renderBody` deduplicates ids within ONE call, so several panes on one page
 * can emit the same id twice. A heading can also collide with a fieldset id —
 * "Section 2" slugifies to `section-2`, which the no-JS remove and split
 * buttons aim at. A pane is a view of the text and nothing links into it, so
 * it drops the ids rather than reserving a namespace for them.
 *
 * The pattern reads the id ANYWHERE in a heading's open tag, so a second
 * attribute added to the renderer leaves this working. It reaches no other
 * element: the renderer emits an id on headings and nowhere else.
 */
const stripHeadingIds = (html: string) =>
	html.replace(/(<h[1-6][^>]*?) id="[^"]*"/g, "$1");

export type RenderPreview = (markdown: string) => string;

/** Held across calls: the module cache serves one fetch to every pane. */
let renderer: Promise<RenderPreview> | null = null;

export function loadPreviewRenderer(): Promise<RenderPreview> {
	renderer ??= import("./markdown").then(
		({ renderBody }) =>
			(markdown: string) =>
				stripHeadingIds(renderBody(markdown).html),
		(reason) => {
			// A rejected promise is held like any other, so a fetch that failed
			// once would fail for every pane the author opens after it. Drop
			// it, and the next pane asks again.
			renderer = null;
			throw reason;
		},
	);
	return renderer;
}
