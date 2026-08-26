import { expect, test } from "@playwright/test";

import { type EntryFixture, expectEntryPage, fillEntry } from "./entry-form";

test("the owner saves a new entry and then edits it", async ({
	page,
}, testInfo) => {
	// The path is the entry's identity in one shared namespace (ADR 0004), and
	// both browser projects run this spec against one database, so each needs a
	// word of its own.
	const entry: EntryFixture = {
		title: `A saved entry (${testInfo.project.name})`,
		path: `e2e-save-${testInfo.project.name}`,
		heading: "The first section",
		body: "The body this entry was created with.",
	};

	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create" }).click();
	await expectEntryPage(page, entry);

	// The whole entry posts again, guarded by its version (ADR 0011).
	await page.getByRole("link", { name: "Edit" }).click();
	const edited = { ...entry, body: "The body this entry was edited to." };
	await page.getByLabel("Body (markdown)").fill(edited.body);
	await page.getByRole("button", { name: "Save", exact: true }).click();

	await expectEntryPage(page, edited);
	await expect(page.getByText(entry.body)).toHaveCount(0);
});
