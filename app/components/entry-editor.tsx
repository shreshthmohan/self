import type { EntryInput } from "../lib/entries";
import { PHASE_1_KINDS } from "../db/vocabulary";

/**
 * The editor. A real `<form>` with a named `<textarea>` per section body, so
 * it works before the runtime lands and with JavaScript off entirely (ADR
 * 0002). TipTap enhances this same field later, behind the fidelity gate of
 * ADR 0007 — it is not loaded here, and the textarea must work alone.
 *
 * Adding and removing a section are submit buttons carrying an `intent`. The
 * action writes nothing for those and re-renders the form with the submitted
 * text, so a round trip never costs the author their typing.
 */
export function EntryEditor(props: {
	value: EntryInput;
	version: number;
	action: string;
	submitLabel: string;
	problems?: string[];
	conflict?: { currentVersion: number };
	deleted?: boolean;
}) {
	const { value, version } = props;

	return (
		<form method="post" action={props.action} className="mt-8 space-y-8">
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

			<div className="space-y-6">
				<h2 className="text-xl">Sections</h2>

				{value.sections.map((s, index) => (
					<fieldset
						key={index}
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

						<button
							type="submit"
							name="intent"
							value={`remove-section:${index}`}
							className="border border-border px-3 py-1 text-sm"
						>
							Remove this section
						</button>
					</fieldset>
				))}

				<button
					type="submit"
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
				<a className="underline" href="/">
					Cancel
				</a>
			</div>
		</form>
	);
}
