import { useEffect, useState } from "react";

import { setTheme, toChoice, type Choice, type Theme } from "../lib/theme";

/**
 * The theme control: dark, light, system. See ADR 0015.
 *
 * A native `<select>`, so it shows its state without being clicked and it is
 * keyboard-accessible with no work.
 *
 * It renders only after mount, inside a slot of fixed size. A reader with no
 * JavaScript gets no control instead of a control that does nothing, and the
 * reserved space keeps the header from shifting when the runtime lands. The
 * slot centres itself, because the nav aligns on the baseline and an empty
 * box has a different baseline from a filled one.
 *
 * The `<select>` is uncontrolled and seeded from the loader. On change the
 * handler writes the cookie and mutates `<html>` directly — no React state and
 * no revalidation.
 */
export function ThemeSelect({ theme }: { theme: Theme | null }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<span className="inline-block h-6 w-24 self-center">
			{mounted && (
				<select
					aria-label="Theme"
					defaultValue={toChoice(theme)}
					onChange={(event) => setTheme(event.target.value as Choice)}
					className="h-full w-full border border-border bg-bg px-1 text-sm"
				>
					<option value="dark">Dark</option>
					<option value="light">Light</option>
					<option value="system">System</option>
				</select>
			)}
		</span>
	);
}
