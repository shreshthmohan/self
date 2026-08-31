import type { Route } from "./+types/home";

import { PHASE_1_KINDS, type Kind } from "../db/vocabulary";
import { db } from "../lib/db.server";
import { listEntries } from "../lib/entries";
import { getViewer, isOwner } from "../lib/viewer";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "shreshth.dev" },
		{ name: "description", content: "Notes, decisions, and other records." },
	];
}

/**
 * The listing. What it holds depends on who is asking: the owner sees every
 * entry, anyone else sees what visibility lets them see. `kind` is one filter,
 * never a branch (#3).
 *
 * `/b`, the blog, is a separate surface from #5 and is not built here. It needs
 * `article` first. A listing of decisions, ethos, and notes under a second name
 * says nothing this one does not.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const viewer = await getViewer(request);
	const url = new URL(request.url);
	const raw = url.searchParams.get("kind");
	// An unrecognised kind filters nothing rather than 404s: a stale bookmark
	// should show the listing, not a notice that reads like a missing page.
	const kind = (PHASE_1_KINDS as readonly string[]).includes(raw ?? "")
		? (raw as Kind)
		: undefined;

	return {
		owner: isOwner(viewer),
		kind: kind ?? null,
		// What the delete of #99 lands with. It rides the query string because
		// there is no flash store: a parameter reads with JavaScript off and
		// survives a refresh, and it names an entry that no longer exists, so
		// it tells a stranger nothing they could not read on the listing.
		deleted: url.searchParams.get("deleted"),
		freed: url.searchParams.get("freed"),
		/** How many redirects went with the live word. See ADR 0017. */
		freedOthers: Number(url.searchParams.get("freedOthers") ?? 0),
		entries: await listEntries(db(), { viewer, kind }),
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { entries, kind, owner, deleted, freed, freedOthers } = loaderData;

	return (
		<main>
			{/* The header already carries the site name, so the listing names
			    what is on the page instead of repeating it. */}
			<h1 className="text-3xl">Entries</h1>

			{deleted !== null && (
				<p className="mt-4 border border-border p-3 text-sm">
					Deleted <strong>{deleted}</strong>.
					{freed !== null && (
						<>
							{" "}
							The word <code>/{freed}</code> is free again
							{freedOthers > 0 &&
								`, with ${freedOthers} ${
									freedOthers === 1 ? "redirect" : "redirects"
								} into it`}
							.
						</>
					)}
				</p>
			)}

			<nav className="mt-4 flex gap-3 text-sm text-muted">
				<a className={kind === null ? "font-semibold" : "underline"} href="/">
					All
				</a>
				{PHASE_1_KINDS.map((k) => (
					<a
						key={k}
						className={kind === k ? "font-semibold" : "underline"}
						href={`/?kind=${k}`}
					>
						{k}
					</a>
				))}
			</nav>

			{entries.length === 0 ? (
				<p className="mt-6">There is nothing to read yet.</p>
			) : (
				<ul className="mt-6 space-y-5">
					{entries.map((entry) => (
						<li key={entry.id}>
							<h2 className="text-xl">
								{entry.slug ? (
									<a
										className="underline decoration-border underline-offset-4"
										href={`/${entry.slug}`}
									>
										{entry.title}
									</a>
								) : (
									entry.title
								)}
							</h2>
							<p className="mt-1 text-sm text-muted">
								{entry.kind}
								{owner && ` · ${entry.visibility}`}
								{owner && (
									<>
										{" · "}
										<a className="underline" href={`/a/${entry.id}/edit`}>
											Edit
										</a>
									</>
								)}
							</p>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
