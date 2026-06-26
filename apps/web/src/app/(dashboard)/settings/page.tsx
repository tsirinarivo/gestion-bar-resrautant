'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Building2, Clock, Truck, Save, Globe, Image, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const DAYS = [
  { key: 'monday',    label: 'Lundi' },
  { key: 'tuesday',   label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday',  label: 'Jeudi' },
  { key: 'friday',    label: 'Vendredi' },
  { key: 'saturday',  label: 'Samedi' },
  { key: 'sunday',    label: 'Dimanche' },
]

export default function SettingsPage() {
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get('/restaurants/me').then(r => r.data.data),
  })

  const { register, handleSubmit, watch, setValue, formState: { isDirty } } = useForm({
    values: restaurant || {},
  })

  const openingHours = watch('openingHours') ?? {} as Record<string, { open: boolean; start: string; end: string }>

  function toggleDay(day: string) {
    const current = openingHours[day] ?? { open: false, start: '09:00', end: '22:00' }
    setValue('openingHours', { ...openingHours, [day]: { ...current, open: !current.open } }, { shouldDirty: true })
  }
  function updateHour(day: string, field: 'start' | 'end', val: string) {
    const current = openingHours[day] ?? { open: true, start: '09:00', end: '22:00' }
    setValue('openingHours', { ...openingHours, [day]: { ...current, [field]: val } }, { shouldDirty: true })
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/restaurants/me', data),
    onSuccess: () => toast.success('Paramètres sauvegardés'),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur lors de la sauvegarde'),
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
            <div>
              <label className="block text-sm font-medium mb-2">Site web</label>
              <input {...register('website')} type="url" placeholder="https://monrestaurant.mg" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Logo (URL)</label>
              <input {...register('logo')} placeholder="https://..." className="input-field" />
            </div>
          </div>
        </div>

        {/* Opening hours */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="font-semibold">Horaires d'ouverture</h2>
          </div>
          <div className="space-y-3">
            {DAYS.map(({ key, label }) => {
              const day = openingHours[key as keyof typeof openingHours] as any ?? { open: false, start: '09:00', end: '22:00' }
              return (
                <div key={key} className="flex items-center gap-4">
                  <label className="flex items-center gap-2 w-32 cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={day.open ?? false} onChange={() => toggleDay(key)}
                      className="w-4 h-4 accent-brand-orange" />
                    <span className="text-sm">{label}</span>
                  </label>
                  {day.open ? (
                    <div className="flex items-center gap-2 text-sm">
                      <input type="time" value={day.start ?? '09:00'} onChange={e => updateHour(key, 'start', e.target.value)}
                        className="input-field w-32 py-1" />
                      <span className="text-brand-muted">→</span>
                      <input type="time" value={day.end ?? '22:00'} onChange={e => updateHour(key, 'end', e.target.value)}
                        className="input-field w-32 py-1" />
                    </div>
                  ) : (
                    <span className="text-sm text-brand-muted italic">Fermé</span>
                  )}
                </div>
              )
            })}
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
              <label className="block text-sm font-medium mb-2">Frais de livraison (Ar)</label>
              <input {...register('deliveryFee', { valueAsNumber: true })} type="number" step="0.5" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Commande min. (Ar)</label>
              <input {...register('minOrderAmount', { valueAsNumber: true })} type="number" step="1" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Temps de préparation (min)</label>
              <input {...register('estimatedPrepTime', { valueAsNumber: true })} type="number" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">
                Objectif CA mensuel (Ar)
                <span className="text-xs text-brand-muted ml-2">— affiché sur le dashboard</span>
              </label>
              <input {...register('monthlyRevenueTarget', { valueAsNumber: true, setValueAs: (v: any) => v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v) })}
                type="number" step="1000" min="0" placeholder="Ex : 5000000" className="input-field" />
            </div>
          </div>
        </div>

        {/* Stock / Vente */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="font-semibold">Stock &amp; Vente</h2>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input {...register('allowNegativeStock')} type="checkbox"
              className="mt-1 w-4 h-4 rounded accent-brand-orange" />
            <div>
              <p className="text-sm font-medium">Autoriser la vente à stock épuisé</p>
              <p className="text-xs text-brand-muted mt-0.5">
                Le POS accepte de vendre un produit même si son stock est à zéro. Le stock
                devient négatif et se régularise automatiquement au prochain réapprovisionnement.
              </p>
            </div>
          </label>
        </div>

        {/* Facture */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-orange" />
            </div>
            <h2 className="font-semibold">En-tête facture &amp; ticket</h2>
          </div>
          <p className="text-xs text-brand-muted mb-4">
            Apparaît en haut/bas des <strong>factures imprimées</strong> ET des <strong>tickets de caisse</strong>,
            sous les coordonnées du restaurant (nom, adresse, contact issus des Informations générales).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">En-tête (mentions légales, NIF/STAT…)</label>
              <textarea {...register('invoiceHeader')} rows={2}
                placeholder="Ex : NIF 1234567890 — STAT 11 2024 0 12345" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Pied de page</label>
              <textarea {...register('invoiceFooter')} rows={2}
                placeholder="Ex : Merci de votre visite ! — Arrêté à la somme de…" className="input-field" />
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
