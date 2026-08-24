# React Router v8: hydration on read-only pages

Research for issue #6. Facts only. No recommendation.

Date: 2026-08-24. Version under test: `react-router` 8.3.0 (npm `latest`).

## Summary

1. React Router v8 has no per-route hydration flag. The only documented way to stop hydration is to not render `<Scripts />`. That switch is per document, and a route can control it.
2. A minimal server-rendered article page on v8 loads 5 JavaScript files: 306 KiB raw, 99 KiB gzip, 87 KiB brotli. Measured, not estimated.
3. The same page without `<Scripts />` loads 0 JavaScript files. The HTML is 249 bytes.
4. Pre-rendering does not remove hydration. A pre-rendered page keeps the same script tags.
5. React Server Components move component code to the server, but the client runtime gets larger, not smaller. RSC is experimental in 8.3.0.

## Method

Primary sources are the shipped docs inside `node_modules/react-router/docs` (v8.3.0), the shipped TypeScript types, the reactrouter.com API reference, Cloudflare Workers docs, and the react-router GitHub repository.

The numbers come from real builds. Steps:

1. `npx create-react-router@latest --template remix-run/react-router-templates/default` (react-router 8.3.0, Vite 8.2.2, React 19.2.7).
2. Remove Tailwind and the welcome page. Keep one index route with a `loader` that returns a title and a body.
3. `npm run build`, then `react-router-serve`, then `curl` the page to see the real script tags.
4. Measure each file with `wc -c`, `gzip -9`, and `zlib.brotliCompressSync`.

Caveat: the test machine runs Node 22.19.0. React Router v8 asks for Node 22.22.0 or later and prints a warning. The build and the server still ran.

## 1. Can v8 skip or narrow hydration for a read-only route?

### There is no per-route hydration option

The `Config` type in `@react-router/dev` (v8.3.0, `dist/config-t89niiFv.d.ts`) has these render-related keys only: `ssr`, `prerender`, `splitRouteModules`, `routeDiscovery`, `serverBundles`, `basename`, `future`. `ssr` is a boolean for the whole app. No key controls hydration for one route.

The docs agree. `docs/start/framework/rendering.md` says about `ssr`:

> Though it's a global setting, individual routes can still be statically pre-rendered. Routes can also use client data loading with `clientLoader` to avoid server rendering/fetching for their portion of the UI.

### `clientLoader.hydrate` controls data, not components

`docs/how-to/client-data.md` and `docs/explanation/hydration.md` describe `clientLoader.hydrate` and `HydrateFallback`. Both control whether a **client loader runs** during the first hydration, and what to render while data is missing. Neither stops React from hydrating the route component. `docs/explanation/hydration.md` states that `HydrateFallback` "is only relevant when you are also setting `clientLoader.hydrate=true` on a given route".

### The documented switch is `<Scripts />`

