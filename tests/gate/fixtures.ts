/**
 * One fixture per row of the ADR 0007 table, and the verdict that row records.
 *
 * These are the constructs a document model drops: a GFM table vanishes whole,
 * a task list loses its checkboxes, a raw `<figure>` flattens. The seed of the
 * `prototype/editor` branch held the same set, and these are its production
 * equivalents.
 */
export type GateFixture = {
	/** The row of the ADR 0007 table. */
	name: string;
	markdown: string;
	/** True when the gate must let TipTap take over the field. */
	passes: boolean;
	/** Why this row reads the way it does. */
	because: string;
};

export const GATE_FIXTURES: GateFixture[] = [
	{
		name: "Prose, lists, quote, code block, rule, image",
		markdown: `## Heading

Prose with **bold**, *italic*, \`code\`, a [link](https://example.com).

- one
- two

1. a
2. b

> Quote.

\`\`\`js
const x = 1
\`\`\`

---

![alt](https://example.com/a.png)
`,
		passes: true,
		because: "StarterKit holds every one of these.",
	},
	{
		name: "Table",
		markdown: `| Part | Cost |
| --- | --- |
| Washer | 40p |
`,
		passes: true,
		because:
			"Table is in the vocabulary, and purchase research is table-shaped.",
	},
	{
		name: "Task list",
		markdown: `- [ ] Buy the washer
- [x] Close the isolator
`,
		passes: true,
		because: "TaskList and TaskItem keep the checkboxes.",
	},
	{
		name: "Nested lists",
		markdown: `- outer
  - inner
    - deeper
`,
		passes: true,
		because: "Nesting survives, though the indent is re-cut.",
	},
	{
		name: "Raw HTML figure",
		markdown: `<figure>
  <img src="https://example.com/a.png" alt="a">
  <figcaption>Caption.</figcaption>
</figure>
`,
		passes: false,
		because:
			"Raw HTML is out of the vocabulary on purpose. This is the row the gate exists for.",
	},
	{
		name: "Inline br and em",
		markdown: `Text with a <br> and an <em>inline tag</em>.
`,
		passes: false,
		because:
			"The site renders raw HTML as text; TipTap parses the tags. The two readings differ.",
	},
];
