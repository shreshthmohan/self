import { expect, test } from "@playwright/test";

import { SIGNED_OUT } from "./owner";

/**
 * The theme switcher, as ADR 0015 settles it. The reader here is a stranger:
 * the choice rides a cookie the browser writes, so it belongs to the device
 * and not to an account.
 */
test.use({ storageState: SIGNED_OUT });

const CONTROL = { name: "Theme" };

test.describe("with JavaScript", () => {
	test.skip(
		({ javaScriptEnabled }) => !javaScriptEnabled,
		"the control only exists after mount",
	);

	test("a choice paints on the next load with no flash", async ({ page }) => {
		await page.goto("/");
		const html = page.locator("html");
		await expect(html).not.toHaveAttribute("data-theme");

		await page.getByLabel(CONTROL.name).selectOption("dark");
		// The handler mutates the DOM directly. No revalidation, no state.
		await expect(html).toHaveAttribute("data-theme", "dark");

		// The whole point of the cookie: the SERVER renders the attribute, so it
		// is in the first byte of HTML rather than applied after hydration.
		const response = await page.reload();
		expect(await response?.text()).toContain('data-theme="dark"');
		await expect(html).toHaveAttribute("data-theme", "dark");
		await expect(page.getByLabel(CONTROL.name)).toHaveValue("dark");
	});

	test("system deletes the cookie and the attribute", async ({ page }) => {
		await page.goto("/");
		await page.getByLabel(CONTROL.name).selectOption("light");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

		await page.getByLabel(CONTROL.name).selectOption("system");
		await expect(page.locator("html")).not.toHaveAttribute("data-theme");

		const cookies = await page.context().cookies();
		expect(cookies.find((cookie) => cookie.name === "theme")).toBeUndefined();

		const response = await page.reload();
		expect(await response?.text()).not.toContain("data-theme");
	});

	test("a junk cookie reads as system", async ({ page }) => {
		await page.context().addCookies([
			{ name: "theme", value: "neon", url: "http://localhost:5273" },
		]);

		const response = await page.goto("/");
		expect(await response?.text()).not.toContain("data-theme");
		await expect(page.getByLabel(CONTROL.name)).toHaveValue("system");
	});
});

/**
 * The two page grounds, Tusker's own hexes (ADR 0014). The page is painted,
 * not just labelled, so these read the computed background rather than the
 * attribute.
 */
const DARK_BG = "rgb(22, 21, 15)"; // #16150f
const LIGHT_BG = "rgb(253, 253, 250)"; // #fdfdfa

// CSS alone, so this holds with the runtime removed too.
test("the operating system decides only while nothing is chosen", async ({
	page,
}) => {
	const body = page.locator("body");

	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/");
	await expect(body).toHaveCSS("background-color", DARK_BG);

	// Live, with the page open and no JavaScript running.
	await page.emulateMedia({ colorScheme: "light" });
	await expect(body).toHaveCSS("background-color", LIGHT_BG);

	// An explicit choice stands the media query down, in both directions.
	await page.context().addCookies([
		{ name: "theme", value: "dark", url: "http://localhost:5273" },
	]);
	await page.goto("/");
	await expect(body).toHaveCSS("background-color", DARK_BG);

	await page.context().addCookies([
		{ name: "theme", value: "light", url: "http://localhost:5273" },
	]);
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/");
	await expect(body).toHaveCSS("background-color", LIGHT_BG);
});

test("with JavaScript off there is no control", async ({
	page,
	javaScriptEnabled,
}) => {
	test.skip(javaScriptEnabled, "this is the scriptless project's test");

	await page.goto("/");
	// An inert widget is a lie told to the one reader who gets nothing. The
	// page still follows the operating system, which is the default anyway.
	await expect(page.getByLabel(CONTROL.name)).toHaveCount(0);
	await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});
