import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import ConfirmEmailChange from './pages/ConfirmEmailChange'
import NotFound from './pages/NotFound'

// Domain Pages (Insurance & Benefits Domain)
import Index from './pages/Index'
import Pipeline from './pages/Pipeline'
import Contacts from './pages/Contacts'
import Companies from './pages/Companies'
import Tasks from './pages/Tasks'
import Conversations from './pages/Conversations'
import Financial from './pages/Financial'
import SettingsPage from './pages/Settings'

export function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

          {/* Protected CRM Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Index />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="contatos" element={<Contacts />} />
            <Route path="empresas" element={<Companies />} />
            <Route path="tarefas" element={<Tasks />} />
            <Route path="conversas" element={<Conversations />} />
            <Route path="financeiro" element={<Financial />} />
            <Route path="configuracoes" element={<SettingsPage />} />

            {/* Old route redirects */}
            <Route path="properties" element={<Navigate to="/pipeline" replace />} />
            <Route path="clients" element={<Navigate to="/contatos" replace />} />
            <Route path="interactions" element={<Navigate to="/tarefas" replace />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
