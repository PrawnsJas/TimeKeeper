import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { UserProfile } from './lib/types'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }

    restoreSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) {
        setProfile(null)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (error && data === null) {
        if (!session.user.email) {
          setProfile(null)
          setProfileLoading(false)
          return
        }
        const { data: inserted, error: insertError } = await supabase.from('users')
          .insert({
            id: session.user.id,
            email: session.user.email,
            role: 'user',
          })
          .select('*')
          .single()
        setProfile(inserted ?? null)
        if (insertError) {
          console.error(insertError)
        }
        setProfileLoading(false)
        return
      }

      setProfile(data as UserProfile)
      setProfileLoading(false)
    }

    loadProfile()
  }, [session])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  const toggleTheme = () => {
    setDarkMode((prev) => !prev)
    document.documentElement.classList.toggle('dark')
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Loading TimeKeeper...</p>
        </div>
      </div>
    )
  }

  if (!session || !profile) {
    return <AuthPage />
  }

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <Dashboard profile={profile} onSignOut={handleSignOut} onToggleTheme={toggleTheme} darkMode={darkMode} />
    </div>
  )
}

export default App
