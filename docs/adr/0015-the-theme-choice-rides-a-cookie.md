# The theme choice rides a cookie the browser writes

ADR 0014 shipped `prefers-color-scheme` alone, so the reader gets whatever the operating system says and cannot argue. This adds a switch with three states — dark, light, and system — defaulting to system.

**The choice is stored in a cookie, and JavaScript alone writes it.** The root loader reads that cookie and renders `data-theme` on `<html>`, so the first paint is already correct. There is no inline script, no flash, and no hydration mismatch.

## The store is a cookie, not `localStorage`

The ticket went in with `localStorage` settled, and this reverses it.

`localStorage` cannot be read on the server. An SSR page therefore paints the system theme and corrects itself after hydration, which is a visible flash on every load for anyone who picked something else. The usual fix is a small blocking script inline in `<head>` — a script in the critical path on a site that otherwise needs none.

A cookie was priced against that and refused, because a cookie was read as a form, a route, and a request per change. That reading was wrong. **The cookie only has to be readable on the server; it does not have to be written there.** `document.cookie` is a browser API. So the write stays in the browser, exactly where `localStorage` would have put it, and the read moves to the server, which is the whole point.

What that buys:

- No flash. The attribute is in the first byte of HTML.
- No hydration mismatch. The server and the client agree, because the server was told.
- No blocking script.
- No form, no route, no extra request. The costs that made the cookie look expensive belong to the *no-JavaScript* cookie, not to this one.

What it costs is about twenty bytes on every request, and one more thing the root loader reads.

The one real objection to a cookie is that it makes the HTML uncacheable at the edge. That objection is already spent: every page varies by the session cookie, because the header renders differently for the owner. Nothing was cacheable to lose.

## It stays a named exception to progressive enhancement

With JavaScript off there is no switch, and the page falls back to `prefers-color-scheme` — which is the "system" default. The enhancement adds a choice; it does not gate a door. Nothing degrades, because the fallback is the behaviour ADR 0014 already shipped.

The **control is not rendered until the component mounts**, in a slot of fixed size. A reader with no JavaScript sees no control, rather than a control that does nothing, and reserving the space keeps the header from shifting. An inert widget is a lie told to the one reader who gets nothing.

## Absence means system, in both places

The DOM carries `data-theme="dark"` or `data-theme="light"`, or **no attribute at all**. No attribute means system, so the media query decides and an operating-system change tracks live with no JavaScript running. An explicit `data-theme="system"` was refused: the media query still does the work, so the value only adds a third state to keep in step.

The cookie mirrors it. Picking system **deletes** the cookie. Two stored values, `dark` and `light`, and a reader who never touches the control carries no cookie at all. The server ignores any other value.

The selectors follow from that:

```css
:root[data-theme="dark"] { /* dark tokens */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark tokens */ }
}
```

`color-scheme` must be restated under an override — `:root[data-theme="dark"] { color-scheme: dark }` and the light equivalent. Without it the scrollbars and the native form controls keep following the operating system while the page does not.

## The server renders the attribute, the browser mutates it, React touches neither

On change, the handler writes the cookie and sets or removes the attribute on `document.documentElement` directly. The `<select>` is uncontrolled and seeded from the loader value.

React never renders `data-theme`, so nothing contends for it. The alternative — React state plus a revalidation — is a round trip to the server to learn something the browser just decided.

The cookie is named `theme`, with `Path=/`, `SameSite=Lax`, `Secure`, and a `Max-Age` of one year. It is **not** `HttpOnly`, because JavaScript writes it.

## The control is a select, in the header

A native `<select>` with three options. It shows its current state without being clicked, and it is keyboard-accessible with no work. A cycling button is smaller but only legible after a click; three segmented buttons need their own pressed-state styling.

It sits at the far right of the header nav. A reader who wants it wants it before reading, not after, and the header is otherwise empty for a signed-out reader.

## Consequences

The choice is per browser, not per account. Signing in on a second device starts at system. That is right for a device preference and wrong for nothing here.

The site now has one cookie that is not the session. Any future decision about cookie policy or a consent notice inherits it — though a strictly necessary preference cookie the reader set on purpose is the easy case.
