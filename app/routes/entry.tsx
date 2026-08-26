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

	const viewer = await getViewer(request);
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
			<p className="text-sm text-muted">
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
				<h1 className="text-4xl">{title}</h1>
				<p className="mt-2 text-sm text-dim">{kind}</p>

				{toc.length > 1 && (
					<nav className="mt-6 border-l-2 border-border pl-4">
						<h2 className="font-sans text-xs tracking-widest text-dim uppercase">
							On this page
						</h2>
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
					// The anchor is the section's STORED slug, so a deep link survives
					// a heading rename. Anchors inside the body are derived at render
					// and do not. See #2.
					//
					// The id sits on the <section> ONLY when there is no heading. A
					// headed section is untouched, so no anchor that works today
					// resolves to a different element tomorrow. See #69.
					<section
						key={s.slug}
						id={s.heading === "" ? s.slug : undefined}
						className="mt-8"
					>
						{s.heading !== "" && (
							<h2 id={s.slug} className="text-2xl">
								<a href={`#${s.slug}`}>{s.heading}</a>
							</h2>
						)}
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
					<p className="mt-8 text-sm text-muted">
						Some sections of this entry are not shown.
					</p>
				)}
			</article>
		</main>
	);
}
