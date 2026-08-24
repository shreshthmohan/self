# D1 access layer: Drizzle, Kysely, or raw SQL

Research for issue #8. Part of map issue #1.

Date: 2026-08-24. Facts only. No recommendation.

## Versions at the date of this research

Read from the npm registry with `npm view` on 2026-08-24.

| Package | Latest version | Published |
|---|---|---|
| `drizzle-orm` | 0.45.2 | 2026-08-12 (registry `modified`) |
| `drizzle-orm` `rc` tag | 1.0.0-rc.4 | 2026-06-27 |
| `drizzle-kit` | 0.31.10 | 2026-08-11 |
| `kysely` | 0.29.5 | 2026-08-10 |
| `kysely` `next` tag | 0.30.0-beta.1 | 2026-07-26 |
| `kysely-d1` | 0.4.0 | 2025-04-19 |
| `@atinux/kysely-d1` | 0.3.1 | 2024-10-17 |
| `kysely-codegen` | 0.20.0 | 2026-02-16 |
| `wrangler` | 4.125.0 | 2026-08-20 |
| `workers-qb` | 1.15.0 | 2026-07-24 |

Note: the Drizzle D1 page tells you to install `drizzle-orm@rc` and `drizzle-kit@rc`, not the `latest` tag.
Source: [Drizzle — Cloudflare D1](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1).

## 1. The platform below all three options

### The Workers binding API

`env.DB` gives these methods:

- `prepare(query)` returns a `D1PreparedStatement`. `bind(...values)` fills `?` placeholders.
- `first()`, `run()`, `all()`, `raw()` run the statement.
- `batch(statements)` runs an array of prepared statements. Cloudflare states: "Our implementation guarantees that each statement in the list will execute and commit, sequentially, non-concurrently." A failure aborts and rolls back the sequence.
- `exec(query)` runs SQL with no parameter binding. Cloudflare states: "Only use this method for maintenance and one-shot tasks (for example, migration jobs)."
- `withSession(...)` makes a `D1DatabaseSession` for read replication. Modes: `first-primary`, `first-unconstrained` (default), or a bookmark string.

