import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AvatarDebug from './components/AvatarDebug.jsx'
import RecordPage from './pages/RecordPage.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

const path    = window.location.pathname
const isDebug = new URLSearchParams(window.location.search).has('debug')

function Root() {
  if (path === '/record') return <RecordPage />
  if (isDebug)            return <AvatarDebug />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
)
