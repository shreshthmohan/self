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

/**
 * A raw photo as a data URI is megabytes of text. That is a prototype artifact
 * — real images go to R2 as a short URL — and it swamps any variant that keeps
 * the markdown in a textarea. Downscale so the variants are judged fairly.
 */
export function fileToDataUri(file, maxEdge = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export const kb = (s) => `${(new Blob([s]).size / 1024).toFixed(1)} kB`
