import { expect, type Locator, type Page, test } from "@playwright/test";

/** Both controls, whole, inside the window. */
async function expectControlsOnScreen(page: Page): Promise<void> {
	await expect(page.getByRole("button", { name: "Create" })).toBeInViewport({
		ratio: 1,
	});
	await expect(page.getByRole("link", { name: "Cancel" })).toBeInViewport({
		ratio: 1,
	});
}

/** How far the bottom of an element sits from the top of the window. */
async function bottomOf(locator: Locator): Promise<number> {
	const box = await locator.boundingBox();
	if (!box) throw new Error("the element has no box");
	return box.y + box.height;
}

/**
 * The Save button and the Cancel link stay on screen while the author scrolls
 * a long form. See issue #92.
 *
 * The window is phone sized. The row is hardest to hold there, and the issue
 * asks for the small screen.
 */
test("the editor controls stay on screen while the form scrolls", async ({
	page,
}) => {
	const height = 640;
	await page.setViewportSize({ width: 390, height });
	await page.goto("/a/new");

	// The premise of the test. A form that fits the window needs no sticky row,
	// and every assertion below would pass without one.
	const form = page.locator("form[action='/a/new']");
	const formBox = await form.boundingBox();
	expect(formBox?.height ?? 0).toBeGreaterThan(height);

	const row = page.getByRole("button", { name: "Create" }).locator("..");

	// At the top of the form, with the rest of it below the fold.
	await expectControlsOnScreen(page);
	expect(await bottomOf(row)).toBeGreaterThan(height - 20);

	// And after scrolling into the last section.
	await page.getByLabel("Body (markdown)").scrollIntoViewIfNeeded();
	await expectControlsOnScreen(page);

	// At the end of the page the row goes back into the form. The footer is
	// then below it, so the row leaves the bottom of the window.
	await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
	await expectControlsOnScreen(page);
	expect(await bottomOf(row)).toBeLessThan(height - 20);
});
