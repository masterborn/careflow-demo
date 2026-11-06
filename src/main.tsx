import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './styles.css'

// Demo aid: agents click without a visible mouse cursor, so ring whatever was just clicked for 2 seconds.
document.addEventListener(
  'click',
  (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('button, a, select, input[type=radio], input[type=checkbox]')
    if (!el) return
    el.classList.remove('just-clicked')
    void el.offsetWidth // restart the pulse animation on repeated clicks
    el.classList.add('just-clicked')
    window.setTimeout(() => el.classList.remove('just-clicked'), 2000)
  },
  true,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
