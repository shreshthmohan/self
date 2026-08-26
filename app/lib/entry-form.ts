import type { EntryInput, SectionInput } from "./entries";
import { KINDS, LEVELS, PHASE_1_KINDS, type Kind, type Level } from "../db/vocabulary";

/**
 * The editor posts the WHOLE entry in one form: every section body, every
 * heading, every position. That is what `entry.version` guards (ADR 0011) and
 * what the delete-then-insert save writes (#2).
 *
 * Field names are flat and indexed rather than nested, because `FormData` has
 * no nesting. One repeated hidden `section-index` carries the set of live
 * indexes, so a removed section leaves no gap to reason about.
 */

export type Intent =
	| { kind: "save" }
	| { kind: "add-section" }
	| { kind: "remove-section"; index: number };

export type ParsedEntryForm = {
	intent: Intent;
	version: number;
	input: EntryInput;
};

function readIntent(formData: FormData): Intent {
	const raw = String(formData.get("intent") ?? "save");
	if (raw === "add-section") return { kind: "add-section" };
	const remove = raw.match(/^remove-section:(\d+)$/);
	if (remove) return { kind: "remove-section", index: Number(remove[1]) };
	return { kind: "save" };
}

function readKind(raw: string): Kind {
	return (KINDS as readonly string[]).includes(raw) ? (raw as Kind) : "decision";
}

function readLevel(raw: string): Level {
	return (LEVELS as readonly string[]).includes(raw) ? (raw as Level) : "inherit";
}

export function blankSection(position: number): SectionInput {
	return { slug: "", heading: "", body: "", position, level: "inherit" };
}

export function parseEntryForm(formData: FormData): ParsedEntryForm {
	const indexes = formData
		.getAll("section-index")
		.map((v) => Number(String(v)))
		.filter((n) => Number.isInteger(n));

	let sections: SectionInput[] = indexes.map((index, order) => ({
		slug: String(formData.get(`section-slug-${index}`) ?? "").trim(),
		heading: String(formData.get(`section-heading-${index}`) ?? "").trim(),
		body: String(formData.get(`section-body-${index}`) ?? ""),
		// A number input per section is the no-JS way to reorder. It is a
		// preference, not an identity: the saved positions are renumbered below.
		position: Number(formData.get(`section-position-${index}`) ?? order),
		level: readLevel(String(formData.get(`section-level-${index}`) ?? "inherit")),
	}));

	const intent = readIntent(formData);
	if (intent.kind === "remove-section") {
		sections = sections.filter((_, i) => i !== intent.index);
	}
	if (intent.kind === "add-section") {
		sections = [...sections, blankSection(sections.length)];
	}

	sections = sections
		.map((s, i) => ({ ...s, position: Number.isFinite(s.position) ? s.position : i }))
		.sort((a, b) => a.position - b.position)
		.map((s, i) => ({ ...s, position: i }));

	return {
		intent,
		version: Number(formData.get("version") ?? 0),
		input: {
			title: String(formData.get("title") ?? "").trim(),
			kind: readKind(String(formData.get("kind") ?? "")),
			isPublic: formData.get("is-public") !== null,
			pathSlug: String(formData.get("path-slug") ?? "").trim(),
			sections,
		},
	};
}

/** What the author must supply before a save is worth attempting. */
export function validateEntry(input: EntryInput): string[] {
	const problems: string[] = [];
	if (input.title === "") problems.push("An entry needs a title.");
	if (!PHASE_1_KINDS.includes(input.kind)) {
		// The list builds this message, so it cannot go stale when the next
		// kind joins. See #70.
		problems.push(`A kind must be one of: ${PHASE_1_KINDS.join(", ")}.`);
	}
	if (input.sections.length === 0) {
		problems.push("An entry needs at least one section.");
	}
	// A heading is optional (#69), but both fields empty is not: the old rule
	// made an empty section unreachable by accident, and dropping it should not
	// quietly open that door. The index stays in the message — an author with
	// five sections has to be told which one is empty.
	input.sections.forEach((s, i) => {
		if (s.heading === "" && s.body.trim() === "") {
			problems.push(`Section ${i + 1} needs a heading or a body.`);
		}
	});
	return problems;
}
