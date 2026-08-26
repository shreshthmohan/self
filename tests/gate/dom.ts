import { JSDOM } from "jsdom";

/**
 * A DOM for TipTap.
 *
 * The gate runs in the browser in production, on the edit route. These checks
 * run it headlessly instead, because what they measure — what the document
 * model can hold — is the same in any DOM, and a check that needs a server, a
 * database and a sign-in to answer a parsing question rots on its running
 * time alone.
 *
 * `jsdom` is pinned to 26.1.0 EXACTLY, and the pin is load-bearing. Version 27
 * and later reach `whatwg-encoding` through an export the Playwright runner
 * cannot link, so every check here dies before it runs with `request for
 * './fallback/encoding.js' is from a module not been linked`. Node 24 and later
 * hide it; `.node-version` and CI run Node 22, so a green local run on a newer
 * runtime proves nothing. Bump this only against Node 22, and keep the range
 * exact — a caret defeats the pin on its own. `@types/jsdom` is held at 21.1.7
 * to match, because its next release is 27. See #42.
 *
 * IMPORT THIS FIRST, before anything that reaches TipTap. A module body runs
 * when it is imported, and `@tiptap/core` reads `window` as it loads, so the
 * order of the import lines is the order these globals are installed in.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>");

const g = globalThis as unknown as Record<string, unknown>;

g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
	value: dom.window.navigator,
	configurable: true,
});
g.DOMParser = dom.window.DOMParser;
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.HTMLElement = dom.window.HTMLElement;
g.getComputedStyle = dom.window.getComputedStyle;
