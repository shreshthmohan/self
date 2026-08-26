import { expect, type Page } from "@playwright/test";

import { logCursor, readMagicLink } from "./magic-link";
import { withSignInLock } from "./sign-in-lock";

/**
 * The one address the suite signs in with.
 *
 * There cannot be a second. The first address to sign in claims the site and
 * registration closes behind it, so every later unknown address is refused
 * (ADR 0012). `scripts/e2e-server.sh` wipes the database on every start, which
 * is what reopens the claim for the next run.
 */
export const OWNER_EMAIL = "owner@e2e.test";

/** Where `auth.setup.ts` leaves the owner's cookies for the specs to reuse. */
export const OWNER_STATE = "tests/.tmp/owner.json";

/** A context that carries no session. `test.use` this to read as a stranger. */
export const SIGNED_OUT = { cookies: [], origins: [] };

/**
 * The sign-in a person performs, start to finish: the form, the mail, the
 * click. Nothing is stubbed. The link this follows is the link the Worker
 * printed.
 *
 * The cursor is taken before the submit, so the search skips every link the
 * run has already spent.
 */
export async function signIn(page: Page): Promise<void> {
	await withSignInLock(async () => {
		const cursor = await logCursor();

		await page.goto("/login");
		await page.getByLabel("Email address").fill(OWNER_EMAIL);
		await page.getByRole("button", { name: "Send a sign-in link" }).click();
		await expect(
			page.getByRole("heading", { name: "Check your mail" }),
		).toBeVisible();

		// The click in the mail client. It is a GET that redirects with a
		// Set-Cookie, which is what makes it work with JavaScript off.
		await page.goto(await readMagicLink(OWNER_EMAIL, cursor));
		await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
	});
}
