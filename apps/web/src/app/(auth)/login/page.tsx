'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChefHat, Loader2 } from 'lucide-react'
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
  const router = useRouter()
  const { setUser } = useAuthStore()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    try {
      const response = await api.post('/auth/login', data)
      const { user, accessToken } = response.data.data
      setUser(user, accessToken)
      const roleName = (user.role as any)?.name ?? user.role ?? ''
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
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FF6B00 100%)' }}
            >
              <ChefHat className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold font-display mb-1">
              Restaurant<span className="gradient-text">OS</span>
            </h1>
            <p className="text-brand-muted text-sm">Connectez-vous à votre espace de gestion</p>
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
                <input type="checkbox" className="rounded border-brand-border bg-brand-darker" />
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

          {/* Demo credentials */}
          <div className="mt-6 p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/20">
            <p className="text-xs font-medium text-brand-orange mb-2">Accès démo</p>
            <div className="space-y-1 text-xs text-brand-muted">
              <div>Manager: <span className="text-white">manager@demo.com / demo1234</span></div>
              <div>Caissier: <span className="text-white">caissier@demo.com / demo1234</span></div>
              <div>Cuisinier: <span className="text-white">cuisinier@demo.com / demo1234</span></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
