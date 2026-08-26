import { expect, test } from "@playwright/test";

import { waitForHydration } from "./hydration";

/**
 * The owner pastes a blob of markdown, splits it, and saves the entry. See
 * #98.
 *
 * It runs in both projects. The split is a submit button and the server does
 * the cutting, so the scriptless project must pass it too (ADR 0002) — that is
 * the whole reason the control is not a paste handler.
 */
const PASTE = [
	"# Pasted entry",
	"",
	"An opening line with no heading.",
	"",
	"## The first heading",
	"",
	"Under the first.",
	"",
	"### A deeper heading",
	"",
	"```md",
	"## Not a heading",
	"```",
	"",
	"## The second heading",
	"",
	"Under the second.",
].join("\n");

test("the owner pastes markdown, splits it into sections, and saves", async ({
	page,
}, testInfo) => {
	// One database serves both projects, and a path names an entry in one
	// shared namespace (ADR 0004). So each project needs a word of its own.
	const path = `e2e-split-${testInfo.project.name}`;

	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Paste markdown").fill(PASTE);
	await page.getByRole("button", { name: "Split into sections" }).click();

	// The split writes nothing. It re-renders the form, and the leading `#`
	// fills the title the owner left empty.
	await expect(page).toHaveURL("/a/new");
	await expect(page.getByLabel("Title")).toHaveValue("Pasted entry");

	// Three, not four. The fresh form's one untouched section was REPLACED, not
	// appended after.
	const headings = page.getByLabel("Heading (optional)");
	await expect(headings).toHaveCount(3);
	await expect(headings.nth(0)).toHaveValue("");
	await expect(headings.nth(1)).toHaveValue("The first heading");
	await expect(headings.nth(2)).toHaveValue("The second heading");

	const bodies = page.getByLabel("Body (markdown)");
	await expect(bodies.nth(0)).toHaveValue("An opening line with no heading.");
	// The deeper heading and the fenced `##` both stay inside the body. Read
	// the value, not the text: a textarea's `textContent` is the server's
	// markup, which would pass even if the live field held something else.
	expect(await bodies.nth(1).inputValue()).toContain("### A deeper heading");
	expect(await bodies.nth(1).inputValue()).toContain("## Not a heading");
	await expect(bodies.nth(2)).toHaveValue("Under the second.");

	// Every field is still the owner's to edit before the save.
	await waitForHydration(page);
	await page.getByLabel("Path").fill(path);
	await page.getByRole("button", { name: "Create" }).click();

	await expect(page).toHaveURL(`/${path}`);
	await expect(
		page.getByRole("heading", { level: 1, name: "Pasted entry" }),
	).toBeVisible();
	await expect(page.getByText("An opening line with no heading.")).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "The first heading" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "The second heading" }),
	).toBeVisible();

	// The deeper heading renders as a heading, and it is not a section anchor.
	await expect(
		page.getByRole("heading", { level: 3, name: "A deeper heading" }),
	).toBeVisible();
	// The fenced `##` is code, not a heading.
	await expect(
		page.getByRole("heading", { name: "Not a heading" }),
	).toHaveCount(0);

	// Slugs come from the existing resolver: readable from a heading, generated
	// for the headingless section.
	await expect(page.locator("#the-first-heading")).toBeVisible();
	await expect(page.locator("#the-second-heading")).toBeVisible();
	await expect(page.locator("#s-1")).toBeAttached();
});

test("a split into a form that holds typing appends to it", async ({
	page,
}) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("Typed already");
	await page.getByLabel("Heading (optional)").fill("A hand-made section");
	await page.getByLabel("Paste markdown").fill("## Pasted\n\nPasted body.");
	await page.getByRole("button", { name: "Split into sections" }).click();

	// The typing survives, and the title the owner typed is not overwritten.
	await expect(page.getByLabel("Title")).toHaveValue("Typed already");
	const headings = page.getByLabel("Heading (optional)");
	await expect(headings).toHaveCount(2);
	await expect(headings.nth(0)).toHaveValue("A hand-made section");
	await expect(headings.nth(1)).toHaveValue("Pasted");

	// The paste box empties, so a second split cannot append the same prose
	// twice. It is an input to the split and nothing else.
	await expect(page.getByLabel("Paste markdown")).toHaveValue("");
});

test("a title the owner typed survives a paste that leads with a heading", async ({
	page,
}) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Title").fill("The owner's own title");
	await page
		.getByLabel("Paste markdown")
		.fill("# A pasted title\n\n## A section\n\nBody.");
	await page.getByRole("button", { name: "Split into sections" }).click();

	// The leading `#` fills an EMPTY title and nothing else. It is dropped
	// here, and it does not come back as body text either.
	await expect(page.getByLabel("Title")).toHaveValue("The owner's own title");
	const bodies = page.getByLabel("Body (markdown)");
	await expect(bodies).toHaveCount(1);
	expect(await bodies.nth(0).inputValue()).not.toContain("A pasted title");
});

test("an anchor typed into an otherwise empty section is not discarded", async ({
	page,
}) => {
	await page.goto("/a/new");
	await waitForHydration(page);
	await page.getByLabel("Anchor").fill("kept-by-hand");
	await page.getByLabel("Paste markdown").fill("## Pasted\n\nPasted body.");
	await page.getByRole("button", { name: "Split into sections" }).click();

	// Typing an anchor is typing. The section is appended after, not replaced.
	const anchors = page.getByLabel("Anchor");
	await expect(anchors).toHaveCount(2);
	await expect(anchors.nth(0)).toHaveValue("kept-by-hand");
});
