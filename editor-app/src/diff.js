// Naive LCS line diff. Throwaway; good enough to show what an editor dropped.
export function lineDiff(a, b) {
  const A = a.split('\n')
  const B = b.split('\n')
  const n = A.length
  const m = B.length
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: 'same', text: A[i] })
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      out.push({ kind: 'gone', text: A[i] })
      i++
    } else {
      out.push({ kind: 'new', text: B[j] })
      j++
    }
  }
  while (i < n) out.push({ kind: 'gone', text: A[i++] })
  while (j < m) out.push({ kind: 'new', text: B[j++] })
  return out
}

export function shorten(text, max = 90) {
  // A data URI makes every diff line unreadable. Cut it, keep the shape.
  return text.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, (m) =>
    `data:image/…;base64,<${m.length} chars>`,
  ).slice(0, max * 4)
}
