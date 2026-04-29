import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (password: string) => Promise<void>
  inviteUser: (email: string, fullName: string, role: UserRole) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USER_CACHE_KEY = 'tm_user'

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function writeCachedUser(u: User | null) {
  try {
    if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch { /* quota exceeded or private mode */ }
}

// Read Supabase session from localStorage synchronously — no network call.
// Supabase JS v2 stores it at sb-{project-ref}-auth-token.
function hasLiveSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const data = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (data?.access_token && data?.expires_at) {
          // expires_at is a Unix timestamp in seconds
          return (data.expires_at as number) * 1000 > Date.now()
        }
      }
    }
  } catch { /* ignore */ }
  return false
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cached = readCachedUser()

  const [user, setUser] = useState<User | null>(cached)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(cached?.role ?? null)
  // Never block rendering on auth init. Guards use `user` directly.
  // getSession() + loadUser() run silently in the background.
  const [isLoading, setIsLoading] = useState(false)

  const loadUser = useCallback(async (supabaseUser: SupabaseUser) => {
    // If we already have this user in cache, apply it immediately and skip the
    // DB fetch — only do a background last_login update. This makes repeat
    // visits / token refreshes instant even when Supabase is slow.
    const cachedNow = readCachedUser()
    if (cachedNow && cachedNow.id === supabaseUser.id) {
      setUser(cachedNow)
      setRole(cachedNow.role)
      void supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', supabaseUser.id)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single()

      if (error || !data) {
        // First login — create the users table record
        const newUser = {
          id: supabaseUser.id,
          email: supabaseUser.email ?? '',
          full_name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email ?? '',
          role: (supabaseUser.user_metadata?.role as UserRole) ?? 'internal',
          is_active: true,
          invited_at: null,
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
        const { data: created } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single()
        // Use DB record if created, otherwise fall back to local data so redirect always fires
        const resolved = (created ?? newUser) as User
        setUser(resolved)
        setRole(resolved.role)
        writeCachedUser(resolved)
      } else {
        setUser(data)
        setRole(data.role)
        writeCachedUser(data)
        // fire-and-forget — don't block on last_login update
        void supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', supabaseUser.id)
      }
    } catch (err) {
      // Last resort: set user from auth data alone so the app doesn't stay stuck
      const fallback: User = {
        id: supabaseUser.id,
        email: supabaseUser.email ?? '',
        full_name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email ?? '',
        role: 'internal' as UserRole,
        is_active: true,
        invited_at: null,
        last_login_at: null,
        created_at: new Date().toISOString(),
      }
      setUser(fallback)
      setRole(fallback.role)
      console.warn('loadUser fell back to auth data:', err)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) {
        // Unblock the guards immediately — loadUser runs in background
        setIsLoading(false)
        // Fetch/sync user profile from DB (updates cache, role, last_login)
        loadUser(s.user)
      } else {
        // No valid session — clear cache and unblock
        writeCachedUser(null)
        setUser(null)
        setRole(null)
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Isolate the recovery session — clear any existing user so that
          // supabase.auth.updateUser() uses the recovery token, not the
          // previously logged-in user's session.
          writeCachedUser(null)
          setSession(s)
          setUser(null)
          setRole(null)
          return
        }
        setSession(s)
        if (s?.user) {
          await loadUser(s.user)
        } else {
          writeCachedUser(null)
          setUser(null)
          setRole(null)
          setIsLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUser])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const logout = async () => {
    writeCachedUser(null)
    setUser(null)
    setRole(null)
    setSession(null)
    await supabase.auth.signOut()
  }

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const resetPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const inviteUser = async (email: string, fullName: string, userRole: UserRole) => {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, full_name: fullName, role: userRole },
    })
    if (error) throw new Error(error.message ?? 'Invite failed')
    if (data?.error) throw new Error(data.error)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, isLoading, login, logout, forgotPassword, resetPassword, inviteUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
