import { and, asc, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Db } from "../db";
import { entry, path, section } from "../db/schema";
import type { Kind, Level } from "../db/vocabulary";
import { freePathSlug } from "./paths.server";
import { resolveSectionSlugs } from "./slug";
import {
	accessRowCounts,
	canReadSection,
	countAccessRows,
	readableEntries,
	visibilityOf,
	type Visibility,
} from "./visibility";
import type { Viewer } from "./viewer";

export type SectionInput = {
	slug: string;
	heading: string;
	body: string;
	position: number;
	level: Level;
};

export type EntryInput = {
	title: string;
	kind: Kind;
	isPublic: boolean;
	pathSlug: string;
	sections: SectionInput[];
};

/** A save that did not happen, and the reason, for the form to re-render. */
export type SaveFailure =
	| { kind: "duplicate-section-slug"; slug: string }
	| { kind: "conflict"; currentVersion: number }
	| { kind: "deleted" };

export type SaveResult =
	| { ok: true; id: number; slug: string }
	| { ok: false; failure: SaveFailure };

const now = () => new Date();

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * The listing. `kind` labels and filters; it never branches code (#3), so this
 * is one `where`, not a switch.
 *
 * Capped at 100 rows. `accessRowCounts` binds one parameter per id, and D1
 * allows 100 per statement — a listing that outgrows one page needs paging,
 * which is a decision nobody has made yet.
 */
export async function listEntries(
	db: Db,
	options: { viewer: Viewer | null; kind?: Kind },
) {
	const readable = readableEntries(options.viewer);
	const filters = [readable, options.kind ? eq(entry.kind, options.kind) : undefined].filter(
		(f) => f !== undefined,
	);

	const rows = await db
		.select({
			id: entry.id,
			title: entry.title,
			kind: entry.kind,
			isPublic: entry.isPublic,
			updatedAt: entry.updatedAt,
			slug: path.slug,
		})
		.from(entry)
		.leftJoin(
			path,
			and(eq(path.targetType, "entry"), eq(path.targetId, entry.id)),
		)
		.where(filters.length > 0 ? and(...filters) : undefined)
		.orderBy(desc(entry.updatedAt))
		.limit(100);

	const counts = await accessRowCounts(
		db,
		rows.map((r) => r.id),
	);

	return rows.map((row) => ({
		...row,
		visibility: visibilityOf({
			isPublic: row.isPublic,
			accessRowCount: counts.get(row.id) ?? 0,
		}),
	}));
}

export type LoadedEntry = {
	id: number;
	title: string;
	kind: Kind;
	version: number;
	isPublic: boolean;
	slug: string | null;
	visibility: Visibility;
	sections: {
		slug: string;
		heading: string;
		body: string;
		position: number;
		level: Level;
	}[];
	/** True when a section was withheld, so the page can say so once. */
	sectionsWithheld: boolean;
};

async function loadEntryRow(db: Db, id: number) {
	const [row] = await db
		.select({
			id: entry.id,
			title: entry.title,
			kind: entry.kind,
			version: entry.version,
			isPublic: entry.isPublic,
			slug: path.slug,
		})
		.from(entry)
		.leftJoin(
			path,
			and(eq(path.targetType, "entry"), eq(path.targetId, entry.id)),
		)
		.where(eq(entry.id, id))
		.limit(1);
	return row;
}

export async function loadEntry(
	db: Db,
	id: number,
	viewer: Viewer | null,
): Promise<LoadedEntry | null> {
	const row = await loadEntryRow(db, id);
	if (!row) return null;

	const visibility = visibilityOf({
		isPublic: row.isPublic,
		accessRowCount: await countAccessRows(db, id),
	});

	// The entry's own visibility is the ceiling for everything under it.
	if (viewer?.role !== "owner") {
		const readable = await db
			.select({ id: entry.id })
			.from(entry)
			.where(and(eq(entry.id, id), readableEntries(viewer)))
			.limit(1);
		if (readable.length === 0) return null;
	}

	const all = await db
		.select({
			slug: section.slug,
			heading: section.heading,
			body: section.body,
			position: section.position,
			level: section.level,
		})
		.from(section)
		.where(eq(section.entryId, id))
		.orderBy(asc(section.position));

	const sections = all.filter((s) =>
		canReadSection({ level: s.level, entryVisibility: visibility, viewer }),
	);

	return {
		id: row.id,
		title: row.title,
		kind: row.kind,
		version: row.version,
		isPublic: row.isPublic,
		slug: row.slug,
		visibility,
		sections,
		sectionsWithheld: sections.length !== all.length,
	};
}

/**
 * Resolve one root URL through the registry. A reserved word and an unknown
 * word give the same answer — nothing — so neither is an existence oracle.
 * See ADR 0004.
 */
export async function resolvePath(db: Db, slug: string) {
	const [row] = await db
		.select()
		.from(path)
		.where(eq(path.slug, slug))
		.limit(1);
	if (!row) return null;
	if (row.targetType === "redirect" && row.redirectTo) {
		return { type: "redirect" as const, to: row.redirectTo };
	}
	if (row.targetType === "entry" && row.targetId !== null) {
		return { type: "entry" as const, id: row.targetId };
	}
	// `reserved`, or a possession or property this ticket does not serve.
	return null;
}

// ── Writes ──────────────────────────────────────────────────────────────────

function sectionStatements(db: Db, entryId: number, input: EntryInput, slugs: string[]) {
	// One INSERT per section, not one multi-row INSERT. D1 allows 100 bound
	// parameters per statement, and six columns would cap an entry at sixteen
	// sections. See #2 and #11.
	return input.sections.map((s, index) =>
		db.insert(section).values({
			entryId,
			position: index,
			slug: slugs[index],
			heading: s.heading,
			body: s.body,
			level: s.level,
		}),
	);
}

/**
 * A new entry. Two writes make a record — the row and its path (ADR 0004) —
 * but the path row needs an id SQLite only produces once the entry row exists,
 * and `last_insert_rowid()` moves with every later insert in the same batch.
 *
 * So the id is fetched first, and the path row and the sections go in one
 * `batch()` after it. If that batch fails, the entry row is deleted here: an
 * entry with no path row is unreachable, and leaving one behind would be a
 * slow leak nothing ever reports.
 */
export async function createEntry(
	db: Db,
	input: EntryInput,
): Promise<SaveResult> {
	const { slugs, duplicate } = resolveSectionSlugs(input.sections);
	if (duplicate) {
		return { ok: false, failure: { kind: "duplicate-section-slug", slug: duplicate } };
	}

	const slug = await freePathSlug(db, input.pathSlug || input.title);
	const stamp = now();

	const [created] = await db
		.insert(entry)
		.values({
			title: input.title,
			kind: input.kind,
			isPublic: input.isPublic,
			version: 1,
			createdAt: stamp,
			updatedAt: stamp,
		})
		.returning({ id: entry.id });

	try {
		const creates: BatchItem<"sqlite">[] = [
			db.insert(path).values({
				slug,
				targetType: "entry",
				targetId: created.id,
				createdAt: stamp,
			}),
			...sectionStatements(db, created.id, input, slugs),
		];
		await db.batch(creates as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
	} catch (error) {
		await db.delete(entry).where(eq(entry.id, created.id));
		throw error;
	}

	return { ok: true, id: created.id, slug };
}

/**
 * The whole-entry save: delete every section, insert every section, in one
 * `batch()`, guarded by `entry.version`. See ADR 0011.
 *
 * The guard is NOT atomic and is not meant to be. D1 rolls back on an ERROR,
 * and an `UPDATE ... WHERE version = ?` that matches no row is not an error —
 * it changes zero rows and the batch commits anyway. So the version is read
 * first and a millisecond race survives the gap. The race this guards is a tab
 * left open for a day.
 */
export async function saveEntry(
	db: Db,
	id: number,
	expectedVersion: number,
	input: EntryInput,
): Promise<SaveResult> {
	const { slugs, duplicate } = resolveSectionSlugs(input.sections);
	if (duplicate) {
		return { ok: false, failure: { kind: "duplicate-section-slug", slug: duplicate } };
	}

	const current = await loadEntryRow(db, id);
	if (!current) return { ok: false, failure: { kind: "deleted" } };

	const [live] = await db
		.select({ version: entry.version })
		.from(entry)
		.where(eq(entry.id, id))
		.limit(1);
	if (live.version !== expectedVersion) {
		return { ok: false, failure: { kind: "conflict", currentVersion: live.version } };
	}

	const stamp = now();
	const desired = input.pathSlug.trim();
	const renaming = desired !== "" && current.slug !== null && desired !== current.slug;
	const slug = renaming
		? await freePathSlug(db, desired, { ignore: current.slug ?? undefined })
		: (current.slug ?? (await freePathSlug(db, input.title)));

	// A heterogeneous statement list: Drizzle infers a tuple from the first
	// element unless it is told the element type.
	const writes: BatchItem<"sqlite">[] = [
		db
			.update(entry)
			.set({
				title: input.title,
				kind: input.kind,
				isPublic: input.isPublic,
				version: expectedVersion + 1,
				updatedAt: stamp,
			})
			.where(and(eq(entry.id, id), eq(entry.version, expectedVersion))),
		db.delete(section).where(eq(section.entryId, id)),
		...sectionStatements(db, id, input, slugs),
	];

	if (renaming) {
		// A rename ALWAYS leaves a redirect. Freeing the old word instead is the
		// owner's explicit choice and arrives with delete. See ADR 0004.
		writes.push(
			db.insert(path).values({
				slug,
				targetType: "entry",
				targetId: id,
				createdAt: stamp,
			}),
		);
		writes.push(
			db
				.update(path)
				.set({ targetType: "redirect", targetId: null, redirectTo: slug })
				.where(eq(path.slug, current.slug as string)),
		);
	} else if (current.slug === null) {
		writes.push(
			db.insert(path).values({
				slug,
				targetType: "entry",
				targetId: id,
				createdAt: stamp,
			}),
		);
	}

	await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

	return { ok: true, id, slug };
}
