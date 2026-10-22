import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './app/ErrorBoundary'

// Прямой переход на /<base>/<guid> приходит через public/404.html с параметром ?p=: возвращаем путь в адрес.
const redirected = new URLSearchParams(window.location.search).get('p')
if (redirected) window.history.replaceState(null, '', import.meta.env.BASE_URL + redirected.replace(/^\//, ''))

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Элемент #root не найден в index.html')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
