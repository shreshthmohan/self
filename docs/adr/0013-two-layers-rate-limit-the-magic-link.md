# Two layers rate-limit the magic link

The magic-link form is an unauthenticated POST that spends an email. The owner's address is on the site, and closed registration means the set of addresses that can spend a send has about one member. So a per-IP limit protects little: the attacker's cost is a new IP, and the asset is the one mailbox that can unlock the site.

The site therefore runs **two** limits, keyed differently. The real bound is **5 requests per address per hour**, hand-written. Beside it, Better Auth's own limiter stays as a per-IP layer at **3 per 60 seconds**, tightened from the magic-link plugin's default of 5.

## The per-address limit could not be configured

[Session storage and revocation lag](https://github.com/shreshthmohan/self/issues/26) chose `storage: "database"` for Better Auth's limiter, and ADR 0009 records it. That decision stands and is untouched by this one, because it never bore on a per-address limit — **no setting reaches one.**

In better-auth 1.7.1, `resolveRateLimitConfig` builds the key as `createRateLimitKey(ip, path)` and nothing else. `customRules` overrides `window` and `max`, or returns `false` to skip a path; it cannot touch the key. `customStorage` receives the key already built, never the request. A per-address limit is code, not configuration.

That code sits in `sendMagicLink`, beside the unknown-address gate from ADR 0012, and for the same reason: `/api/auth/sign-in/magic-link` is reachable directly, so a check in the `/login` action would guard the form and not the endpoint.

It counts in Better Auth's own `rateLimit` table, through Drizzle, under a namespaced key such as `magic-link-email|<address>`. The table already exists and [Drizzle schema and first migration](https://github.com/shreshthmohan/self/issues/51) already declares it in `app/db/schema.ts`; its three columns — `key`, `count`, `lastRequest` — are exactly this shape, so a second table would hold the same three columns under a different name. The risk is that a Better Auth upgrade changes that table's meaning. The schema file is generated, checked in, and diff-read on every upgrade, so the change would be visible rather than silent.

**Five per hour**, because a real sign-in is one mail and a person who does not receive it retries once or twice. Five leaves room for a genuine retry loop and still bounds a flood at 120 mails a day to one mailbox. A second daily window was considered and dropped: it buys a tighter cap at the price of a second counter and a second failure mode, and it is one more key whenever it is wanted.

## The per-IP limit was decorative, and nobody knew

The magic-link plugin declares its own rule — `/sign-in/magic-link` and `/magic-link/verify`, window 60 s, max 5 — which overrides the built-in `/sign-in*` rule of 10 s / 3. So a per-IP limit has been in force since the plugin was added.

It has almost certainly never bound anyone. Better Auth's default `ipAddressHeaders` is `["x-forwarded-for"]`, and Cloudflare **appends** the client IP to whatever `X-Forwarded-For` the client sent. A request carrying its own copy of the header arrives with two hops; with no `trustedProxies` configured, `getIPFromHeader` refuses a multi-hop chain and returns `null`; `resolveRateLimitConfig` then falls back to the literal key `no-trusted-ip|<path>`. **One bucket, shared by every requester.** Five sign-in attempts a minute, site-wide. An attacker can force that state deliberately by sending the header, and it also fires by accident behind any proxy that sets one.

The fix is `advanced.ipAddress.ipAddressHeaders: ["cf-connecting-ip"]`. Cloudflare overwrites that header on every proxied request, so it is single-valued and cannot be spoofed at the edge, and it needs no published IP range list kept current — which is what `trustedProxies` would have cost. Local `wrangler dev` sends no such header, but `getIP` falls back to `127.0.0.1` in development, so local is unaffected.

With the IP resolving, the rule tightens to **3 per 60 s**. The per-address counter is now the real bound, so this layer's only job is to make it expensive for one host to cycle through many addresses. Three in a minute is past any human retry pattern. It was not tightened to an hour: a household or an office behind one address would then lock each other out over a limit the per-address counter already enforces correctly.

## A limited request looks exactly like a send

It re-renders the same generic notice, per ADR 0003.

This is not an existence question. The counter increments for any address typed, known or not, so a distinct page would leak nothing about who exists. It is refused for a different reason: a distinct page tells an attacker their flood is landing, and tells a real owner nothing they can act on that "check your inbox, the link lasts 15 minutes" does not.

Better Auth's own 429 is left as it is. That is a different surface, reached by hammering the endpoint directly rather than by using the form, and suppressing it would buy nothing.

## Turnstile was considered and rejected

**Better Auth's `captcha` plugin cannot be used on this form under any answer.** It reads the token from an `x-captcha-response` **header**, which a native form post cannot set, so the plugin requires a `fetch` client — which ADR 0002 forbids as the only path. Its `defaultEndpoints` do not cover the magic link either. Turnstile here means hand-rolling the siteverify call.

Hand-rolling is workable. Turnstile's widget injects a hidden `cf-turnstile-response` input into the enclosing form, so a normal post carries it in the body, and `sendMagicLink` receives the endpoint context, so the check could sit beside the ADR 0012 gate and still cover a direct POST.

The blocker is that **Turnstile has no no-JS mode**. Every variant, "invisible" included, is a script that runs a challenge in the browser. Requiring it makes `/login` — the site's only door — a named exception to ADR 0002 with no no-JS equivalent.

Two lesser shapes were refused too. An **advisory** check, verified when present and skipped when absent, buys nothing against a deliberate attacker: they omit the token and are treated identically, so it filters only bots too dumb to notice. A **ceiling-raising** shape — a tighter limit with no token, the full limit with one — is the only honestly progressive version, because the enhancement raises a ceiling instead of gating a door, and JavaScript-off degrades to something stricter rather than something broken.

That shape is the one to reach for, and it is not wanted yet. The threat it buys down is 120 mails a day to one mailbox, which one mail filter silences. Against that it adds a Cloudflare resource, a secret per environment, a third-party script on the one page that otherwise needs no JavaScript at all, and a siteverify `fetch` in the send path that must fail closed on a timeout — making Cloudflare's challenge service a new way for sign-in to break. That trade is worse than the flood. Revisit it if a flood actually happens, or if viewers are invited and the address set grows past one published target.

## Consequences

**Every refused send leaves a row behind.** `createVerificationValue` runs **before** `sendMagicLink` is called, and D1 auto-commits, so both gates in `sendMagicLink` — the unknown address and now the over-limit — refuse a request whose `verification` row is already written. A flood writes one row per attempt.

This is accepted. The rows are small, they expire in 15 minutes, and Better Auth prunes them. Moving both gates ahead of the endpoint would save one small row per refused request and would duplicate both, because the endpoint stays directly reachable and would still need them as a backstop. A duplicated gate drifts.

**A per-address count cannot be derived from those rows.** The `verification` row's `identifier` is the hashed token, not the email, so counting unexpired rows for an address is not possible. The counter has to be its own state, which is what sends it to the `rateLimit` table.

**ADR 0009 is incomplete, not wrong.** It records the rate-limit posture and calls a Cloudflare WAF rule "worth adding later as a second layer". It does not say that the thing it configured is IP-keyed only, nor that the IP was not resolving. It now points here. The WAF rule it suggested is still worth having as a third layer, and still cannot key on an address: reading a request body needs Enterprise.

Set in [Rate-limit the magic-link request form](https://github.com/shreshthmohan/self/issues/46). ADR 0012 is [How the site gets its owner](https://github.com/shreshthmohan/self/issues/43) and lands with its build in [Build the sign-in and claim the site](https://github.com/shreshthmohan/self/issues/63).
