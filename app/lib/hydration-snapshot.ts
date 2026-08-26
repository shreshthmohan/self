import { snapshotTyped, type ControlRoot, type TypedSnapshot } from "./hydration-guard";

/**
 * Holds the one snapshot taken before `hydrateRoot`, for the one component
 * that puts it back. See ADR 0016.
 *
 * It lives here and not in `hydration-guard.ts` because the guard is pure —
 * a DOM root in, plain data out — and this is the mutable half. It is a
 * module, not a property on `window`, so it stays typed and so the server
 * never sees it: nothing imports it into a server module, and the capture is
 * only ever called from the client entry.
 *
 * The snapshot is taken once per document and read once. A client-side
 * navigation into the editor has no hydration gap, so there is nothing to
 * restore and `takeTypedSnapshot` returns null.
 */
let pending: TypedSnapshot | null = null;

/** Called as the first statement of `app/entry.client.tsx`, before React runs. */
export function captureTypedBeforeHydration(root: ControlRoot): void {
	const snap = snapshotTyped(root);
	pending = Object.keys(snap).length > 0 ? snap : null;
}

/** Reads the snapshot and clears it, so a second caller restores nothing. */
export function takeTypedSnapshot(): TypedSnapshot | null {
	const snap = pending;
	pending = null;
	return snap;
}
