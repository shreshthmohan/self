import { redirect } from "react-router";

import type { Route } from "./+types/entry-delete";

import { db } from "../lib/db.server";
import { deleteEntry, loadDeleteFacts } from "../lib/entries";
import { notFound, requireOwner } from "../lib/viewer";

/**
 * The confirmation. A page, not a dialog: `confirm()` does not exist with
 * JavaScript off, and the consequences of a delete need more room than a
 * dialog has anyway. See ADR 0017.
 *
 * The page names what will be lost, because nothing else will — the section
 * count, every inbound link, every word about to be freed, and the whole entry
 * as markdown in a read-only textarea. D1 is the only copy and export is not
 * built, so that textarea is the last moment the text exists.
 */
export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: loaderData ? `Delete ${loaderData.title} — shreshth.dev` : "Delete" },
	];
}

export async function loader({ params, request }: Route.LoaderArgs) {
	await requireOwner(request);
	const id = Number(params.id);
	if (!Number.isInteger(id)) notFound();

	const facts = await loadDeleteFacts(db(), id);
	if (!facts) notFound();
	return facts;
}

/**
 * The delete, guarded by `entry.version` (ADR 0011). The version rides a
 * hidden field on this page's form, so the losses the page listed are the
 * losses the delete takes — another tab can add a section or a link between
 * the GET and this POST.
 *
 * A mismatch returns nothing but the flag. The facts come from the loader, and
 * a POST navigation revalidates it, so the page re-renders with the current
 * facts and the current version without this action fetching them twice.
 */
export async function action({ params, request }: Route.ActionArgs) {
	await requireOwner(request);
	const id = Number(params.id);
	if (!Number.isInteger(id)) notFound();

	const form = await request.formData();
	const result = await deleteEntry(db(), id, Number(form.get("version") ?? 0));

	if (result.ok) {
		// The notice rides the query string. There is no flash store, and a
		// query parameter reads with JavaScript off, survives a refresh, and
		// costs no session write.
		const notice = new URLSearchParams({ deleted: result.title });
		if (result.slug !== null) notice.set("freed", result.slug);
		// A delete frees the live word and every redirect into it. The notice
		// names the live one and counts the rest, so it stays one line while
		// still saying that more went. The confirm page listed them all.
		const others = result.freedSlugs.length - (result.slug === null ? 0 : 1);
		if (others > 0) notice.set("freedOthers", String(others));
		throw redirect(`/?${notice}`);
	}

	// `gone` means the entry went between this page and this button. The delete
	// the owner asked for has happened, so the loader answers the generic
	// notice on revalidation rather than this page offering the button again.
	return { conflict: result.failure.kind === "conflict" };
}

export default function DeleteEntry({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const facts = loaderData;

	return (
		<main>
			<h1 className="text-3xl">Delete this entry?</h1>
			<p className="mt-1 text-sm text-muted">
				<a className="underline" href={`/a/${facts.id}/edit`}>
					Back to the editor
				</a>
			</p>

			{actionData?.conflict && (
				<p className="mt-6 border border-amber-500 p-3 text-sm">
					This entry changed somewhere else since this page loaded. Nothing
					was deleted. The list below is the current one.
				</p>
			)}

			<p className="mt-6">
				<strong>{facts.title}</strong> and its {facts.sectionCount}{" "}
				{facts.sectionCount === 1 ? "section" : "sections"} go for good.
				There is no undo.
			</p>

			<section className="mt-6">
				<h2 className="text-xl">Links pointing here</h2>
				{facts.inboundLinks.length === 0 ? (
					<p className="mt-2 text-sm text-muted">None.</p>
				) : (
					<>
						{/* The entries at the other end are untouched. Only the fact
						    that they pointed here goes, and nothing else in the
						    system reports it. See ADR 0017. */}
						<p className="mt-2 text-sm text-muted">
							These entries stay. The links themselves go.
						</p>
						<ul className="mt-2 space-y-1 text-sm">
							{facts.inboundLinks.map((link) => (
								<li key={`${link.id}-${link.relation}`}>
									{link.title} — <code>{link.relation}</code>
								</li>
							))}
						</ul>
					</>
				)}
			</section>

			<section className="mt-6">
				<h2 className="text-xl">Words freed</h2>
				{facts.freedSlugs.length === 0 ? (
					<p className="mt-2 text-sm text-muted">
						This entry owns no path.
					</p>
				) : (
					<>
						<p className="mt-2 text-sm text-muted">
							Another record can claim any of these afterwards, and an old
							link then lands somewhere else.
						</p>
						<ul className="mt-2 space-y-1 font-mono text-sm">
							{facts.freedSlugs.map((slug) => (
								<li key={slug}>
									/{slug}
									{slug !== facts.slug && " (redirect)"}
								</li>
							))}
						</ul>
					</>
				)}
			</section>

			<section className="mt-6">
				<h2 className="text-xl">Copy the text first</h2>
				<p className="mt-2 text-sm text-muted">
					This is the whole entry. Nothing backs it up, so this is the last
					moment it exists.
				</p>
				<label className="mt-2 block">
					<span className="text-sm font-medium">Entry as markdown</span>
					<textarea
						readOnly
						rows={16}
						value={facts.markdown}
						className="mt-1 w-full border border-border bg-bg p-2 font-mono text-sm"
					/>
				</label>
			</section>

			{/* A real form posting to this same route, so the delete is a POST
			    and works with JavaScript off (ADR 0002). */}
			<form
				method="post"
				action={`/a/${facts.id}/delete`}
				className="mt-8 flex items-center gap-3 border-t border-border py-3"
			>
				<input type="hidden" name="version" value={facts.version} />
				<button
					type="submit"
					className="border border-red-500 bg-red-500 px-4 py-2 text-bg"
				>
					Delete for good
				</button>
				<a className="underline" href={`/a/${facts.id}/edit`}>
					Cancel
				</a>
			</form>
		</main>
	);
}
