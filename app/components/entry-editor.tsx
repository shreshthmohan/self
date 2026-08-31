import { useLayoutEffect, useRef } from "react";

import type { EntryInput } from "../lib/entries";
import { PHASE_1_KINDS } from "../db/vocabulary";
import { restoreTyped } from "../lib/hydration-guard";
import { takeTypedSnapshot } from "../lib/hydration-snapshot";

/**
 * The editor. A real `<form>` with a named `<textarea>` per section body, so
 * it works before the runtime lands and with JavaScript off entirely (ADR
 * 0002). TipTap enhances this same field later, behind the fidelity gate of
 * ADR 0007 — it is not loaded here, and the textarea must work alone.
 *
 * Adding and removing a section are submit buttons carrying an `intent`. The
 * action writes nothing for those and re-renders the form with the submitted
 * text, so a round trip never costs the author their typing.
 *
 * A round trip is a full document navigation, so the browser goes back to the
 * top of the page. Remove and split therefore carry a URL fragment on their
 * `formAction`. It names what the author wants to look at next, and every
 * section fieldset carries the matching id.
 *
 * Add uses `autofocus` on the new heading instead. The browser scrolls a
 * focused field into view, so the one attribute buys both. A URL fragment here
 * would cancel that focus: a fragment target wins over an autofocus candidate.
 *
 * All of it is plain HTML. It works with JavaScript off. See #108.
 *
 * Typing in the hydration gap costs the author nothing either: the client
 * entry snapshots the typed fields before React runs, and the layout effect
 * below puts them back (ADR 0016).
 */
