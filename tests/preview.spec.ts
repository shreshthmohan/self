import { expect, type Locator, type Page, test } from "@playwright/test";

import { type EntryFixture, fillEntry } from "./entry-form";
import { waitForHydration } from "./hydration";

/**
 * The preview beside the authoring form, as #103 asks for it.
 *
 * It is an enhancement (ADR 0002): the served HTML is the form without it, so
 * the scriptless project is where "no dead control" is decided.
 *
 * One database serves both projects and a path names an entry in one shared
 * namespace (ADR 0004), so every test that saves takes a word of its own.
 */

const TOGGLE = "Preview";

/** The pane beside section `n`, counting from one, as the label reads. */
const pane = (page: Page, n: number): Locator =>
	page.getByRole("region", { name: `Preview of section ${n}` });

async function boxOf(locator: Locator) {
	const box = await locator.boundingBox();
	if (!box) throw new Error("the element has no box");
	return box;
}

test.describe("with JavaScript", () => {
	test.skip(
		({ javaScriptEnabled }) => !javaScriptEnabled,
		"the pane only exists after mount",
	);

	test("each pane holds its own section, rendered", async ({ page }) => {
		await page.goto("/a/new");
		await waitForHydration(page);
		await page.getByRole("button", { name: "Add a section" }).click();
		await waitForHydration(page);

		await page.getByLabel("Heading (optional)").nth(0).fill("The first");
		await page
			.getByLabel("Body (markdown)")
			.nth(0)
			.fill("A **bold** word.\n\n### A deep heading");

		// The heading as the read page shows it, and the body as the site's
		// renderer renders it.
		await expect(
			pane(page, 1).getByRole("heading", { level: 2, name: "The first" }),
		).toBeVisible();
		await expect(pane(page, 1).locator("strong")).toHaveText("bold");

		// No id anywhere in a pane. Several panes render one page, and the
		// renderer only deduplicates within one call — and `section-2` is a
		// fieldset id the no-JS buttons aim at. See app/lib/preview.ts.
		await expect(pane(page, 1).locator("[id]")).toHaveCount(0);

		// The listener is the pane's own: one section's typing repaints one
		// pane.
		await expect(pane(page, 2).locator("strong")).toHaveCount(0);
		await expect(pane(page, 2).getByRole("heading")).toHaveCount(0);
	});

	test("a stored entry is rendered at load", async ({ page }, testInfo) => {
		const entry: EntryFixture = {
			title: `A previewed entry (${testInfo.project.name})`,
			path: `e2e-preview-${testInfo.project.name}`,
			heading: "The stored heading",
			body: "The stored body.",
		};

		await page.goto("/a/new");
		await fillEntry(page, entry);
		await page.getByRole("button", { name: "Create", exact: true }).click();
		await page.getByRole("link", { name: "Edit" }).click();
		await waitForHydration(page);

		// Nothing typed. The pane renders what the loader put in the fields.
		await expect(
			pane(page, 1).getByRole("heading", { level: 2, name: entry.heading }),
		).toBeVisible();
		await expect(pane(page, 1).getByText(entry.body)).toBeVisible();
	});

	test("the toggle takes every pane away, and the choice sticks", async ({
		page,
	}) => {
		await page.goto("/a/new");
		await waitForHydration(page);
		await expect(pane(page, 1)).toBeVisible();

		await page.getByLabel(TOGGLE, { exact: true }).uncheck();
		await expect(page.getByRole("region")).toHaveCount(0);

		// The preference is the browser's own, as the theme is (ADR 0015).
		await page.reload();
		await waitForHydration(page);
		await expect(page.getByLabel(TOGGLE, { exact: true })).not.toBeChecked();
		await expect(page.getByRole("region")).toHaveCount(0);

		await page.getByLabel(TOGGLE, { exact: true }).check();
		await expect(pane(page, 1)).toBeVisible();
		await page.reload();
		await waitForHydration(page);
		await expect(pane(page, 1)).toBeVisible();
	});

	test("a long body scrolls the pane, not the fieldset", async ({ page }) => {
		await page.goto("/a/new");
		await waitForHydration(page);

		const fieldset = page.locator("#section-0");
		const before = await boxOf(fieldset);

		const body = Array.from({ length: 80 }, (_, n) => `Line ${n + 1}.`);
		await page.getByLabel("Body (markdown)").fill(body.join("\n\n"));
		await expect(pane(page, 1).getByText("Line 1.")).toBeVisible();

		// The author is typing in this fieldset. It does not move under them.
		expect((await boxOf(fieldset)).height).toBe(before.height);

		const scroll = await pane(page, 1).evaluate(
			(node) => node.scrollHeight - node.clientHeight,
		);
		expect(scroll).toBeGreaterThan(0);
	});

	test("below the breakpoint the pane sits under the textarea", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 500, height: 900 });
		await page.goto("/a/new");
		await waitForHydration(page);

		const textarea = await boxOf(page.getByLabel("Body (markdown)"));
		const preview = await boxOf(pane(page, 1));

		expect(preview.y).toBeGreaterThanOrEqual(textarea.y + textarea.height);
		// One column: both are as wide as the fieldset gives them.
		expect(Math.abs(preview.width - textarea.width)).toBeLessThan(4);
	});

	test("a renderer that never arrives leaves the editor working", async ({
		page,
	}) => {
		// The chunk the dynamic import fetches: `app/lib/markdown.ts` from the
		// dev server, `markdown-<hash>.js` from a build.
		await page.route(/\/markdown[.-][^/]*$/, (route) => route.abort());

		await page.goto("/a/new");
		await waitForHydration(page);

		await expect(
			pane(page, 1).getByText("The preview is unavailable."),
		).toBeVisible();

		// The pane is the only thing that failed.
		await page.getByLabel("Body (markdown)").fill("Still typing.");
		await expect(page.getByLabel("Body (markdown)")).toHaveValue(
			"Still typing.",
		);
	});
});

test("with JavaScript off there is no pane and no toggle", async ({
	page,
	javaScriptEnabled,
}) => {
	test.skip(javaScriptEnabled, "this is the scriptless project's test");

	await page.goto("/a/new");

	// A control that cannot work is worse than no control.
	await expect(page.getByLabel(TOGGLE, { exact: true })).toHaveCount(0);
	await expect(page.getByRole("region")).toHaveCount(0);
	// The form itself is untouched.
	await expect(page.getByLabel("Body (markdown)")).toHaveCount(1);
});
