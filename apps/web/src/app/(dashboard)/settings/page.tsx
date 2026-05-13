'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Settings, Building2, Clock, Truck, Save } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get('/restaurants/me').then(r => r.data.data),
  })

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    values: restaurant || {},
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/restaurants/me', data),
    onSuccess: () => toast.success('Paramètres sauvegardés'),
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-brand-muted text-sm">Configuration du restaurant</p>
      </div>

      <form onSubmit={handleSubmit(data => updateMutation.mutate(data))} className="space-y-6">
        {/* Informations générales */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="font-semibold">Informations générales</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Nom du restaurant</label>
              <input {...register('name')} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea {...register('description')} rows={3} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input {...register('email')} type="email" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Téléphone</label>
              <input {...register('phone')} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Adresse</label>
              <input {...register('address')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ville</label>
              <input {...register('city')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Code postal</label>
              <input {...register('postalCode')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">SIRET</label>
              <input {...register('siret')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">N° TVA</label>
              <input {...register('vatNumber')} className="input-field" />
            </div>
          </div>
        </div>

        {/* Delivery & Service */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Truck className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="font-semibold">Modes de service</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { field: 'dineInEnabled', label: 'Sur place' },
              { field: 'pickupEnabled', label: 'Click & Collect' },
              { field: 'deliveryEnabled', label: 'Livraison' },
            ].map(({ field, label }) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer">
                <input {...register(field as any)} type="checkbox"
                  className="w-4 h-4 rounded border-brand-border bg-brand-darker text-brand-orange" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
            <div>
              <label className="block text-sm font-medium mb-2">Frais de livraison (€)</label>
              <input {...register('deliveryFee', { valueAsNumber: true })} type="number" step="0.5" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Commande min. (€)</label>
              <input {...register('minOrderAmount', { valueAsNumber: true })} type="number" step="1" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Temps de préparation (min)</label>
              <input {...register('estimatedPrepTime', { valueAsNumber: true })} type="number" className="input-field" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={updateMutation.isPending}
            className="btn-primary flex items-center gap-2 px-6 py-3">
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  )
}
