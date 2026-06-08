export type UserRole = 'admin' | 'user'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export type DtrRecord = {
  id: string
  user_id: string
  date: string
  time_in: string | null
  lunch_out: string | null
  lunch_in: string | null
  time_out: string | null
  created_at: string
  updated_at: string
  users?: {
    email: string
    role: UserRole
  }
}
