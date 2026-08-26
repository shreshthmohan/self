import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * The magic link, read back out of the dev server's stdout.
 *
 * There is no mailbox to poll. A local sign-in prints the URL to the Worker
 * console instead of sending mail (see `app/lib/email.server.ts`), and
 * `scripts/e2e-server.sh` tees that console to this file. So the suite reads
 * the log, and no code in the app changes to let it.
 */
const LOG = new URL("./.tmp/dev.log", import.meta.url);

const WAIT_MS = 20_000;

async function read(): Promise<string> {
	try {
		return await readFile(LOG, "utf8");
	} catch {
		// The server writes the file before it listens, so a miss here means
		// the run started early rather than that the log is lost.
		return "";
	}
}

/**
 * Where the log ends now.
 *
 * Take one before the submit that sends the mail, and pass it to
 * `readMagicLink`. One address signs in several times in a run and a link
 * works once, so a search from the top of the log finds a URL that is already
 * spent.
 */
export async function logCursor(): Promise<number> {
	return (await read()).length;
}

const escapeForRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The last link printed for `email` after `cursor`. */
export async function readMagicLink(
	email: string,
	cursor: number,
): Promise<string> {
	const pattern = new RegExp(
		`magic link for ${escapeForRegExp(email)}:\\s+(\\S+)`,
		"g",
	);
	const deadline = Date.now() + WAIT_MS;

	for (;;) {
		const matches = [...(await read()).slice(cursor).matchAll(pattern)];
		const last = matches.at(-1);
		if (last) return last[1];
		if (Date.now() > deadline) {
			throw new Error(
				`No magic link for ${email} in ${LOG.pathname} after ${WAIT_MS} ms. ` +
					"The server prints one in development only; check that " +
					"scripts/e2e-server.sh started it.",
			);
		}
		await sleep(100);
	}
}
