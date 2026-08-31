import { expect, test } from "@playwright/test";

import { waitForHydration } from "./hydration";

/**
 * The three authoring frictions of #108, in both projects. Each control here
 * is a submit button on a plain form (ADR 0002), so the scriptless project is
 * the one that decides whether the fix is real.
 *
 * One database serves both projects and a path names an entry in one shared
 * namespace (ADR 0004), so every test takes a word of its own.
 */

const SECTION_HEADINGS = "Heading (optional)";

test("a form of nothing but untouched sections does not save", async ({
	page,
}) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("An entry of empty sections");

	// The drop leaves nothing, so the entry itself is what is wrong. The
	// message names the entry, not a section.
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(
		page.getByText("An entry needs at least one section."),
	).toBeVisible();
	// The form the author gets back is the form they submitted. The drop
	// belongs to the write, so the empty section is still here to fill.
	await expect(page.getByLabel(SECTION_HEADINGS)).toHaveCount(1);
});

test("a save drops the sections the author never typed into", async ({
	page,
}, testInfo) => {
	const path = `e2e-drop-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("An entry with spare sections");
	await page.getByLabel("Path").fill(path);

	// Three sections: one filled, one holding an anchor alone, one untouched.
	await page.getByRole("button", { name: "Add a section" }).click();
	await page.getByRole("button", { name: "Add a section" }).click();
	await expect(page.getByLabel(SECTION_HEADINGS)).toHaveCount(3);

	await waitForHydration(page);
	await page.getByLabel(SECTION_HEADINGS).nth(0).fill("The kept section");
	await page.getByLabel("Body (markdown)").nth(0).fill("The kept body.");
	// An anchor alone is typing (#98), so this one is kept as well.
	await page.getByLabel("Anchor").nth(1).fill("anchor-only");

	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page).toHaveURL(`/${path}`);

	// Two, not three. The editor is where a section with neither a heading nor
	// a body can still be counted.
	await page.getByRole("link", { name: "Edit" }).click();
	await expect(page.getByLabel(SECTION_HEADINGS)).toHaveCount(2);
	await expect(page.getByLabel(SECTION_HEADINGS).nth(0)).toHaveValue(
		"The kept section",
	);
	await expect(page.getByLabel(SECTION_HEADINGS).nth(1)).toHaveValue("");
	await expect(page.getByLabel("Anchor").nth(1)).toHaveValue("anchor-only");
});

test("a heading alone and a body alone both save", async ({
	page,
}, testInfo) => {
	const path = `e2e-half-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("An entry of half sections");
	await page.getByLabel("Path").fill(path);
	await page.getByRole("button", { name: "Add a section" }).click();

	// A heading is optional (#69) and so is a body (#75). Neither section is
	// untouched, so the drop keeps both.
	await waitForHydration(page);
	await page.getByLabel(SECTION_HEADINGS).nth(0).fill("A heading alone");
	await page.getByLabel("Body (markdown)").nth(1).fill("A body alone.");

	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expect(page).toHaveURL(`/${path}`);
	await expect(
		page.getByRole("heading", { level: 2, name: "A heading alone" }),
	).toBeVisible();
	await expect(page.getByText("A body alone.")).toBeVisible();
});

test("adding a section leaves the author on the new section", async ({
	page,
}) => {
	// A phone-sized window, so the new section is below the fold and a scroll
	// to the top of the document would be visible as a failure.
	await page.setViewportSize({ width: 390, height: 640 });
	await page.goto("/a/new");
	await waitForHydration(page);

	await page.getByRole("button", { name: "Add a section" }).click();

	const added = page.getByLabel(SECTION_HEADINGS).nth(1);
	await expect(page.getByLabel(SECTION_HEADINGS)).toHaveCount(2);
	// `autofocus` on the new heading. The browser scrolls a focused field into
	// view, so the one plain-HTML attribute buys both.
	await expect(added).toBeInViewport({ ratio: 1 });
	await expect(added).toBeFocused();
});

test("Save and Continue writes the entry and returns the editor", async ({
	page,
}, testInfo) => {
	const path = `e2e-stay-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("An entry saved in place");
	await page.getByLabel("Path").fill(path);
	await page.getByLabel(SECTION_HEADINGS).fill("The first section");
	await page.getByLabel("Body (markdown)").fill("The first body.");

	// A new entry cannot stay on /a/new: the next save would make a second
	// entry. It lands in the editor of the entry it just made.
	await page.getByRole("button", { name: "Create and Continue" }).click();
	await expect(page).toHaveURL(/\/a\/\d+\/edit$/);
	const editUrl = page.url();
	await expect(page.getByLabel("Title")).toHaveValue("An entry saved in place");

	// The form holds what the database holds, so the anchor the server
	// generated is in it.
	await expect(page.getByLabel("Anchor")).toHaveValue("the-first-section");

	await waitForHydration(page);
	await page.getByLabel("Body (markdown)").fill("The second body.");
	await page.getByRole("button", { name: "Save and Continue" }).click();
	await expect(page).toHaveURL(editUrl);
	await expect(page.getByText("Saved.")).toBeVisible();

	// Twice over. The first answer carried the version the write produced, so
	// this one passes the guard rather than reading as a conflict.
	await waitForHydration(page);
	await page.getByLabel("Body (markdown)").fill("The third body.");
	await page.getByRole("button", { name: "Save and Continue" }).click();
	await expect(page.getByText("Saved.")).toBeVisible();
	await expect(page.getByText("This entry changed somewhere else")).toHaveCount(
		0,
	);

	// The plain Save still leaves for the entry, and it holds the last write.
	await waitForHydration(page);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page).toHaveURL(`/${path}`);
	await expect(page.getByText("The third body.")).toBeVisible();
});

test("a stale version still conflicts after Save and Continue", async ({
	page,
	context,
}, testInfo) => {
	const path = `e2e-stale-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("An entry saved from two tabs");
	await page.getByLabel("Path").fill(path);
	await page.getByLabel(SECTION_HEADINGS).fill("The only section");
	await page.getByLabel("Body (markdown)").fill("The first body.");
	await page.getByRole("button", { name: "Create and Continue" }).click();
	await expect(page).toHaveURL(/\/a\/\d+\/edit$/);

	// A second tab holds the version this page is about to move past. This is
	// the shape a refresh of the posted page takes: the same form, posted
	// again against a version that has gone.
	const stale = await context.newPage();
	await stale.goto(page.url());
	await waitForHydration(stale);

	await waitForHydration(page);
	await page.getByLabel("Body (markdown)").fill("The second body.");
	await page.getByRole("button", { name: "Save and Continue" }).click();
	await expect(page.getByText("Saved.")).toBeVisible();

	await stale.getByRole("button", { name: "Save and Continue" }).click();
	await expect(
		stale.getByText("This entry changed somewhere else"),
	).toBeVisible();
	await stale.close();
});
