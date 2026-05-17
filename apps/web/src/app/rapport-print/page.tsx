'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money', CARD: 'Carte bancaire', BNI_MOBILE: 'BNI Mobile',
  BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement', CHEQUE: 'Chèque',
  VOUCHER: 'Bon/Coupon', WALLET: 'Wallet',
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/\s/g, ' ') + ' Ar'
}
function pct(part: number, total: number) {
  if (!total) return '0%'
  return Math.round((part / total) * 100) + '%'
}

function PrintContent() {
  const params = useSearchParams()
  const date = params.get('date') || new Date().toISOString().slice(0, 10)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) { setError('Non authentifié'); return }
    fetch(`${API_URL}/api/finances/rapport-journalier?date=${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(r => {
        if (r.success) setData(r.data)
        else setError(r.error || 'Erreur')
      })
      .catch(() => setError('Erreur de connexion'))
  }, [date])

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400)
  }, [data])

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  if (error) return <div style={{ padding: 40, color: 'red' }}>{error}</div>
  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
      Chargement du rapport…
    </div>
  )

  const { orders, byPaymentMethod, caisse, topProducts, expenses, stockAlerts } = data
  const byMethod = byPaymentMethod ?? {}
  const totalEncaisse = Object.values(byMethod).reduce((s: number, v) => s + (v as number), 0)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @page { size: A4; margin: 18mm 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a1a2e; color: #fff; padding: 7px 10px; text-align: left; font-size: 10pt; }
        th.right { text-align: right; }
        td { padding: 6px 10px; border-bottom: 1px solid #e8e8e8; font-size: 10pt; }
        td.right { text-align: right; }
        td.bold { font-weight: 700; }
        tr:last-child td { border-bottom: none; }
        tr.total td { background: #f5f5f5; font-weight: 700; border-top: 2px solid #1a1a2e; }
        .section { margin-bottom: 20px; }
        .section-title {
          font-size: 12pt; font-weight: 700; color: #1a1a2e;
          border-left: 4px solid #FF6B00; padding-left: 10px;
          margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; text-align: center; }
        .kpi-label { font-size: 8.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .kpi-value { font-size: 15pt; font-weight: 700; color: #1a1a2e; }
        .kpi-sub { font-size: 8pt; color: #888; margin-top: 3px; }
        .kpi.orange .kpi-value { color: #FF6B00; }
        .kpi.green .kpi-value { color: #16a34a; }
        .kpi.red .kpi-value { color: #dc2626; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .info-table { width: 100%; }
        .info-table tr td:first-child { color: #555; width: 55%; }
        .info-table tr td:last-child { font-weight: 600; text-align: right; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9pt; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #16a34a; }
        .badge-red { background: #fee2e2; color: #dc2626; }
        .badge-orange { background: #fff7ed; color: #ea580c; }
        .alert-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 10pt; color: #92400e; }
        .footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 9pt; color: #888; }
        .tag { font-size: 7.5pt; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
        .positive { color: #16a34a; font-weight: 700; }
        .negative { color: #dc2626; font-weight: 700; }
      `}</style>

      {/* Bouton fermer (masqué à l'impression) */}
      <div className="no-print" style={{ background: '#1a1a2e', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Aperçu avant impression — Rapport journalier</span>
        <button onClick={() => window.print()} style={{ background: '#FF6B00', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 700 }}>
          🖨️ Imprimer
        </button>
        <button onClick={() => window.close()} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>
          ✕ Fermer
        </button>
      </div>

      <div style={{ padding: '20px 0' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '3px solid #1a1a2e' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px' }}>
              {data.restaurant?.name ?? 'RESTAURANT'}
            </div>
            {data.restaurant?.address && <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>{data.restaurant.address}{data.restaurant?.city ? `, ${data.restaurant.city}` : ''}</div>}
            {data.restaurant?.phone && <div style={{ fontSize: 10, color: '#555' }}>Tél : {data.restaurant.phone}</div>}
            {data.restaurant?.email && <div style={{ fontSize: 10, color: '#555' }}>{data.restaurant.email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B00', textTransform: 'uppercase', letterSpacing: 1 }}>Rapport Journalier</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginTop: 4 }}>{dateLabel}</div>
            <div style={{ marginTop: 6 }}>
              <span className="tag">Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Alertes stock */}
        {stockAlerts > 0 && (
          <div className="alert-box">
            ⚠️ {stockAlerts} alerte(s) de stock en cours — vérifiez les niveaux de stock
          </div>
        )}

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi orange">
            <div className="kpi-label">Chiffre d'affaires</div>
            <div className="kpi-value">{fmt(orders?.totalRevenue ?? 0)}</div>
            <div className="kpi-sub">{orders?.count ?? 0} commande(s)</div>
          </div>
          <div className="kpi green">
            <div className="kpi-label">Marge brute</div>
            <div className="kpi-value">{fmt(orders?.grossMargin ?? 0)}</div>
            <div className="kpi-sub">COGS : {fmt(orders?.totalCOGS ?? 0)}</div>
          </div>
          <div className={`kpi ${(orders?.netMargin ?? 0) >= 0 ? 'green' : 'red'}`}>
            <div className="kpi-label">Marge nette</div>
            <div className="kpi-value">{fmt(orders?.netMargin ?? 0)}</div>
            <div className="kpi-sub">Dépenses : {fmt(expenses?.total ?? 0)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pourboires</div>
            <div className="kpi-value">{fmt(orders?.totalTip ?? 0)}</div>
            <div className="kpi-sub">Remises : {fmt(orders?.totalDiscount ?? 0)}</div>
          </div>
        </div>

        {/* Ventes + Caisse */}
        <div className="two-col">
          <div className="section">
            <div className="section-title">Détail des ventes</div>
            <table className="info-table">
              <tbody>
                <tr><td>Nombre de commandes</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{orders?.count ?? 0}</td></tr>
                <tr><td>Chiffre d'affaires brut</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(orders?.totalRevenue ?? 0)}</td></tr>
                <tr><td>Remises accordées</td><td style={{ textAlign: 'right', color: '#dc2626' }}>- {fmt(orders?.totalDiscount ?? 0)}</td></tr>
                <tr><td>Pourboires</td><td style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(orders?.totalTip ?? 0)}</td></tr>
                <tr><td>Taxes collectées</td><td style={{ textAlign: 'right' }}>{fmt(orders?.totalTax ?? 0)}</td></tr>
                <tr><td>Coût matières (COGS)</td><td style={{ textAlign: 'right', color: '#dc2626' }}>- {fmt(orders?.totalCOGS ?? 0)}</td></tr>
                <tr style={{ background: '#f5f5f5' }}><td style={{ fontWeight: 700 }}>Marge brute</td><td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(orders?.grossMargin ?? 0)}</td></tr>
                <tr><td>Dépenses du jour</td><td style={{ textAlign: 'right', color: '#dc2626' }}>- {fmt(expenses?.total ?? 0)}</td></tr>
                <tr style={{ background: '#1a1a2e' }}><td style={{ fontWeight: 700, color: '#fff' }}>Marge nette</td><td style={{ textAlign: 'right', fontWeight: 700, color: '#FF6B00' }}>{fmt(orders?.netMargin ?? 0)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="section">
            <div className="section-title">Caisse du jour</div>
            {!caisse ? (
              <div style={{ color: '#888', fontStyle: 'italic', padding: '10px 0' }}>Aucune session caisse enregistrée ce jour</div>
            ) : (
              <table className="info-table">
                <tbody>
                  <tr>
                    <td>Statut</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${caisse.status === 'OPEN' ? 'badge-green' : 'badge-orange'}`}>
                        {caisse.status === 'OPEN' ? 'Ouverte' : 'Fermée'}
                      </span>
                    </td>
                  </tr>
                  <tr><td>Ouverture</td><td style={{ textAlign: 'right' }}>{caisse.openedAt ? new Date(caisse.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td></tr>
                  {caisse.closedAt && <tr><td>Fermeture</td><td style={{ textAlign: 'right' }}>{new Date(caisse.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td></tr>}
                  <tr><td>Fond d'ouverture</td><td style={{ textAlign: 'right' }}>{fmt(caisse.openingFloat)}</td></tr>
                  <tr><td>Espèces attendues</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(caisse.expectedCash)}</td></tr>
                  {caisse.closingFloat !== null && <>
                    <tr><td>Fond de fermeture</td><td style={{ textAlign: 'right' }}>{fmt(caisse.closingFloat)}</td></tr>
                    <tr style={{ background: '#f5f5f5' }}>
                      <td style={{ fontWeight: 700 }}>Écart de caisse</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={caisse.difference >= 0 ? 'positive' : 'negative'}>
                          {caisse.difference >= 0 ? '+' : ''}{fmt(caisse.difference ?? 0)}
                        </span>
                      </td>
                    </tr>
                  </>}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Encaissements par mode */}
        {Object.keys(byMethod).length > 0 && (
          <div className="section">
            <div className="section-title">Encaissements par mode de paiement</div>
            <table>
              <thead>
                <tr>
                  <th>Mode de paiement</th>
                  <th className="right">Montant</th>
                  <th className="right">Part</th>
                  <th className="right" style={{ width: 120 }}>Répartition</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byMethod).map(([method, amount]) => (
                  <tr key={method}>
                    <td>{METHOD_LABELS[method] ?? method}</td>
                    <td className="right bold">{fmt(amount as number)}</td>
                    <td className="right">{pct(amount as number, totalEncaisse)}</td>
                    <td className="right">
                      <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ background: '#FF6B00', height: '100%', width: pct(amount as number, totalEncaisse) }} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>TOTAL ENCAISSÉ</td>
                  <td className="right">{fmt(totalEncaisse)}</td>
                  <td className="right">100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Top produits */}
        {topProducts?.length > 0 && (
          <div className="section">
            <div className="section-title">Top produits du jour</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Produit</th>
                  <th className="right">Qté vendue</th>
                  <th className="right">CA généré</th>
                  <th className="right">Part du CA</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p: any, i: number) => (
                  <tr key={p.productId}>
                    <td style={{ color: '#888', fontWeight: 700 }}>{i + 1}</td>
                    <td className="bold">{p.name}</td>
                    <td className="right">{p.quantity}</td>
                    <td className="right bold" style={{ color: '#FF6B00' }}>{fmt(p.revenue)}</td>
                    <td className="right">{pct(p.revenue, orders?.totalRevenue ?? 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dépenses */}
        {expenses?.items?.length > 0 && (
          <div className="section">
            <div className="section-title">Dépenses du jour</div>
            <table>
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Description</th>
                  <th className="right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {expenses.items.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.category}</td>
                    <td style={{ color: '#555' }}>{e.description || '—'}</td>
                    <td className="right" style={{ color: '#dc2626', fontWeight: 700 }}>- {fmt(e.amount)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={2}>TOTAL DÉPENSES</td>
                  <td className="right" style={{ color: '#dc2626' }}>- {fmt(expenses.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Pied de page */}
        <div className="footer">
          <div>
            <strong>RestaurantOS</strong> — Rapport généré automatiquement
          </div>
          <div style={{ textAlign: 'right' }}>
            {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>
    </>
  )
}

export default function RapportPrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Chargement…</div>}>
      <PrintContent />
    </Suspense>
  )
}
