# Resend sends the magic link, not Cloudflare's own email service

The stack is Cloudflare end to end — Workers, D1, R2, Workers Builds — and Cloudflare now sends mail itself. **Email Service** entered public beta on 2026-04-16 and sends from a Worker through a `send_email` binding. The site does not use it. Magic-link mail goes out through **Resend**, over a plain `fetch` to `https://api.resend.com/emails`.

## Why not the in-house product

Two reasons, in order of weight.

**It refuses to send on Workers Free.** Cloudflare's own limits page: "Sending to arbitrary recipients requires the Workers Paid plan." A viewer who signs in is an arbitrary recipient. So Email Service makes sign-in depend on a billing tier, and a lapsed plan takes out authentication, not a feature. Nothing else in the stack has that coupling: D1, R2, and Workers Builds all run on Free.

**Its delivery reporting lies by default.** A message sent through `send_email` shows as **dropped** in the Email Routing summary even when it was delivered. The correct figures sit on a different page. A single operator debugging a sign-in failure at the wrong dashboard reads a false negative.

Against that, the owner already pays for Resend. The account, the API key, and the billing relationship exist; adopting Email Service would open a second sending relationship to replace a working one.

## What was chosen

| | |
| --- | --- |
| Transport | `POST https://api.resend.com/emails`, bearer token, no SDK |
| Credential | one Resend API key per environment, each a `wrangler secret` |
| From | `Shreshth <auth@send.shreshth.dev>` |
| Reply-To | `shreshthmohan@hey.com` |
| Body | plain text, the URL on its own line |
| Expiry | 15 minutes, single use |

The SDK was rejected on surface, not size — [Choose the D1 access layer](https://github.com/shreshthmohan/self/issues/11) already ruled Worker-side bytes near-irrelevant. One POST with a JSON body needs no library, and a library is one more version to hold.

The **subdomain** `send.shreshth.dev` carries SPF, DKIM, DMARC and the bounce MX records, so the apex zone that serves the site is untouched and a future bulk sender cannot spend the apex's reputation.

**Plain text, no button.** A button is a link a reader cannot inspect before clicking and a filter cannot read. Plain text shows the destination host in full and cannot render wrong. It also removes a template from a mail that carries one sentence.

**15 minutes, against Better Auth's 300 s default.** Five minutes is shorter than the fetch cycle of a phone mail client, so the link can die before it is seen. An hour leaves a working credential in an inbox. Single use stays: the link consumes its `verification` row.

## Consequences

**A failed send is not silent, but it is not loud either.** An unknown address gets the same generic notice as every other unpermitted request — ADR 0003 forbids an existence oracle. A failure of the Resend API itself gets a distinct error page, because that failure happens either side of the address check and so leaks nothing about the address. Both paths `console.error` to Workers Logs.

No bounce webhook. A bounce is not the failure that locks the owner out; an exhausted quota or a stale DKIM record is, and both arrive as a failed API call, not as a bounce. A webhook route with a signature check is real work against a fault it does not catch.

**Local development does not send.** It prints the URL to the Worker console and the operator copies it. `dev` and `main` both send for real, so the sending path is proved on `dev` before `main` depends on it.

**Nothing here is hard to reverse except the DNS.** The transport is one function. The sending domain and its accumulated reputation are the part that cost something to move, which is why the subdomain is separate from the apex.

Set in [How magic-link email is sent](https://github.com/shreshthmohan/self/issues/25).
