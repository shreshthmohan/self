/**
 * The theme choice, stored in a cookie the browser writes and the server
 * reads. See docs/adr/0015-the-theme-choice-rides-a-cookie.md.
 *
 * Two values reach the cookie. "System" is the absence of the cookie and the
 * absence of `data-theme`, so the media query decides and an operating-system
 * change tracks live with no JavaScript running.
 */
export type Theme = "dark" | "light";

/** What the control offers. The third state is the absence of the other two. */
export type Choice = Theme | "system";

export const THEME_COOKIE = "theme";

/** One year. A device preference does not expire with a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** `Secure` stays on in development: a browser counts localhost as secure. */
const COOKIE_ATTRIBUTES = "Path=/; SameSite=Lax; Secure";

/**
 * The theme the request carries, or null for system. Anything that is not
 * `dark` or `light` is ignored, so a hand-edited cookie cannot put an
 * arbitrary string in the HTML.
 *
 * The value is read raw. Both stored values are plain ASCII, so there is
 * nothing to decode — and `decodeURIComponent` throws on a malformed escape,
 * which would turn one bad cookie into a 500 on every page.
 */
export function themeFromRequest(request: Request): Theme | null {
	const header = request.headers.get("cookie");
	if (!header) return null;

	for (const pair of header.split(";")) {
		const eq = pair.indexOf("=");
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() !== THEME_COOKIE) continue;

		const value = pair.slice(eq + 1).trim();
		return value === "dark" || value === "light" ? value : null;
	}

	return null;
}

/** What the control shows for a stored theme. Absence reads as system. */
export function toChoice(theme: Theme | null): Choice {
	return theme ?? "system";
}

/**
 * Store the choice, then apply it — in the browser and nowhere else. React
 * never renders `data-theme` after the first paint, so nothing contends for
 * the attribute, and nothing revalidates to learn what the browser just
 * decided.
 */
export function setTheme(choice: Choice) {
	if (choice === "system") {
		document.cookie = `${THEME_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
		delete document.documentElement.dataset.theme;
	} else {
		document.cookie = `${THEME_COOKIE}=${choice}; ${COOKIE_ATTRIBUTES}; Max-Age=${MAX_AGE}`;
		document.documentElement.dataset.theme = choice;
	}
}
