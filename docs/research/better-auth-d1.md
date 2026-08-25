# Better Auth on workerd and D1

Research for issue #19. Part of map issue #1. Blocks #11.

Date: 2026-08-25. Facts only. No recommendation.

Reads the companion note `docs/research/d1-access-layer.md` for the D1 platform facts.

## Versions at the date of this research

Read from the npm registry with `npm view` on 2026-08-25.

| Package | Latest version | Published |
|---|---|---|
| `better-auth` | 1.7.1 | 2026-08-18 (registry `modified`) |
| `@better-auth/core` | 1.7.1 | 2026-08-18 |
| `@better-auth/kysely-adapter` | 1.7.1 | 2026-08-18 |
| `@better-auth/drizzle-adapter` | 1.7.1 | 2026-08-18 |
| `kysely` | 0.29.5 | 2026-08-10 |
| `drizzle-orm` | 0.45.2 | 2026-08-12 |
| `wrangler` | 4.125.0 | 2026-08-20 |

Other `better-auth` dist-tags: `rc` 1.7.0-rc.6, `beta` 1.7.0-beta.10, `canary` 1.0.0-canary.14.

## 1. The D1 adapter

### Better Auth has a built-in D1 dialect. It forces nothing.

Since 1.5, `better-auth` ships its own D1 dialect. You pass the binding:

```ts
const auth = betterAuth({ database: env.DB });
```

Better Auth 1.5 release note: "Better Auth now natively supports Cloudflare D1 as a first-class database option. Pass your D1 binding directly — no custom adapter setup required." The same note says: "Note that D1 does not support interactive transactions — Better Auth uses D1's `batch()` API for atomicity instead."

