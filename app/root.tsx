import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getViewer } from "./lib/viewer";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="mx-auto max-w-2xl px-4 py-12 font-sans text-gray-900 dark:text-gray-100">
				{children}
				<ScrollRestoration />
				{/*
					Keep <Scripts /> last in <body>. StreamTransfer renders where
					<Scripts /> renders, so this keeps the second copy of an entry
					after </article>, off the critical path.
					See docs/adr/0002-progressive-enhancement-over-selective-hydration.md.
				*/}
				<Scripts />
			</body>
		</html>
	);
}

/**
 * Whether to draw the logout control. One session read per request, shared
 * with the route below through the memo in `getViewer` — see app/lib/viewer.ts.
 */
export async function loader({ request }: Route.LoaderArgs) {
	return { signedIn: (await getViewer(request)) !== null };
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<>
			{loaderData.signedIn && (
				<div className="mb-6 flex justify-end text-sm">
					{/* A real form, so it posts with JavaScript off. Signing out is
					    a POST and nothing else: a GET would let any page end the
					    session with an <img> tag. */}
					<form method="post" action="/logout">
						<button type="submit" className="underline">
							Log out
						</button>
					</form>
				</div>
			)}
			<Outlet />
		</>
	);
}

// Renders on the server, so it reads with JavaScript off.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Something went wrong";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "Not found" : "Error";
		details =
			error.status === 404
				? "There is nothing at this address."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main>
			<h1 className="text-2xl font-semibold">{message}</h1>
			<p className="mt-2">{details}</p>
			<p className="mt-4">
				<a className="underline" href="/">
					Go to the home page
				</a>
			</p>
			{stack && (
				<pre className="mt-6 w-full overflow-x-auto text-sm">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
