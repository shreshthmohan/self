import { redirect } from "react-router";

import type { Route } from "./+types/entry-new";

import { EntryEditor } from "../components/entry-editor";
import { db } from "../lib/db.server";
import { createEntry, type EntryInput } from "../lib/entries";
import {
	blankSection,
	dropUntouchedSections,
	intentWrites,
	parseEntryForm,
	validateEntry,
} from "../lib/entry-form";
import { requireOwner } from "../lib/viewer";

export function meta() {
	return [{ title: "New entry — shreshth.dev" }];
}

const EMPTY: EntryInput = {
	title: "",
	kind: "decision",
	isPublic: false,
	pathSlug: "",
	sections: [blankSection(0)],
};

export async function loader({ request }: Route.LoaderArgs) {
	await requireOwner(request);
	return { value: EMPTY };
}

/**
 * `add-section` and `remove-section` write nothing. They re-render the form
 * with the submitted text plus the change, which is how the section count
 * changes with JavaScript off (ADR 0002).
 *
 * A save is POST-redirect-GET, so a refresh re-fetches the new entry instead
 * of posting it a second time. The back button can still double-post; a
 * one-time token needs a store and a sweep, and nobody has asked for one.
 * See ADR 0011.
 *
 * Create and Continue redirects too, into the new entry's editor. Re-rendering
 * this route instead would leave the author on `/a/new`, where the next save
 * would make a second entry. See #108.
 */
export async function action({ request }: Route.ActionArgs) {
	await requireOwner(request);
	const { intent, input } = parseEntryForm(await request.formData());

	if (!intentWrites(intent)) {
		return {
			value: input,
			problems: [],
			addedSection: intent.kind === "add-section",
		};
	}

	// The write drops what the author never typed into. `input` keeps it, so a
	// save that fails returns the form they submitted (#108).
	const write = dropUntouchedSections(input);
	const problems = validateEntry(write);
	if (problems.length > 0) return { value: input, problems };

	const result = await createEntry(db(), write);
	if (!result.ok) {
		const failure = result.failure;
		return {
			value: input,
			problems:
				failure.kind === "duplicate-section-slug"
					? [`Two sections both want the anchor "${failure.slug}".`]
					: ["The entry was not saved."],
		};
	}

	throw redirect(
		intent.kind === "save" ? `/${result.slug}` : `/a/${result.id}/edit`,
	);
}

export default function NewEntry({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const value = actionData?.value ?? loaderData.value;

	return (
		<main>
			<h1 className="text-3xl">New entry</h1>
			<EntryEditor
				action="/a/new"
				value={value}
				version={0}
				submitLabel="Create"
				continueLabel="Create and Continue"
				problems={actionData?.problems}
				addedSection={actionData?.addedSection}
				allowSplit
			/>
		</main>
	);
}
