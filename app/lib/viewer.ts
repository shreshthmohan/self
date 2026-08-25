import type { Role } from "../db/vocabulary";

/**
 * Who is asking. The seam a real sign-in fills.
 *
 * Better Auth is chosen, researched, and declared (ADR 0010), but no handler
 * serves it yet — that is #43. Until it does, this module is the ONLY place
 * that answers "who is this", so #43 replaces one function body and every
 * caller stays as it is.
 *
 * The rule while the seam is empty: the owner exists on `pnpm dev` and NOWHERE
 * else. `import.meta.env.DEV` is resolved at BUILD time, so a deployed bundle
 * carries the `null` branch and nothing more — a version preview URL runs with
 * production bindings (see scripts/build.sh), and an unguarded editor there
 * would write to the production database.
 */
export type Viewer = { id: string; role: Role };

const LOCAL_OWNER: Viewer = { id: "local-owner", role: "owner" };

export function getViewer(_request: Request): Viewer | null {
	// #43 replaces this body with a Better Auth session read. Keep the
	// signature: `request` carries the cookie a real session needs.
	return import.meta.env.DEV ? LOCAL_OWNER : null;
}

export function isOwner(viewer: Viewer | null): boolean {
	return viewer?.role === "owner";
}

/**
 * The one generic notice. Every unpermitted request gets it — a private entry,
 * an unknown slug, a write route with no owner behind it — so there is no
 * existence oracle. See ADR 0003 and #5.
 *
 * The wording lives in the root ErrorBoundary, which renders on the server and
 * so reads with JavaScript off.
 */
export function notFound(): never {
	throw new Response(null, { status: 404 });
}

/** Only the owner writes. Anyone else gets the same notice as a bad slug. */
export function requireOwner(request: Request): Viewer {
	const viewer = getViewer(request);
	if (!isOwner(viewer)) notFound();
	return viewer as Viewer;
}
