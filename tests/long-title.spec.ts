import { expect, type Page, test } from "@playwright/test";

import { slugify } from "../app/lib/slug";
import { type EntryFixture, fillEntry } from "./entry-form";
import { waitForHydration } from "./hydration";

/**
 * D1 caps a LIKE or GLOB pattern at 50 bytes, and the read that finds a free
 * path used one. So every title long enough to make a slug of 50 characters
 * threw, and no such entry could be saved. #106 reads the prefix as a range.
 * Why a range, and why it selects the same rows: `app/lib/paths.server.ts`.
 *
 * The local Worker runtime raises the same error, so this spec fails on the
 * pattern form.
 */
const D1_PATTERN_LIMIT = 50;

/** A title of 200 characters, with a word of its own per browser project. */
function longTitle(project: string, nth: string): string {
	return `A ${nth} long title for ${project} that runs on `.padEnd(
		200,
		"and on and on ",
	);
}

async function create(page: Page, entry: EntryFixture): Promise<void> {
	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create" }).click();
}

test("a long title saves, and a second one takes a suffix", async ({
	page,
}, testInfo) => {
	// One database, two browser projects (ADR 0002), and the path is one shared
	// namespace (ADR 0004) — so each title carries the project's name.
	const title = longTitle(testInfo.project.name, "first");
	const base = slugify(title);
	expect(base.length).toBeGreaterThanOrEqual(D1_PATTERN_LIMIT);

	// The Path field stays empty, so the slug comes off the title.
	await create(page, {
		title,
		path: "",
		heading: "The first section",
		body: "The entry that took the base path.",
	});
	await expect(page).toHaveURL(`/${base}`);
	await expect(
		page.getByRole("heading", { level: 1, name: title }),
	).toBeVisible();

	await create(page, {
		title,
		path: "",
		heading: "The first section",
		body: "The entry that had to take a suffix.",
	});
	await expect(page).toHaveURL(`/${base}-2`);

	// A rename reads the registry the same way, on the other route (#106).
	const renamed = slugify(longTitle(testInfo.project.name, "renamed"));
	await page.getByRole("link", { name: "Edit" }).click();
	await waitForHydration(page);
	await page.getByLabel("Path").fill(renamed);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page).toHaveURL(`/${renamed}`);
});
