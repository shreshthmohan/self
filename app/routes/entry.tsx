import { redirect } from "react-router";

import type { Route } from "./+types/entry";

import { db } from "../lib/db.server";
import { loadEntry, resolvePath } from "../lib/entries";
import { renderSections, tableOfContents } from "../lib/markdown";
import { getViewer, isOwner, notFound } from "../lib/viewer";

/**
 * One root URL. The `path` registry resolves it — a reserved word, an unknown
 * word, and an entry this viewer may not read all end in the SAME generic
 * notice, so nothing here answers "does that exist". See ADR 0003 and ADR 0004.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
	const handle = db();
	const target = await resolvePath(handle, params.slug);
	if (!target) notFound();
	if (target.type === "redirect") throw redirect(`/${target.to}`, 301);

	const viewer = getViewer(request);
	const entry = await loadEntry(handle, target.id, viewer);
	if (!entry) notFound();

	const sections = renderSections(entry.sections);

	return {
		owner: isOwner(viewer),
		id: entry.id,
		title: entry.title,
		kind: entry.kind,
		sectionsWithheld: entry.sectionsWithheld,
		sections,
		toc: tableOfContents(sections),
	};
}

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: loaderData ? `${loaderData.title} — shreshth.dev` : "shreshth.dev" },
	];
}

export default function Entry({ loaderData }: Route.ComponentProps) {
	const { sections, toc, title, kind, owner, sectionsWithheld, id } = loaderData;

	return (
		<main>
			<p className="text-sm">
				<a className="underline" href="/">
					All entries
				</a>
				{owner && (
					<>
						{" · "}
						<a className="underline" href={`/a/${id}/edit`}>
							Edit
						</a>
					</>
				)}
			</p>

			<article className="mt-4">
				<h1 className="text-2xl font-semibold">{title}</h1>
				<p className="mt-1 text-sm">{kind}</p>

				{toc.length > 1 && (
					<nav className="mt-6 border-l-2 border-gray-300 pl-4">
						<h2 className="text-sm font-semibold">On this page</h2>
						<ul className="mt-2 space-y-1 text-sm">
							{toc.map((node) => (
								<li key={node.id}>
									<a className="underline" href={`#${node.id}`}>
										{node.text}
									</a>
									{node.children.length > 0 && (
										<ul className="mt-1 ml-4 space-y-1">
											{node.children.map((child) => (
												<li key={child.id}>
													<a className="underline" href={`#${child.id}`}>
														{child.text}
													</a>
												</li>
											))}
										</ul>
									)}
								</li>
							))}
						</ul>
					</nav>
				)}

				{sections.map((s) => (
					<section key={s.slug} className="mt-8">
						{/* The h2 anchor is the section's STORED slug, so a deep link
						    survives a heading rename. Anchors inside the body are
						    derived at render and do not. See #2. */}
						<h2 id={s.slug} className="text-xl font-semibold">
							<a href={`#${s.slug}`}>{s.heading}</a>
						</h2>
						<div
							className="prose mt-2"
							// The body is markdown rendered by `marked` with raw HTML
							// ESCAPED, not passed through — see app/lib/markdown.ts. The
							// string here carries no author-supplied markup.
							dangerouslySetInnerHTML={{ __html: s.body.html }}
						/>
					</section>
				))}

				{sectionsWithheld && (
					<p className="mt-8 text-sm">
						Some sections of this entry are not shown.
					</p>
				)}
			</article>
		</main>
	);
}
