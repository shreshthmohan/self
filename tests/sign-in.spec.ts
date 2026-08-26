import { expect, test } from "@playwright/test";

import { SIGNED_OUT, signIn } from "./owner";

// Signed out. The saved owner state is what the other specs start from; this
// spec is the flow that produces it.
test.use({ storageState: SIGNED_OUT });

test("a magic link signs the owner in, and a POST signs them out", async ({
	page,
}) => {
	await signIn(page);

	// The link lands on `/`, so no redirect parameter is carried and none has
	// to be validated (ADR 0012).
	await expect(page).toHaveURL("/");
	await expect(page.getByRole("link", { name: "New entry" })).toBeVisible();

	// Signing out is a POST and nothing else, so it is a real form.
	await page.getByRole("button", { name: "Log out" }).click();
	await expect(page).toHaveURL("/");
	await expect(page.getByRole("link", { name: "New entry" })).toHaveCount(0);
});
