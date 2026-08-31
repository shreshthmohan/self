import { expect, type Locator, type Page, test } from "@playwright/test";

import { waitForHydration } from "./hydration";

/**
 * A section carries an identity the form round-trips. See #110.
 *
 * The editor keys its fieldsets on that identity, not on the array index. A
 * full navigation hides the difference — the browser throws the DOM away and
 * the server's text is the only text — so this spec passes on `main` too. It
 * is the guard for the client-side submit of #111, where an index key leaves
 * section 3's text under the caption "Section 2".
 *
 * It runs in both projects. Add, remove and split are submit buttons the
 * server answers (ADR 0002), so the identity must survive with the runtime
 * off as well as on.
 */

/**
 * The values of a set of fields, in the order they stand.
 *
 * `inputValue`, not `evaluateAll`: the scriptless project has no page runtime
 * to evaluate in, and Playwright reads a field without one.
 */
async function valuesOf(locator: Locator): Promise<string[]> {
	const count = await locator.count();
	const values: string[] = [];
	for (let i = 0; i < count; i++) values.push(await locator.nth(i).inputValue());
	return values;
}

const uids = (page: Page) =>
	valuesOf(page.locator("input[name^='section-uid-']"));
const headings = (page: Page) =>
	valuesOf(page.getByLabel("Heading (optional)"));
const bodies = (page: Page) => valuesOf(page.getByLabel("Body (markdown)"));

test("a section keeps its identity across add, remove and a failed save", async ({
	page,
}, testInfo) => {
	await page.goto("/a/new");
	await waitForHydration(page);

	await page.getByLabel("Title").fill(`Identity (${testInfo.project.name})`);
	await page.getByRole("button", { name: "Add a section" }).click();
	await page.getByRole("button", { name: "Add a section" }).click();

	const written = [
		{ heading: "First", body: "Under the first." },
		{ heading: "Second", body: "Under the second." },
		{ heading: "Third", body: "Under the third." },
	];
	for (const [index, s] of written.entries()) {
		await page.getByLabel("Heading (optional)").nth(index).fill(s.heading);
		await page.getByLabel("Body (markdown)").nth(index).fill(s.body);
	}

	const before = await uids(page);
	expect(before).toHaveLength(3);
	expect(new Set(before).size).toBe(3);

	// Remove the middle one. The third section's text must follow its own
	// caption, not slide up under the second's.
	await page.getByRole("button", { name: "Remove this section" }).nth(1).click();

	expect(await uids(page)).toEqual([before[0], before[2]]);
	expect(await headings(page)).toEqual(["First", "Third"]);
	expect(await bodies(page)).toEqual(["Under the first.", "Under the third."]);

	// A save the server refuses hands the form back. The uids come back with
	// it: the empty section is the one at fault, and the two written ones are
	// still themselves.
	await page.getByRole("button", { name: "Add a section" }).click();
	const withBlank = await uids(page);
	expect(withBlank.slice(0, 2)).toEqual([before[0], before[2]]);

	await page.getByRole("button", { name: "Create" }).click();
	await expect(page.getByText("Section 3 needs a heading or a body.")).toBeVisible();
	expect(await uids(page)).toEqual(withBlank);
	expect(await bodies(page)).toEqual(["Under the first.", "Under the third.", ""]);
});

test("a split gives every section an identity of its own", async ({ page }) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page
		.getByLabel("Paste markdown")
		.fill("## One\n\nUnder one.\n\n## Two\n\nUnder two.\n");
	await page.getByRole("button", { name: "Split into sections" }).click();

	const split = await uids(page);
	expect(split).toHaveLength(2);
	expect(new Set(split).size).toBe(2);
	expect(split.every((uid) => uid !== "")).toBe(true);
});

test("a save ignores the uid", async ({ page }, testInfo) => {
	// One database serves both projects, and a path names an entry in one
	// shared namespace (ADR 0004). So each project needs a word of its own.
	const path = `e2e-uid-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill(`Uid save (${testInfo.project.name})`);
	await page.getByLabel("Path").fill(path);
	await page.getByLabel("Heading (optional)").fill("Kept");
	await page.getByLabel("Body (markdown)").fill("The body the uid never touched.");
	await page.getByRole("button", { name: "Create" }).click();

	await expect(page).toHaveURL(`/${path}`);
	await expect(page.getByRole("heading", { level: 2, name: "Kept" })).toBeVisible();

	// The anchor is the section's stored identity, generated from the heading.
	// The uid left no mark on it, and it does not reach the page at all.
	await expect(page.locator("#kept")).toHaveCount(1);
	await expect(page.locator("input[name^='section-uid-']")).toHaveCount(0);
});
