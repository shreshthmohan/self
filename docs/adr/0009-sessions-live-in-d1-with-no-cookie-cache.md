# Sessions live in D1, with no cookie cache

Better Auth offers three session stores on Workers, and the two cheaper ones both trade revocation speed for reads. The site takes the **default**: a `session` row in D1 and a token in the cookie, read on every authenticated request. `cookieCache` is off. `secondaryStorage` is unset. A revoked session dies on the next request.

## Why the expensive option is the cheap one

Cost did not decide this, because there is no cost. Measured at list rates, an authenticated request reads about two D1 rows — the `session` row and the `user` row Better Auth returns with it — which is roughly $0.000000002. Workers Paid includes 25 billion row reads a month. A single-owner site with a handful of viewers will not approach the allowance in the life of the site, so the read the other two options save is a saving of nothing.

What they charge for it is real:

**`cookieCache`** validates the session from the signed cookie and touches no storage until the window expires. Better Auth's own docs state the server "cannot directly delete cookies from other devices", so a revoked session keeps working for up to `maxAge`. The cookie also carries the user object, so it is bounded by the ~4096-byte cookie limit of RFC 6265 section 6.1 — a bound that tightens every time a field is added to `user`.

**`secondaryStorage` on KV** costs $0.50 per million key reads, about 250 times a D1 row read, and buys eventual consistency in exchange: a write "may take up to 60 seconds or more to be visible" elsewhere, and `cacheTtl` has a 30-second floor. That is the cookie cache's lag without the cookie cache's saved read. KV also has no atomic `increment`, so it cannot back rate limiting.

So the store that revokes immediately is also the one with no cookie-size ceiling, no consistency window, and a working rate-limit backend. The other two are optimisations for a read volume this site does not have.

## What was chosen

| | |
| --- | --- |
| Store | `session` row in D1, token in the cookie |
| `cookieCache` | off |
| `secondaryStorage` | unset |
| `expiresIn` | 30 days |
| `updateAge` | 1 day |
| Per-role policy | none — owner and viewer are identical |
| Rate limiting | `storage: "database"` |
| Secret | one `BETTER_AUTH_SECRET` per environment, a `wrangler secret` |

**30 days, not the 7-day default.** Sign-in is a magic link, so an expiry costs an email round-trip. At 7 days a viewer who reads the site fortnightly re-authenticates every visit, which makes a shared link feel broken. The longer life is free: the write count is set by `updateAge`, which stays at 1 day, not by `expiresIn`.

**One policy for both roles.** Better Auth's session config is global, so a per-role lifetime is custom code on session creation. It would guard against a threat model a single-owner site does not have, and it is one more thing an upgrade must survive.

**Rate limiting in the database.** The default `storage: "memory"` is per-isolate on Workers and resets constantly, so the limit is decorative — and the magic-link endpoint is unauthenticated and *sends email*, so an unlimited one burns the Resend quota and risks the sending domain. `storage: "database"` adds a fifth table through the migration route ADR 0006 already set. Its increments are not atomic, because D1 auto-commits, so a count can undershoot under concurrency; at this volume that does not matter. A Cloudflare WAF rule on the sign-in path is worth adding later as a second layer, not instead — it does not apply locally or on `dev`.

## Consequences

**The auth schema is five tables, not four.** [Better Auth adapter: built-in D1 dialect or minimal plus Drizzle](https://github.com/shreshthmohan/self/issues/24) held schema generation until this decision, because setting `secondaryStorage` deletes `session` and `verification` from the generated schema — a fact found in the source, which the prose docs do not state. It is unset, so both stay, and `rateLimit` joins them: `user`, `session`, `account`, `verification`, `rateLimit`. Generation is now unblocked.

**Immediate revocation needs a surface to be real.** Better Auth ships `revokeSession` and `revokeOtherSessions`, but something must call them. The site gets one owner-only route listing the owner's own active sessions — `userAgent`, `ipAddress`, `createdAt` — with a sign-out per row and a sign-out-everywhere. The scenario that made immediacy worth having is a stolen laptop, and a D1-console delete needs a working machine and Cloudflare credentials, which is what the owner may have just lost.

**Viewer sessions are not revoked from that screen.** Removing a viewer from an audience already takes effect on their next request, because ADR 0003 derives visibility per request from access rows rather than storing it. Where the user must go entirely, deleting the `user` row cascades to `session`. Neither path needs a viewer-session UI.

**Rotating `BETTER_AUTH_SECRET` signs everyone out.** Better Auth has no key-rotation window, so an overlap-free rotation would be code. Signing out one owner and a few viewers is a cheap incident, and it is a useful blunt instrument if the session table is ever untrustworthy.

Set in [Session storage and revocation lag](https://github.com/shreshthmohan/self/issues/26).
