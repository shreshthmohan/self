import { redirect } from "react-router";

import type { Route } from "./+types/login";

import { auth, isAuthOrigin } from "../lib/auth.server";
import { MailTransportError } from "../lib/email.server";
import { getViewer, notFound } from "../lib/viewer";

export function meta() {
	return [{ title: "Sign in — shreshth.dev" }];
}

/**
 * The sign-in form. Linked from nowhere: the owner types the address, and a
 * viewer follows the link in an invitation. A magic link always lands on `/`,
 * so this route takes no redirect parameter and none has to be validated.
 * See ADR 0012.
 *
 * The origin guard is repeated here, not inherited: the action calls the
 * Better Auth API directly rather than through `/api/auth/*`, so the guard on
 * that route does not cover this one. A version preview URL is public and runs
 * with PRODUCTION bindings — see auth.server.ts.
 */
export async function loader({ request }: Route.LoaderArgs) {
	if (!isAuthOrigin(request)) notFound();
	// Signing in again while signed in is a dead end, not an error.
	if (await getViewer(request)) throw redirect("/");
	return null;
}

type Outcome = "notice" | "mail-failed" | "not-an-address";

/**
 * One generic notice whichever way it went — sent, refused, or unknown. The
 * refusal happens inside `sendMagicLink` (see app/lib/auth.ts), which is why
 * this action cannot tell the cases apart and must not try. See ADR 0003.
 *
 * A Resend failure is the one exception ADR 0008 names. It happens either side
 * of the address check, so it leaks nothing, and hiding it strands the only
 * person who can fix it.
 */
export async function action({ request }: Route.ActionArgs) {
	if (!isAuthOrigin(request)) notFound();

	const form = await request.formData();
	const email = String(form.get("email") ?? "").trim();

	// A malformed address is told apart from an unknown one. It says nothing
	// about who has an account, and answering "check your mail" to a typo
	// leaves the person waiting for a message that was never addressable.
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		return { outcome: "not-an-address" as Outcome };
	}

	try {
		// `request` is passed, not only its headers: Better Auth reads it for
		// the cross-site checks on a form POST.
		await auth().api.signInMagicLink({
			body: { email },
			headers: request.headers,
			request,
		});
	} catch (error) {
		if (error instanceof MailTransportError) {
			return { outcome: "mail-failed" as Outcome };
		}
		// Everything else — a rate limit, a database error — reads as the same
		// notice. The address is never logged with it.
		console.error("login: sign-in request failed", error);
	}

	return { outcome: "notice" as Outcome };
}

export default function Login({ actionData }: Route.ComponentProps) {
	const outcome = actionData?.outcome;

	if (outcome === "notice") {
		return (
			<main>
				<h1 className="text-3xl">Check your mail</h1>
				<p className="mt-2">
					If that address can sign in, a link is on its way. It works once and
					expires in 15 minutes.
				</p>
			</main>
		);
	}

	if (outcome === "mail-failed") {
		return (
			<main>
				<h1 className="text-3xl">The mail did not send</h1>
				<p className="mt-2">
					The mail service refused the message, so no link was sent. Nothing is
					wrong with the address. The failure is in the Worker logs.
				</p>
				<p className="mt-4">
					<a className="underline" href="/login">
						Try again
					</a>
				</p>
			</main>
		);
	}

	return (
		<main>
			<h1 className="text-3xl">Sign in</h1>

			{outcome === "not-an-address" && (
				<p className="mt-2" role="alert">
					That is not an email address.
				</p>
			)}

			{/* A real form with a named field, so it submits with JavaScript off. */}
			<form method="post" action="/login" className="mt-6">
				<label className="block" htmlFor="email">
					Email address
				</label>
				<input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					required
					className="mt-1 block w-full border border-border bg-bg px-2 py-1"
				/>
				<button type="submit" className="mt-4 border border-fg bg-fg px-4 py-2 text-bg">
					Send a sign-in link
				</button>
			</form>
		</main>
	);
}
