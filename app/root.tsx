import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getViewer, isOwner } from "./lib/viewer";

/**
 * One webfont on the wire: Fraunces, roman only, for the headings. The body
 * and mono faces are system stacks and cost nothing. The italic axis is
 * 81.7 KB and no heading on this site is italic. See ADR 0014.
 */
export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&display=swap",
	},
	{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
	{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
	{ rel: "manifest", href: "/site.webmanifest" },
];

/**
 * The chrome lives here rather than in the default export, so an error page
 * wears it too. The page width sits on the content wrapper and NOT on
 * `<body>`, so the header's bottom rule spans the viewport.
 */
export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{/* stone-50 and stone-950: the two --color-bg values in app.css. */}
				<meta
					name="theme-color"
					media="(prefers-color-scheme: light)"
					content="#fafaf9"
				/>
				<meta
					name="theme-color"
					media="(prefers-color-scheme: dark)"
					content="#0c0a09"
				/>
				<Meta />
				<Links />
			</head>
			<body className="flex min-h-screen flex-col font-sans">
				<Header />
				<Shell className="grow py-10">{children}</Shell>
				<Footer />
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
 * A full-width bottom rule and no fill, so the header separates the chrome
 * from the content without becoming an object of its own. It carries the site
 * title linking home, an owner-only "New entry", and "Log out".
 *
 * The header reads the loader data through the hook, not through props.
 * `Layout` also renders the error page, where the root loader may never have
 * run. An undefined read means no owner and no session, which is the safe
 * chrome.
 */
function Header() {
	const data = useRouteLoaderData<typeof loader>("root");

	return (
		<header className="border-b border-border py-4">
			<Shell className="flex items-baseline gap-4">
				<a href="/" className="font-serif text-xl">
					shreshth.dev
				</a>
				<nav className="ml-auto flex items-baseline gap-4 text-sm">
					{data?.owner && (
						<a className="underline" href="/a/new">
							New entry
						</a>
					)}
					{data?.signedIn && (
						/* A real form, so it posts with JavaScript off. Signing out is
						   a POST and nothing else: a GET would let any page end the
						   session with an <img> tag. */
						<form method="post" action="/logout">
							<button type="submit" className="underline">
								Log out
							</button>
						</form>
					)}
				</nav>
			</Shell>
		</header>
	);
}

/**
 * A name and a short link row, on a plain top rule — no surface fill. The
 * rule spans the viewport, like the header's, so the two match.
 */
function Footer() {
	return (
		<footer className="border-t border-border py-8">
			<Shell className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
				<span>Shreshth Mohan</span>
				<a
					className="ml-auto underline"
					href="https://github.com/shreshthmohan"
				>
					GitHub
				</a>
				<a className="underline" href="https://github.com/shreshthmohan/self">
					Source
				</a>
			</Shell>
		</footer>
	);
}

/**
 * The page width, in one place. The header and the footer draw their rules
 * outside it, so a rule spans the viewport and its content does not.
 */
function Shell(props: { className?: string; children: React.ReactNode }) {
	return (
		<div className={`mx-auto w-full max-w-2xl px-4 ${props.className ?? ""}`}>
			{props.children}
		</div>
	);
}

/**
 * What the header draws. One session read per request, shared with the route
 * below through the memo in `getViewer` — see app/lib/viewer.ts.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const viewer = await getViewer(request);
	return { signedIn: viewer !== null, owner: isOwner(viewer) };
}

export default function App() {
	return <Outlet />;
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
			<h1 className="text-3xl">{message}</h1>
			<p className="mt-2">{details}</p>
			<p className="mt-4">
				<a className="underline" href="/">
					Go to the home page
				</a>
			</p>
			{stack && (
				<pre className="mt-6 w-full overflow-x-auto font-mono text-sm">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
