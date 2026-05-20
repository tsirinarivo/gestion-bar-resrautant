'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, TrendingUp, ShoppingCart, Banknote, CreditCard,
  AlertTriangle, ChefHat, Printer, RefreshCw, ArrowUpRight, ArrowDownRight, FileText, Download,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { formatCurrency } from '@restaurant/utils'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', CARD: 'Carte', STRIPE: 'Stripe',
  PAYPAL: 'PayPal', VOUCHER: 'Bon', WALLET: 'Wallet',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function KpiCard({ label, value, sub, icon: Icon, color = '#FF6B00', trend }: any) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-brand-muted">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {formatCurrency(Math.abs(trend))} de marge
        </p>
      )}
    </div>
  )
}

export default function RapportPage() {
  const [date, setDate] = useState(todayStr())

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['rapport-journalier', date],
    queryFn: () => api.get(`/finances/rapport-journalier?date=${date}`).then(r => r.data.data),
  })

  async function handlePrint() {
    if (!data) return
    try {
      await api.post(`/finances/rapport-journalier/print?date=${date}`)
      toast.success('Rapport envoyé à l\'imprimante')
    } catch {
      toast.error('Imprimante non disponible')
    }
  }

  const orders = data?.orders
  const caisse = data?.caisse
  const byMethod = data?.byPaymentMethod ?? {}
  const topProducts = data?.topProducts ?? []
  const expenses = data?.expenses ?? { total: 0, items: [] }

  function exportCSV() {
    const rows: (string | number)[][] = []
    rows.push([`Rapport journalier — ${date}`])
    rows.push([])
    rows.push(['--- Synthèse ---'])
    rows.push(['CA total', orders?.totalRevenue ?? 0])
    rows.push(['Commandes', orders?.count ?? 0])
    rows.push(['Coût marchandises (COGS)', orders?.totalCOGS ?? 0])
    rows.push(['Marge brute', orders?.grossMargin ?? 0])
    rows.push(['TVA collectée', orders?.totalTax ?? 0])
    rows.push(['Pourboires', orders?.totalTip ?? 0])
    rows.push(['Remises', orders?.totalDiscount ?? 0])
    rows.push(['Marge nette', orders?.netMargin ?? 0])
    rows.push([])
    rows.push(['--- Paiements par méthode ---'])
    Object.entries(byMethod).forEach(([m, amt]) => rows.push([m, amt as number]))
    rows.push([])
    rows.push(['--- Top produits ---'])
    rows.push(['Produit', 'Quantité', 'CA'])
    topProducts.forEach((p: any) => rows.push([p.name, p.quantity ?? 0, p.revenue ?? 0]))
    if (expenses.items?.length) {
      rows.push([])
      rows.push(['--- Dépenses ---'])
      rows.push(['Catégorie', 'Description', 'Montant'])
      expenses.items.forEach((e: any) => rows.push([e.category ?? '', e.description ?? '', e.amount ?? 0]))
      rows.push(['Total dépenses', '', expenses.total ?? 0])
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `rapport-${date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rapport journalier</h1>
          <p className="text-brand-muted text-sm mt-1">Résumé complet de la journée</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-card border border-brand-border text-sm hover:border-brand-orange transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-card border border-brand-border text-sm hover:border-brand-orange transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => window.open(`/rapport-print?date=${date}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-card border border-brand-border text-sm hover:border-brand-orange transition-colors"
          >
            <FileText className="w-4 h-4" />
            Format A4
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-orange text-white text-sm hover:bg-orange-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Ticket
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-brand-muted">Aucune donnée pour cette date</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Chiffre d'affaires" value={formatCurrency(orders?.totalRevenue ?? 0)} sub={`${orders?.count ?? 0} commande(s)`} icon={TrendingUp} color="#10B981" trend={orders?.netMargin} />
            <KpiCard label="Marge brute" value={formatCurrency(orders?.grossMargin ?? 0)} sub={`COGS: ${formatCurrency(orders?.totalCOGS ?? 0)}`} icon={ArrowUpRight} color="#3B82F6" />
            <KpiCard label="Dépenses" value={formatCurrency(expenses.total)} sub={`${expenses.items?.length ?? 0} charge(s)`} icon={ArrowDownRight} color="#EF4444" />
            <KpiCard label="Pourboires" value={formatCurrency(orders?.totalTip ?? 0)} sub={`Remises: ${formatCurrency(orders?.totalDiscount ?? 0)}`} icon={Banknote} color="#F59E0B" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Paiements par mode */}
            <div className="bg-brand-card border border-brand-border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-orange" />
                Paiements par mode
              </h2>
              {Object.keys(byMethod).length === 0 ? (
                <p className="text-brand-muted text-sm">Aucun paiement</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(byMethod).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center">
                      <span className="text-sm text-brand-muted">{METHOD_LABELS[method] ?? method}</span>
                      <span className="font-semibold text-sm">{formatCurrency(amount as number)}</span>
                    </div>
                  ))}
                  <div className="border-t border-brand-border pt-3 flex justify-between">
                    <span className="text-sm font-medium">Total encaissé</span>
                    <span className="font-bold text-brand-orange">
                      {formatCurrency(Object.values(byMethod).reduce((s: number, v) => s + (v as number), 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Caisse du jour */}
            <div className="bg-brand-card border border-brand-border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-brand-orange" />
                Caisse
              </h2>
              {!caisse ? (
                <p className="text-brand-muted text-sm">Aucune session caisse ce jour</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Statut</span>
                    <span className={`font-medium ${caisse.status === 'OPEN' ? 'text-emerald-400' : 'text-brand-muted'}`}>
                      {caisse.status === 'OPEN' ? 'Ouverte' : 'Fermée'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Fond d'ouverture</span>
                    <span>{formatCurrency(caisse.openingFloat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Espèces attendues</span>
                    <span>{formatCurrency(caisse.expectedCash)}</span>
                  </div>
                  {caisse.closingFloat !== null && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-brand-muted">Fond de fermeture</span>
                        <span>{formatCurrency(caisse.closingFloat)}</span>
                      </div>
                      <div className="flex justify-between border-t border-brand-border pt-2">
                        <span className="font-medium">Écart</span>
                        <span className={`font-bold ${(caisse.difference ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {(caisse.difference ?? 0) >= 0 ? '+' : ''}{formatCurrency(caisse.difference ?? 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Alertes stock */}
            <div className="bg-brand-card border border-brand-border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-brand-orange" />
                Alertes & Info
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-brand-muted">Alertes stock</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${data.stockAlerts > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {data.stockAlerts > 0 ? `${data.stockAlerts} alerte(s)` : 'OK'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Taxes collectées</span>
                  <span>{formatCurrency(orders?.totalTax ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Marge nette</span>
                  <span className={`font-semibold ${(orders?.netMargin ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(orders?.netMargin ?? 0)}
                  </span>
                </div>
                <div className="border-t border-brand-border pt-2 flex justify-between">
                  <span className="text-brand-muted">Date</span>
                  <span className="flex items-center gap-1 text-brand-orange">
                    <Calendar className="w-3 h-3" />
                    {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top produits */}
          {topProducts.length > 0 && (
            <div className="bg-brand-card border border-brand-border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-brand-orange" />
                Top produits du jour
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-brand-muted border-b border-brand-border">
                      <th className="text-left py-2 font-medium">#</th>
                      <th className="text-left py-2 font-medium">Produit</th>
                      <th className="text-right py-2 font-medium">Qté vendue</th>
                      <th className="text-right py-2 font-medium">CA généré</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p: any, i: number) => (
                      <tr key={p.productId} className="border-b border-brand-border/50 hover:bg-white/5">
                        <td className="py-2.5 text-brand-muted">{i + 1}</td>
                        <td className="py-2.5 font-medium">{p.name}</td>
                        <td className="py-2.5 text-right">{p.quantity}</td>
                        <td className="py-2.5 text-right font-semibold text-brand-orange">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dépenses */}
          {expenses.items?.length > 0 && (
            <div className="bg-brand-card border border-brand-border rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-red-400" />
                Dépenses du jour
              </h2>
              <div className="space-y-2">
                {expenses.items.map((e: any) => (
                  <div key={e.id} className="flex justify-between items-center py-1.5 border-b border-brand-border/50 text-sm">
                    <span className="text-brand-muted">{e.category} {e.description ? `— ${e.description}` : ''}</span>
                    <span className="font-semibold text-red-400">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold">
                  <span>Total dépenses</span>
                  <span className="text-red-400">{formatCurrency(expenses.total)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
