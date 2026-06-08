import Dashboard from './Dashboard'
import type { UserProfile } from '../lib/types'

interface Props {
  profile: UserProfile
  onSignOut: () => void
  onToggleTheme: () => void
  darkMode: boolean
}

export default function UserDashboard(props: Props) {
  return <Dashboard {...props} />
}