Source: [Better Auth 1.5](https://better-auth.com/blog/1-5).

**Plain answer for #11: Better Auth does not force Drizzle, and it does not force you to write Kysely queries. The choice of D1 access layer for the app's own tables is free.**

Three qualifications follow. They change the cost of each choice, not the freedom.

### Qualification A: `kysely` is a hard dependency of `better-auth`

`better-auth@1.7.1` lists `kysely: "^0.28.17 || ^0.29.0"` in `dependencies`, not `peerDependencies`. So Kysely installs whatever you pick.

Read from the npm registry, `npm view better-auth dependencies`.

Measured: a Worker that uses `drizzleAdapter` still bundles all of Kysely. See section 2.

There is an escape. `better-auth/minimal` is documented in the package as "Better Auth initializer for minimal mode (without Kysely)". It drops the built-in adapter detection, so you must supply an adapter yourself.

Read from `node_modules/better-auth/dist/auth/minimal.mjs` of `better-auth@1.7.1`.

### Qualification B: detection is by duck typing

Read from `node_modules/@better-auth/kysely-adapter/dist/index.mjs`, `createKyselyAdapter`:

```js
if ("batch" in db && "exec" in db && "prepare" in db) {
    const { D1SqliteDialect } = await import("./d1-sqlite-dialect-...mjs");
    dialect = new D1SqliteDialect({ database: db });
    transaction = false;
}
```

So a `D1Database` binding is recognised by shape. `getKyselyDatabaseType` returns `sqlite` for the same shape. The check sits last, after the `aggregate`, `getConnection`, `connect`, `fileControl`, and `createSession` checks. A D1 binding has none of those properties, so it lands on the D1 branch.

The same function also accepts a `dialect` you build yourself, and an `{ db, type, transaction }` object. Both bypass detection.

### Qualification C: transactions

The built-in D1 dialect refuses interactive transactions on purpose. Read from `node_modules/@better-auth/kysely-adapter/dist/d1-sqlite-dialect-BZmaVTp8.mjs`:

```js
async beginTransaction() {
    throw new Error("D1 does not support interactive transactions. Use the D1 batch() API instead.");
}
```

`commitTransaction` and `rollbackTransaction` throw the same. `streamQuery` throws "D1 does not support streaming queries."

The detection code sets `transaction = false` for D1. The core adapter factory then substitutes a non-atomic path. Read from `node_modules/@better-auth/core/dist/db/adapter/factory.mjs`:

```js
if (!config.transaction) lazyLoadTransaction = createAsIsTransaction(adapter);
```

So Better Auth runs the statements in sequence with no rollback. Nothing throws.

Three places in the Kysely adapter still call `db.transaction()`. All three are inside `if (config?.type === "mysql")` branches — `fetchInserted`, `claimFromTransaction`, and `incrementInTransaction`. D1 reports as `sqlite`, so none of them run.

Source: package source of `@better-auth/kysely-adapter@1.7.1`.

**Correction to the release note.** The claim "Better Auth uses D1's `batch()` API for atomicity" does not hold in the code. A grep for `.batch(` over `better-auth@1.7.1` and every `@better-auth/*` package finds one call site: the D1 introspector, which batches `pragma_table_info` reads while it reads the schema. No write path uses `batch()`. Writes are single auto-committed statements.

Consequence: a multi-row auth write is not atomic on D1. Better Auth's own writes are mostly single-row, so this is small. It matters if you add a plugin, or app tables, that need two writes to land together.

### The community `kysely-d1` package is a different thing

Better Auth's "Other Relational Databases" page lists Cloudflare D1 among *Kysely community dialects*, and links to `aidenwallis/kysely-d1`. That link predates the built-in dialect and is not the path the 1.5 note describes. `kysely-d1@0.4.0` throws on transactions and exposes no `batch()`; see `docs/research/d1-access-layer.md`.

Source: [Other Relational Databases](https://better-auth.com/docs/adapters/other-relational-databases).

### There is no D1 adapter in the community list

The community adapters page lists 22 adapters — Convex, SurrealDB, TypeORM, DynamoDB, and so on. None is for D1. Nothing third-party is needed.

Source: [Community adapters](https://www.better-auth.com/docs/adapters/community-adapters).

## 2. Bundle cost on workerd — measured

Method: esbuild 0.28.2, `--bundle --minify --format=esm --platform=neutral --conditions=workerd,worker,browser --external:node:* --external:cloudflare:*`. One Worker `fetch` handler builds the `betterAuth` instance and returns `auth.handler(request)`. `gzip -9`. Packages: `better-auth@1.7.1`, `kysely@0.29.5`, `drizzle-orm@0.45.2`. Run on 2026-08-25.

| Variant | Minified bytes | Gzipped bytes |
|---|---|---|
| `betterAuth({ database: env.DB })`, email + password | 770,319 | 199,293 |
| the same, plus `magicLink` | 776,637 | 201,161 |
| the same, plus `magicLink` and `admin` | 803,816 | 206,741 |
| `drizzleAdapter` on `drizzle-orm/d1`, plus `magicLink` | 861,289 | 223,861 |
| `better-auth/minimal` + `drizzleAdapter`, plus `magicLink` | 632,477 | 173,447 |
| `better-auth/minimal` + `memoryAdapter`, plus `magicLink` (floor) | 547,747 | 150,744 |

What is inside the second row, by package, minified bytes in the output. Read from the esbuild metafile:

| Package | Bytes |
|---|---|
| `better-auth` | 192,464 |
| `kysely` | 188,964 |
| `@better-auth/core` | 116,288 |
| `zod` | 80,902 |
| `@opentelemetry/semantic-conventions` | 59,848 |
| `jose` | 41,864 |
| `@better-auth/kysely-adapter` | 20,576 |
| `better-call` | 19,019 |
| `@noble/ciphers` | 13,546 |
| `@better-auth/telemetry` | 9,238 |
| `@better-fetch/fetch` | 7,799 |
| `@noble/hashes` | 7,780 |
| the app entry | 294 |

Facts that fall out of the table:

- The built-in D1 dialect costs almost nothing. It is 3,909 bytes of source, and the whole `@better-auth/kysely-adapter` is 20,576 bytes in the bundle.
- **Drizzle adds 22.7 KB gzipped and removes nothing.** `kysely` stays in the bundle at 189 KB minified, because `better-auth`'s main entry imports the Kysely adapter statically. Drizzle is a pure addition on the default entry.
- `better-auth/minimal` removes Kysely. `minimal` + Drizzle is 173,447 B gzipped — 27.7 KB *less* than the default entry with the built-in D1 dialect. That is the only configuration in which Drizzle pays for itself here.
- The magic-link plugin costs 1,868 B gzipped. The admin plugin costs 5,580 B gzipped on top of that.
- `zod`, `jose`, and `@opentelemetry/semantic-conventions` together are 182 KB minified and are not removable by adapter choice.

Against the Workers limit: 3 MB compressed on Free, 10 MB compressed on Paid. Every row above is far below both. A Worker must also "parse and execute its global scope (top-level code outside of handlers) within 1 second".

Source: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Caveat: these numbers are one auth handler alone. A real Worker adds the app, the router, and the app's own D1 access layer.

## 3. The schema Better Auth owns

### Tables

Four core tables: `user`, `session`, `account`, `verification`. A fifth, `rateLimit`, appears only when `rateLimit.storage` is `"database"`.

Read from `getAuthTables` in `@better-auth/core@1.7.1`, `dist/db/get-tables.mjs`.

### The SQL, generated

Run against `better-auth@1.7.1` with `getMigrations` from `better-auth/db/migration`, a D1-shaped shim over `node:sqlite`, `emailAndPassword` on, the `magicLink` plugin, and one extra user field `role`. Output of `compileMigrations()`:

```sql
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "role" text);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "issuer" text not null, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");
create unique index "account_issuer_accountId_uidx" on "account" ("issuer", "accountId");
```

Notes on the DDL:

- Every `id` is `text`, not an integer. Better Auth generates the id.
- `date` is not an SQLite type. SQLite applies NUMERIC affinity to it. The Kysely adapter sets `supportsDates: false` for sqlite, so Better Auth writes the value in a form it can read back.
- The table names are unquoted-reserved-word safe because the generator quotes them. `"user"` needs the quotes.
- Table and column names are configurable — `user.modelName`, `user.fields.email`, and so on — so a name clash with the app's tables is avoidable.

### Which plugin adds what

Measured by calling `getAuthTables` with each plugin.

- **`magicLink` adds no table and no column.** It reuses `verification`. The docs say the token's "storage backend itself is controlled by the global `verification` config".
- **`admin` adds** `user.role` (string), `user.banned` (boolean), `user.banReason` (string), `user.banExpires` (date), and `session.impersonatedBy` (string).

Sources: [Magic link plugin](https://www.better-auth.com/docs/plugins/magic-link), [Admin plugin](https://www.better-auth.com/docs/plugins/admin).

### `secondaryStorage` removes two tables

Read from `get-tables.mjs`:

```js
...!options.secondaryStorage || options.session?.storeSessionInDatabase ? sessionTable : {},
...
...!options.secondaryStorage || options.verification?.storeInDatabase ? verificationTable : {},
```

Confirmed by running `getAuthTables` with a stub `secondaryStorage`: `session` and `verification` disappear from the schema, leaving `user` and `account`. The prose docs do not state this; the source does.

### Migrations against D1 and wrangler

The CLI cannot reach a D1 binding, because the binding exists inside the Worker only. Better Auth documents two ways round it.

1. **`generate`.** `npx auth@latest generate` writes a schema file. For the built-in Kysely adapter it writes SQL. You put that SQL in the wrangler `migrations` folder and run `wrangler d1 migrations apply`. The `migrate` command "is only supported for the built-in Kysely adapter", and needs a reachable database, which D1 is not from a shell.
2. **`getMigrations`, programmatic.** "In environments where the CLI isn't available (e.g. Cloudflare Workers, serverless functions), you can run migrations programmatically using `getMigrations`." Import from `better-auth/db/migration`. The docs warn: "getMigrations only works with the built-in Kysely adapter (SQLite/D1, PostgreSQL, MySQL, MSSQL). It does not work with Prisma or Drizzle ORM adapters." It returns `toBeCreated`, `toBeAdded`, `runMigrations`, and `compileMigrations`.

Source: [Database concepts](https://www.better-auth.com/docs/concepts/database).

`compileMigrations()` returns a plain SQL string. That string can be pasted into a numbered `.sql` file under the wrangler `migrations_dir`, which keeps one migration history (`d1_migrations`) for both the auth tables and the app tables. Doing that needs a build-time step that runs `compileMigrations` in Node against a D1 shim, because the introspector reads `sqlite_master` and `pragma_table_info` and so needs a database to compare against.

If you use Drizzle for the app tables, route 2 is closed and `generate` writes a Drizzle schema instead of SQL.

## 4. Magic-link delivery

Better Auth calls your `sendMagicLink({ email, url, token, metadata }, request)`. It sends nothing. Default `expiresIn` is 300 seconds. `disableSignUp` blocks account creation through the link. `storeToken` takes `"plain"`, `"hashed"`, or a custom hasher.

Source: [Magic link plugin](https://www.better-auth.com/docs/plugins/magic-link).

Workers has no raw TCP, so SMTP libraries such as Nodemailer are out. Every option below is an HTTPS API reachable with `fetch`.

### MailChannels free sending is gone

MailChannels ended the free Cloudflare Workers service on 2024-08-31. Cloudflare no longer points at it: `https://developers.cloudflare.com/pages/functions/plugins/mailchannels/` now returns HTTP 301 to the Resend tutorial (checked with curl on 2026-08-25).

MailChannels Email API pricing today: free up to 3,000 per month, capped at 100 per day; paid "from $10/month" for 10,000 per month. There is no tier between the two.

Sources: [MailChannels end-of-life notice](https://support.mailchannels.com/hc/en-us/articles/26814255454093-End-of-Life-Notice-Cloudflare-Workers), [MailChannels pricing](https://www.mailchannels.com/pricing/).

### Cloudflare now sends mail itself

This is new since the ticket was written. **Cloudflare Email Service** entered public beta on 2026-04-16: "Email Sending now in public beta. Send transactional emails directly from Workers (`env.EMAIL.send()`) or the REST API".

Source: [Changelog, 2026-04-16](https://developers.cloudflare.com/changelog/post/2026-04-16-email-sending-public-beta/), [Email Service docs](https://developers.cloudflare.com/email-service/).

This is a different product from Email Routing. Email Routing and Email Workers still only receive, forward, and reply — `message.forward()` and `message.reply()`.

Source: [Email Workers](https://developers.cloudflare.com/email-routing/email-workers/).

Binding, in the Wrangler config:

```jsonc
{ "send_email": [{ "name": "EMAIL" }] }
```

Four forms: unrestricted (any verified destination in the account), `destination_address`, `allowed_destination_addresses`, `allowed_sender_addresses`. "The sender address must always belong to a domain you have onboarded to Email Service."

The rule that decides whether magic links work: "Before you onboard a sending domain, you can send emails only to verified destination addresses in your account. After you onboard a sending domain, you can send to any recipient immediately."

Price: Workers Free cannot send outbound at all. Workers Paid includes 3,000 outbound per month, then **$0.35 per 1,000**. Sends to verified destination addresses are free and do not count against the quota. "Sending to arbitrary recipients requires the Workers Paid plan."

Limits: 50 recipients per message, 5 MiB message, 998-character subject, 30 domains per zone. New accounts start on "a conservative daily quota" that grows with reputation.

Requirement: "You must be using Cloudflare DNS to use Email Service."

Trap: a message sent from a Worker through `send_email` shows as **dropped** in the Email Routing summary even when it was delivered. Read the Email sending metrics instead.

Sources: [Send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [Limits](https://developers.cloudflare.com/email-service/platform/limits/), [Pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

### Resend

Cloudflare's own Workers tutorial uses Resend and was last updated 2026-06-09.

Source: [Send emails with Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/).

Both paths work from a Worker: a plain `POST https://api.resend.com/emails` with a bearer token, or the `resend` npm SDK, which Resend documents for Workers with no `nodejs_compat` flag.

Price, read from [resend.com/pricing](https://resend.com/pricing) on 2026-08-25:

| Plan | Per month | Volume | Overage |
|---|---|---|---|
| Free | $0 | 3,000/month, 100/day cap | — |
| Pro | $20 | 50,000 | $0.90/1K |
| Pro | $35 | 100,000 | $0.90/1K |
| Scale | $90 | 100,000 | $0.90/1K |
| Scale | $160 | 200,000 | $0.80/1K |

There is no Resend binding. The dashboard integrations that once held such connectors were removed; the API key goes in a Wrangler secret.

Source: [Workers integrations changes, 2025-06-09](https://developers.cloudflare.com/changelog/post/2025-06-09-workers-integrations-changes/).

### Others, priced

All are `fetch`-callable.

| Service | Free | First paid tier |
|---|---|---|
| Amazon SES | none permanent | $0.10 per 1,000, no minimum |
| Postmark | 100/month | $15/month for 10,000 |
| Mailgun | 100/day | $15/month for 10,000 |
| Brevo | 300/day | from $9/month for 5,000 |
| SendGrid | 60-day trial only | from $19.95/month |

Sources: [SES pricing](https://aws.amazon.com/ses/pricing/), [Postmark pricing](https://postmarkapp.com/pricing), [Mailgun pricing](https://www.mailgun.com/pricing/), [Brevo pricing](https://www.brevo.com/pricing/), [SendGrid pricing](https://www.twilio.com/en-us/products/email-api/pricing).

SES needs AWS SigV4 signing, which is extra code in a Worker or the `aws4fetch` package. SES also starts every account in a sandbox that can only mail verified addresses until you request production access.

### DNS, for all of them

Every option needs a verified sending domain with SPF and DKIM. DMARC is required in practice by the Gmail and Yahoo bulk-sender rules.

Cloudflare Email Service puts the sending records on a `cf-bounce` subdomain: SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, a DKIM TXT at `cf-bounce._domainkey`, and three MX records for bounces. DMARC goes at `_dmarc.<domain>`.

Source: [Email Service domains](https://developers.cloudflare.com/email-service/configuration/domains/).

Resend issues SPF, DKIM, DMARC, and MX records per domain, and recommends a subdomain such as `mail.example.com` to keep sending reputation separate.

Source: [Resend domains](https://resend.com/docs/dashboard/domains/introduction).

One domain can hold only one SPF TXT record. Merge `include:` mechanisms; do not add a second record.

## 5. Session storage on Workers

Better Auth offers three arrangements. They combine.

### a. Session row in D1, cookie holds the token — the default

`session` table as in section 3. Default `expiresIn` is 7 days; `updateAge` is 1 day, at which point the expiry is extended. Every `getSession` reads the database.

Source: [Session management](https://www.better-auth.com/docs/concepts/session-management).

Cost per authenticated request: one indexed row read on `session`, plus the `user` row Better Auth returns with it. D1 charges by rows read, not by query. Workers Paid includes 25 billion rows read per month, then $0.001 per million; 50 million rows written per month, then $1.00 per million; 5 GB storage, then $0.75 per GB-month. Workers Free gives 5 million rows read and 100,000 rows written per day.

The `updateAge` refresh is a row *write* once per day per active session. Writes are the expensive side: $1.00 per million against $0.001 per million for reads.

Source: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

### b. Cookie cache — a signed cookie carries the session

```ts
session: { cookieCache: { enabled: true, maxAge: 5 * 60 } }
```

With it on, Better Auth "validates sessions from the signed cookie itself, eliminating database queries until the cache expires".

Cost per request inside the window: zero storage operations. Only the Worker request and its CPU. Workers Paid includes 10 million requests per month, then $0.30 per million, and 30 million CPU-milliseconds, then $0.02 per million.

Source: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

The price is revocation lag. The docs note the server "cannot directly delete cookies from other devices", so a revoked session stays usable for up to `maxAge`. The cookie also carries the user object, so it is bounded by the browser cookie limit — RFC 6265 section 6.1 asks user agents to support "at least 4096 bytes per cookie (as measured by the sum of the length of the cookie's name, value, and attributes)".

Source: [RFC 6265 section 6.1](https://www.rfc-editor.org/rfc/rfc6265#section-6.1).

### c. `secondaryStorage` — KV, or anything with the interface

```ts
interface SecondaryStorage {
  get: (key: string) => Promise<unknown>;
  getAndDelete: (key: string) => Promise<unknown>;
  increment: (key: string, ttl: number) => Promise<number>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
}
```

It holds "session data, verification records, rate limiting counters, and other short-lived auth data". Setting it drops the `session` and `verification` tables from the generated schema, unless you set `session.storeSessionInDatabase` or `verification.storeInDatabase`.

Source: [Database concepts](https://www.better-auth.com/docs/concepts/database); confirmed against `get-tables.mjs`.

KV cost: Workers Paid includes 10 million key reads per month then $0.50 per million; 1 million writes then $5.00 per million; 1 million deletes then $5.00 per million; 1 GB storage then $0.50 per GB-month. Free gives 100,000 reads, 1,000 writes, 1,000 deletes per day. Reads of missing keys are billable.

Source: [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).

Two facts make KV awkward for sessions:

- KV is eventually consistent. A write "may take up to 60 seconds or more to be visible in other global network locations as their cached versions of the data time out". `cacheTtl` defaults to 60 seconds with a minimum of 30. So sign-out can lag by a minute at another location — the same failure the cookie cache has, without the cookie cache's saving of the read.
- `increment` cannot be atomic on KV. Better Auth wants it for rate limiting. Cloudflare's own advice is to use Durable Objects when you need atomic operations.

Sources: [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Read key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/).

KV limits: 25 MiB per value, 512 bytes per key, 1024 bytes of metadata.

Source: [KV limits](https://developers.cloudflare.com/kv/platform/limits/).

### Cost side by side, per authenticated request

| Arrangement | Storage operations | Marginal Cloudflare price |
|---|---|---|
| D1 session row | ~2 rows read | ~$0.000000002 at $0.001 per million rows |
| D1 + cookie cache, inside the window | 0 | $0 above the request itself |
| KV secondary storage | 1 key read | $0.0000005 at $0.50 per million |

A KV read is roughly 250 times the price of a D1 row read at list rates. Both are far inside the included allowances of the $5 Workers Paid plan for a single-user CMS. The real cost is consistency, not money.

## 6. Roles

**One column is enough. The plugin is optional.**

`user.additionalFields` adds a column with no plugin:

```ts
betterAuth({
  user: { additionalFields: { role: { type: "string", required: false, input: false } } },
})
```

Verified: the generated DDL in section 3 contains `"role" text`, produced by exactly that config with no plugin loaded. `input: false` stops the field being settable through the sign-up API, which matters when the column decides who is the owner.

The `admin` plugin gives more, for 5,580 bytes gzipped: `role`, `banned`, `banReason`, `banExpires`, `session.impersonatedBy`, `defaultRole` (default `"user"`), `adminRoles` (default `["admin"]`), `adminUserIds`, plus an admin API — list users, ban, impersonate, set role. It does not need the access-control plugin; `createAccessControl` from `better-auth/plugins/access` is there if you want custom permissions.

Source: [Admin plugin](https://www.better-auth.com/docs/plugins/admin).

So: for one owner and a set of viewers, `additionalFields` plus your own check is enough. The plugin earns its place only if you want the admin API surface — impersonation and bans — which a single-user CMS does not obviously need.

## Facts that cut against the ticket's assumptions

- The ticket says "Better Auth ships adapters for Drizzle, Kysely, and a hand-written one". Since 1.5 there is a fourth and simplest one: a built-in D1 dialect that takes the binding.
- The ticket asks about "whichever adapter it forces". It forces none, but `kysely` is a hard dependency, so the Kysely code ships whatever you choose, unless you use `better-auth/minimal`.
- Adding Drizzle on the default entry costs 22.7 KB gzipped and saves nothing.
- MailChannels is no longer a free option and Cloudflare no longer points at it.
- Cloudflare now sends transactional mail itself, in public beta since 2026-04-16, at $0.35 per 1,000 after 3,000 free per month on Workers Paid. This did not exist when #5 was decided.
- The 1.5 release note's claim that Better Auth "uses D1's `batch()` API for atomicity" is not borne out by the code. Only introspection uses `batch()`.

## Open points this research does not settle

- Whether the non-atomic write path matters for any flow this project will use.
- Whether Cloudflare Email Service leaves beta, and what its reputation-based daily quota starts at for a new account.
- Whether a build-time `compileMigrations()` step can be made to produce stable, diff-able migration files that sit beside the app's own wrangler migrations.
- What `better-auth/minimal` gives up besides adapter detection.
