import { useEffect, useState, type RefObject } from "react";

import { loadPreviewRenderer, type RenderPreview } from "../lib/preview";

/** Live, but not on every keystroke. A whole body renders per tick. */
const DEBOUNCE_MS = 200;

/**
 * One section, as a reader sees it, beside the textarea that holds it. See
 * #103.
 *
 * It reads the fields through refs and never writes them. The heading input
 * and the body textarea stay uncontrolled, so React sets no value here and
 * ADR 0016's restore across the hydration gap is untouched.
 *
 * The listener is this component's own, attached to the two fields it was
 * given: typing in one section repaints that section's pane and no other.
 *
 * The renderer arrives by dynamic import. Until it lands the pane holds its
 * space empty, so the layout settles once, and if the import fails the pane
 * says so and the editor keeps working.
 */
export function SectionPreview(props: {
	/** Names the region, so the pane is reachable and tells which it is. */
	label: string;
	heading: RefObject<HTMLInputElement | null>;
	body: RefObject<HTMLTextAreaElement | null>;
}) {
	const [heading, setHeading] = useState("");
	const [html, setHtml] = useState("");
	const [unavailable, setUnavailable] = useState(false);

	const { heading: headingRef, body: bodyRef } = props;

	useEffect(() => {
		const headingField = headingRef.current;
		const bodyField = bodyRef.current;

		let live = true;
		let render: RenderPreview | null = null;
		let timer: ReturnType<typeof setTimeout> | undefined;

		function paint() {
			if (!live || !render) return;
			setHeading(headingField?.value ?? "");
			setHtml(render(bodyField?.value ?? ""));
		}

		function schedule() {
			clearTimeout(timer);
			timer = setTimeout(paint, DEBOUNCE_MS);
		}

		headingField?.addEventListener("input", schedule);
		bodyField?.addEventListener("input", schedule);

		loadPreviewRenderer().then(
			(loaded) => {
				render = loaded;
				// The stored text, rendered at once. The author has typed
				// nothing yet, so there is nothing to wait for.
				paint();
			},
			() => {
				if (live) setUnavailable(true);
			},
		);

		return () => {
			live = false;
			clearTimeout(timer);
			headingField?.removeEventListener("input", schedule);
			bodyField?.removeEventListener("input", schedule);
		};
	}, [headingRef, bodyRef]);

	return (
		<div className="flex flex-col">
			<span className="text-sm font-medium">Preview</span>
			{/*
				The pane is a fixed box that scrolls inside itself, so neither a
				long body nor the first render grows the fieldset the author is
				typing in.

				Beside the textarea, the box is as tall as the grid row. The
				textarea column sets that row, and the box fills a cell it cannot
				stretch, because it is out of flow.

				Stacked under the textarea there is no row to fill. The box takes
				a height of its own there, near enough the textarea's twelve
				rows.
			*/}
			<div className="mt-1 md:relative md:grow">
				<div
					role="region"
					aria-label={props.label}
					// The box scrolls, so it takes the keyboard. An author who
					// reaches it by tab can read a body longer than the box.
					tabIndex={0}
					className="h-72 overflow-y-auto border border-border bg-surface p-2 md:absolute md:inset-0 md:h-auto"
				>
					{unavailable ? (
						<p className="text-sm text-muted">
							The preview is unavailable. The editor is unaffected.
						</p>
					) : (
						<>
							{/*
								The section heading, as the read page renders it —
								without its anchor link, which would point at an id
								the pane deliberately does not emit.
							*/}
							{heading !== "" && <h2 className="text-2xl">{heading}</h2>}
							<div
								className="prose mt-2"
								// Rendered by `marked` with raw HTML ESCAPED, not
								// passed through — see app/lib/markdown.ts. The
								// string here carries no author-supplied markup.
								dangerouslySetInnerHTML={{ __html: html }}
							/>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
