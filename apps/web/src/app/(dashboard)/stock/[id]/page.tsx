'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Package, AlertTriangle, TrendingDown, TrendingUp, Calendar, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { formatQuantity, formatCurrency, formatDateTime } from '@restaurant/utils'

const MOVEMENT_COLORS: Record<string, string> = {
  IN:         'text-green-400 bg-green-500/10',
  OUT:        'text-red-400 bg-red-500/10',
  ADJUSTMENT: 'text-blue-400 bg-blue-500/10',
  LOSS:       'text-amber-400 bg-amber-500/10',
  TRANSFER:   'text-purple-400 bg-purple-500/10',
}
const MOVEMENT_LABELS: Record<string, string> = {
  IN: 'Entrée', OUT: 'Sortie', ADJUSTMENT: 'Ajustement', LOSS: 'Perte', TRANSFER: 'Transfert',
}

export default function StockItemPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()

  const { data: item, isLoading } = useQuery({
    queryKey: ['stock-item', id],
    queryFn: () => api.get(`/stock/${id}`).then(r => r.data.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-20 text-brand-muted">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>Article introuvable</p>
        <button onClick={() => router.back()} className="mt-4 btn-secondary text-sm">Retour</button>
      </div>
    )
  }

  const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date()
  const expiresSoon = item.expiryDate && !isExpired && (new Date(item.expiryDate).getTime() - Date.now()) < 7 * 86_400_000

  const inMovements = (item.movements ?? []).filter((m: any) => m.type === 'IN').reduce((s: number, m: any) => s + m.quantity, 0)
  const outMovements = (item.movements ?? []).filter((m: any) => ['OUT', 'LOSS'].includes(m.type)).reduce((s: number, m: any) => s + m.quantity, 0)

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-brand-muted hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Retour au stock
      </button>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
            <Package className="w-7 h-7 text-brand-orange" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{item.name}</h1>
                {item.description && <p className="text-brand-muted text-sm mt-0.5">{item.description}</p>}
              </div>
              {item.isPerishable && (
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${isExpired ? 'text-red-400 border-red-500/30 bg-red-500/10' : expiresSoon ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                  {isExpired ? '⚠️ Expiré' : expiresSoon ? '⏰ Expire bientôt' : '✓ Frais'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-brand-muted">
              {item.sku && <span>SKU: <span className="font-mono text-white">{item.sku}</span></span>}
              {item.barcode && <span>Code-barres: <span className="font-mono text-white">{item.barcode}</span></span>}
              {item.location && <span>📍 {item.location}</span>}
              {item.warehouse?.name && <span>🏭 {item.warehouse.name}</span>}
              {item.expiryDate && <span>📅 Expire: {new Date(item.expiryDate).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Stock actuel',
            value: formatQuantity(item.currentQuantity, item.unit),
            sub: `Min: ${item.minQuantity} ${item.unit}`,
            color: item.currentQuantity <= 0 ? 'text-red-400' : item.currentQuantity <= item.minQuantity ? 'text-amber-400' : 'text-green-400',
            icon: Package,
          },
          {
            label: 'Valeur stock',
            value: formatCurrency(item.currentQuantity * item.costPerUnit),
            sub: `${formatCurrency(item.costPerUnit)} / ${item.unit}`,
            color: 'text-brand-orange',
            icon: Layers,
          },
          {
            label: 'Entrées (20 mvts)',
            value: formatQuantity(inMovements, item.unit),
            sub: '+',
            color: 'text-green-400',
            icon: TrendingUp,
          },
          {
            label: 'Sorties (20 mvts)',
            value: formatQuantity(outMovements, item.unit),
            sub: '−',
            color: 'text-red-400',
            icon: TrendingDown,
          },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card p-4 flex items-center gap-3">
            <kpi.icon className={`w-5 h-5 flex-shrink-0 ${kpi.color}`} />
            <div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-brand-muted">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {item.levels?.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-orange" />
            Répartition par entrepôt
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {item.levels.map((lv: any) => (
              <div key={lv.id} className="rounded-xl border border-brand-border p-3">
                <p className="text-xs text-brand-muted truncate">🏭 {lv.warehouse?.name}</p>
                <p className={`text-lg font-bold ${lv.quantity <= 0 ? 'text-red-400' : 'text-white'}`}>
                  {formatQuantity(lv.quantity, item.unit)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movements */}
        <div className="glass-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-brand-orange" />
            Derniers mouvements
          </h2>
          {!item.movements?.length ? (
            <p className="text-sm text-brand-muted text-center py-6">Aucun mouvement enregistré</p>
          ) : (
            <div className="space-y-2">
              {item.movements.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${MOVEMENT_COLORS[m.type] ?? 'text-brand-muted bg-white/5'}`}>
                    {MOVEMENT_LABELS[m.type] ?? m.type}
                  </span>
                  <span className="font-medium">
                    {m.type === 'IN' ? '+' : m.type === 'ADJUSTMENT' ? '→' : '−'}{formatQuantity(m.quantity, item.unit)}
                  </span>
                  {m.notes && <span className="text-brand-muted text-xs truncate">{m.notes}</span>}
                  <span className="ml-auto text-xs text-brand-muted flex-shrink-0">
                    {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Batches (FIFO) */}
        <div className="glass-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-orange" />
            Lots FIFO
          </h2>
          {!item.stockBatches?.length ? (
            <p className="text-sm text-brand-muted text-center py-6">Aucun lot. Les lots sont créés lors des entrées de stock sur les articles périssables.</p>
          ) : (
            <div className="space-y-2">
              {item.stockBatches.map((b: any, i: number) => {
                const batchExpired = b.expiryDate && new Date(b.expiryDate) < new Date()
                const batchSoon = b.expiryDate && !batchExpired && (new Date(b.expiryDate).getTime() - Date.now()) < 7 * 86_400_000
                return (
                  <div key={b.id} className={`p-3 rounded-xl border flex items-center gap-3 text-sm ${batchExpired ? 'border-red-500/30 bg-red-500/5' : batchSoon ? 'border-amber-500/30 bg-amber-500/5' : 'border-brand-border'}`}>
                    <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-brand-muted flex-shrink-0">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium">{formatQuantity(b.remainingQty, item.unit)} <span className="text-brand-muted text-xs">/ {formatQuantity(b.quantity, item.unit)}</span></p>
                      <p className="text-xs text-brand-muted">Reçu le {new Date(b.receivedAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {b.expiryDate && (
                      <span className={`text-xs font-medium ${batchExpired ? 'text-red-400' : batchSoon ? 'text-amber-400' : 'text-green-400'}`}>
                        {batchExpired ? '⚠️' : batchSoon ? '⏰' : '✓'} {new Date(b.expiryDate).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Alerts */}
        {item.alerts?.length > 0 && (
          <div className="glass-card p-5 lg:col-span-2">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Alertes stock
            </h2>
            <div className="space-y-2">
              {item.alerts.map((a: any) => (
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${a.isRead ? 'opacity-50' : ''} ${a.type === 'OUT_OF_STOCK' ? 'bg-red-500/5 border border-red-500/20' : a.type === 'LOW_STOCK' ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-white/5 border border-brand-border'}`}>
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.type === 'OUT_OF_STOCK' ? 'text-red-400' : 'text-amber-400'}`} />
                  <p className="flex-1">{a.message}</p>
                  <span className="text-xs text-brand-muted">{new Date(a.createdAt).toLocaleDateString('fr-FR')}</span>
                  {a.isRead && <span className="text-xs text-brand-muted">Lu</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supplier info */}
        {item.supplier && (
          <div className="glass-card p-5">
            <h2 className="font-semibold mb-4">Fournisseur principal</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                🏪
              </div>
              <div>
                <p className="font-medium">{item.supplier.name}</p>
                {item.supplier.phone && <p className="text-xs text-brand-muted">{item.supplier.phone}</p>}
                {item.supplier.email && <p className="text-xs text-brand-muted">{item.supplier.email}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Thresholds */}
        <div className="glass-card p-5">
          <h2 className="font-semibold mb-4">Seuils & configuration</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Stock minimum (alerte)', value: `${item.minQuantity} ${item.unit}` },
              { label: 'Seuil de réapprovisionnement', value: `${item.reorderQuantity} ${item.unit}` },
              { label: 'Stock maximum', value: item.maxQuantity ? `${item.maxQuantity} ${item.unit}` : '—' },
              { label: 'Méthode de valorisation', value: item.valuationMethod },
              { label: 'Article périssable', value: item.isPerishable ? '✓ Oui' : '✗ Non' },
              { label: 'Coût unitaire', value: formatCurrency(item.costPerUnit) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <span className="text-brand-muted">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
