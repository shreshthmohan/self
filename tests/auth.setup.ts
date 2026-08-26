import { expect, test as setup } from "@playwright/test";

import { PUBLIC_ENTRY, expectEntryPage, fillEntry } from "./entry-form";
import { OWNER_STATE, signIn } from "./owner";

/**
 * The claim, once per run, before either browser project starts.
 *
 * It exists for two reasons. It fixes WHEN the site gets its owner, which
 * happens once in the life of a database and would otherwise fall to whichever
 * spec ran first (ADR 0012). And it saves the owner's cookies, so the specs
 * that write an entry do not each spend a magic-link send against the
 * five-an-hour ceiling (ADR 0013).
 *
 * It seeds the public entry the read flow needs, in the same session.
 */
setup("the owner claims the site and seeds an entry", async ({ page }) => {
	await signIn(page);
	await expect(page.getByRole("link", { name: "New entry" })).toBeVisible();

	await page.goto("/a/new");
	await fillEntry(page, PUBLIC_ENTRY);
	await page.getByRole("button", { name: "Create" }).click();
	await expectEntryPage(page, PUBLIC_ENTRY);

	await page.context().storageState({ path: OWNER_STATE });
});
