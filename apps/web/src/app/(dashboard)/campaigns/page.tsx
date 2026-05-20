'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Plus, Send, Copy, Trash2, X, Mail, MessageSquare, Bell, Edit2, Users, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatRelative } from '@restaurant/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string
  name: string
  type: 'EMAIL' | 'SMS' | 'PUSH'
  subject: string | null
  content: string
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED'
  scheduledAt: string | null
  sentAt: string | null
  recipientCount: number
  openCount: number
  clickCount: number
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  EMAIL:  { label: 'Email',        icon: Mail,           color: 'text-blue-400 bg-blue-500/10' },
  SMS:    { label: 'SMS',          icon: MessageSquare,  color: 'text-green-400 bg-green-500/10' },
  PUSH:   { label: 'Notification', icon: Bell,           color: 'text-purple-400 bg-purple-500/10' },
}

const STATUS_CONFIG = {
  DRAFT:     { label: 'Brouillon',  color: 'text-brand-muted border-brand-muted/30 bg-white/5' },
  SCHEDULED: { label: 'Planifiée', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  SENDING:   { label: 'En cours',  color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  SENT:      { label: 'Envoyée',   color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  CANCELLED: { label: 'Annulée',   color: 'text-red-400 border-red-500/30 bg-red-500/10' },
}

const EMPTY_FORM = { name: '', type: 'EMAIL' as Campaign['type'], subject: '', content: '', scheduledAt: '' }

// ─── Campaign Modal ───────────────────────────────────────────────────────────

function CampaignModal({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:        campaign?.name ?? '',
    type:        campaign?.type ?? 'EMAIL' as Campaign['type'],
    subject:     campaign?.subject ?? '',
    content:     campaign?.content ?? '',
    scheduledAt: campaign?.scheduledAt ? campaign.scheduledAt.slice(0, 16) : '',
  })

  const save = useMutation({
    mutationFn: (data: typeof form) => campaign
      ? api.put(`/campaigns/${campaign.id}`, data)
      : api.post('/campaigns', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(campaign ? 'Campagne mise à jour' : 'Campagne créée')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  const TypeIcon = TYPE_CONFIG[form.type].icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-brand-card border border-brand-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">{campaign ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className="block text-xs text-brand-muted mb-1">Nom de la campagne *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="ex: Promotion été 2026" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-brand-muted mb-1">Canal *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_CONFIG) as Campaign['type'][]).map(t => {
                const conf = TYPE_CONFIG[t]
                const Icon = conf.icon
                return (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${form.type === t ? `${conf.color} border-current` : 'border-brand-border text-brand-muted hover:border-brand-orange/30'}`}>
                    <Icon className="w-4 h-4" />
                    {conf.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subject (email only) */}
          {form.type === 'EMAIL' && (
            <div>
              <label className="block text-xs text-brand-muted mb-1">Objet</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="input-field w-full" placeholder="ex: 🎉 Offre exclusive — 20% de réduction" />
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-xs text-brand-muted mb-1">Contenu *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={5} className="input-field w-full resize-none"
              placeholder={form.type === 'SMS' ? 'Message SMS (160 caractères max)...' : 'Contenu de la campagne...'} />
            {form.type === 'SMS' && (
              <p className={`text-[10px] mt-1 ${form.content.length > 160 ? 'text-red-400' : 'text-brand-muted'}`}>
                {form.content.length}/160 caractères
              </p>
            )}
          </div>

          {/* Scheduled date */}
          <div>
            <label className="block text-xs text-brand-muted mb-1">Planifier l'envoi (optionnel)</label>
            <input type="datetime-local" value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              className="input-field w-full"
              min={new Date().toISOString().slice(0, 16)} />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-brand-border">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-brand-border hover:border-brand-orange/30 transition-colors">
            Annuler
          </button>
          <button onClick={() => save.mutate(form)} disabled={!form.name || !form.content || save.isPending}
            className="flex-1 btn-primary text-sm disabled:opacity-50">
            {save.isPending ? 'Enregistrement...' : campaign ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onEdit }: { campaign: Campaign; onEdit: () => void }) {
  const qc = useQueryClient()
  const typeConf = TYPE_CONFIG[campaign.type]
  const statusConf = STATUS_CONFIG[campaign.status]
  const TypeIcon = typeConf.icon

  const send = useMutation({
    mutationFn: () => api.post(`/campaigns/${campaign.id}/send`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(`Campagne envoyée à ${r.data.recipientCount} destinataire(s)`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  const duplicate = useMutation({
    mutationFn: () => api.post(`/campaigns/${campaign.id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campagne dupliquée') },
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/campaigns/${campaign.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campagne supprimée') },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  const isSent = campaign.status === 'SENT'

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConf.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold truncate">{campaign.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-medium ${statusConf.color}`}>
              {statusConf.label}
            </span>
          </div>
          {campaign.subject && (
            <p className="text-xs text-brand-muted truncate mt-0.5">📧 {campaign.subject}</p>
          )}
          <p className="text-xs text-brand-muted mt-0.5">{formatRelative(campaign.createdAt)}</p>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-sm text-brand-muted/80 line-clamp-2 text-xs">{campaign.content}</p>

      {/* Stats (for sent campaigns) */}
      {isSent && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-sm font-bold text-brand-orange">{campaign.recipientCount}</p>
            <p className="text-[10px] text-brand-muted">Envoyés</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-sm font-bold text-blue-400">{campaign.openCount}</p>
            <p className="text-[10px] text-brand-muted">Ouverts</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-sm font-bold text-green-400">{campaign.clickCount}</p>
            <p className="text-[10px] text-brand-muted">Clics</p>
          </div>
        </div>
      )}

      {/* Scheduled date */}
      {campaign.scheduledAt && !isSent && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          🕐 Planifiée : {new Date(campaign.scheduledAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-brand-border pt-3">
        {!isSent && (
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-brand-border hover:border-brand-orange/40 hover:text-brand-orange transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Modifier
          </button>
        )}
        {!isSent && campaign.status !== 'SENDING' && (
          <button onClick={() => { if (confirm(`Envoyer la campagne "${campaign.name}" maintenant ?`)) send.mutate() }}
            disabled={send.isPending}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition-colors disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </button>
        )}
        <button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}
          className="w-8 flex items-center justify-center rounded-lg border border-brand-border hover:border-blue-500/40 hover:text-blue-400 transition-colors"
          title="Dupliquer">
          <Copy className="w-3.5 h-3.5" />
        </button>
        {campaign.status !== 'SENT' && (
          <button onClick={() => { if (confirm(`Supprimer la campagne "${campaign.name}" ?`)) remove.mutate() }}
            className="w-8 flex items-center justify-center rounded-lg border border-brand-border hover:border-red-500/40 hover:text-red-400 transition-colors"
            title="Supprimer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [filter, setFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editCampaign, setEditCampaign] = useState<Campaign | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', filter],
    queryFn: () => api.get(`/campaigns${filter !== 'all' ? `?status=${filter}` : ''}`).then(r => r.data),
    staleTime: 30_000,
  })

  const campaigns: Campaign[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0

  const stats = {
    total,
    sent: campaigns.filter(c => c.status === 'SENT').length,
    scheduled: campaigns.filter(c => c.status === 'SCHEDULED').length,
    draft: campaigns.filter(c => c.status === 'DRAFT').length,
    totalRecipients: campaigns.filter(c => c.status === 'SENT').reduce((s, c) => s + c.recipientCount, 0),
  }

  const FILTERS = [
    { value: 'all', label: 'Toutes' },
    { value: 'DRAFT', label: 'Brouillons' },
    { value: 'SCHEDULED', label: 'Planifiées' },
    { value: 'SENT', label: 'Envoyées' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campagnes marketing</h1>
          <p className="text-brand-muted text-sm">{total} campagne{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditCampaign(undefined); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle campagne
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Megaphone, color: 'text-brand-orange' },
          { label: 'Envoyées', value: stats.sent, icon: Check, color: 'text-green-400' },
          { label: 'Planifiées', value: stats.scheduled, icon: Send, color: 'text-amber-400' },
          { label: 'Destinataires', value: stats.totalRecipients, icon: Users, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4 flex items-center gap-3">
            <stat.icon className={`w-5 h-5 flex-shrink-0 ${stat.color}`} />
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-brand-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === f.value ? 'bg-brand-orange text-white' : 'bg-white/5 text-brand-muted hover:bg-white/10'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-brand-muted">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold">Aucune campagne</p>
          <p className="text-sm mt-1">Créez votre première campagne email, SMS ou notification</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} onEdit={() => { setEditCampaign(c); setModalOpen(true) }} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Modal */}
      {modalOpen && (
        <CampaignModal campaign={editCampaign} onClose={() => { setModalOpen(false); setEditCampaign(undefined) }} />
      )}
    </div>
  )
}
