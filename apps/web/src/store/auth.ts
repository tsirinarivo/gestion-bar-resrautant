import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@restaurant/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setUser: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setUser: (user, accessToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken)
        }
        set({ user, accessToken, isAuthenticated: true })
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
        }
        set({ user: null, accessToken: null, isAuthenticated: false })
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'restaurant-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    }
  )
)
