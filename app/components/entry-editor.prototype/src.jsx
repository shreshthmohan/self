/**
 * PROTOTYPE — throwaway page shell. See README.md.
 *
 * The shell is plain DOM. Only the editor pane is React, because React
 * hydration is the thing under test.
 */
import { createElement as h, useLayoutEffect, useRef, useState } from "react";
import { renderToString } from "react-dom/server.browser";
import { hydrateRoot } from "react-dom/client";
import { snapshotTyped, restoreTyped } from "./hydration-guard.js";

/* ---------------------------------------------------------------- the form */

const FIELDS = [
	{ name: "title", label: "Title", el: "input", type: "text", server: "Kitchen rebuild" },
	{ name: "kind", label: "Kind", el: "select", server: "note", options: ["note", "decision", "ethos", "idea"] },
	{ name: "path-slug", label: "Path", el: "input", type: "text", server: "kitchen-rebuild", mono: true },
	{ name: "is-public", label: "Public", el: "input", type: "checkbox", server: false },
	{ name: "section-heading-0", label: "Heading", el: "input", type: "text", server: "Worktop" },
	{ name: "section-slug-0", label: "Anchor", el: "input", type: "text", server: "worktop", mono: true },
	{ name: "section-position-0", label: "Position", el: "input", type: "number", server: "1" },
	{ name: "section-body-0", label: "Body (markdown)", el: "textarea", server: "created body" },
];

const STRATEGIES = [
	{
		key: "baseline",
		label: "1 — As it ships today",
		blurb:
			"Every field uncontrolled, defaultValue from the server data. This is app/components/entry-editor.tsx as it stands.",
	},
	{
		key: "snapshot-default",
		label: "2 — Read the DOM, seed defaultValue",
		blurb:
			"Before hydrating, read what is in the fields. Pass that as defaultValue, so React hydrates onto the text the person typed.",
	},
	{
		key: "restore-after",
		label: "3 — Put it back after hydration",
		blurb:
			"Hydrate as today, then a layout effect writes the snapshot back and restores the caret.",
	},
	{
		key: "controlled",
		label: "4 — Controlled from the snapshot",
		blurb:
			"useState seeded from the DOM, value + onChange. React owns the field from hydration on.",
	},
	{
		key: "hands-off",
		label: "5 — Client tree names no value",
		blurb:
			"No value and no defaultValue on the client, suppressHydrationWarning. Does React leave the node alone?",
	},
];

function Field({ f, mode, snap }) {
	const s = snap?.[f.name];
	const cls = "field" + (f.mono ? " mono" : "");
	const common = { name: f.name, id: "f-" + f.name, className: cls };

	if (f.el === "select") {
		const opts = f.options.map((o) => h("option", { key: o, value: o }, o));
		if (mode === "hands-off") return h("select", { ...common, suppressHydrationWarning: true }, opts);
		if (mode === "controlled") return h(ControlledSelect, { common, opts, initial: s?.value ?? f.server });
		const dv = mode === "snapshot-default" && s ? s.value : f.server;
		return h("select", { ...common, defaultValue: dv }, opts);
	}

	if (f.type === "checkbox") {
		if (mode === "hands-off") return h("input", { ...common, type: "checkbox", suppressHydrationWarning: true });
		if (mode === "controlled") return h(ControlledCheck, { common, initial: s ? s.checked : f.server });
		const dc = mode === "snapshot-default" && s ? s.checked : f.server;
		return h("input", { ...common, type: "checkbox", defaultChecked: dc });
	}

	const tag = f.el;
	const extra = tag === "textarea" ? { rows: 6 } : { type: f.type };
	if (mode === "hands-off") return h(tag, { ...common, ...extra, suppressHydrationWarning: true });
	if (mode === "controlled") return h(ControlledText, { common, extra, tag, initial: s?.value ?? f.server });
	const dv = mode === "snapshot-default" && s ? s.value : f.server;
	return h(tag, { ...common, ...extra, defaultValue: dv });
}

function ControlledText({ common, extra, tag, initial }) {
	const [v, setV] = useState(initial);
	return h(tag, { ...common, ...extra, value: v, onChange: (e) => setV(e.target.value) });
}
function ControlledSelect({ common, opts, initial }) {
	const [v, setV] = useState(initial);
	return h("select", { ...common, value: v, onChange: (e) => setV(e.target.value) }, opts);
}
function ControlledCheck({ common, initial }) {
	const [v, setV] = useState(initial);
	return h("input", { ...common, type: "checkbox", checked: v, onChange: (e) => setV(e.target.checked) });
}

