import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SetupRequired from './pages/SetupRequired'
import { missingFirebaseEnv } from './utils/env'

const root = createRoot(document.getElementById('root')!)

if (missingFirebaseEnv.length > 0) {
  // Show a clear setup screen instead of crashing on an invalid Firebase config.
  root.render(
    <StrictMode>
      <SetupRequired missing={missingFirebaseEnv} />
    </StrictMode>,
  )
} else {
  // Loaded only once the config is valid, so Firebase never initialises with empty keys.
  import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
