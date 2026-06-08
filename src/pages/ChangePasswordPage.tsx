import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/types'
import Button from '../components/Button'

interface Props {
  profile: UserProfile
  onSignOut: () => void
}

export default function ChangePasswordPage({ profile, onSignOut }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile.must_change_password) {
      navigate(profile.role === 'admin' ? '/admin' : '/user', { replace: true })
    }
  }, [profile, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('users')
      .update({ must_change_password: false })
      .eq('id', profile.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    setSuccess('Password updated. Redirecting...')
    setLoading(false)
    navigate(profile.role === 'admin' ? '/admin' : '/user', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Change Password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          A temporary password was issued. Update it now to continue.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            />
          </label>

          {success ? <p className="rounded-3xl bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">{success}</p> : null}
          {error ? <p className="rounded-3xl bg-rose-100 p-3 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          If you need help, ask your administrator to reset the password securely.
        </div>
      </div>
    </div>
  )
}
