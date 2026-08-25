/**
 * Closed vocabularies. Every one of these lives in TypeScript, never in a D1
 * `CHECK` constraint: SQLite cannot alter a `CHECK`, so a database-level enum
 * turns every new member into a table rebuild.
 *
 * Sources: #3 (kind), #13 (relation), #5 (level, target type), #24 (role).
 */

/** The one primary axis an entry is classified on. See CONTEXT.md, "Kind". */
export const KINDS = [
	"decision",
	"ethos",
	"note",
	"article",
	"preference",
	"learning",
	"idea",
	"purchase-research",
	"project-log",
] as const;
export type Kind = (typeof KINDS)[number];

/** Live in phase 1. The rest of `KINDS` is declared, not yet reachable. */
export const PHASE_1_KINDS: readonly Kind[] = ["decision", "ethos"];

/** The meaning a link carries. Each declares an inverse label. See #13. */
export const RELATIONS = {
	"justified-by": { inverse: "justifies" },
	supersedes: { inverse: "superseded-by" },
} as const;
export type Relation = keyof typeof RELATIONS;

/**
 * What a section does to its record's visibility. Narrow only — the record's
 * visibility is the ceiling. See #5 and #18.
 */
export const LEVELS = ["inherit", "shared", "private"] as const;
export type Level = (typeof LEVELS)[number];

/** What a `path` row points at. See #5. */
export const PATH_TARGETS = [
	"entry",
	"possession",
	"property",
	"reserved",
	"redirect",
] as const;
export type PathTarget = (typeof PATH_TARGETS)[number];

/** What a user is allowed to do. See #24. */
export const ROLES = ["owner", "viewer"] as const;
export type Role = (typeof ROLES)[number];