/** Strategy 3 lives here: hydrate normally, then write the snapshot back. */
function RestoreAfterHydration({ snap }) {
	const marker = useRef(null);
	useLayoutEffect(() => {
		if (!snap) return;
		const f = marker.current?.closest("form");
		if (f) restoreTyped(f, snap);
	}, []);
	return h("span", { ref: marker, hidden: true });
}

function Editor({ mode, snap }) {
	return h(
		"form",
		{ id: "proto-form", onSubmit: (e) => e.preventDefault() },
		h(RestoreAfterHydration, { snap: mode === "restore-after" ? snap : null }),
		FIELDS.map((f) =>
			h(
				"label",
				{ key: f.name, className: "row" + (f.type === "checkbox" ? " row-check" : "") },
				h("span", { className: "row-label" }, f.label),
				h(Field, { f, mode, snap }),
			),
		),
	);
}

/* --------------------------------------------------------------- the shell */

const state = {
	strategy: "baseline",
	phase: "painted", // painted | hydrated
	typed: null, // snapshot taken just before hydration
	report: null,
	warnings: [],
	posted: null,
	caretBefore: null,
	caretAfter: null,
	note: "",
};

const pane = () => document.getElementById("pane");
const form = () => document.getElementById("proto-form");
const el = (name) => form()?.querySelector(`[name="${CSS.escape(name)}"]`);

let root = null;
/** The field a person last put the caret in. Survives clicking a demo button. */
let lastField = null;
document.addEventListener("focusin", (e) => {
	if (e.target?.name && e.target.closest("#pane")) lastField = e.target.name;
});

function reset(strategy) {
	if (strategy) state.strategy = strategy;
	if (root) {
		root.unmount();
		root = null;
	}
	state.phase = "painted";
	state.typed = null;
	state.report = null;
	state.warnings = [];
	state.posted = null;
	state.caretBefore = null;
	state.caretAfter = null;
	state.note = "Server HTML painted. Nothing is hydrated yet — this is the gap.";
	pane().innerHTML = renderToString(h(Editor, { mode: "server", snap: null }));
	render();
}

/** What a browser does when a person types: set the value, leave the attribute. */
function type(name, value, caret) {
	const target = el(name);
	if (!target) return;
	if (target.type === "checkbox") target.checked = value;
	else target.value = value;
	if (caret != null) {
		lastField = name;
		target.focus();
		try {
			target.setSelectionRange(caret, caret);
		} catch {
			/* no caret on this control */
		}
	}
	state.note = `Typed into “${name}”. The field holds it; the HTML attribute still holds the server text.`;
	render();
}

function hydrate() {
	if (state.phase === "hydrated") {
		state.note = "Already hydrated. Start over to paint fresh server HTML.";
		return render();
	}
	state.typed = snapshotTyped(form());
	state.caretBefore = readCaret(lastField);
	const realError = console.error;
	console.error = (...a) => {
		state.warnings.push(String(a[0]).slice(0, 240));
		realError(...a);
	};
	root = hydrateRoot(pane(), h(Editor, { mode: state.strategy, snap: state.typed }));
	setTimeout(() => {
		console.error = realError;
		state.phase = "hydrated";
		state.caretAfter = readCaret(lastField);
		state.report = measure();
		state.note = "Hydrated. Compare “typed before hydration” with “in the field now”.";
		render();
	}, 300);
	state.note = "Hydrating…";
	render();
}

/** A caret survives blur: selectionStart still reads after focus moves away. */
/** Gives you time to put the caret back in a field before the runtime lands. */
function hydrateSoon() {
	let left = 3;
	state.note = `Hydrating in ${left} s — click into a field and place the caret.`;
	render();
	const tick = setInterval(() => {
		left -= 1;
		if (left <= 0) {
			clearInterval(tick);
			hydrate();
			return;
		}
		state.note = `Hydrating in ${left} s — click into a field and place the caret.`;
		render();
	}, 1000);
}

function readCaret(name) {
	const n = name && el(name);
	if (!n) return null;
	try {
		if (n.selectionStart == null) return null;
		return { name, at: n.selectionStart, focused: document.activeElement === n };
	} catch {
		return null;
	}
}

function measure() {
	return FIELDS.map((f) => {
		const n = el(f.name);
		const isCheck = f.type === "checkbox";
		const now = n ? (isCheck ? n.checked : n.value) : "";
		const typed = state.typed?.[f.name];
		const wanted = typed ? (isCheck ? typed.checked : typed.value) : f.server;
		return {
			field: f,
			now,
			typed: typed ? (isCheck ? typed.checked : typed.value) : null,
			wanted,
			ok: String(now) === String(wanted),
		};
	});
}

