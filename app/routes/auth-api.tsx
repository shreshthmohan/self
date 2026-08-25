import type { Route } from "./+types/auth-api";

import { auth, isAuthOrigin } from "../lib/auth.server";
import { notFound } from "../lib/viewer";

/**
 * Better Auth's own endpoints, under `/api/auth/*`. `api` is a reserved word
 * in the `path` registry (migration 0001), so no entry can claim it and shadow
 * this route.
 *
 * The handler is mounted in the router rather than intercepted in
 * `workers/app.ts`, so the URL space is readable in one file. It answers both
 * verbs: sign-in is a POST, and the magic-link click is a GET that redirects
 * with a `Set-Cookie` — which is what makes the click work with JavaScript off.
 *
 * `isAuthOrigin` keeps auth off a version preview URL. See auth.server.ts.
 */
function handle({ request }: Route.LoaderArgs | Route.ActionArgs) {
	if (!isAuthOrigin(request)) notFound();
	return auth().handler(request);
}

export const loader = handle;
export const action = handle;
