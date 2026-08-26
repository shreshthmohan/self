import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { captureTypedBeforeHydration } from "./lib/hydration-snapshot";

/**
 * FIRST, before React touches the document. React 19 hydrates a `<textarea>`
 * by rewriting its text, so anything typed since the first paint is already
 * gone by the time any effect runs. The editor puts this snapshot back in a
 * layout effect. See ADR 0016.
 */
captureTypedBeforeHydration(document);

/** The attribute this marks the document with once hydration is done. */
export const HYDRATED_ATTRIBUTE = "data-hydrated";

/**
 * Says hydration is over. Nothing in the app reads this — the E2E suite does,
 * and it is the only signal the page gives. The document is the hydration
 * root, so no container appears to wait for, and the editor's fields are the
 * thing under test. Do not remove it with the tests still in the tree; see
 * `tests/hydration.ts` and issue #90.
 *
 * It renders no DOM, so it hydrates against nothing and cannot mismatch. It
 * sits after `<HydratedRouter />` and its effect is a passive one, so it fires
 * after every layout effect in the tree — the guard's restore of ADR 0016
 * included. The marker therefore means "hydrated AND guarded", which is what
 * a test has to wait for before it types.
 */
function MarkHydrated() {
	useEffect(() => {
		document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, "");
	}, []);
	return null;
}

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<HydratedRouter />
			<MarkHydrated />
		</StrictMode>,
	);
});
