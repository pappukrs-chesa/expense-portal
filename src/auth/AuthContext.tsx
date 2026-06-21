import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Concern } from '../types'

const KEY = 'ep.concern'

type AuthCtx = {
  concern: Concern | null
  login: (c: Concern) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

const read = (): Concern | null => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Concern) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [concern, setConcern] = useState<Concern | null>(() => read())

  const login = (c: Concern) => {
    localStorage.setItem(KEY, JSON.stringify(c))
    setConcern(c)
  }
  const logout = () => {
    localStorage.removeItem(KEY)
    setConcern(null)
  }

  return <Ctx.Provider value={{ concern, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
