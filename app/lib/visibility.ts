import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { audienceMember, entry, entryAudience, entryUser } from "../db/schema";
import type { Level } from "../db/vocabulary";
import type { Viewer } from "./viewer";

/**
 * Visibility is READ, never stored. An entry is public if `is_public` is set,
 * shared if it has any access row, and private if it has neither. See ADR 0003.
 */
export type Visibility = "public" | "shared" | "private";

export function visibilityOf(input: {
	isPublic: boolean;
	accessRowCount: number;
}): Visibility {
	if (input.isPublic) return "public";
	return input.accessRowCount > 0 ? "shared" : "private";
}

/**
 * The SQL half of the same rule: the entries this viewer may read.
 *
 * The owner reads everything. Anyone else reads an entry that is public, OR
 * shared to them by name, OR shared to an audience they belong to — the union
 * of both axes, because the owner chose both (ADR 0003). An anonymous reader
 * belongs to no audience and is named by no row, so the union collapses to
 * `is_public`.
 *
 * This is written in full now, not stubbed, so that #43 changes `getViewer`
 * and nothing here.
 */
export function readableEntries(viewer: Viewer | null) {
	if (viewer?.role === "owner") return undefined; // no filter
	if (!viewer) return eq(entry.isPublic, true);

	const sharedToUser = sql`exists (select 1 from ${entryUser} where ${and(
		eq(entryUser.entryId, entry.id),
		eq(entryUser.userId, viewer.id),
	)})`;

	const sharedToAudience = sql`exists (select 1 from ${entryAudience} join ${audienceMember} on ${eq(
		audienceMember.audienceId,
		entryAudience.audienceId,
	)} where ${and(
		eq(entryAudience.entryId, entry.id),
		eq(audienceMember.userId, viewer.id),
	)})`;

	return or(eq(entry.isPublic, true), sharedToUser, sharedToAudience);
}

/**
 * A section narrows its entry's visibility and never widens it, so the entry's
 * level is the ceiling and one read of the entry bounds everything under it.
 * See ADR 0003.
 *
 * `level` is not editable in this ticket — with no users, `shared` is
 * unreachable — but a stored value is honoured on read from the first day, so
 * a row written later is never silently exposed.
 */
export function canReadSection(input: {
	level: Level;
	entryVisibility: Visibility;
	viewer: Viewer | null;
}): boolean {
	if (input.viewer?.role === "owner") return true;
	switch (input.level) {
		case "inherit":
			return true; // The entry was already checked.
		case "shared":
			// Narrows a public entry to its access rows. The entry query already
			// proved this viewer passes those rows, so only the public reader,
			// who has none, is turned away.
			return input.entryVisibility !== "public" || input.viewer !== null;
		case "private":
			return false;
	}
}

export async function countAccessRows(db: Db, entryId: number) {
	const [audiences, users] = await db.batch([
		db
			.select({ n: sql<number>`count(*)` })
			.from(entryAudience)
			.where(eq(entryAudience.entryId, entryId)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(entryUser)
			.where(eq(entryUser.entryId, entryId)),
	]);
	return (audiences[0]?.n ?? 0) + (users[0]?.n ?? 0);
}

/** Unused today; kept so a bulk listing does not fall back to N queries. */
export async function accessRowCounts(db: Db, entryIds: number[]) {
	const counts = new Map<number, number>();
	if (entryIds.length === 0) return counts;
	const add = (rows: { entryId: number; n: number }[]) => {
		for (const row of rows) {
			counts.set(row.entryId, (counts.get(row.entryId) ?? 0) + row.n);
		}
	};
	const [audiences, users] = await db.batch([
		db
			.select({ entryId: entryAudience.entryId, n: sql<number>`count(*)` })
			.from(entryAudience)
			.where(inArray(entryAudience.entryId, entryIds))
			.groupBy(entryAudience.entryId),
		db
			.select({ entryId: entryUser.entryId, n: sql<number>`count(*)` })
			.from(entryUser)
			.where(inArray(entryUser.entryId, entryIds))
			.groupBy(entryUser.entryId),
	]);
	add(audiences);
	add(users);
	return counts;
}
