import { expect, test } from "@playwright/test";

import { type EntryFixture, expectEntryPage, fillEntry } from "./entry-form";
import { waitForHydration } from "./hydration";

/**
 * Delete, end to end. See #99 and ADR 0017.
 *
 * Both browser projects run this against one database, so every fixture takes
 * a word of its own — the path is the entry's identity in one shared namespace
 * (ADR 0004).
 */

/** Rename the open entry, which leaves a redirect at the old word. */
async function renameTo(page: import("@playwright/test").Page, path: string) {
	await waitForHydration(page);
	await page.getByLabel("Path").fill(path);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page).toHaveURL(`/${path}`);
}

test("the owner deletes an entry and every word it owned is freed", async ({
	page,
}, testInfo) => {
	const first = `e2e-delete-${testInfo.project.name}`;
	const entry: EntryFixture = {
		title: `An entry to delete (${testInfo.project.name})`,
		path: first,
		heading: "The only section",
		body: "This text exists nowhere else.",
	};

	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expectEntryPage(page, entry);

	// Two renames, so the delete has a CHAIN to free: the second word redirects
	// to the third, and the first still redirects to the second. "Every
	// redirect that resolves to it" means transitively (ADR 0017).
	const second = `${first}-renamed`;
	const third = `${second}-again`;
	await page.getByRole("link", { name: "Edit" }).click();
	await renameTo(page, second);
	await page.getByRole("link", { name: "Edit" }).click();
	await renameTo(page, third);

	await page.getByRole("link", { name: "Edit" }).click();
	await page.getByRole("link", { name: "Delete" }).click();

	// The page names what will be lost, because nothing else will.
	await expect(
		page.getByRole("heading", { level: 1, name: "Delete this entry?" }),
	).toBeVisible();
	// Exact matches throughout. The rescue textarea below holds the same words,
	// and a loose match would find them there as well as in the list.
	await expect(page.getByText(entry.title, { exact: true })).toBeVisible();
	await expect(page.getByText("1 section", { exact: false })).toBeVisible();
	await expect(page.getByText(`/${third}`, { exact: true })).toBeVisible();
	await expect(
		page.getByText(`/${second} (redirect)`, { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText(`/${first} (redirect)`, { exact: true }),
	).toBeVisible();

	// The rescue text is the last copy of the words.
	const rescue = page.getByLabel("Entry as markdown");
	await expect(rescue).toHaveValue(new RegExp(`^---\\nkind: decision\\npath: ${third}\\n`));
	await expect(rescue).toHaveValue(new RegExp(entry.body));

	await page.getByRole("button", { name: "Delete for good" }).click();

	// The listing says what went, and names the word that came back.
	await expect(page).toHaveURL(/^.*\/\?deleted=/);
	await expect(page.getByText(`Deleted ${entry.title}`)).toBeVisible();
	await expect(page.getByText(`/${third}`, { exact: true })).toBeVisible();
	await expect(page.getByText("2 redirects", { exact: false })).toBeVisible();

	// Every word answers the generic notice now: the live one and both
	// redirects into it.
	for (const word of [first, second, third]) {
		const response = await page.goto(`/${word}`);
		expect(response?.status()).toBe(404);
	}
});

test("a tab open on a deleted entry recreates it on the old word", async ({
	page,
	context,
}, testInfo) => {
	const path = `e2e-delete-stale-${testInfo.project.name}`;
	const entry: EntryFixture = {
		title: `A stale tab entry (${testInfo.project.name})`,
		path,
		heading: "Still here",
		body: "The text the open tab is holding.",
	};

	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expectEntryPage(page, entry);

	// The tab the author left open.
	await page.getByRole("link", { name: "Edit" }).click();
	await waitForHydration(page);
	const editor = page.url();

	// The delete, from somewhere else.
	const other = await context.newPage();
	await other.goto(editor);
	await other.getByRole("link", { name: "Delete" }).click();
	await other.getByRole("button", { name: "Delete for good" }).click();
	await expect(other).toHaveURL(/^.*\/\?deleted=/);
	await other.close();

	// The guarded save matches nothing, and the page says so without
	// discarding a word of the typing (ADR 0011).
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("There is no entry at this address")).toBeVisible();
	await expect(page.getByLabel("Body (markdown)")).toHaveValue(entry.body);

	// The old word was freed by the delete, so the create path takes it back.
	await page.getByRole("button", { name: "Recreate as a new entry" }).click();
	await expectEntryPage(page, entry);
});

test("a stale confirm page deletes nothing and comes back with the new facts", async ({
	page,
	context,
}, testInfo) => {
	const path = `e2e-delete-stale-page-${testInfo.project.name}`;
	const entry: EntryFixture = {
		title: `A guarded delete (${testInfo.project.name})`,
		path,
		heading: "One",
		body: "The section the confirm page counted.",
	};

	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expectEntryPage(page, entry);

	// The confirm page, read and left open.
	await page.getByRole("link", { name: "Edit" }).click();
	const editor = page.url();
	await page.getByRole("link", { name: "Delete" }).click();
	await expect(page.getByText("1 section", { exact: false })).toBeVisible();

	// A second section arrives from somewhere else, which bumps the version.
	const other = await context.newPage();
	await other.goto(editor);
	await waitForHydration(other);
	await other.getByRole("button", { name: "Add a section" }).click();
	// The add is a round trip. With scripts on it posts from the page, so the
	// second fieldset arrives after the click rather than with it.
	await expect(other.getByLabel("Heading")).toHaveCount(2);
	await other.getByLabel("Heading").last().fill("Two");
	await other.getByLabel("Body (markdown)").last().fill("Written after the page was read.");
	await other.getByRole("button", { name: "Save", exact: true }).click();
	await expect(other).toHaveURL(`/${path}`);
	await other.close();

	// The guard of ADR 0011. The button deletes nothing and the page comes
	// back with the facts as they are now.
	await page.getByRole("button", { name: "Delete for good" }).click();
	await expect(page.getByText("This entry changed somewhere else")).toBeVisible();
	await expect(page.getByText("2 sections", { exact: false })).toBeVisible();

	// The entry is still there, and the second press carries the new version.
	await page.getByRole("button", { name: "Delete for good" }).click();
	await expect(page).toHaveURL(/^.*\/\?deleted=/);
	expect((await page.goto(`/${path}`))?.status()).toBe(404);
});
