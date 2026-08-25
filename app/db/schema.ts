/**
 * The single source for every table. `drizzle-kit generate` reads this file and
 * writes a migration into `migrations/`; wrangler alone applies it. See #11.
 *
 * Two id shapes, on purpose. App tables use `INTEGER PRIMARY KEY`, a rowid
 * alias and the cheapest key SQLite has. Better Auth generates text ids for its
 * own five tables and that is not configurable, so `user.id` is text and every
 * column pointing at it is text too.
 *
 * Closed vocabularies (`kind`, `relation`, `level`, `role`) live in
 * `vocabulary.ts`, never in a D1 `CHECK`. See #3.
 *
 * Migrations are ADDITIVE ONLY. A migration lands while the OLD worker is still
 * serving, so no column is dropped or renamed in the deploy that stops using
 * it. See ADR 0006.
 */
import { relations } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";
import type { Kind, Level, PathTarget, Relation } from "./vocabulary";

export * from "./auth-schema";

/** Epoch milliseconds. Written by the app, never by a SQLite default. */
const timestamp = (name: string) =>
	integer(name, { mode: "timestamp_ms" }).notNull();

// ── Entries ─────────────────────────────────────────────────────────────────

/**
 * Anything prose-shaped the CMS holds. An entry is a title and an ordered list
 * of sections; the prose itself lives in `section`, never here.
 *
 * `possession_id`, `property_id`, and `contact_id` are NOT here yet. Those
 * tables' shapes are open (#15, #16), and adding a nullable column later is a
 * one-line additive migration.
 */
export const entry = sqliteTable(
	"entry",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title").notNull(),
		/** One word from `KINDS`. Labels and filters; never branches code. */
		kind: text("kind").$type<Kind>().notNull(),
		/**
		 * Guards the whole-entry save against a lost update. Posted back in a
		 * hidden field and checked as statement one of the save batch. Covers
		 * `entry` and `section` only — links and access rows do not bump it.
		 * See ADR 0011.
		 */
		version: integer("version").notNull().default(1),
		/**
		 * The public flag, not the visibility. Visibility is DERIVED: public if
		 * this is set, shared if any access row exists, private if neither.
		 * See ADR 0003.
		 */
		isPublic: integer("is_public", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: timestamp("created_at"),
		updatedAt: timestamp("updated_at"),
	},
	(t) => [
		index("entry_kind_idx").on(t.kind),
		index("entry_created_at_idx").on(t.createdAt),
	],
);

/**
 * One heading and one markdown body, at a fixed position within an entry. The
 * unit a search result points at and a deep link addresses.
 *
 * A whole-entry save is delete-then-insert of every section in one `batch()`,
 * so `id` is not stable across a save — `slug` is the section's identity.
 * See #2.
 */
export const section = sqliteTable(
	"section",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		entryId: integer("entry_id")
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		/**
		 * Stored, human-readable, sticky. Generated from the heading once, then
		 * left alone; a rename does not recompute it. This is the durable h2
		 * anchor. A collision inside one entry fails loudly on the unique index.
		 */
		slug: text("slug").notNull(),
		heading: text("heading").notNull(),
		/** Markdown. The stored value; the editor is an enhanced textarea. */
		body: text("body").notNull(),
		/**
		 * Narrows the entry's visibility, never widens it. `shared` means the
		 * entry's access rows, not the public. See ADR 0003.
		 */
		level: text("level").$type<Level>().notNull().default("inherit"),
	},
	(t) => [
		unique("section_entry_slug_unq").on(t.entryId, t.slug),
		index("section_entry_position_idx").on(t.entryId, t.position),
	],
);

/**
 * A directed relation from one entry to another. One generic table, no kind
 * constraint at either end; supersession and link visibility are derived from
 * these rows, never stored. See ADR 0005.
 */
export const entryLink = sqliteTable(
	"entry_link",
	{
		fromEntryId: integer("from_entry_id")
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		toEntryId: integer("to_entry_id")
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		/** One word from `RELATIONS`. Each declares an inverse label. */
		relation: text("relation").$type<Relation>().notNull(),
	},
	(t) => [
		primaryKey({
			name: "entry_link_pk",
			columns: [t.fromEntryId, t.toEntryId, t.relation],
		}),
		index("entry_link_to_idx").on(t.toEntryId),
	],
);

