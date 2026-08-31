import { expect, type Locator, type Page, test } from "@playwright/test";

import { waitForHydration } from "./hydration";

/**
 * A section carries an identity the form round-trips. See #110.
 *
 * The editor keys its fieldsets on that identity, not on the array index. A
 * full navigation hides the difference: the browser throws the DOM away, so
 * the server's text is the only text. The client-side submit of #111 is what
 * makes this spec a guard — the fieldsets now survive the round trip, and an
 * index key leaves section 3's text under the caption "Section 2". Swap the
 * key for `index` and the scripted project fails here; the scriptless one,
 * which still reloads, does not.
 *
 * The load-bearing assertions are the ones on the heading and the body. Those
 * fields are uncontrolled — `defaultValue` — so a surviving DOM node keeps
 * what it held and the wrong pairing shows. The uid is a controlled value,
 * which React rewrites on every render, so an assertion on it reports the
 * server's echo and never the DOM's identity. The uid assertions below say
 * the identity round-trips; they do not say the key is right.
 *
 * It runs in both projects. Add, remove and split are submit buttons the
 * server answers (ADR 0002), so the identity must survive with the runtime
 * off as well as on.
 */

/** One section fieldset, as the page holds it. */
type Rendered = { caption: string; heading: string; body: string; uid: string };

const UID_FIELD = "input[name^='section-uid-']";

/** The section fieldsets. The paste fieldset has no uid and is left out. */
const sectionFieldsets = (page: Page): Locator =>
	page.locator("fieldset").filter({ has: page.locator(UID_FIELD) });

/**
 * Wait for the form to hold `count` sections, then read them.
 *
 * A submit is a client-side POST once the runtime is on (#111), so a click
 * returns before the answer does. Every read below therefore names the count
 * it expects and waits for it. `toHaveCount` retries; `rendered` does not.
 */
async function settled(page: Page, count: number): Promise<Rendered[]> {
	await expect(sectionFieldsets(page)).toHaveCount(count);
	return rendered(page);
}

/**
 * Every section, read one fieldset at a time. The caption, the heading, the
 * body and the uid come out together, so a mispairing inside one fieldset
 * fails as loudly as a shift across the list.
 *
 * Playwright reads each field with `inputValue`, not with `evaluateAll`: the
 * scriptless project has no page runtime to evaluate in.
 */
async function rendered(page: Page): Promise<Rendered[]> {
	const fieldsets = sectionFieldsets(page);
	const count = await fieldsets.count();
	const out: Rendered[] = [];
	for (let i = 0; i < count; i++) {
		const fieldset = fieldsets.nth(i);
		out.push({
			caption: (await fieldset.locator("legend").textContent()) ?? "",
			heading: await fieldset.getByLabel("Heading (optional)").inputValue(),
			body: await fieldset.getByLabel("Body (markdown)").inputValue(),
			uid: await fieldset.locator(UID_FIELD).inputValue(),
		});
	}
	return out;
}

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

	const before = await settled(page, 3);
	expect(new Set(before.map((s) => s.uid)).size).toBe(3);

	// Remove the middle one. The third section's text must follow its own
	// caption, not slide up under the second's.
	await page.getByRole("button", { name: "Remove this section" }).nth(1).click();

	expect(await settled(page, 2)).toEqual([
		{ caption: "Section 1", heading: "First", body: "Under the first.", uid: before[0].uid },
		{ caption: "Section 2", heading: "Third", body: "Under the third.", uid: before[2].uid },
	]);

	// A save the server refuses hands the form back, empty section and all
	// (#108). Every uid comes back with it, and each one is still on the
	// section that had it.
	await page.getByRole("button", { name: "Add a section" }).click();
	const withBlank = await settled(page, 3);
	expect(withBlank.map((s) => s.uid).slice(0, 2)).toEqual([
		before[0].uid,
		before[2].uid,
	]);

	// Two sections asking for one anchor is a save the server refuses.
	await page.getByLabel("Anchor").nth(0).fill("same");
	await page.getByLabel("Anchor").nth(1).fill("same");
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(
		page.getByText('Two sections both want the anchor "same".'),
	).toBeVisible();
	expect(await rendered(page)).toEqual(withBlank);
});

test("a split gives every section an identity of its own", async ({ page }) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page
		.getByLabel("Paste markdown")
		.fill("## One\n\nUnder one.\n\n## Two\n\nUnder two.\n");
	await page.getByRole("button", { name: "Split into sections" }).click();

	const split = (await settled(page, 2)).map((s) => s.uid);
	expect(split).toHaveLength(2);
	expect(new Set(split).size).toBe(2);
	expect(split.every((uid) => uid !== "")).toBe(true);
});

test("a save ignores the uid", async ({ page }, testInfo) => {
	// One database serves both projects, and a path names an entry in one
	// shared namespace (ADR 0004). So each project needs a word of its own.
	const path = `e2e-uid-${testInfo.project.name}`;
	const body = "The body the uid never touched.";

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill(`Uid save (${testInfo.project.name})`);
	await page.getByLabel("Path").fill(path);
	await page.getByLabel("Heading (optional)").fill("Kept");
	await page.getByLabel("Body (markdown)").fill(body);
	await page.getByRole("button", { name: "Create", exact: true }).click();

	// The reader's page carries no uid. It is a form field and nothing else.
	await expect(page).toHaveURL(`/${path}`);
	await expect(page.getByRole("heading", { level: 2, name: "Kept" })).toBeVisible();
	await expect(page.locator(UID_FIELD)).toHaveCount(0);
	// The anchor is the section's stored identity, generated from the heading.
	// The uid left no mark on it.
	await expect(page.locator("#kept")).toHaveCount(1);

	// The editor mints a uid for the stored section on the way in. The stored
	// text and the stored anchor are the ones that were saved.
	await page.getByRole("link", { name: "Edit" }).click();
	await waitForHydration(page);
	const reopened = await settled(page, 1);
	expect(reopened).toHaveLength(1);
	expect(reopened[0].heading).toBe("Kept");
	expect(reopened[0].body).toBe(body);
	expect(reopened[0].uid).not.toBe("");
	await expect(page.getByLabel("Anchor")).toHaveValue("kept");
});
