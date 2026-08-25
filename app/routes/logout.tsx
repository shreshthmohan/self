import { redirect } from "react-router";

import type { Route } from "./+types/logout";

import { auth, isAuthOrigin } from "../lib/auth.server";
import { notFound } from "../lib/viewer";

/**
 * Signing out is a POST and nothing else. A GET here would let any page end
 * the owner's session with an `<img src="/logout">`, which needs no
 * JavaScript and leaves no trace on the page that fired it.
 */
export function loader() {
	notFound();
}

export async function action({ request }: Route.ActionArgs) {
	if (!isAuthOrigin(request)) notFound();

	// `returnHeaders` carries the cookie-clearing `Set-Cookie` out of the API
	// call. Without it the session row is deleted and the browser keeps a
	// cookie that no longer resolves.
	const { headers } = await auth().api.signOut({
		headers: request.headers,
		request,
		returnHeaders: true,
	});

	throw redirect("/", { headers });
}
