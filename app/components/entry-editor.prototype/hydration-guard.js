/**
 * PROTOTYPE — the one part meant to survive.
 *
 * Reads what a person typed into a form before React hydrated it, and puts it
 * back after. Pure: it takes a DOM root and returns plain data. No React, no
 * page, no globals.
 *
 * The dirty test is the browser's own: a control keeps the server-rendered
 * text in `defaultValue` / `defaultChecked` and the live text in `value` /
 * `checked`. Typing moves one and not the other. So a field counts as typed
 * only when the two differ, and a field nobody touched is never restored —
 * a server value that changed between paint and hydration still wins.
 */

/** @typedef {{ name: string, kind: "value" | "checked", value: string, checked: boolean, selectionStart: number | null, selectionEnd: number | null, focused: boolean }} FieldSnapshot */

/** Every named control under `root`. */
function controls(root) {
	return /** @type {Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>} */ (
		Array.from(root.querySelectorAll("input[name], textarea[name], select[name]"))
	);
}

/** True when a control holds text the server did not render. */
function isDirty(el) {
	if (el instanceof HTMLSelectElement) {
		return Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
	}
	if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
		return el.checked !== el.defaultChecked;
	}
	return el.value !== el.defaultValue;
}

/**
 * Snapshot the typed fields under `root`. Untouched fields are left out.
 * @returns {Record<string, FieldSnapshot>}
 */
export function snapshotTyped(root) {
	/** @type {Record<string, FieldSnapshot>} */
	const snap = {};
	for (const el of controls(root)) {
		if (!isDirty(el)) continue;
		const isCheck = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
		let start = null;
		let end = null;
		try {
			start = /** @type {any} */ (el).selectionStart ?? null;
			end = /** @type {any} */ (el).selectionEnd ?? null;
		} catch {
			// number and checkbox inputs throw on selectionStart. No caret to keep.
		}
		snap[el.name] = {
			name: el.name,
			kind: isCheck ? "checked" : "value",
			value: el.value,
			checked: isCheck ? el.checked : false,
			selectionStart: start,
			selectionEnd: end,
			focused: document.activeElement === el,
		};
	}
	return snap;
}

/**
 * Put a snapshot back on the DOM and tell React about it. Restores the caret
 * on the field that had focus.
 * @param {Record<string, FieldSnapshot>} snap
 * @returns {string[]} names restored
 */
export function restoreTyped(root, snap) {
	const done = [];
	for (const el of controls(root)) {
		const s = snap[el.name];
		if (!s) continue;
		if (s.kind === "checked") {
			if (/** @type {HTMLInputElement} */ (el).checked === s.checked) continue;
			/** @type {HTMLInputElement} */ (el).checked = s.checked;
		} else {
			if (el.value === s.value) continue;
			setValue(el, s.value);
		}
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		if (s.selectionStart != null) {
			try {
				if (s.focused) /** @type {any} */ (el).focus();
				/** @type {any} */ (el).setSelectionRange(s.selectionStart, s.selectionEnd);
			} catch {
				// no caret on this control
			}
		}
		done.push(el.name);
	}
	return done;
}

/**
 * Write through React's own value setter, not the element's. React 19 tracks
 * the last value it wrote on the node; a plain assignment leaves that tracker
 * stale and the next `input` event is swallowed.
 */
function setValue(el, value) {
	if (el instanceof HTMLSelectElement) {
		el.value = value;
		return;
	}
	const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
	if (setter) setter.call(el, value);
	else el.value = value;
}
