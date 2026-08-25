import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import {Table,TableRow,TableCell,TableHeader} from '@tiptap/extension-table'
import {TaskList} from '@tiptap/extension-task-list'
import {TaskItem} from '@tiptap/extension-task-item'
new Editor({ element: document.getElementById('root'), extensions: [StarterKit, Image, Table, TableRow, TableCell, TableHeader, TaskList, TaskItem, Markdown], content: 'x' })
