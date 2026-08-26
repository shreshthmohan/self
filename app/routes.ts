import { type RouteConfig, index, route } from "@react-router/dev/routes";

/**
 * `/a` is the owner's write surface, and `api`, `login`, and `logout` are
 * reserved words in the `path` registry (migration 0001), so no entry can
 * claim one and shadow these routes. Edit is keyed on the entry id, not its
 * slug, so a rename does not move it.
 *
 * Better Auth mounts as a splat under `/api/auth/*` rather than as an
 * interception in `workers/app.ts`, so the URL space is readable in one file.
 *
 * `:slug` is last and matches ONE segment, so it never competes with `/a/new`
 * or with a static word above it. Every root URL resolves through the
 * registry, never through a route file. See ADR 0004.
 */
export default [
	index("routes/home.tsx"),
	// PROTOTYPE (#71) — throwaway, never merges to main.
	route("proto-chrome", "routes/proto-chrome.tsx"),
	route("api/auth/*", "routes/auth-api.tsx"),
	route("login", "routes/login.tsx"),
	route("logout", "routes/logout.tsx"),
	route("a/new", "routes/entry-new.tsx"),
	route("a/:id/edit", "routes/entry-edit.tsx"),
	route(":slug", "routes/entry.tsx"),
] satisfies RouteConfig;
