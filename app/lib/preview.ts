/**
 * The preview: the rendered view of one section, beside its textarea.
 *
 * Two things live here, and both belong to the browser alone.
 *
 * The PREFERENCE. It rides a cookie the browser writes and reads, as ADR 0015
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

export const PREVIEW_COOKIE = "preview";

/** One year, as the theme cookie holds. A device preference has no session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** `Secure` stays on in development: a browser counts localhost as secure. */
const COOKIE_ATTRIBUTES = "Path=/; SameSite=Lax; Secure";

/**
 * Is the preview on? Only the exact word `off` turns it off, so a hand-edited
 * cookie leaves the author with a working editor and a pane.
 *
 * The value is read raw, for the reason `themeFromRequest` gives:
 * `decodeURIComponent` throws on a malformed escape.
 */
export function previewPreference(): boolean {
	for (const pair of document.cookie.split(";")) {
		const eq = pair.indexOf("=");
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() !== PREVIEW_COOKIE) continue;
		return pair.slice(eq + 1).trim() !== "off";
	}

	return true;
}

/** Store the choice. On is the default, so on deletes the cookie. */
export function setPreviewPreference(on: boolean) {
	document.cookie = on
		? `${PREVIEW_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`
		: `${PREVIEW_COOKIE}=off; ${COOKIE_ATTRIBUTES}; Max-Age=${MAX_AGE}`;
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
 * The renderer emits an id on headings and nowhere else, so this pattern
 * cannot reach any other attribute.
 */
const stripHeadingIds = (html: string) =>
	html.replace(/(<h[1-6]) id="[^"]*"/g, "$1");

export type RenderPreview = (markdown: string) => string;

/** Held across calls: the module cache serves one fetch to every pane. */
let renderer: Promise<RenderPreview> | null = null;

export function loadPreviewRenderer(): Promise<RenderPreview> {
	renderer ??= import("./markdown").then(
		({ renderBody }) =>
			(markdown: string) =>
				stripHeadingIds(renderBody(markdown).html),
	);
	return renderer;
}
