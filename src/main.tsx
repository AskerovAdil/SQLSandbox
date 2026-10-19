import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './app/ErrorBoundary'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Элемент #root не найден в index.html')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
