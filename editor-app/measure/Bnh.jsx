import { createRoot } from 'react-dom/client'
import MDEditor from '@uiw/react-md-editor/nohighlight'
createRoot(document.getElementById('root')).render(<MDEditor value="x" height={300} />)
