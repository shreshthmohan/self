// The DOM has to exist before TipTap loads. Keep this line first.
import "./dom";

import { expect, test } from "@playwright/test";

import { roundTrip } from "../../app/lib/fidelity-gate";
import { GATE_FIXTURES } from "./fixtures";

/**
 * Serialisation reaches a fixed point after one pass.
 *
 * This is what stops damage compounding across saves. One pass re-cuts an
 * indent and pads a table, and that is allowed — the gate reads what a reader
 * sees, not the bytes. A SECOND pass that moves again is a different animal:
 * every save rewrites the body, so an entry drifts on its own for as long as
 * the author keeps opening it. On the prototype a second save merged two lists
 * into one.
 *
 * Only the rows the gate PASSES are checked, and that is the whole point of
 * the gate: TipTap never touches a field it refused, so a refused row is never
 * serialised twice. Measured while writing this — the inline `<br>` row does
 * NOT converge, because TipTap writes a hard break as trailing spaces and the
 * count of them moves on every pass. It is a refused row, so it never reaches
 * a save. It is left unasserted here because it is TipTap's behaviour, not
 * this repo's, and a version that fixes it should not fail the build.
 */
for (const fixture of GATE_FIXTURES.filter((f) => f.passes)) {
	test(`converges after one pass: ${fixture.name}`, () => {
		const first = roundTrip(fixture.markdown);

		// Four passes, not two. A cycle of period two reads as stable when it
		// is only compared once.
		let current = first;
		for (let pass = 2; pass <= 4; pass++) {
			current = roundTrip(current);
			expect(current, `pass ${pass} moved`).toBe(first);
		}
	});
}
