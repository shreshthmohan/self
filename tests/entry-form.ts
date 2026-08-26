import { expect, type Page } from "@playwright/test";

import { waitForHydration } from "./hydration";

/** One entry, as the editor's fields hold it. */
export type EntryFixture = {
	title: string;
	path: string;
	heading: string;
	body: string;
	isPublic?: boolean;
};

/**
 * The entry `auth.setup.ts` seeds and `read-entry.spec.ts` reads. It is public,
 * so a stranger may read it: the read flow is what a visitor gets, not what the
 * owner gets.
 */
export const PUBLIC_ENTRY: EntryFixture = {
	title: "A public entry",
	path: "e2e-public",
	heading: "What this is",
	body: "Anybody may read this entry, signed in or not.",
	isPublic: true,
};

/**
 * Fill the editor. It is a plain `<form>` (ADR 0002), so every field here is
 * reached by its label.
 *
 * The one wait is for hydration, and it is not a wait for the field: the
 * field is in the server's HTML and a person may type into it at once. It is
 * a wait for the runtime to stop rewriting the body, which it does on the way
 * in. Typing under that rewrite is issue #90 — the spec filled the field, the
 * runtime landed on it, and the save posted the server's text. `tests/
 * hydration-gap.spec.ts` is where the gap itself is under test; every other
 * spec wants it over with.
 */
export async function fillEntry(
	page: Page,
	entry: EntryFixture,
): Promise<void> {
	await waitForHydration(page);
	await page.getByLabel("Title").fill(entry.title);
	await page.getByLabel("Path").fill(entry.path);
	await page.getByLabel("Heading").fill(entry.heading);
	await page.getByLabel("Body (markdown)").fill(entry.body);
	if (entry.isPublic) await page.getByLabel("Public").check();
}

/** Assert the entry page shows what was saved. */
export async function expectEntryPage(
	page: Page,
	entry: EntryFixture,
): Promise<void> {
	await expect(page).toHaveURL(`/${entry.path}`);
	await expect(
		page.getByRole("heading", { level: 1, name: entry.title }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: entry.heading }),
	).toBeVisible();
	await expect(page.getByText(entry.body)).toBeVisible();
}
