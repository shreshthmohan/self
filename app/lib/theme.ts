/**
 * The theme choice, stored in a cookie the browser writes and the server
 * reads. See docs/adr/0015-the-theme-choice-rides-a-cookie.md.
 *
 * Two stored values only. "system" is the absence of the cookie and the
 * absence of `data-theme`, so the media query decides and an operating-system
 * change tracks live with no JavaScript running.
 */
export type Theme = "dark" | "light";

export const THEME_COOKIE = "theme";

/** One year. A device preference does not expire with a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** `Secure` stays on in development: a browser counts localhost as secure. */
const ATTRIBUTES = "Path=/; SameSite=Lax; Secure";

/**
 * The theme the request carries, or null for system. Anything that is not
 * `dark` or `light` is ignored, so a hand-edited cookie cannot put an
 * arbitrary string in the HTML.
 */
export function themeFromRequest(request: Request): Theme | null {
	return themeFromCookieHeader(request.headers.get("cookie"));
}

export function themeFromCookieHeader(header: string | null): Theme | null {
	if (!header) return null;

	for (const pair of header.split(";")) {
		const eq = pair.indexOf("=");
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() !== THEME_COOKIE) continue;

		const value = decodeURIComponent(pair.slice(eq + 1).trim());
		return value === "dark" || value === "light" ? value : null;
	}

	return null;
}

/**
 * Write the choice, then apply it — in the browser and nowhere else. React
 * never renders `data-theme`, so nothing contends for the attribute, and
 * nothing revalidates to learn what the browser just decided.
 */
export function applyTheme(theme: Theme | null) {
	if (theme) {
		document.cookie = `${THEME_COOKIE}=${theme}; ${ATTRIBUTES}; Max-Age=${MAX_AGE}`;
		document.documentElement.dataset.theme = theme;
	} else {
		document.cookie = `${THEME_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;
		delete document.documentElement.dataset.theme;
	}
}
