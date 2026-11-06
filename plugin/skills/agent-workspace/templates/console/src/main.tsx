/**
 * Local-dev entry point. The Prisme.ai platform never runs this file — in
 * production it loads the bundle from `npm run build` and calls the default
 * export of src/App.tsx with `sdk`, `user`, `workspace`, `backends` props.
 * Here the props come from the mock host (src/lib/mockHost.ts), which answers
 * every console endpoint in memory (?mock=ok|update|install|drift|running).
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { buildMockProps } from './lib/mockHost'
import './styles/globals.css'

// Local dev only: the Studio gives the app a full-height container and its own theme.
// ?theme=dark adds the Studio's `dark` class on <html> to check dark mode.
for (const el of [document.documentElement, document.body, document.getElementById('root')]) if (el) el.style.height = '100%'
document.body.style.margin = '0'
document.body.classList.add('bg-background')
if (new URLSearchParams(window.location.search).get('theme') === 'dark') document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App {...buildMockProps()} />
  </StrictMode>
)
