import { mkdir, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * One sign-in at a time, across every worker and both browser projects.
 *
 * The suite has one address and can have no other (ADR 0012), and a magic link
 * works once. Two sign-ins in flight together therefore race for the same URL
 * in the log, and the loser follows a link that is already spent. Holding this
 * lock over the whole flow — submit, read, click — keeps them apart.
 *
 * `mkdir` fails when the directory exists and is atomic, so the directory is
 * the lock. `scripts/e2e-server.sh` removes a leftover one on every start.
 */
const LOCK = new URL("./.tmp/sign-in.lock", import.meta.url);

const WAIT_MS = 60_000;

export async function withSignInLock<T>(work: () => Promise<T>): Promise<T> {
	const deadline = Date.now() + WAIT_MS;

	for (;;) {
		try {
			await mkdir(LOCK);
			break;
		} catch {
			if (Date.now() > deadline) {
				throw new Error(
					`Another sign-in held ${LOCK.pathname} for ${WAIT_MS} ms.`,
				);
			}
			await sleep(50);
		}
	}

	try {
		return await work();
	} finally {
		await rm(LOCK, { recursive: true, force: true });
	}
}
