/**
 * PROTOTYPE build. Bundles React, the editor and the shell script into one
 * inline <script>, and writes hydration-gap.prototype.html — a single file to
 * double-click or email.
 *
 *   node app/components/entry-editor.prototype/build.mjs
 */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const out = await build({
	entryPoints: [join(here, "src.jsx")],
	bundle: true,
	format: "iife",
	write: false,
	define: { "process.env.NODE_ENV": '"development"' },
	loader: { ".js": "jsx" },
});

const shell = await readFile(join(here, "shell.html"), "utf8");
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = shell.replace("/* BUNDLE */", js);
await writeFile(join(here, "hydration-gap.prototype.html"), html);
console.log(`wrote hydration-gap.prototype.html (${(html.length / 1024).toFixed(0)} KiB)`);
