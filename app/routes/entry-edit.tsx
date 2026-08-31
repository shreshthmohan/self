import { redirect } from "react-router";

import type { Route } from "./+types/entry-edit";

import { EntryEditor } from "../components/entry-editor";
import { db } from "../lib/db.server";
import { loadEntry, saveEntry, type LoadedEntry } from "../lib/entries";
import {
	dropUntouchedSections,
	intentWrites,
	parseEntryForm,
	toFormSections,
	validateEntry,
	type FormEntry,
} from "../lib/entry-form";
import { notFound, requireOwner } from "../lib/viewer";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `Edit ${loaderData.value.title} — shreshth.dev`
				: "Edit",
		},
	];
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const viewer = await requireOwner(request);
	const id = Number(params.id);
	if (!Number.isInteger(id)) notFound();

	const entry = await loadEntry(db(), id, viewer);
	if (!entry) notFound();

	return { id: entry.id, version: entry.version, value: toFormEntry(entry) };
}

/** A stored entry, as the editor's fields hold it. */
function toFormEntry(entry: LoadedEntry): FormEntry {
	return {
		title: entry.title,
		kind: entry.kind,
		isPublic: entry.isPublic,
		pathSlug: entry.slug ?? "",
		// The stored sections have no form identity yet. One is minted here, on
		// the way into the first render, and the form carries it from then on.
		//
		// Every call mints a fresh set, and that costs nothing. A navigation
		// into the editor mounts the fieldsets anyway, and Save and Continue
		// replaces the form with what the database holds, which is a remount
		// on purpose.
		sections: toFormSections(entry.sections),
	};
}

/**
 * The whole-entry save, guarded by `entry.version` (ADR 0011).
 *
 * A conflict never discards typing: the submitted text comes back with a
 * banner, and **Save anyway** carries the version from that banner, so a
 * further change while the author reads re-fires the conflict. The per-section
 * markdown diff that ADR 0011 describes is NOT here — #52 excludes it, and it
 * enhances a working save rather than making one.
 */
export async function action({ params, request }: Route.ActionArgs) {
	const viewer = await requireOwner(request);
	const id = Number(params.id);
	if (!Number.isInteger(id)) notFound();

	const { intent, input, version } = parseEntryForm(await request.formData());

	if (!intentWrites(intent)) {
		return {
			value: input,
			version,
			problems: [] as string[],
			addedSection: intent.kind === "add-section",
		};
	}

	// The write drops what the author never typed into. `input` keeps it, so a
	// save that fails returns the form they submitted (#108).
	const write = dropUntouchedSections(input);
	const problems = validateEntry(write);
	if (problems.length > 0) return { value: input, version, problems };

	const result = await saveEntry(db(), id, version, write);
	if (result.ok) {
		if (intent.kind === "save") throw redirect(`/${result.slug}`);

		// Save and Continue. The editor comes back holding what the database
		// now holds, NOT what was submitted. The write generated the anchors
		// and renumbered the positions, and an echo of the input would leave
		// those out of the form. The new version comes with it, so the next
		// save passes the guard instead of reading as a conflict.
		const saved = await loadEntry(db(), id, viewer);
		if (!saved) notFound();
		return {
			value: toFormEntry(saved),
			version: saved.version,
			problems: [] as string[],
			saved: true,
		};
	}

	const failure = result.failure;
	switch (failure.kind) {
		case "duplicate-section-slug":
			return {
				value: input,
				version,
				problems: [`Two sections both want the anchor "${failure.slug}".`],
			};
		case "conflict":
			return {
				value: input,
				// The banner's Save anyway carries the CURRENT version, so the next
				// submit passes the guard unless someone changes the entry again.
				version: failure.currentVersion,
				problems: [] as string[],
				conflict: { currentVersion: failure.currentVersion },
			};
		case "deleted":
			return { value: input, version, problems: [] as string[], deleted: true };
	}
}

export default function EditEntry({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const value = actionData?.value ?? loaderData.value;
	const version = actionData?.version ?? loaderData.version;

	return (
		<main>
			<h1 className="text-3xl">Edit entry</h1>
			<p className="mt-1 text-sm text-muted">
				<a className="underline" href={`/${loaderData.value.pathSlug}`}>
					View
				</a>
			</p>
			<EntryEditor
				action={`/a/${loaderData.id}/edit`}
				value={value}
				version={version}
				submitLabel="Save"
				continueLabel="Save and Continue"
				problems={actionData?.problems}
				conflict={actionData?.conflict}
				deleted={actionData?.deleted}
				saved={actionData?.saved}
				addedSection={actionData?.addedSection}
			/>
		</main>
	);
}
