import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { UserProfile } from '../lib/types'

interface Props {
  session: Session | null
  profile: UserProfile | null
  requiredRole?: 'admin' | 'user'
  children: JSX.Element
}

export default function ProtectedRoute({ session, profile, requiredRole, children }: Props) {
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (requiredRole && profile.role !== requiredRole) {
    const destination = profile.role === 'admin' ? '/admin' : '/user'
    return <Navigate to={destination} replace />
  }

  return children
}
