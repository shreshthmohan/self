import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { loadPreviewRenderer } from "../../app/lib/preview";

/**
 * The preview of #103, checked where no browser is needed.
 *
 * These sit with the gate checks for the reason the gate config gives: they
 * answer a question about a pure function and a built file, so a server, a
 * database and a sign-in would only buy them a start-up cost. `pnpm run test`
 * runs this config first, so they run on every push.
 */

/**
 * The pane calls the site's one renderer (ADR 0007) and drops the heading ids
 * it emits. Nothing else about the HTML changes: a pane and the read page show
 * the same body.
 */
test("the pane renders the site's HTML, without the heading ids", async () => {
	const render = await loadPreviewRenderer();
	const html = render(
		"# One\n\n## A heading\n\n### Three\n\n<script>x</script>\n\nA **bold** word.",
	);

	// Every level, because the renderer gives every level an id.
	expect(html).toContain("<h1>One</h1>");
	expect(html).toContain("<h2>A heading</h2>");
	expect(html).toContain("<h3>Three</h3>");
	expect(html).not.toContain("id=");
	// The renderer under it is the site's, not marked's default: raw HTML is
	// escaped. See tests/gate/renderer.check.ts.
	expect(html).toContain("&lt;script&gt;");
	expect(html).toContain("<strong>bold</strong>");
});

/**
 * `marked` is about 13 kB gzip and a reader never needs it: the server renders
 * every read page. The preview is the one thing that puts the renderer in a
 * browser, and it does so by dynamic import, which is worth nothing unless the
 * bundler honours it.
 *
 * So this reads the BUILT manifest rather than the source. It walks the
 * client entry and EVERY route, with every chunk they statically import, and
 * fails if the renderer is in one. Every route, because a read page is not one
 * file: the listing and the entry are two, and the editor routes reach the
 * renderer by dynamic import, which this walk does not follow. A static import
 * added anywhere fails here rather than on a reader's connection.
 */
const CLIENT = "build/client";
const ASSETS = join(CLIENT, "assets");

/** An error message marked keeps through minification. */
const MARKED = "markedjs/marked";

test("the renderer is in no chunk a page loads", () => {
	test.skip(!existsSync(ASSETS), "no client build; run `pnpm run build`");

	const manifest = readManifest();
	const seeds = [manifest.entry, ...Object.values(manifest.routes)];

	const loaded = new Set<string>();
	for (const seed of seeds) {
		for (const module of [seed.module, ...seed.imports]) {
			collect(module.replace(/^\/assets\//, ""), loaded);
		}
	}

	// The check is only worth its run if the signature is real and the
	// renderer does reach the browser somewhere. Both, in one assertion.
	const everywhere = readdirSync(ASSETS).filter((file) =>
		readFileSync(join(ASSETS, file), "utf8").includes(MARKED),
	);
	expect(everywhere.length).toBeGreaterThan(0);

	expect(everywhere.filter((file) => loaded.has(file))).toEqual([]);
});

type Module = { module: string; imports: string[] };

function readManifest(): { entry: Module; routes: Record<string, Module> } {
	const file = readdirSync(ASSETS).find((name) =>
		/^manifest-[^/]+\.js$/.test(name),
	);
	if (!file) throw new Error(`no React Router manifest in ${ASSETS}`);

	const source = readFileSync(join(ASSETS, file), "utf8");
	const json = source
		.replace(/^window\.__reactRouterManifest=/, "")
		.replace(/;\s*$/, "");
	return JSON.parse(json);
}

/**
 * One chunk and everything it imports STATICALLY, by name. A dynamic import
 * reads `import("./x.js")` and matches neither pattern, which is the whole
 * point: the renderer's chunk is fetched when a pane asks for it and never
 * with the page.
 */
function collect(file: string, seen: Set<string>) {
	if (seen.has(file)) return;
	seen.add(file);

	const source = readFileSync(join(ASSETS, file), "utf8");
	for (const pattern of [/\bfrom"([^"]+)"/g, /\bimport"([^"]+)"/g]) {
		for (const [, specifier] of source.matchAll(pattern)) {
			if (specifier.endsWith(".js")) {
				collect(specifier.replace(/^\.\//, ""), seen);
			}
		}
	}
}
