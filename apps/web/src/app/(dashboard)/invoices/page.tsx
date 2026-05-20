'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, X, Check, Send, Download, Search,
  ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@restaurant/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  totalHT: number
  totalTTC: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate?: string | null
  totalHT: number
  totalTax: number
  totalTTC: number
  status: InvoiceStatus
  notes?: string | null
  items: InvoiceItem[]
  payment?: {
    id: string
    amount: number
    method: string
    order: {
      id: string
      orderNumber: string
      customer?: { firstName: string; lastName: string; email?: string } | null
    }
  } | null
}

interface Stats {
  total: number
  paid: number
  sent: number
  draft: number
  monthAmount: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
}

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: 'text-brand-muted border-brand-border bg-brand-surface',
  SENT: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  PAID: 'text-green-400 border-green-400/30 bg-green-400/10',
  CANCELLED: 'text-red-400 border-red-400/30 bg-red-400/10',
}

// ─── Generate Invoice Modal ───────────────────────────────────────────────────

function GenerateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [paymentId, setPaymentId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchOrder, setSearchOrder] = useState('')

  const { data: payments } = useQuery({
    queryKey: ['payments-for-invoice', searchOrder],
    queryFn: () =>
      api.get(`/orders?status=COMPLETED&limit=50${searchOrder ? `&search=${searchOrder}` : ''}`).then(r => r.data.data.orders),
    enabled: true,
  })

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentId) { toast.error('Sélectionnez un paiement'); return }
    setLoading(true)
    try {
      await api.post('/invoices', { paymentId, notes: notes || undefined })
      toast.success('Facture générée avec succès')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-orange" />
            Générer une facture
          </h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Rechercher une commande</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input
                type="text"
                placeholder="Numéro de commande..."
                value={searchOrder}
                onChange={e => setSearchOrder(e.target.value)}
                className="input-field w-full pl-9"
              />
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div>
              <label className="block text-xs text-brand-muted mb-1">Sélectionner la commande</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {payments.map((order: any) =>
                  order.payments?.map((payment: any) => (
                    <button
                      key={payment.id}
                      type="button"
                      onClick={() => setPaymentId(payment.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        paymentId === payment.id
                          ? 'border-brand-orange bg-brand-orange/10 text-brand-orange'
                          : 'border-brand-border hover:border-brand-orange/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">#{order.orderNumber}</span>
                        <span className="text-sm font-bold">{formatCurrency(payment.amount)}</span>
                      </div>
                      <div className="text-xs text-brand-muted mt-0.5">
                        {payment.method} · {formatDate(order.createdAt)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {payments && payments.length === 0 && (
            <p className="text-sm text-brand-muted py-4 text-center">
              Aucune commande complétée trouvée
            </p>
          )}

          <div>
            <label className="block text-xs text-brand-muted mb-1">Notes (optionnel)</label>
            <textarea
              rows={2}
              placeholder="Notes additionnelles sur la facture..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field w-full resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading || !paymentId} className="btn-primary flex-1">
              {loading ? 'Génération...' : 'Générer la facture'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Invoice Detail Row ───────────────────────────────────────────────────────

function InvoiceRow({ invoice, onStatusChange, onDelete }: {
  invoice: Invoice
  onStatusChange: (id: string, status: InvoiceStatus) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-brand-border hover:bg-brand-surface/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-brand-muted" /> : <ChevronRight className="w-4 h-4 text-brand-muted" />}
            <span className="font-mono text-sm font-semibold text-brand-orange">{invoice.invoiceNumber}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-brand-muted">{formatDate(invoice.issueDate)}</td>
        <td className="px-4 py-3 text-sm">
          {invoice.payment?.order?.customer
            ? `${invoice.payment.order.customer.firstName} ${invoice.payment.order.customer.lastName}`
            : invoice.payment?.order?.orderNumber ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm">{formatCurrency(invoice.totalHT)}</td>
        <td className="px-4 py-3 text-sm text-brand-muted">{formatCurrency(invoice.totalTax)}</td>
        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(invoice.totalTTC)}</td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLOR[invoice.status]}`}>
            {STATUS_LABEL[invoice.status]}
          </span>
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {invoice.status === 'DRAFT' && (
              <>
                <button
                  onClick={() => onStatusChange(invoice.id, 'SENT')}
                  className="p-1.5 text-brand-muted hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                  title="Marquer comme envoyée"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(invoice.id)}
                  className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {invoice.status === 'SENT' && (
              <button
                onClick={() => onStatusChange(invoice.id, 'PAID')}
                className="p-1.5 text-brand-muted hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                title="Marquer comme payée"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-brand-surface/30">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-2">
              <p className="text-xs text-brand-muted font-semibold uppercase tracking-wide mb-3">Détail des articles</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-brand-muted">
                    <th className="text-left pb-2">Description</th>
                    <th className="text-right pb-2">Qté</th>
                    <th className="text-right pb-2">PU HT</th>
                    <th className="text-right pb-2">TVA</th>
                    <th className="text-right pb-2">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id} className="border-t border-brand-border">
                      <td className="py-1.5">{item.description}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-1.5 text-right">{item.taxRate}%</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency(item.totalTTC)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-brand-border">
                  <tr className="font-semibold">
                    <td colSpan={4} className="pt-2 text-right text-brand-muted text-xs">Total HT</td>
                    <td className="pt-2 text-right">{formatCurrency(invoice.totalHT)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right text-brand-muted text-xs">TVA</td>
                    <td className="text-right">{formatCurrency(invoice.totalTax)}</td>
                  </tr>
                  <tr className="text-brand-orange">
                    <td colSpan={4} className="text-right font-bold">Total TTC</td>
                    <td className="text-right font-bold">{formatCurrency(invoice.totalTTC)}</td>
                  </tr>
                </tfoot>
              </table>
              {invoice.notes && (
                <p className="text-xs text-brand-muted mt-2 italic">{invoice.notes}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: stats } = useQuery<Stats>({
    queryKey: ['invoice-stats'],
    queryFn: () => api.get('/invoices/stats').then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      return api.get(`/invoices?${params}`).then(r => r.data.data)
    },
    refetchInterval: 60_000,
  })

  const invoices = data ?? []

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      api.patch(`/invoices/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
      toast.success('Statut mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const deleteInvoice = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-stats'] })
      toast.success('Facture supprimée')
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function exportCSV() {
    const rows: (string | number)[][] = [
      ['Numéro', 'Date', 'Client', 'Commande', 'Total HT', 'TVA', 'Total TTC', 'Statut'],
      ...invoices.map(i => [
        i.invoiceNumber,
        formatDate(i.issueDate),
        i.payment?.order?.customer
          ? `${i.payment.order.customer.firstName} ${i.payment.order.customer.lastName}`
          : '—',
        i.payment?.order?.orderNumber ?? '—',
        i.totalHT,
        i.totalTax,
        i.totalTTC,
        STATUS_LABEL[i.status],
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STATUS_FILTERS = [
    { value: '', label: 'Toutes' },
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'SENT', label: 'Envoyées' },
    { value: 'PAID', label: 'Payées' },
    { value: 'CANCELLED', label: 'Annulées' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Factures</h1>
          <p className="text-brand-muted text-sm">{invoices.length} facture(s)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle facture
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Payées', value: stats.paid, color: 'text-green-400' },
            { label: 'Envoyées', value: stats.sent, color: 'text-blue-400' },
            { label: 'Brouillons', value: stats.draft, color: 'text-brand-muted' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4">
              <p className="text-xs text-brand-muted">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      {stats && stats.monthAmount > 0 && (
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-muted">CA facturé ce mois</p>
            <p className="text-xl font-bold text-brand-orange mt-1">{formatCurrency(stats.monthAmount)}</p>
          </div>
          <FileText className="w-8 h-8 text-brand-orange/30" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input
            type="text"
            placeholder="Rechercher par numéro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 w-full"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                statusFilter === f.value
                  ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange'
                  : 'border-brand-border text-brand-muted hover:border-brand-orange/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-brand-border">
              <tr className="text-xs text-brand-muted uppercase tracking-wide">
                <th className="text-left px-4 py-3">N° Facture</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Total HT</th>
                <th className="text-left px-4 py-3">TVA</th>
                <th className="text-left px-4 py-3">Total TTC</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-brand-border">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-20 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <FileText className="w-10 h-10 text-brand-muted mx-auto mb-3" />
                    <p className="text-brand-muted text-sm">Aucune facture trouvée</p>
                    <button
                      onClick={() => setShowGenerate(true)}
                      className="btn-primary mt-4 text-sm"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Générer une facture
                    </button>
                  </td>
                </tr>
              ) : (
                invoices.map(invoice => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                    onDelete={id => deleteInvoice.mutate(id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showGenerate && (
          <GenerateModal
            onClose={() => setShowGenerate(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['invoices'] })
              qc.invalidateQueries({ queryKey: ['invoice-stats'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
