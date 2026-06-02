'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const router = useRouter()
  const { setUser } = useAuthStore()

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  })

  // Charge l'email mémorisé après mount (évite hydration mismatch SSR/client)
  useEffect(() => {
    const saved = localStorage.getItem('remembered-email')
    if (saved) setValue('email', saved)
  }, [setValue])

  async function onSubmit(data: LoginForm) {
    try {
      const response = await api.post('/auth/login', data)
      const { user, accessToken } = response.data.data
      setUser(user, accessToken)
      if (rememberMe) localStorage.setItem('remembered-email', data.email)
      else localStorage.removeItem('remembered-email')
      const roleName = user.role?.name ?? ''
      const redirectMap: Record<string, string> = {
        cuisinier: '/kds',
        caissier: '/pos',
        serveur: '/orders',
      }
      router.push(redirectMap[roleName] ?? '/dashboard')
      toast.success(`Bienvenue, ${user.firstName} !`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur de connexion')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FF4D00 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #FFB800 0%, transparent 70%)' }} />
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <div className="glass-card p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-block mb-4"
            >
              <img src="/logo.svg" alt="Sakafio" className="w-24 h-24 drop-shadow-2xl" />
            </motion.div>
            <h1 className="text-3xl font-bold font-display mb-1">
              <span className="gradient-text">Sakafio</span>
            </h1>
            <p className="text-brand-muted text-sm">Logiciel pour votre restaurant et bar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Adresse email
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="vous@restaurant.com"
                className="input-field"
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-brand-border bg-brand-darker accent-brand-orange" />
                <span className="text-brand-muted">Se souvenir de moi</span>
              </label>
              <a href="#" className="text-brand-orange hover:text-brand-gold transition-colors">
                Mot de passe oublié ?
              </a>
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
