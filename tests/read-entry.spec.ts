import { expect, test } from "@playwright/test";

import { PUBLIC_ENTRY, expectEntryPage } from "./entry-form";
import { SIGNED_OUT } from "./owner";

// A stranger, not the owner. What a visitor may read is decided by visibility,
// so the read flow is worth nothing signed in as the one person who sees
// everything.
test.use({ storageState: SIGNED_OUT });

test("a stranger reads a public entry from the listing", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("link", { name: PUBLIC_ENTRY.title }).click();

	await expectEntryPage(page, PUBLIC_ENTRY);
	await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});

test("an unknown path gives the generic notice", async ({ page }) => {
	const response = await page.goto("/no-entry-claims-this-word");

	// The wording lives in the root ErrorBoundary, which renders on the server,
	// so a reader with JavaScript off gets the notice and not a blank page.
	expect(response?.status()).toBe(404);
	await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