Source: [D1 Database — Workers API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

`D1Result` holds `success`, `meta`, and `results`. `meta` holds `served_by`, `served_by_region`, `served_by_primary`, `timings.sql_duration_ms`, `duration`, `changes`, `last_row_id`, `changed_db`, `size_after`, `rows_read`, `rows_written`, and `total_attempts`.

Cloudflare warns: "Any numeric value in a column is affected by JavaScript's 52-bit precision for numbers."

Source: [Return object](https://developers.cloudflare.com/d1/worker-api/return-object/).

### Explicit transactions

D1 runs in auto-commit. The docs tell you to remove `BEGIN TRANSACTION` and `COMMIT` from dumped SQL, or you get "cannot start a transaction within a transaction". `batch()` is the transactional unit.

Source: [Import and export data](https://developers.cloudflare.com/d1/build-with-d1/import-export-data/), [D1 Database](https://developers.cloudflare.com/d1/worker-api/d1-database/).

This fact bears on Drizzle's `transaction()`. See section 2.

### Limits

- Maximum bound parameters per query: 100.
- Maximum SQL statement length: 100,000 bytes.
- Maximum SQL query duration: 30 seconds.
- Maximum database size: 10 GB paid, 500 MB free.
- Queries per Worker invocation: 1,000 paid, 50 free.
- Maximum columns per table: 100.
- Maximum string, BLOB, or row size: 2,000,000 bytes.
- The per-query limits also apply to each statement inside `batch()`.

Source: [Limits](https://developers.cloudflare.com/d1/platform/limits/).

The 100-parameter limit constrains bulk inserts. All three options hit it.

### JSON in D1

D1 includes the SQLite JSON extension, FTS5, and the math functions.

Available: `json()`, `json_array()`, `json_array_length()`, `json_extract()`, `json_insert()`, `json_object()`, `json_patch()`, `json_remove()`, `json_replace()`, `json_set()`, `json_type()`, `json_valid()`, `json_quote()`, `json_group_array()`, `json_each()`, `json_tree()`. The `->` operator returns JSON. The `->>` operator returns an SQL value.

Cloudflare states that "Creating a generated column and an index can dramatically improve query performance" for JSON you query often. You define such a column with `AS ... STORED`.

Sources: [Query JSON](https://developers.cloudflare.com/d1/sql-api/query-json/), [SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/).

A JSON column is TEXT to D1. The binding returns it as a string. Nothing in the platform parses it for you.

### Migrations through wrangler

`wrangler d1 migrations create|list|apply`. Files are `.sql` in a `migrations` folder, numbered, applied in sequence. Applied migrations are recorded in a `d1_migrations` table.

The Wrangler config accepts `migrations_dir` (default `migrations/`), `migrations_table` (default `d1_migrations`), and `migrations_pattern` — a glob for nested layouts, which the docs say helps with ORMs such as Drizzle.

Source: [Migrations](https://developers.cloudflare.com/d1/reference/migrations/).

### Local development

`wrangler dev` runs in local mode by default, "powered by Miniflare and workerd". Data persists between runs on Wrangler v3+. `--persist-to=/path` sets the location. `wrangler d1 execute DB --local --command "..."` runs SQL against the local copy only.

Source: [Local development](https://developers.cloudflare.com/d1/best-practices/local-development/).

For tests, `cloudflare:test` exports `applyD1Migrations(db, migrations)`. You read the array with `readD1Migrations()` from `@cloudflare/vitest-plugin/config` in Node. D1 gets per-file storage isolation.

Source: [Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/).

All three options share this local story, because all three sit on the same binding.

### What Cloudflare lists

The community projects page lists Sutando ORM, `knex-cloudflare-d1`, Prisma ORM, the D1 adapter for Kysely, `feathers-kysely`, Drizzle ORM, and `workers-qb`. Cloudflare does not endorse one.

Source: [Community projects](https://developers.cloudflare.com/d1/reference/community-projects/).

## 2. Drizzle

### Driver

`import { drizzle } from 'drizzle-orm/d1'`, then `const db = drizzle(env.BINDING_NAME)`. The driver ships inside `drizzle-orm` itself. There is no third-party package.

Drizzle states it "fully supports the Cloudflare D1 database and Cloudflare Workers environment" and mirrors the SQLite `all`, `get`, `values`, and `run` methods.

Source: [Drizzle — Cloudflare D1](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1).

### Batch and transactions

Read from `drizzle-orm@0.45.2`, file `node_modules/drizzle-orm/d1/session.js`:

- `batch(queries)` compiles the statements and calls `this.client.batch(builtQueries)`. It maps each `D1Result` back to the query's result shape. This is the native D1 batch.
- `transaction(fn)` runs `begin`, then the callback, then `commit`, and `rollback` on an error. Nested transactions use `savepoint` and `release savepoint`.

The `transaction()` path sends literal `BEGIN`/`COMMIT` statements to D1. D1 auto-commits and rejects nested transactions (see section 1). Drizzle's own D1 documentation shows `batch`, not `transaction`. The generic batch page names only the Neon HTTP driver, so the D1 batch is documented on the D1 page, not there.

Source: package source of `drizzle-orm@0.45.2`; [Batch API](https://orm.drizzle.team/docs/batch-api).

### JSON columns

Drizzle offers `text({ mode: 'json' })` and `blob({ mode: 'json' })`. The docs state: "It's recommended to use `text('', { mode: 'json' })` instead of `blob('', { mode: 'json' })`", because BLOB mode does not work with SQLite's JSON functions.

`$type<T>()` sets the TypeScript type. It does no runtime validation. It applies to defaults, insert types, and select types.

Source: [SQLite column types](https://orm.drizzle.team/docs/column-types/sqlite).

Drizzle serializes and parses the JSON text for you. So `sections: {heading, body}[]` comes back as an array, not a string.

### TypeScript inference

You write the schema in TypeScript. Drizzle infers select and insert types from it. No introspection step and no code generation are needed for types.

### Migrations

Two paths exist.

1. `drizzle-kit generate` writes SQL files. You point `migrations_dir` at `drizzle/migrations` in the Wrangler config and apply with `wrangler d1 migrations apply`. Cloudflare's `migrations_pattern` option exists for this layout.
2. `drizzle-kit` with `driver: 'd1-http'` runs `migrate`, `push`, `introspect`, and `studio` over the D1 HTTP API. It needs `accountId`, `databaseId`, and an API token with D1 edit rights.

Sources: [Drizzle Kit with D1 HTTP](https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

Path 2 works against the remote database. Local work stays on `wrangler d1 migrations apply --local`.

## 3. Kysely

### Driver

Kysely core ships no D1 dialect. The built-in dialects in `kysely@0.29.5` are `mssql`, `mysql`, `pglite`, `postgres`, and `sqlite` (better-sqlite3). Read from `node_modules/kysely/dist/dialect/`.

D1 needs `kysely-d1` by aidenwallis, which Cloudflare lists. Usage: `new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB }) })`. The README states the project "was largely adapted from kysely-planetscale".

Sources: package contents of `kysely@0.29.5`; [kysely-d1 README](https://github.com/aidenwallis/kysely-d1); [Community projects](https://developers.cloudflare.com/d1/reference/community-projects/).

### Driver maintenance and gaps

`kysely-d1@0.4.0` shipped 2025-04-19, about 16 months before this research. It is one person's package, 14,931 bytes unpacked, with `kysely: "*"` as its only peer dependency.

Read from `node_modules/kysely-d1/dist/index.js`:

- `executeQuery` calls `.prepare(sql).bind(...params).all()` for every query, including writes.
- `beginTransaction`, `commitTransaction`, and `rollbackTransaction` each `throw new Error('Transactions are not supported yet.')`. So `db.transaction()` fails at runtime.
- `streamQuery` throws `'D1 Driver does not support streaming'`.
- The dialect exposes no D1 `batch()`. Multi-statement atomicity needs a direct call on the binding.

Source: package source of `kysely-d1@0.4.0`.

### JSON columns

Kysely has `JSONColumnType`, "selected as" the JSON type, while "insert and update types are always `string`", because values get stringified.

Kysely ships `jsonArrayFrom` and `jsonObjectFrom` helpers for postgres, mysql, and sqlite: `import { jsonArrayFrom } from 'kysely/helpers/sqlite'`. The docs note the MySQL and SQLite versions differ a little but are used the same way.

For drivers that return JSON columns as strings — SQLite and third-party dialects included — the docs point to `ParseJSONResultsPlugin`.

Sources: [Getting started](https://kysely.dev/docs/getting-started), [Relations recipe](https://kysely.dev/docs/recipes/relations).

So JSON works, but you add the plugin and you write the stringify yourself on insert.

### TypeScript inference

You declare a `Database` interface: table names as keys, row interfaces as values. `Generated<>` marks database-made columns. `ColumnType` sets separate select, insert, and update types. `Selectable`, `Insertable`, and `Updateable` derive per-operation types.

Kysely states: "For production apps, it is recommended to automatically generate your `Database` interface by introspecting your production database or Prisma schemas."

Source: [Getting started](https://kysely.dev/docs/getting-started).

Generation means `kysely-codegen` (0.20.0, 2026-02-16), which connects to a database. The D1 binding is not such a connection, so a generated flow needs a local SQLite file or the D1 HTTP API. Hand-written types stay possible.

### Migrations

Kysely has a `Migrator` and a `MigrationProvider`. `FileMigrationProvider` needs Node filesystem access; you can write your own provider instead. Kysely takes a database-level lock, runs parallel calls serially, orders migrations alphanumerically, and errors on out-of-order additions unless `allowUnorderedMigrations` is set.

Source: [Migrations](https://kysely.dev/docs/migrations).

Two facts collide on D1. Kysely's migrator needs a live Kysely instance, and `kysely-d1` needs a `D1Database` binding, which exists inside the Worker only. And the migrator's lock uses transactions, which `kysely-d1` throws on. So the common path is `wrangler d1 migrations` with hand-written SQL, not Kysely's migrator.

## 4. Raw SQL on the binding

No package. You call `env.DB.prepare(...).bind(...).all()`.

- `batch()` gives the transactional unit that D1 supports.
- JSON is a string in and a string out. You call `JSON.stringify` and `JSON.parse` yourself, or you use `json_extract`, `->>`, and generated columns in SQL.
- Types come from `@cloudflare/workers-types`. `all<T>()` accepts a type parameter, but nothing checks that `T` matches the table. The row type is an assertion.
- Migrations are `wrangler d1 migrations` and nothing else.
- The 100-parameter and 100 KB limits are visible in the code you write, not hidden by a builder.

Source: [D1 Database](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## 5. Bundle size on workerd — measured

Method: esbuild 0.28.2, `--bundle --minify --format=esm --platform=neutral --conditions=workerd,worker,browser`. Each entry is one Worker `fetch` handler that runs the same query: select three columns from `entry`, filter on `published`, order by `id` desc, limit 20. Packages: `drizzle-orm@0.45.2`, `kysely@0.29.5`, `kysely-d1@0.4.0`. Run on 2026-08-24.

| Variant | Minified bytes | Gzipped bytes |
|---|---|---|
| Raw binding | 208 | 195 |
| Drizzle (`drizzle-orm/d1` + schema) | 70,875 | 18,892 |
| Kysely + `kysely-d1` | 158,547 | 30,219 |

Notes on the measurement:

- One query only. A larger app pulls in more of each library, so the gap narrows in relative terms.
- The Drizzle build imports the query builder and one table schema. It does not import Drizzle's relational query API, which adds more.
- Kysely is larger here because the query compiler and the operation-node tree get pulled in as one unit.
- Unpacked package size on npm, for reference: `drizzle-orm` 10,420,427 bytes, `kysely` 1,726,867 bytes, `kysely-d1` 14,931 bytes. Drizzle's tarball holds every dialect; the bundler drops what you do not import.

Workers has a 3 MB compressed bundle limit on the paid plan. All three numbers sit far below it.

## 6. Facts side by side

| Point | Drizzle | Kysely + kysely-d1 | Raw SQL |
|---|---|---|---|
| D1 driver owner | Drizzle itself (`drizzle-orm/d1`) | Third party, one maintainer | Cloudflare |
| Last driver release | 2026-08-12 (whole package) | 2025-04-19 | n/a |
| D1 `batch()` | Yes, mapped | No | Yes |
| `transaction()` | Present, sends `BEGIN`/`COMMIT` that D1 auto-commit rejects | Throws "Transactions are not supported yet." | n/a |
| JSON column | `text({mode:'json'}).$type<T>()`, parsed for you | `JSONColumnType` + `ParseJSONResultsPlugin`, stringify on write | Manual |
| Types from | TypeScript schema, inferred | Hand-written or generated interface | Assertion on `all<T>()` |
| Migrations | `drizzle-kit generate` + wrangler, or `d1-http` | wrangler with hand-written SQL | wrangler |
| Bundle, gzipped (one query) | 18,892 B | 30,219 B | 195 B |
| Local dev | wrangler / Miniflare | wrangler / Miniflare | wrangler / Miniflare |

## Open points this research does not settle

- Whether Drizzle 1.0 leaves rc, and what its D1 surface looks like at that point.
- Whether `kysely-d1` gets transaction or batch support.
- How the `entry.sections` JSON column gets queried in practice — generated columns and indexes, or read-and-filter in JS.
