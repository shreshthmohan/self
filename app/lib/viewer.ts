import type { Role } from "../db/vocabulary";
import { auth } from "./auth.server";

/**
 * Who is asking. The seam a real sign-in fills, now filled.
 *
 * One Better Auth session read against D1 per request that carries a session
 * cookie — no `cookieCache`, no `secondaryStorage`, so revocation is
 * immediate. A request with no cookie never reaches the database. See ADR 0009.
 *
 * The `import.meta.env.DEV` owner that stood here while the seam was empty is
 * gone. Local signs in for real off the URL the Worker console prints, so
 * there is one way to become the owner and production exercises it.
 *
 * This is async, and every caller awaits it. The stub could be synchronous; a
 * session read cannot.
 */
export type Viewer = { id: string; role: Role };

/**
 * One read per REQUEST, not one per call. The root route reads the viewer to
 * decide whether to show the logout control, and the route under it reads the
 * same viewer to decide what the viewer may see; both loaders run against the
 * same `Request`, so without this the page costs two session reads.
 *
 * A `WeakMap` and not a module variable: an isolate serves many requests, and
 * a cache keyed on anything wider would hand one visitor another's session.
 * ADR 0009's rule is untouched — a new request still reads D1.
 */
const perRequest = new WeakMap<Request, Promise<Viewer | null>>();

export function getViewer(request: Request): Promise<Viewer | null> {
	const cached = perRequest.get(request);
	if (cached) return cached;

	const pending = readViewer(request);
	perRequest.set(request, pending);
	return pending;
}

async function readViewer(request: Request): Promise<Viewer | null> {
	const session = await auth().api.getSession({ headers: request.headers });
	if (!session) return null;
	return { id: session.user.id, role: session.user.role as Role };
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
export async function requireOwner(request: Request): Promise<Viewer> {
	const viewer = await getViewer(request);
	if (!isOwner(viewer)) notFound();
	return viewer as Viewer;
}
