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
 * `/b`, the blog, is a separate surface from #5 and is not built here — with
 * only `decision` and `ethos` live, it would list the same rows under a second
 * name.
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
		entries: await listEntries(db(), { viewer, kind }),
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { entries, kind, owner } = loaderData;

	return (
		<main>
			<h1 className="text-2xl font-semibold">shreshth.dev</h1>

			<nav className="mt-4 flex gap-3 text-sm">
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
				{owner && (
					<a className="ml-auto underline" href="/a/new">
						New entry
					</a>
				)}
			</nav>

			{entries.length === 0 ? (
				<p className="mt-6">There is nothing to read yet.</p>
			) : (
				<ul className="mt-6 space-y-4">
					{entries.map((entry) => (
						<li key={entry.id}>
							<h2 className="text-lg">
								{entry.slug ? (
									<a className="underline" href={`/${entry.slug}`}>
										{entry.title}
									</a>
								) : (
									entry.title
								)}
							</h2>
							<p className="text-sm">
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