The v8.3.0 API reference for `Scripts` (https://reactrouter.com/api/components/Scripts) says:

> If server rendering, you can omit `<Scripts/>` and the app will work as a traditional web app without JavaScript, relying solely on HTML and browser behaviors.

This is the only documented no-hydrate escape hatch. The `Scripts` component takes one prop, `scriptProps`. It has no per-route option.

Measured result. The same article app, with `<Scripts />` and `<ScrollRestoration />` removed from the root layout:

- Served HTML: 249 bytes, 0 `<script>` tags, 0 `modulepreload` links.
- The client build still writes all the JavaScript files to `build/client/assets`. The browser never asks for them.

### A route can turn `<Scripts />` off for itself

The root `Layout` is a normal React component, so it can read `useMatches()` and drop `<Scripts />` for one route. Tested on 8.3.0 with two routes, `/` and `/article`:

```tsx
export function Layout({ children }: { children: React.ReactNode }) {
  let matches = useMatches();
  let noJs = matches.some((m) => m.id === "routes/article");
  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body>{children}{noJs ? null : <Scripts />}</body>
    </html>
  );
}
```

Result on a document request:

- `GET /` returns the 5 modulepreload links and the script tags.
- `GET /article` returns 249 bytes with no script tag.

This works for a document load. It does not remove the client runtime from a client-side navigation. If the user reaches `/article` through a `<Link>` from a page that has scripts, the router is already running in the browser and renders the article there.

### Islands are not on the roadmap

GitHub discussion 13343, "Islands Architecture support" (2025-04-02), asks for hydration control per component. React Router collaborator sergiodxa answers:

> I don't think islands architecture works with RR, because the router needs to control the whole page

He points at RSC for the same goal.

## 2. What does a plain article page cost on v8?

Minimal framework-mode app. Root layout with `Meta`, `Links`, `Outlet`, `ScrollRestoration`, `Scripts`. One index route with a server `loader` and two elements. No CSS, no Tailwind.

| File | Raw | Gzip -9 | Brotli |
| --- | ---: | ---: | ---: |
| `entry.client-*.js` | 185,857 | 57,851 | 50,269 |
| `jsx-runtime-*.js` | 83,658 | 27,581 | 24,412 |
| `errorBoundaries-*.js` | 33,299 | 11,607 | 10,484 |
| `root-*.js` | 10,346 | 4,204 | 3,696 |
| `home-*.js` | 216 | 195 | 139 |
| **Total** | **313,376** | **101,438** | **89,000** |

That is 306 KiB raw, 99 KiB gzip, 87 KiB brotli. The route module itself is 216 bytes. Everything else is React, React DOM, and the router.

The served HTML for that page is 3,346 bytes. It carries all 5 files as `modulepreload` links, an inline script for scroll restoration, an inline `window.__reactRouterContext`, an inline route manifest, and the loader data a second time as a turbo-stream chunk:

```
window.__reactRouterContext.streamController.enqueue("[...\"title\",\"An article\",\"body\",\"Some prose that came from a database.\"]\n");
```

So the article text goes over the wire twice when scripts are on: once as HTML, once as serialized loader data.

Chunk names do not map to packages one to one. Rolldown mixes React, React DOM, and router code across `entry.client`, `jsx-runtime`, and `errorBoundaries`. Read the total, not the parts.

`splitRouteModules` defaults to `true` (`docs/explanation/code-splitting.md`). It splits `clientLoader`, `clientAction`, `clientMiddleware`, and `HydrateFallback` away from the component. It does not touch the runtime above.

## 3. What else exists?

### Pre-rendering

`docs/how-to/pre-rendering.md` and the `prerender` config build HTML at build time. Test: `prerender: ["/article"]` on the same app.

- Output: `build/client/article/index.html` (4,317 bytes) and `build/client/article.data` (115 bytes).
- The HTML still contains the `modulepreload` link and the same inline scripts. Hydration is unchanged.

Pre-rendering removes the server render, not the client bundle.

Cloudflare matters here. The Cloudflare Workers guide for React Router (https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) states:

> SPA mode and prerendering are not currently supported when using the Cloudflare Vite plugin.

### `<Await>` and Suspense

`docs/how-to/suspense.md` shows `<Await>` with a promise returned from a loader. This defers non-critical data and streams it. It changes when data arrives. It does not change the JavaScript payload, and the page still hydrates.

### React Server Components

`docs/how-to/react-server-components.md` carries this warning verbatim:

> React Server Components support is experimental and subject to breaking changes in minor/patch releases. Please use with caution and pay **very** close attention to release notes for relevant changes.

Every RSC API is prefixed `unstable_`: `unstable_reactRouterRSC`, `unstable_RSCRouteConfig`, `unstable_matchRSCServerRequest`, `unstable_routeRSCServerRequest`, `unstable_RSCStaticRouter`, `unstable_createCallServer`, `unstable_getRSCStream`, `unstable_RSCHydratedRouter`. The bundler plugin `@vitejs/plugin-rsc` is experimental too. The v8 announcement (GitHub discussion 14468) says the team plans to stabilize RSC in a minor release after v8.

Measured RSC cost. Template `unstable_rsc-framework-mode`, same versions:

| File | Raw | Gzip -9 | Brotli |
| --- | ---: | ---: | ---: |
| `react-*.js` | 216,685 | 67,350 | 58,072 |
| `router-*.js` | 112,352 | 35,873 | 31,671 |
| `root-*.js` | 1,189 | 656 | 545 |
| `rolldown-runtime-*.js` | 558 | 356 | 313 |
| `index-*.js` | 524 | 355 | 334 |
| `home-*.js` | 350 | 271 | 216 |
| `entry.rsc-*.js` | 206 | 174 | 146 |
| **Total** | **331,864** | **105,035** | **91,297** |

The RSC client runtime is larger than the non-RSC one: 105 KiB gzip against 99 KiB gzip. RSC removes **component** code from the browser, not the router and React runtime. The server components in that template compile to 0.35 KiB of client references.

One more fact about the RSC template: `npm install` fails with `ERESOLVE`, because `vite-plugin-devtools-json@1.0.0` accepts Vite 5, 6, or 7, and the template pins Vite 8.0.3. `--legacy-peer-deps` gets past it.

## Sources

- `node_modules/react-router/docs/` at version 8.3.0: `explanation/hydration.md`, `explanation/progressive-enhancement.md`, `explanation/code-splitting.md`, `start/framework/rendering.md`, `how-to/client-data.md`, `how-to/pre-rendering.md`, `how-to/suspense.md`, `how-to/react-server-components.md`.
- `node_modules/@react-router/dev/dist/config-t89niiFv.d.ts` at version 8.3.0, type `ReactRouterConfig`.
- https://reactrouter.com/api/components/Scripts (v8.3.0).
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://github.com/remix-run/react-router/discussions/13343
- https://github.com/remix-run/react-router/discussions/14468
- Local builds of `remix-run/react-router-templates/default` and `remix-run/react-router-templates/unstable_rsc-framework-mode`.
