/**
 * Local-dev entry point. The Prisme.ai platform never runs this file —
 * in production it loads the bundle from `npm run build` and calls the
 * default export of src/App.tsx with `sdk`, `user`, `workspace`, `backends` props.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { buildMockProps } from './lib/mockHost'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App {...buildMockProps()} />
  </StrictMode>
)
