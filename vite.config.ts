import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * `E2E_STATE_DIR` marks a run started by `scripts/e2e-server.sh`, and holds
 * the directory the suite keeps its local D1 in. Two things move with it.
 *
 * The state directory, so a test run wipes and migrates a database of its own
 * and never the one `pnpm run dev` writes.
 *
 * The port, pinned. The suite answers on one origin and no other, for the
 * reason `scripts/e2e-server.sh` gives, so `strictPort` makes a clash the
 * error it is instead of a silent move to the next free port.
 */
const e2eStateDir = process.env.E2E_STATE_DIR;

/**
 * `marked` reaches the browser by dynamic import, on the editor only (see
 * `app/lib/preview.ts`). Vite does not see that import when it scans on start,
 * so it discovers the dependency the first time an editor page runs, optimizes
 * it, and RELOADS the page. A reload in the middle of a save loses the click
 * and leaves the spec on `/a/new`. Naming it here pre-bundles it with the
 * rest, so no run reloads for it.
 */
export default defineConfig({
	optimizeDeps: { include: ["marked"] },

	plugins: [
		cloudflare({
			viteEnvironment: { name: "ssr" },
			...(e2eStateDir ? { persistState: { path: e2eStateDir } } : {}),
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
	...(e2eStateDir
		? {
				server: {
					port: 5273,
					strictPort: true,
					// Playwright writes traces and reports under `tests/.tmp`.
					// Unignored, every artifact it saves reloads the page the run is
					// on.
					watch: { ignored: ["**/tests/.tmp/**"] },
				},
			}
		: {}),
});
