// The DOM has to exist before TipTap loads. Keep this line first.
import "./dom";

import { expect, test } from "@playwright/test";

import { checkFidelity, roundTrip } from "../../app/lib/fidelity-gate";
import { GATE_FIXTURES } from "./fixtures";

/**
 * The gate, row by row against the ADR 0007 table.
 *
 * A gate that passes too readily lets TipTap rewrite an entry and drop a
 * table. A gate that refuses too readily makes the rich editor never appear.
 * Neither shows an author an error, so nothing but these rows says which of
 * the two is happening.
 */
test.describe("the fidelity gate", () => {
	for (const fixture of GATE_FIXTURES) {
		const verdict = fixture.passes ? "passes" : "refuses";

		test(`${verdict}: ${fixture.name}`, () => {
			const { passes, roundTripped } = checkFidelity(fixture.markdown);

			expect(
				passes,
				`${fixture.because}\n--- stored ---\n${fixture.markdown}\n--- round trip ---\n${roundTripped}`,
			).toBe(fixture.passes);
		});
	}
});

/**
 * Why the gate reads rendered HTML and not bytes.
 *
 * Byte equality was the first design and measuring killed it: serialisation
 * adds a trailing newline and pads table columns, so it refuses plain prose
 * that holds no table at all. Every row below comes back with different bytes,
 * including the four the gate passes — so a later "simplification" back to
 * `stored === roundTripped` refuses the whole vocabulary, and this says so.
 */
test.describe("bytes are not the measure", () => {
	for (const fixture of GATE_FIXTURES) {
		test(`bytes differ: ${fixture.name}`, () => {
			expect(roundTrip(fixture.markdown)).not.toBe(fixture.markdown);
		});
	}
});
