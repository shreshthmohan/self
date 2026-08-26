import { defineConfig, devices } from "@playwright/test";

import { OWNER_STATE } from "./tests/owner";

/**
 * The suite runs every flow twice: once in a browser with JavaScript, once in
 * a browser without. The second project is why the harness exists. An untested
 * no-JS path rots within a month, and it rots silently, because every developer
 * runs with JavaScript on — so a route that works only after hydration fails
 * the build here. See ADR 0002.
 *
 * The server is `scripts/e2e-server.sh`, which explains the port and the
 * database it runs against.
 */
const BASE_URL = "http://localhost:5273";

export default defineConfig({
	testDir: "./tests",
	outputDir: "./tests/.tmp/results",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,

	/**
	 * One retry in CI, and no more. A sign-in spends one of the address's five
	 * magic-link sends per hour (ADR 0013). A clean run spends three — the setup
	 * and one sign-in per project — so one retry of each sign-in reaches five,
	 * which is the ceiling exactly. A second retry would fail on the limit
	 * rather than on the bug.
	 */
	retries: process.env.CI ? 1 : 0,

	reporter: [
		["list"],
		["html", { outputFolder: "tests/.tmp/report", open: "never" }],
	],

	use: { baseURL: BASE_URL, trace: "retain-on-failure" },

	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts$/,
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "scripted",
			testMatch: /\.spec\.ts$/,
			dependencies: ["setup"],
			use: { ...devices["Desktop Chrome"], storageState: OWNER_STATE },
		},
		{
			// The same specs, with the runtime removed. Links must be links and
			// forms must be forms.
			name: "scriptless",
			testMatch: /\.spec\.ts$/,
			dependencies: ["setup"],
			use: {
				...devices["Desktop Chrome"],
				storageState: OWNER_STATE,
				javaScriptEnabled: false,
			},
		},
	],

	webServer: {
		command: "sh scripts/e2e-server.sh",
		url: BASE_URL,
		// Never reuse. The script wipes and migrates the database it starts,
		// and a server already on this port is a leftover, not a shortcut.
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
