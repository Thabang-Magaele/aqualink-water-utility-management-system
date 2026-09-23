import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ToastProvider } from './context/ToastProvider'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