function readForm() {
	state.posted = Object.fromEntries(new FormData(form()).entries());
	state.note = "This is what a save would post right now.";
	render();
}

/** Typing after hydration: React must hear the input event. */
function typeLive(name, value) {
	const n = el(name);
	if (!n) return;
	const proto = n instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	Object.getOwnPropertyDescriptor(proto, "value").set.call(n, value);
	n.dispatchEvent(new Event("input", { bubbles: true }));
	state.note = `Typed “${value}” into a hydrated field.`;
	render();
}

/* ------------------------------------------------------------ walkthroughs */

const typeTwo = () => {
	type("section-body-0", "edited body");
	type("title", "Kitchen rebuild, take two");
};

const SCENARIOS = [
	{
		id: "lost",
		title: "The report in #89",
		why: "A person opens the edit page and types into the body before the runtime lands. Then the runtime lands. Watch the Body row: under strategy 1 it goes back to the server text, and the save posts the old text.",
		steps: [
			{ label: "Start over with strategy 1", run: () => reset("baseline") },
			{ label: "Type “edited body” into Body", run: () => type("section-body-0", "edited body") },
			{ label: "Hydrate now", run: hydrate },
			{ label: "Read what a save would post", run: readForm },
		],
	},
	{
		id: "fixes",
		title: "Do the fixes hold?",
		why: "The same typing, each candidate in turn. A candidate passes only when every row reads “kept”. The buttons switch strategy for you.",
		steps: [
			{ label: "Strategy 2 — seed defaultValue", run: () => reset("snapshot-default") },
			{ label: "Type into Body and Title", run: typeTwo },
			{ label: "Hydrate now", run: hydrate },
			{ label: "Strategy 3 — restore after", run: () => reset("restore-after") },
			{ label: "Type into Body and Title", run: typeTwo },
			{ label: "Hydrate now", run: hydrate },
			{ label: "Strategy 4 — controlled", run: () => reset("controlled") },
			{ label: "Type into Body and Title", run: typeTwo },
			{ label: "Hydrate now", run: hydrate },
			{ label: "Strategy 5 — name no value", run: () => reset("hands-off") },
			{ label: "Type into Body and Title", run: typeTwo },
			{ label: "Hydrate now", run: hydrate },
		],
	},
	{
		id: "caret",
		title: "Does the caret survive?",
		why: "Text alone is not enough. A person mid-sentence keeps the caret where it was. This types a line, puts the caret after “quick”, then hydrates. Watch the caret line under the table.",
		steps: [
			{ label: "Start over with the current strategy", run: () => reset() },
			{ label: "Type a line, caret after “quick”", run: () => type("section-body-0", "the quick brown fox", 9) },
			{ label: "Hydrate now", run: hydrate },
		],
	},
	{
		id: "controls",
		title: "Not only text",
		why: "The checkbox and the dropdown carry state before hydration too. A fix that guards text alone leaves these behind.",
		steps: [
			{ label: "Start over with the current strategy", run: () => reset() },
			{ label: "Tick Public", run: () => type("is-public", true) },
			{ label: "Pick kind = decision", run: () => type("kind", "decision") },
			{ label: "Hydrate now", run: hydrate },
		],
	},
	{
		id: "untouched",
		title: "Nobody typed",
		why: "The guard must stay quiet when there is nothing to guard. Hydrate an untouched form: every field still holds the server text, and React says nothing.",
		steps: [
			{ label: "Start over with the current strategy", run: () => reset() },
			{ label: "Hydrate now, without typing", run: hydrate },
		],
	},
	{
		id: "after",
		title: "Still an editor afterwards",
		why: "A fix that rescues the text but breaks typing afterwards is no fix. Type after hydration, then read the form: the newest text must be in it.",
		steps: [
			{ label: "Start over with the current strategy", run: () => reset() },
			{ label: "Type “edited body”", run: () => type("section-body-0", "edited body") },
			{ label: "Hydrate now", run: hydrate },
			{ label: "Type again, into the hydrated field", run: () => typeLive("section-body-0", "edited body, then more") },
			{ label: "Read what a save would post", run: readForm },
		],
	},
];

let openTab = SCENARIOS[0].id;
const stepAt = {};

/* --------------------------------------------------------------- rendering */

function render() {
	document.getElementById("controls").replaceChildren(controlsView());
	document.getElementById("state").replaceChildren(stateView());
	document.getElementById("walk").replaceChildren(walkView());
}

function button(label, onClick, cls) {
	const b = document.createElement("button");
	b.textContent = label;
	if (cls) b.className = cls;
	b.onclick = onClick;
	return b;
}

function node(tag, cls, text) {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (text != null) n.textContent = text;
	return n;
}

