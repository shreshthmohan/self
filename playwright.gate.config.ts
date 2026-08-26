import { defineConfig } from "@playwright/test";

/**
 * The fidelity gate checks of ADR 0007 (#42).
 *
 * A config of their own, and no `webServer`, because these answer a parsing
 * question: what TipTap's document model can hold, and whether the site's
 * renderer reads the result the same way. No route, no database and no sign-in
 * bears on the answer, so hanging them off the browser suite would only buy
 * them its start-up cost — and a slow check is a check somebody skips.
 *
 * They still run on every push. `pnpm run test` runs this config first, so
 * there is one command and nothing to remember.
 */
export default defineConfig({
	testDir: "./tests/gate",
	testMatch: /\.check\.ts$/,
	outputDir: "./tests/.tmp/gate-results",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	reporter: [["list"]],
});
