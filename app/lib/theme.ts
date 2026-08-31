import { readCookie, writeCookie } from "./cookie";

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

/**
 * The theme the request carries, or null for system. Anything that is not
 * `dark` or `light` is ignored, so a hand-edited cookie cannot put an
 * arbitrary string in the HTML.
 */
export function themeFromRequest(request: Request): Theme | null {
	const value = readCookie(request.headers.get("cookie"), THEME_COOKIE);
	return value === "dark" || value === "light" ? value : null;
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
		writeCookie(THEME_COOKIE, null);
		delete document.documentElement.dataset.theme;
	} else {
		writeCookie(THEME_COOKIE, choice);
		document.documentElement.dataset.theme = choice;
	}
}
