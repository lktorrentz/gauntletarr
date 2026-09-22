import { createContext, useContext } from 'react'

interface AuthContextValue {
  username: string | null
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({ username: null, logout: () => {} })

export function useAuth() {
  return useContext(AuthContext)
}
