import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/common/Toast'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  )
}
