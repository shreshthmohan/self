// PROTOTYPE — wipe me. Stands in for D1 while the round-trip question is client-side.
const KEY = (variant) => `PROTOTYPE-editor-wipe-me:${variant}`

// A 6x6 red PNG, small enough that a data URI stays readable in a textarea.
export const SAMPLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAGCAYAAADgzO9IAAAAKUlEQVR4nGP8z8DwnwEPYMInOSoxCjAyMPzHZwIjIQNGJUcBRgaGof0dAM5QBUXBK0F1AAAAAElFTkSuQmCC'

// Seeded on purpose with constructs a StarterKit does not know: a GFM table, a
// task list, a footnote, and raw HTML. This is the silent-drop test.
export const SEED = `## Why the kitchen tap leaks

The washer is perished. Two facts settle it, and one is measured.

- The drip runs at about **12 drops a minute**.
- It stops when the isolator is closed.

| Part | Cost | Where |
| --- | --- | --- |
| Washer | 40p | Screwfix |
| Cartridge | 14.00 | Bristan |

- [ ] Buy the washer
- [x] Close the isolator

Here is an inline image: ![red square](${'REPLACE_ME'})

<figure>
  <img src="https://example.com/tap.jpg" alt="the tap">
  <figcaption>Raw HTML block.</figcaption>
</figure>

A footnote reference[^1].

[^1]: The isolator is under the sink, on the hot feed.
`.replace('REPLACE_ME', SAMPLE_IMAGE)

export function load(variant) {
  try {
    return localStorage.getItem(KEY(variant))
  } catch {
    return null
  }
}

export function save(variant, markdown) {
  localStorage.setItem(KEY(variant), markdown)
}

export function wipe(variant) {
  localStorage.removeItem(KEY(variant))
}

export function initial(variant) {
  return load(variant) ?? SEED
}
