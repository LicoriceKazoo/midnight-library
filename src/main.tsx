import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IdentityCallbackHandler } from './IdentityCallbackHandler.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdentityCallbackHandler />
    <App />
  </StrictMode>,
)
