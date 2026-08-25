import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'

new Editor({ element: document.getElementById('root'), extensions: [StarterKit, Image, Markdown], content: 'x' })
