/**
 * Keeps what a person typed before React hydrated the page, and puts it back
 * after. ADR 0002 promises the editor works before the runtime lands; ADR 0016
 * is why that promise needs this file.
 *
 * Pure: a DOM root in, plain data out. No React, no page, no globals.
 *
 * The dirty test is the browser's own. A control holds the server-rendered
 * text in `defaultValue` / `defaultChecked` and the live text in `value` /
 * `checked`. Typing moves one and not the other. So a field counts as typed
 * only when the two differ. An untouched field is never restored, and a server
 * value that changed between paint and hydration still wins.
 */

export type FieldSnapshot = {
	name: string;
	kind: "value" | "checked";
	value: string;
	checked: boolean;
	selectionStart: number | null;
	selectionEnd: number | null;
	focused: boolean;
};

export type TypedSnapshot = Record<string, FieldSnapshot>;

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * A `document` or a form. Narrower than `ParentNode` on purpose: workerd's
 * `HTMLRewriter` declares its own global `Element`, which merges with the DOM
 * one, and the merged shape makes `HTMLFormElement` fail `ParentNode`. Only
 * the one method used here is asked for.
 */
export type ControlRoot = Pick<ParentNode, "querySelectorAll">;

/**
 * Every named control under `root`. The cast is needed because
 * `HTMLSelectElement.remove()` does not match `Element.remove()`, so
 * `HTMLSelectElement` fails the `querySelectorAll` type parameter.
 */
function controls(root: ControlRoot): Control[] {
	return Array.from(root.querySelectorAll("input[name], textarea[name], select[name]")) as Control[];
}

function isToggle(el: Control): el is HTMLInputElement {
	return el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
}

/** True when a control holds text the server did not render. */
function isDirty(el: Control): boolean {
	if (el instanceof HTMLSelectElement) {
		return Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
	}
	if (isToggle(el)) return el.checked !== el.defaultChecked;
	return el.value !== el.defaultValue;
}

function caretOf(el: Control): { start: number | null; end: number | null } {
	try {
		// A select, a number input and a checkbox all refuse `selectionStart`.
		const target = el as Partial<HTMLTextAreaElement>;
		return { start: target.selectionStart ?? null, end: target.selectionEnd ?? null };
	} catch {
		return { start: null, end: null };
	}
}

/** Snapshot the typed fields under `root`. Untouched fields are left out. */
export function snapshotTyped(root: ControlRoot): TypedSnapshot {
	const snap: TypedSnapshot = {};
	for (const el of controls(root)) {
		if (!isDirty(el)) continue;
		const toggle = isToggle(el);
		const caret = caretOf(el);
		snap[el.name] = {
			name: el.name,
			kind: toggle ? "checked" : "value",
			value: el.value,
			checked: toggle ? el.checked : false,
			selectionStart: caret.start,
			selectionEnd: caret.end,
			focused: document.activeElement === el,
		};
	}
	return snap;
}

/**
 * Put a snapshot back on the DOM under `root` and tell React about it.
 * Restores the caret on the field that had focus.
 *
 * @returns the names restored
 */
export function restoreTyped(root: ControlRoot, snap: TypedSnapshot): string[] {
	const done: string[] = [];
	for (const el of controls(root)) {
		const field = snap[el.name];
		if (!field) continue;
		if (field.kind === "checked") {
			if (!isToggle(el) || el.checked === field.checked) continue;
			el.checked = field.checked;
		} else {
			if (el.value === field.value) continue;
			setValue(el, field.value);
		}
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		restoreCaret(el, field);
		done.push(el.name);
	}
	return done;
}

function restoreCaret(el: Control, field: FieldSnapshot): void {
	if (field.selectionStart == null) return;
	try {
		if (field.focused) el.focus();
		(el as Partial<HTMLTextAreaElement>).setSelectionRange?.(field.selectionStart, field.selectionEnd);
	} catch {
		// No caret on this control.
	}
}

/**
 * Write through React's own value setter, not the element's. React 19 tracks
 * the last value it wrote on the node; a plain assignment leaves that tracker
 * stale and the next `input` event is swallowed.
 *
 * Exported for any code that writes a field the author owns. The editor
 * empties the paste box this way (#111).
 */
export function setValue(el: Control, value: string): void {
	if (el instanceof HTMLSelectElement) {
		el.value = value;
		return;
	}
	const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
	if (setter) setter.call(el, value);
	else el.value = value;
}