export function EntryEditor(props: {
	value: EntryInput;
	version: number;
	action: string;
	submitLabel: string;
	/** The second submit: it saves and returns this editor. See #108. */
	continueLabel: string;
	problems?: string[];
	/** A write landed and the author is still here, after `save-and-stay`. */
	saved?: boolean;
	/**
	 * The last section was added by the round trip that rendered this. Its
	 * heading takes focus, so the author can type straight into it.
	 */
	addedSection?: boolean;
	conflict?: { currentVersion: number };
	deleted?: boolean;
	/**
	 * Show the paste-and-split control. New entries only for now — appending a
	 * split into an entry that already holds sections is a follow-up to #98.
	 */
	allowSplit?: boolean;
}) {
	const { value, version } = props;
	const form = useRef<HTMLFormElement>(null);

	/*
	 * A layout effect, not an effect: it runs before the browser paints, so
	 * the author never sees the server's text flash back. The snapshot is read
	 * once and cleared, so this is a no-op on a client-side navigation into
	 * the editor — that has no hydration gap to bridge.
	 */
	useLayoutEffect(() => {
		const snap = takeTypedSnapshot();
		if (snap && form.current) restoreTyped(form.current, snap);
	}, []);

	return (
		<form
			ref={form}
			method="post"
			action={props.action}
			className="mt-8 space-y-8"
		>
			<input type="hidden" name="version" value={version} />

			{props.deleted && (
				<p className="border border-red-500 p-3 text-sm">
					This entry was deleted while this page was open. Saving it now
					recreates it as a new entry, on a new path.
				</p>
			)}

			{props.conflict && !props.deleted && (
				<p className="border border-amber-500 p-3 text-sm">
					This entry changed somewhere else since this page loaded. Your
					typing is still here. <strong>Save anyway</strong> overwrites the
					other change; the per-section diff arrives with{" "}
					<a
						className="underline"
						href="https://github.com/shreshthmohan/self/issues/12"
					>
						the conflict screen
					</a>
					.
				</p>
			)}

			{props.saved && (
				<p className="border border-border p-3 text-sm">Saved.</p>
			)}

			{props.problems && props.problems.length > 0 && (
				<ul className="border border-red-500 p-3 text-sm">
					{props.problems.map((problem) => (
						<li key={problem}>{problem}</li>
					))}
				</ul>
			)}

			<div className="space-y-3">
				<label className="block">
					<span className="text-sm font-medium">Title</span>
					<input
						name="title"
						defaultValue={value.title}
						required
						className="mt-1 w-full border border-border bg-bg p-2"
					/>
				</label>

				<label className="block">
					<span className="text-sm font-medium">Kind</span>
					<select
						name="kind"
						defaultValue={value.kind}
						className="mt-1 w-full border border-border bg-bg p-2"
					>
						{PHASE_1_KINDS.map((kind) => (
							<option key={kind} value={kind}>
								{kind}
							</option>
						))}
					</select>
				</label>

				<label className="block">
					<span className="text-sm font-medium">Path</span>
					<input
						name="path-slug"
						defaultValue={value.pathSlug}
						placeholder="generated from the title"
						className="mt-1 w-full border border-border bg-bg p-2 font-mono text-sm"
					/>
					<span className="mt-1 block text-xs text-muted">
						Renaming leaves a redirect at the old path.
					</span>
				</label>

				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						name="is-public"
						defaultChecked={value.isPublic}
					/>
					<span className="text-sm">Public</span>
				</label>
			</div>

			<div id="sections" className="space-y-6">
				<h2 className="text-xl">Sections</h2>

				{/*
					Paste prose written elsewhere and let the server cut it into
					sections on its level-2 headings. A submit button and a
					textarea, so it works with JavaScript off (ADR 0002). A paste
					event handler could enhance this later; it is not needed for
					the control to work. See #98.

					The split writes nothing. It re-renders the form, and every
					field it fills is the author's to edit before saving.
				*/}
				{props.allowSplit && (
					<fieldset className="border border-border p-3 space-y-3">
						<legend className="px-1 text-sm text-muted">
							From markdown
						</legend>
						<label className="block">
							<span className="text-sm font-medium">
								Paste markdown
							</span>
							<textarea
								name="raw-markdown"
								rows={8}
								placeholder="Each ## heading starts a section."
								className="mt-1 w-full border border-border bg-bg p-2 font-mono text-sm"
							/>
						</label>
						{/*
							Outside the label on purpose. Text inside a label joins
							the field's accessible name, and this hint names the
							title field, which made "Title" match two controls.
						*/}
						<p className="text-xs text-muted">
							This text is not saved. A leading # fills an empty
							title.
						</p>
						{/*
							`formNoValidate`, because the title is `required` and
							the split is what fills it. Without this the browser
							blocks the submit on an empty title and the paste never
							reaches the server. The split saves nothing, so there is
							nothing here for validation to protect.
						*/}
						<button
							type="submit"
							formNoValidate
							name="intent"
							value="split-sections"
							formAction={`${props.action}#sections`}
							className="border border-border px-3 py-1 text-sm"
						>
							Split into sections
						</button>
					</fieldset>
				)}

				{value.sections.map((s, index) => (
					<fieldset
						key={index}
						id={`section-${index}`}
						className="border border-border p-3 space-y-3"
					>
						<legend className="px-1 text-sm text-muted">Section {index + 1}</legend>
						<input type="hidden" name="section-index" value={index} />
						<input
							type="hidden"
							name={`section-level-${index}`}
							value={s.level}
						/>

						<label className="block">
							{/* Optional. A section with a body and no heading reads as
							    prose alone; the entry's h1 is enough. Not `required`,
							    so the browser does not block a save the server allows.
							    See #69. */}
							<span className="text-sm font-medium">Heading (optional)</span>
							<input
								name={`section-heading-${index}`}
								defaultValue={s.heading}
								autoFocus={
									props.addedSection &&
									index === value.sections.length - 1
								}
								className="mt-1 w-full border border-border bg-bg p-2"
							/>
						</label>

						<div className="flex gap-3">
							<label className="block grow">
								{/* Visible and editable for every section, headed or not:
								    #2 made a section's identity the author's to see and
								    change, and a headingless section has one for the same
								    reason. It holds `s-<n>` once the section is saved. */}
								<span className="text-sm font-medium">Anchor</span>
								<input
									name={`section-slug-${index}`}
									defaultValue={s.slug}
									placeholder="from the heading, or generated"
									className="mt-1 w-full border border-border bg-bg p-2 font-mono text-sm"
								/>
							</label>
							<label className="block w-24">
								<span className="text-sm font-medium">Position</span>
								<input
									type="number"
									name={`section-position-${index}`}
									defaultValue={s.position}
									className="mt-1 w-full border border-border bg-bg p-2"
								/>
							</label>
						</div>

						<label className="block">
							<span className="text-sm font-medium">Body (markdown)</span>
							<textarea
								name={`section-body-${index}`}
								defaultValue={s.body}
								rows={12}
								className="mt-1 w-full border border-border bg-bg p-2 font-mono text-sm"
							/>
						</label>

						{/*
							The URL fragment lands the author on the section above
							the one they removed. It lands them at the top of the
							list when they removed the first.
						*/}
						<button
							type="submit"
							formNoValidate
							name="intent"
							value={`remove-section:${index}`}
							formAction={`${props.action}#${
								index === 0 ? "sections" : `section-${index - 1}`
							}`}
							className="border border-border px-3 py-1 text-sm"
						>
							Remove this section
						</button>
					</fieldset>
				))}

				{/*
					No URL fragment here. The new section's heading is autofocused
					and the browser scrolls a focused field into view. A fragment
					on this button would cancel that focus rather than add to it.

					`formNoValidate`, for the reason the split has it. The title
					is `required` and this button writes nothing, so browser
					validation here only blocks a section the author asked for.
				*/}
				<button
					type="submit"
					formNoValidate
					name="intent"
					value="add-section"
					className="border border-border px-3 py-1 text-sm"
				>
					Add a section
				</button>
			</div>

			{/*
				The row is sticky, not fixed. It is the last thing in the form, so
				it stays at the bottom of the window while the form is taller than
				the window. At the end of the page it goes back into the form.
				A long entry no longer costs the author a scroll to save. See #92.

				"Add a section" stays above, with the sections. It changes the
				list. This row leaves the page.

				The rule and the fill divide the row from the text below it.
			*/}
			<div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-border bg-bg py-3">
				<button
					type="submit"
					name="intent"
					value="save"
					className="border border-fg bg-fg px-4 py-2 text-bg"
				>
					{props.conflict ? "Save anyway" : props.submitLabel}
				</button>
				{/*
					The same write, a different answer: the editor comes back
					instead of the entry. A long entry is saved often, and each
					save should not cost the author the trip back. See #108.
				*/}
				<button
					type="submit"
					name="intent"
					value="save-and-stay"
					className="border border-border px-4 py-2"
				>
					{props.continueLabel}
				</button>
				<a className="underline" href="/">
					Cancel
				</a>
			</div>
		</form>
	);
}