// ── The root namespace ──────────────────────────────────────────────────────

/**
 * Every root URL, in one registry. Entries, possessions, and properties share
 * one namespace, which SQLite cannot enforce with per-table columns, so a
 * collision is a failed insert rather than a race. See ADR 0004.
 *
 * `target_type` decides which other columns carry a value:
 *   entry | possession | property  -> `target_id`
 *   reserved                       -> neither; the row exists to hold the word
 *   redirect                       -> `redirect_to`, another slug in this table
 *
 * `target_id` has no foreign key: it points at one of three tables, and SQLite
 * cannot express that.
 */
export const path = sqliteTable(
	"path",
	{
		slug: text("slug").primaryKey(),
		targetType: text("target_type").$type<PathTarget>().notNull(),
		targetId: integer("target_id"),
		redirectTo: text("redirect_to"),
		createdAt: timestamp("created_at"),
	},
	(t) => [index("path_target_idx").on(t.targetType, t.targetId)],
);

// ── Access ──────────────────────────────────────────────────────────────────

/** A named set of users — `family`, `climbing`. See CONTEXT.md, "Audience". */
export const audience = sqliteTable("audience", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	createdAt: timestamp("created_at"),
});

export const audienceMember = sqliteTable(
	"audience_member",
	{
		audienceId: integer("audience_id")
			.notNull()
			.references(() => audience.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({
			name: "audience_member_pk",
			columns: [t.audienceId, t.userId],
		}),
		index("audience_member_user_idx").on(t.userId),
	],
);

/**
 * An entry shared to an audience. A visibility check is the union of this and
 * `entry_user` — the user chose both axes, not audiences alone. See ADR 0003.
 *
 * Removing the last member of an audience silently makes every entry shared
 * only to it private. That is accepted: the edit screen shows the derived
 * level, so it is never a surprise.
 */
export const entryAudience = sqliteTable(
	"entry_audience",
	{
		entryId: integer("entry_id")
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		audienceId: integer("audience_id")
			.notNull()
			.references(() => audience.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({
			name: "entry_audience_pk",
			columns: [t.entryId, t.audienceId],
		}),
		index("entry_audience_audience_idx").on(t.audienceId),
	],
);

/** An entry shared to one named user. */
export const entryUser = sqliteTable(
	"entry_user",
	{
		entryId: integer("entry_id")
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ name: "entry_user_pk", columns: [t.entryId, t.userId] }),
		index("entry_user_user_idx").on(t.userId),
	],
);

// ── Relations, for the query builder ────────────────────────────────────────

export const entryRelations = relations(entry, ({ many }) => ({
	sections: many(section),
	linksFrom: many(entryLink, { relationName: "linksFrom" }),
	linksTo: many(entryLink, { relationName: "linksTo" }),
	audiences: many(entryAudience),
	users: many(entryUser),
}));

export const sectionRelations = relations(section, ({ one }) => ({
	entry: one(entry, { fields: [section.entryId], references: [entry.id] }),
}));

export const entryLinkRelations = relations(entryLink, ({ one }) => ({
	from: one(entry, {
		relationName: "linksFrom",
		fields: [entryLink.fromEntryId],
		references: [entry.id],
	}),
	to: one(entry, {
		relationName: "linksTo",
		fields: [entryLink.toEntryId],
		references: [entry.id],
	}),
}));

export const audienceRelations = relations(audience, ({ many }) => ({
	members: many(audienceMember),
	entries: many(entryAudience),
}));

export const audienceMemberRelations = relations(audienceMember, ({ one }) => ({
	audience: one(audience, {
		fields: [audienceMember.audienceId],
		references: [audience.id],
	}),
	user: one(user, {
		fields: [audienceMember.userId],
		references: [user.id],
	}),
}));

export const entryAudienceRelations = relations(entryAudience, ({ one }) => ({
	entry: one(entry, {
		fields: [entryAudience.entryId],
		references: [entry.id],
	}),
	audience: one(audience, {
		fields: [entryAudience.audienceId],
		references: [audience.id],
	}),
}));

export const entryUserRelations = relations(entryUser, ({ one }) => ({
	entry: one(entry, { fields: [entryUser.entryId], references: [entry.id] }),
	user: one(user, { fields: [entryUser.userId], references: [user.id] }),
}));
