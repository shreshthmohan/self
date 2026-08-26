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
