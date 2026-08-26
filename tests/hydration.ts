import { expect, type Page, test } from "@playwright/test";

/**
 * The marker `app/entry.client.tsx` sets on `<html>` once React has hydrated
 * the page and the guard of ADR 0016 has put back anything typed in the gap.
 * Keep the string in step with `HYDRATED_ATTRIBUTE` there.
 */
const HYDRATED = "html[data-hydrated]";

/**
 * Wait until the runtime owns the page. A spec that types before this races
 * hydration: React rewrites the field to the server's text and the save posts
 * the old body. That is issue #90, and it flaked about half the runs.
 *
 * With JavaScript off there is no runtime and no marker, so this is a no-op —
 * the scriptless project has nothing to race. The check reads the project's
 * own option rather than its name, because the option is what decides it.
 */
export async function waitForHydration(page: Page): Promise<void> {
	if (test.info().project.use.javaScriptEnabled === false) return;
	await expect(page.locator(HYDRATED)).toBeAttached();
}
