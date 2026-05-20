'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Save, Key, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', avatar: '', phone: '' })
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)

  useEffect(() => {
    if (user) setProfile({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      avatar: (user as any).avatar ?? '',
      phone: (user as any).phone ?? '',
    })
  }, [user])

  const saveProfile = useMutation({
    mutationFn: () => api.put('/auth/me', {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      avatar: profile.avatar || null,
      phone: profile.phone || null,
    }),
    onSuccess: (r) => {
      updateUser(r.data.data)
      toast.success('Profil mis à jour')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.put('/auth/password', { currentPassword: passwords.current, newPassword: passwords.next }),
    onSuccess: () => {
      setPasswords({ current: '', next: '', confirm: '' })
      toast.success('Mot de passe modifié. Reconnectez-vous.')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (passwords.next.length < 8) { toast.error('Min. 8 caractères'); return }
    if (passwords.next !== passwords.confirm) { toast.error('Les mots de passe ne correspondent pas'); return }
    changePassword.mutate()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-brand-muted text-sm">Gérez vos informations et votre mot de passe</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={e => { e.preventDefault(); saveProfile.mutate() }}
        className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center">
            <User className="w-4 h-4 text-brand-orange" />
          </div>
          <h2 className="font-semibold">Informations personnelles</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Prénom</label>
            <input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Nom</label>
            <input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Email</label>
          <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Téléphone</label>
          <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Avatar (URL)</label>
          <input value={profile.avatar} onChange={e => setProfile(p => ({ ...p, avatar: e.target.value }))} className="input-field" placeholder="https://..." />
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saveProfile.isPending} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> {saveProfile.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </motion.form>

      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={submitPassword} className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="font-semibold">Changer le mot de passe</h2>
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Mot de passe actuel</label>
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} value={passwords.current}
              onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
              required className="input-field pr-10" />
            <button type="button" onClick={() => setShowCurrent(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} value={passwords.next}
                onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
                required minLength={8} className="input-field pr-10" />
              <button type="button" onClick={() => setShowNext(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Confirmation</label>
            <input type={showNext ? 'text' : 'password'} value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              required minLength={8} className="input-field" />
          </div>
        </div>
        <p className="text-xs text-brand-muted">Min. 8 caractères. Vous serez déconnecté de toutes vos sessions après modification.</p>
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={changePassword.isPending} className="btn-primary flex items-center gap-2">
            <Key className="w-4 h-4" /> {changePassword.isPending ? 'Modification...' : 'Modifier'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}
