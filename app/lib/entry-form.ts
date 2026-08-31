import type { EntryInput, SectionInput } from "./entries";
import { KINDS, LEVELS, PHASE_1_KINDS, type Kind, type Level } from "../db/vocabulary";
import { splitMarkdown } from "./markdown-split";

/**
 * The editor posts the WHOLE entry in one form: every section body, every
 * heading, every position. That is what `entry.version` guards (ADR 0011) and
 * what the delete-then-insert save writes (#2).
 *
 * Field names are flat and indexed rather than nested, because `FormData` has
 * no nesting. One repeated hidden `section-index` carries the set of live
 * indexes, so a removed section leaves no gap to reason about.
 *
 * An index says where a section stands, never which section it is. So each one
 * also carries a `section-uid-<index>`, minted here for a section that arrives
 * without one, which the editor renders as a hidden field and keys its
 * fieldsets on (#110). It is a form-lifetime identity, like `section-index`: a
 * save ignores it and nothing stores it. The slug cannot do this job — it is
 * empty on a new section, the author edits it, and two blank ones collide.
 */

/** A section as the form holds it: the stored shape plus its form identity. */
export type FormSection = SectionInput & { uid: string };

/** An entry as the form holds it. `EntryInput` once the uids are dropped. */
export type FormEntry = Omit<EntryInput, "sections"> & {
	sections: FormSection[];
};

/**
 * A fresh identity. It never leaves the form, so it needs to be unique among
 * one form's sections and nothing more.
 */
const newUid = () => crypto.randomUUID();

/** Give stored sections the identity the form needs, for a first render. */
export function toFormSections(sections: SectionInput[]): FormSection[] {
	return sections.map((s) => ({ ...s, uid: newUid() }));
}

export type Intent =
	| { kind: "save" }
	/** A save that returns the editor rather than the entry. See #108. */
	| { kind: "save-and-stay" }
	| { kind: "add-section" }
	| { kind: "remove-section"; index: number }
	| { kind: "split-sections" };

/** The two intents that write. Everything else re-renders the form. */
export const intentWrites = (intent: Intent) =>
	intent.kind === "save" || intent.kind === "save-and-stay";

export type ParsedEntryForm = {
	intent: Intent;
	version: number;
	input: FormEntry;
};

function readIntent(formData: FormData): Intent {
	const raw = String(formData.get("intent") ?? "save");
	if (raw === "add-section") return { kind: "add-section" };
	if (raw === "save-and-stay") return { kind: "save-and-stay" };
	if (raw === "split-sections") return { kind: "split-sections" };
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

export function blankSection(position: number): FormSection {
	return { slug: "", heading: "", body: "", position, level: "inherit", uid: newUid() };
}

/**
 * Nothing typed into it. A fresh new-entry form is one of these, and the split
 * replaces those rather than appending after them.
 *
 * It reads the anchor as well as the heading and the body. An author who typed
 * only an anchor typed something, and #98 asked the split never to discard
 * that. The three are trimmed alike, so a field of spaces reads the same way
 * whichever field it is.
 */
const isUntouched = (s: SectionInput) =>
	s.slug.trim() === "" && s.heading.trim() === "" && s.body.trim() === "";

/**
 * The field the split reads. An input only: it is never stored, and a save
 * ignores it (#98). The editor writes the name as a literal, as it does for
 * every other field here.
 */
const RAW_MARKDOWN_FIELD = "raw-markdown";

export function parseEntryForm(formData: FormData): ParsedEntryForm {
	const indexes = formData
		.getAll("section-index")
		.map((v) => Number(String(v)))
		.filter((n) => Number.isInteger(n));

	let sections: FormSection[] = indexes.map((index, order) => ({
		// The identity the form carries. A section that arrives without one
		// gets a new one: a page rendered by the deploy before #110 is still
		// open in somebody's tab.
		uid: String(formData.get(`section-uid-${index}`) ?? "").trim() || newUid(),
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

	// The split writes nothing either. It re-renders the form with the pasted
	// prose spread over sections, which the author then edits before saving.
	let splitTitle: string | null = null;
	if (intent.kind === "split-sections") {
		const split = splitMarkdown(String(formData.get(RAW_MARKDOWN_FIELD) ?? ""));
		splitTitle = split.title;
		if (split.sections.length > 0) {
			// Replace a form of untouched sections; append to one that holds
			// typing. The split never discards what the author already wrote.
			//
			// This assignment is also what keeps `SplitSection` honest: it is
			// `SectionInput` restated, and a new field on `SectionInput` fails
			// to compile here rather than going missing from a split.
			const keep = sections.every(isUntouched) ? [] : sections;
			const after = keep.reduce((max, s) => Math.max(max, s.position), -1) + 1;
			sections = [
				...keep,
				...split.sections.map((s, i) => ({
					...s,
					position: after + i,
					uid: newUid(),
				})),
			];
		}
	}

	sections = sections
		.map((s, i) => ({ ...s, position: Number.isFinite(s.position) ? s.position : i }))
		.sort((a, b) => a.position - b.position)
		.map((s, i) => ({ ...s, position: i }));

	return {
		intent,
		version: Number(formData.get("version") ?? 0),
		input: {
			// A leading `#` fills the title, and only when the author left it
			// empty. Their own words are never overwritten.
			title: String(formData.get("title") ?? "").trim() || splitTitle || "",
			kind: readKind(String(formData.get("kind") ?? "")),
			isPublic: formData.get("is-public") !== null,
			pathSlug: String(formData.get("path-slug") ?? "").trim(),
			sections,
		},
	};
}

/**
 * What a write keeps. Every section the author never typed into is gone, so a
 * spare section costs them nothing (#108).
 *
 * The test is the split's, unchanged. An anchor alone is typing (#98).
 *
 * A caller applies this to what it writes and what it validates, NOT to what
 * it renders back. A failed save must return the form the author submitted,
 * with its empty sections still on the page for them to fill.
 */
export function dropUntouchedSections(input: EntryInput): EntryInput {
	return {
		...input,
		sections: input.sections
			.filter((s) => !isUntouched(s))
			.map((s, i) => ({ ...s, position: i })),
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
	// There is no per-section "needs a heading or a body" rule any more. The
	// drop above runs first, so the rule had no case left to catch. A section
	// that survives holds a heading, a body, or an anchor. #69, #75 and #98
	// each allow one of those alone. A form of nothing but untouched sections
	// lands on the message above instead, which is the one the author needs.
	return problems;
}
