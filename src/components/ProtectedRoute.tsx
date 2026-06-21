import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute() {
  const { concern } = useAuth()
  return concern ? <Outlet /> : <Navigate to="/login" replace />
}
