import { expect, test, type Page } from "@playwright/test";

import { type EntryFixture, expectEntryPage, fillEntry } from "./entry-form";
import { waitForHydration } from "./hydration";

/**
 * The report in #89: text typed between the first paint and hydration was
 * discarded, and the save posted the server's text. The guard of ADR 0016
 * keeps it.
 *
 * The gap is made real, not simulated. The client entry is held on the wire
 * until the test releases it, so the page paints and takes typing with no
 * runtime — which is the state a slow phone on a cold cache is in.
 *
 * Under the scriptless project there is no hydration at all and nothing to
 * guard against, so the same spec asserts the same thing about a browser that
 * never runs the guard.
 */

/** Holds the client entry on the wire. Returns the release. */
async function holdHydration(page: Page): Promise<() => void> {
	let release = (): void => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	// Nothing else calls `hydrateRoot`, so holding this one module holds
	// hydration whole. Vite serves it from its source path in dev.
	await page.route("**/entry.client*", async (route) => {
		await held;
		await route.continue();
	});
	return release;
}

/** Open the editor for a freshly created entry, with hydration held. */
async function editWithHydrationHeld(
	page: Page,
	entry: EntryFixture,
): Promise<() => void> {
	await page.goto("/a/new");
	await fillEntry(page, entry);
	await page.getByRole("button", { name: "Create", exact: true }).click();
	await expectEntryPage(page, entry);

	const editHref = await page
		.getByRole("link", { name: "Edit" })
		.getAttribute("href");
	expect(editHref).toBeTruthy();

	const release = await holdHydration(page);
	await page.goto(editHref as string);
	// The server's HTML, before any runtime. The field is here already — that
	// is the promise of ADR 0002, and the reason a person types into it now.
	await expect(page.getByLabel("Body (markdown)")).toHaveValue(entry.body);
	return release;
}

test("typing in the hydration gap survives hydration and posts", async ({
	page,
}, testInfo) => {
	const scripted = testInfo.project.name === "scripted";
	const entry: EntryFixture = {
		title: `A gap entry (${testInfo.project.name})`,
		path: `e2e-gap-${testInfo.project.name}`,
		heading: "The first section",
		body: "The body this entry was created with.",
	};
	const typed = "The body typed before the runtime landed.";

	const release = await editWithHydrationHeld(page, entry);

	const body = page.getByLabel("Body (markdown)");
	await body.fill(typed);
	// Mid-text, not at the end: the report lost the caret to the end of the
	// server's text, so an assertion at the end would pass on the bug.
	const caret = 9;
	if (scripted) {
		await body.evaluate((el: HTMLTextAreaElement, at: number) => {
			el.setSelectionRange(at, at);
		}, caret);
	}

	release();
	await waitForHydration(page);

	await expect(body).toHaveValue(typed);
	if (scripted) {
		await expect
			.poll(() =>
				body.evaluate((el: HTMLTextAreaElement) => el.selectionStart),
			)
			.toBe(caret);
	}

	// The report's real cost: the POST carried the old text.
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expectEntryPage(page, { ...entry, body: typed });
	await expect(page.getByText(entry.body)).toHaveCount(0);
});

test("a form nobody touched is left alone across hydration", async ({
	page,
}, testInfo) => {
	const entry: EntryFixture = {
		title: `An untouched gap entry (${testInfo.project.name})`,
		path: `e2e-gap-untouched-${testInfo.project.name}`,
		heading: "The first section",
		body: "The body this entry was created with.",
	};

	const release = await editWithHydrationHeld(page, entry);
	release();
	await waitForHydration(page);

	// Strategy 5 of the prototype blanked this field. The guard must not fire
	// on a field the browser does not call dirty.
	await expect(page.getByLabel("Body (markdown)")).toHaveValue(entry.body);
	await expect(page.getByLabel("Title")).toHaveValue(entry.title);
});