function controlsView() {
	const wrap = node("div");
	const strat = node("div", "strip");
	strat.append(node("span", "strip-label", "Strategy"));
	for (const s of STRATEGIES) {
		strat.append(button(s.label, () => reset(s.key), state.strategy === s.key ? "on" : ""));
	}
	wrap.append(strat);
	wrap.append(node("p", "blurb", STRATEGIES.find((s) => s.key === state.strategy).blurb));

	const acts = node("div", "strip");
	acts.append(node("span", "strip-label", "Free play"));
	acts.append(button("Type into Body", () => type("section-body-0", "edited body")));
	acts.append(button("Type into Title", () => type("title", "Kitchen rebuild, take two")));
	acts.append(button("Tick Public", () => type("is-public", true)));
	acts.append(button("Caret mid-word", () => type("section-body-0", "the quick brown fox", 9)));
	acts.append(button("Hydrate now", hydrate, "primary"));
	acts.append(button("Hydrate in 3 s", hydrateSoon));
	acts.append(button("Read the form", readForm));
	acts.append(button("Start over", () => reset()));
	wrap.append(acts);
	return wrap;
}

function stateView() {
	const wrap = node("div");
	const phase = node("div", "phase");
	phase.append(
		node(
			"span",
			"pill " + (state.phase === "hydrated" ? "pill-on" : ""),
			state.phase === "hydrated" ? "Hydrated" : "Server HTML only",
		),
	);
	phase.append(node("span", "note", state.note));
	wrap.append(phase);

	const t = node("table", "grid");
	const head = node("tr");
	for (const c of ["Field", "Server sent", "Typed before hydration", "In the field now", ""]) head.append(node("th", null, c));
	t.append(head);

	const rows = state.report ?? FIELDS.map((f) => ({ field: f, now: null, typed: null, wanted: null, ok: null }));
	for (const r of rows) {
		const live = el(r.field.name);
		const now = state.report ? r.now : live ? (r.field.type === "checkbox" ? live.checked : live.value) : "";
		const tr = node("tr", r.ok === false ? "bad" : r.ok === true ? "good" : "");
		tr.append(node("td", null, r.field.label));
		tr.append(node("td", "mono", String(r.field.server)));
		tr.append(node("td", "mono", r.typed == null ? "—" : String(r.typed)));
		tr.append(node("td", "mono", String(now)));
		tr.append(node("td", "verdict", r.ok == null ? "" : r.ok ? "kept" : "lost"));
		t.append(tr);
	}
	wrap.append(t);

	if (state.report) {
		const lost = state.report.filter((r) => !r.ok).length;
		wrap.append(
			node(
				"p",
				lost ? "verdict-line bad-text" : "verdict-line good-text",
				lost
					? `${lost} field${lost > 1 ? "s" : ""} lost what was in it.`
					: "Every field kept what was in it.",
			),
		);
	}

	wrap.append(
		node(
			"p",
			"caret-line",
			`Caret before hydration: ${fmtCaret(state.caretBefore)} · after: ${fmtCaret(state.caretAfter)}`,
		),
	);

	if (state.warnings.length) {
		const w = node("div", "warn");
		w.append(node("strong", null, "React said:"));
		for (const line of state.warnings.slice(0, 3)) w.append(node("p", "mono", line));
		wrap.append(w);
	}

	if (state.posted) {
		const p = node("div", "posted");
		p.append(node("strong", null, "A save would post:"));
		p.append(node("pre", "mono", JSON.stringify(state.posted, null, 2)));
		wrap.append(p);
	}
	return wrap;
}

function fmtCaret(c) {
	if (!c) return "—";
	return `${c.name} @ ${c.at}${c.focused ? ", focused" : ", not focused"}`;
}

function walkView() {
	const wrap = node("div");
	const tabs = node("div", "tabs");
	for (const s of SCENARIOS) {
		tabs.append(
			button(
				s.title,
				() => {
					openTab = s.id;
					stepAt[s.id] = 0;
					render();
				},
				openTab === s.id ? "on" : "",
			),
		);
	}
	wrap.append(tabs);

	const s = SCENARIOS.find((x) => x.id === openTab);
	wrap.append(node("p", "blurb", s.why));
	const at = stepAt[s.id] ?? 0;
	const list = node("ol", "steps");
	s.steps.forEach((step, i) => {
		const li = node("li", i < at ? "done" : i === at ? "next" : "later");
		li.append(
			button(
				step.label,
				() => {
					step.run();
					stepAt[s.id] = i + 1;
					render();
				},
				i === at ? "primary" : "",
			),
		);
		list.append(li);
	});
	wrap.append(list);
	return wrap;
}

reset("baseline");
