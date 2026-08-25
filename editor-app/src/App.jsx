// PROTOTYPE — throwaway. Answers issue #10: which rich-text editor.
// Three variants of one entry section, switchable via ?variant=.
import { useState } from 'react'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { TiptapVariant, name as nameA } from './variants/TiptapVariant'
import { MdEditorVariant, name as nameB } from './variants/MdEditorVariant'
import { BareTextareaVariant, name as nameC } from './variants/BareTextareaVariant'
import { EnhancedVariant, name as nameD } from './variants/EnhancedVariant'

const VARIANTS = [
  { key: 'A', name: nameA, Component: TiptapVariant },
  { key: 'B', name: nameB, Component: MdEditorVariant },
  { key: 'C', name: nameC, Component: BareTextareaVariant },
  { key: 'D', name: nameD, Component: EnhancedVariant },
]

function readVariant() {
  const v = new URLSearchParams(location.search).get('variant')
  return VARIANTS.some((x) => x.key === v) ? v : 'A'
}

export function App() {
  const [variant, setVariant] = useState(readVariant)

  const change = (key) => {
    const url = new URL(location.href)
    url.searchParams.set('variant', key)
    history.replaceState(null, '', url)
    setVariant(key)
  }

  const { Component, name } = VARIANTS.find((v) => v.key === variant)

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 96px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ background: '#ffe9b8', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}>
        PROTOTYPE — throwaway. Issue #10, choose the rich-text editor. Storage is localStorage.
      </p>
      <h1 style={{ fontSize: 22, margin: '16px 0 4px' }}>Variant {variant}</h1>
      <p style={{ margin: '0 0 20px', color: '#555' }}>{name}</p>
      <Component key={variant} />
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={change} />
    </main>
  )
}
