import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/Button'

export default function AuthPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
      }
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user?.id) {
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        role: 'user',
      })
    }

    setMessage('Account created. Check your inbox for a confirmation email.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">TimeKeeper</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {mode === 'sign-in' ? 'Sign in to manage your daily time records.' : 'Create an account to start punching in and recording time.'}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            />
          </label>

          {message ? <p className="rounded-3xl bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">{message}</p> : null}
          {error ? <p className="rounded-3xl bg-rose-100 p-3 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processing…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>{mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}</span>
          <button
            type="button"
            className="font-semibold text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          >
            {mode === 'sign-in' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
