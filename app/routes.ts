import { type RouteConfig, index, route } from "@react-router/dev/routes";

/**
 * `/a` is the owner's write surface. It is a reserved word in the `path`
 * registry (migration 0002), so no entry can claim it and shadow these routes.
 * Edit is keyed on the entry id, not its slug, so a rename does not move it.
 *
 * `:slug` is last and matches ONE segment, so it never competes with `/a/new`.
 * Every root URL resolves through the registry, never through a route file.
 * See ADR 0004.
 */
export default [
	index("routes/home.tsx"),
	route("a/new", "routes/entry-new.tsx"),
	route("a/:id/edit", "routes/entry-edit.tsx"),
	route(":slug", "routes/entry.tsx"),
] satisfies RouteConfig;
