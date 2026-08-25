import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export * as schema from "./schema";
export * from "./vocabulary";

/**
 * The database handle.
 *
 * `transaction()` is deliberately not reachable through this type. D1
 * auto-commits every statement, so Drizzle's `transaction()` gives no atomicity
 * at all and silently commits half a write — open as drizzle-orm#2463 since
 * 2024-06. `batch()` is the only transactional unit D1 has. See #8 and #11.
 *
 * Raw SQL (FTS5, generated columns) goes through Drizzle's `sql` template, so
 * it can join a `batch()` with everything else.
 */
export type Db = Omit<
	ReturnType<typeof drizzle<typeof schema>>,
	"transaction"
>;

export function createDb(binding: D1Database): Db {
	return drizzle(binding, { schema, casing: "snake_case" });
}
