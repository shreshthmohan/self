/**
 * The two lines every device preference of this site is stored on.
 *
 * A preference the browser owns rides a cookie, so the server renders the
 * page the reader chose in the first byte rather than after hydration. ADR
 * 0015 settles that for the theme; the preview of #103 is the second, and one
 * pair of readers here is what keeps a third from inventing a third set of
 * attributes.
 *
 * A value is read RAW. Every value stored is plain ASCII, so there is nothing
 * to decode — and `decodeURIComponent` throws on a malformed escape, which
 * would turn one hand-edited cookie into a 500 on every page.
 */

/** One year. A device preference does not expire with a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** `Secure` stays on in development: a browser counts localhost as secure. */
const ATTRIBUTES = "Path=/; SameSite=Lax; Secure";

/**
 * One cookie out of a header. The header is a request's on the server and
 * `document.cookie` in the browser: both are the same list of pairs.
 */
export function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;

	for (const pair of header.split(";")) {
		const eq = pair.indexOf("=");
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() !== name) continue;
		return pair.slice(eq + 1).trim();
	}

	return null;
}

/** Store a value in this browser, or drop the cookie when it is `null`. */
export function writeCookie(name: string, value: string | null) {
	document.cookie =
		value === null
			? `${name}=; ${ATTRIBUTES}; Max-Age=0`
			: `${name}=${value}; ${ATTRIBUTES}; Max-Age=${MAX_AGE}`;
}
