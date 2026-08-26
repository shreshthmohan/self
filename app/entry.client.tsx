import { startTransition, StrictMode } from "react";
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

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<HydratedRouter />
		</StrictMode>,
	);
});
