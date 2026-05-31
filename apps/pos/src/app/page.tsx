'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { formatCurrency } from '@restaurant/utils';
import {
  apiFetch,
  apiPost,
  apiPatch,
  authFetch,
  login,
  setAccessToken,
  subscribeToken,
} from '@/lib/auth-fetch';

interface Category  { id: string; name: string; icon?: string }
interface Product   { id: string; name: string; price: number; categoryId: string; image?: string | null; stockAvailable?: number | null; barcode?: string | null; sku?: string | null }
interface CartItem  { product: Product; quantity: number }
interface Table     { id: string; number: number; status: string; capacity: number }
interface OrderItem { id: string; quantity: number; totalPrice: number; product: { name: string } }
interface OrderPayment { id: string; amount: number; status: string }
interface Order     { id: string; orderNumber: string; status: string; totalAmount: number; items: OrderItem[]; payments?: OrderPayment[] }
interface CustomerLite { id: string; firstName: string; lastName: string; phone?: string; loyaltyAccount?: { points: number; tier: string } }

const POINTS_RATE = 10 // 1 point = 10 Ar

const TABLE_COLOR: Record<string, string> = {
  AVAILABLE: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
  OCCUPIED:  'border-red-500   bg-red-500/10   text-red-300',
  RESERVED:  'border-blue-500  bg-blue-500/10  text-blue-300',
  CLEANING:  'border-amber-500 bg-amber-500/10 text-amber-300',
  BLOCKED:   'border-gray-600  bg-gray-600/10  text-gray-400',
}
const TABLE_LABEL: Record<string, string> = {
  AVAILABLE: 'Libre', OCCUPIED: 'Occupée', RESERVED: 'Réservée',
  CLEANING: 'Nettoyage', BLOCKED: 'Bloquée',
}

// Helper: solde réel d'un ordre (totalAmount - paiements déjà encaissés)
function orderRemaining(o: Order): number {
  const paid = (o.payments ?? []).filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
  return Math.max(0, o.totalAmount - paid)
}

const POS_PAYMENT_METHODS = [
  { value: 'CASH',         label: '💵 Cash' },
  { value: 'MVOLA',        label: '📱 MVola' },
  { value: 'ORANGE_MONEY', label: '🟠 Orange' },
  { value: 'AIRTEL_MONEY', label: '🔴 Airtel' },
  { value: 'CARD',         label: '💳 Carte' },
  { value: 'BNI_MOBILE',   label: '🏦 BNI' },
  { value: 'BOA_MOBILE',   label: '🏦 BOA' },
  { value: 'VIREMENT',     label: '🔁 Virement' },
  { value: 'CHEQUE',       label: '📄 Chèque' },
  { value: 'VOUCHER',      label: '🎟️ Bon' },
  { value: 'WALLET',       label: '👜 Wallet' },
]

// ─── API helpers ───────────────────────────────────────────────────────────────
// apiFetch / apiPost / apiPatch / login importés depuis @/lib/auth-fetch
// (avec refresh automatique sur 401 via le cookie refreshToken)

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email,    setEmail]    = useState('caissier@demo.com');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try   { onLogin(await login(email, password)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-xl">
        <div className="text-center mb-4">
          <p className="text-3xl mb-1">🍽️</p>
          <h1 className="text-2xl font-bold">Caisse POS</h1>
        </div>
        {error && <p className="bg-red-900/50 text-red-300 text-sm rounded-xl px-4 py-2">{error}</p>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

// ─── Receipt modal ─────────────────────────────────────────────────────────────

function ReceiptModal({
  token, activeTable, orderType, openOrders, cart, onClose,
}: {
  token: string; activeTable: Table | null; orderType: 'DINE_IN' | 'TAKEAWAY'; openOrders: Order[]; cart: CartItem[]; onClose: () => void;
}) {
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const tableLabel = activeTable ? `Table ${activeTable.number}` : orderType === 'TAKEAWAY' ? 'Emporté' : 'Commande';

  const kitchenTotal = openOrders.reduce((s, o) => s + orderRemaining(o), 0);
  const cartTotal    = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal   = kitchenTotal + cartTotal;

  const allItems = [
    ...openOrders.flatMap(o => o.items.map(i => ({
      name: i.product.name, qty: i.quantity,
      unitPrice: i.totalPrice / i.quantity, total: i.totalPrice,
    }))),
    ...cart.map(i => ({
      name: i.product.name, qty: i.quantity,
      unitPrice: i.product.price, total: i.product.price * i.quantity,
    })),
  ];

  async function printOnCloud() {
    setCloudStatus('sending');
    try {
      const res = await authFetch('/api/printer/receipt', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber:  activeTable?.number,
          tableLabel,
          orderNumber:  openOrders[0]?.orderNumber,
          items:        allItems,
          subtotal:     grandTotal,
          grandTotal,
        }),
      });
      const data = await res.json() as { success: boolean };
      setCloudStatus(data.success ? 'ok' : 'err');
    } catch {
      setCloudStatus('err');
    }
    setTimeout(() => setCloudStatus('idle'), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 print:hidden" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white text-gray-900 rounded-t-2xl sm:rounded-2xl z-10 overflow-hidden">

        {/* Header actions — hidden when printing */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-100 print:hidden">
          <span className="text-sm font-semibold text-gray-600">Reçu</span>
          <div className="flex gap-2">
            <button onClick={printOnCloud} disabled={cloudStatus === 'sending'}
              className={`text-white text-sm font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60 ${
                cloudStatus === 'ok'  ? 'bg-green-600' :
                cloudStatus === 'err' ? 'bg-red-600'   :
                'bg-blue-600 hover:bg-blue-500'
              }`}>
              {cloudStatus === 'sending' ? '⏳' : cloudStatus === 'ok' ? '✅ Envoyé' : cloudStatus === 'err' ? '❌ Erreur' : '☁️ Imprimer'}
            </button>
            <button onClick={() => window.print()}
              className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold px-3 py-1.5 rounded-xl transition-colors">
              🖨️
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center">&times;</button>
          </div>
        </div>

        {/* Receipt body */}
        <div className="p-5 font-mono text-sm" id="receipt-content">
          <div className="text-center mb-4">
            <p className="text-lg font-bold tracking-wide">🍽️ Sakafio</p>
            <p className="text-xs text-gray-500">{dateStr} à {timeStr}</p>
            <p className="text-xs text-gray-500">{tableLabel}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />

          {/* Items from kitchen orders */}
          {openOrders.map(order => (
            <div key={order.id}>
              <p className="text-[10px] text-gray-400 mb-1">Commande {order.orderNumber}</p>
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between py-0.5">
                  <span>{item.quantity}× {item.product.name}</span>
                  <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Pending cart items */}
          {cart.length > 0 && (
            <div>
              {openOrders.length > 0 && <p className="text-[10px] text-gray-400 mt-2 mb-1">En cours</p>}
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between py-0.5">
                  <span>{item.quantity}× {item.product.name}</span>
                  <span className="font-semibold">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-3" />

          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />
          <p className="text-center text-xs text-gray-400">Merci de votre visite !</p>
        </div>
      </div>
    </div>
  );
}

// ─── Refund modal ─────────────────────────────────────────────────────────────

function RefundModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [query, setQuery]       = useState('')
  const [foundOrder, setFound]  = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [refundState, setRefundState] = useState<Record<string, { amount: string; busy: boolean; done: boolean }>>({})
  const [error, setError]       = useState('')

  async function search() {
    if (!query.trim()) return
    setSearching(true); setError(''); setFound(null)
    try {
      const res = await authFetch(`/api/orders?orderNumber=${encodeURIComponent(query.trim())}&status=COMPLETED&limit=5`)
      const data = await res.json() as { success: boolean; data: any[] }
      if (!data.success || !data.data.length) { setError('Aucune commande complétée trouvée'); return }
      setFound(data.data[0])
    } catch { setError('Erreur réseau') }
    finally { setSearching(false) }
  }

  async function doRefund(paymentId: string) {
    const payment = (foundOrder?.payments ?? []).find((p: any) => p.id === paymentId)
    if (!payment) return
    const st = refundState[paymentId]
    const amount = parseFloat(st?.amount ?? '0')
    if (!amount || amount <= 0) return
    if (amount > payment.amount) {
      setError(`Montant max ${payment.amount} MGA pour ce paiement`)
      return
    }
    setRefundState(s => ({ ...s, [paymentId]: { ...s[paymentId]!, busy: true } }))
    try {
      const res = await authFetch(`/api/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason: 'Retour POS' }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Erreur')
      setRefundState(s => ({ ...s, [paymentId]: { amount: '', busy: false, done: true } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur remboursement')
      setRefundState(s => ({ ...s, [paymentId]: { ...s[paymentId]!, busy: false } }))
    }
  }

  const completedPayments = (foundOrder?.payments ?? []).filter((p: any) => p.status === 'COMPLETED' || p.status === 'PARTIAL_REFUND')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-gray-800 rounded-t-2xl sm:rounded-2xl z-10 max-h-[95vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">↩ Remboursement / Retour</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center">&times;</button>
          </div>

          <div className="flex gap-2 mb-3">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="N° commande (ex: ORD-001)"
              className="flex-1 bg-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button onClick={search} disabled={searching}
              className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm">
              {searching ? '⏳' : '🔍'}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs mb-3 bg-red-900/30 rounded-xl px-3 py-2">{error}</p>}

          {foundOrder && (
            <div className="bg-gray-700/40 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700">
                <p className="font-semibold text-sm">Commande {foundOrder.orderNumber}</p>
                <p className="text-xs text-gray-400">
                  {new Date(foundOrder.completedAt ?? foundOrder.createdAt).toLocaleString('fr-FR')}
                  {' · '}{formatCurrency(foundOrder.totalAmount)}
                </p>
              </div>

              {completedPayments.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Aucun paiement remboursable</p>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {completedPayments.map((p: any) => {
                    const st = refundState[p.id]
                    const LABELS: Record<string, string> = { CASH:'Espèces', MVOLA:'MVola', ORANGE_MONEY:'Orange Money', CARD:'Carte', WALLET:'Wallet' }
                    return (
                      <div key={p.id} className="p-3">
                        <div className="flex items-center justify-between mb-2 text-sm">
                          <span className="text-gray-300">{LABELS[p.method] ?? p.method}</span>
                          <span className="font-bold">{formatCurrency(p.amount)}</span>
                        </div>
                        {st?.done ? (
                          <p className="text-green-400 text-xs">✅ Remboursé</p>
                        ) : (
                          <div className="flex gap-2">
                            <input type="number" min="1" step="1" max={p.amount}
                              value={st?.amount ?? ''} placeholder="Montant (Ar)"
                              onChange={e => setRefundState(s => ({ ...s, [p.id]: { amount: e.target.value, busy: false, done: false } }))}
                              className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button onClick={() => doRefund(p.id)} disabled={st?.busy}
                              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">
                              {st?.busy ? '⏳' : '↩ Rembourser'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Open Caisse modal (gating) ───────────────────────────────────────────────

function OpenCaisseModal({ token, onOpened, onLogout }: { token: string; onOpened: () => void; onLogout: () => void }) {
  const [openingFloat, setOpeningFloat] = useState('0')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const amount = parseFloat(openingFloat || '0')
    if (Number.isNaN(amount) || amount < 0) { setError('Fond de caisse invalide'); return }
    setBusy(true); setError('')
    try {
      const res = await authFetch('/api/caisse/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat: amount, notes: notes || undefined }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Erreur')
      onOpened()
    } catch (e: any) {
      setError(e?.message ?? 'Erreur ouverture caisse')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🔒</span>
            <h2 className="text-lg font-bold text-white">Ouvrir la caisse</h2>
          </div>
          <p className="text-xs text-gray-400">
            Aucune session de caisse n'est ouverte. Vous devez ouvrir la caisse avant de commencer à vendre.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Fond de caisse (Ar)</label>
            <input type="number" min="0" step="100" value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full bg-gray-700 text-white text-2xl font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">Montant en espèces présent dans la caisse à l'ouverture</p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Ex: changement d'équipe…"
              className="w-full bg-gray-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-900/30 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={submit} disabled={busy}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
            {busy ? 'Ouverture...' : '🏧 Ouvrir la caisse'}
          </button>

          <button onClick={onLogout}
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment modal (multi-méthode) ────────────────────────────────────────────

function PaymentModal({
  token, grandTotal, tableLabel, openOrders, cart, orderType, activeTable, orderNote,
  allowedMethods, customer, onComplete, onClose,
}: {
  token: string; grandTotal: number; tableLabel: string;
  openOrders: Order[]; cart: CartItem[]; orderType: 'DINE_IN' | 'TAKEAWAY';
  activeTable: Table | null; orderNote: string;
  allowedMethods: typeof POS_PAYMENT_METHODS;
  customer: CustomerLite | null;
  onComplete: () => void; onClose: () => void;
}) {
  // Queue of orders to pay: {id, remaining}
  const [orderQueue, setOrderQueue] = useState<{id: string; remaining: number}[]>([]);
  const [ready, setReady]           = useState(false);   // orders created
  // BUG 2 — suivre l'ordre créé depuis le panier pour l'annuler si on ferme sans payer
  const createdCartOrderId = useRef<string | null>(null);
  const [done, setDone]             = useState(false);
  const [busy, setBusy]             = useState(false);
  const [method, setMethod]         = useState(() => allowedMethods[0]?.value ?? 'CASH');
  const [amountStr, setAmountStr]   = useState('');
  const [payments, setPayments]     = useState<{method: string; amount: number}[]>([]);
  const [error, setError]           = useState('');
  const [tip, setTip]               = useState(0);
  const [tipInput, setTipInput]     = useState('');

  const grandTotalWithTip = grandTotal + tip;
  const totalPaid  = payments.reduce((s, p) => s + p.amount, 0);
  const remaining  = Math.max(0, grandTotalWithTip - totalPaid);

  // On mount: create order from cart if needed, then build queue.
  // Guard `creating` synchrone : sous React StrictMode (dev) le useEffect tire
  // 2x, créant 2 commandes. La ref check-and-set évite ça.
  const creating = useRef(false)
  useEffect(() => {
    if (creating.current) return;
    creating.current = true;
    (async () => {
      setBusy(true);
      try {
        const queue: {id: string; remaining: number}[] = [];

        if (cart.length > 0) {
          const newOrder = await apiPost<{id: string; totalAmount: number}>(token, '/orders', {
            type: orderType, status: 'CONFIRMED',
            tableId: activeTable?.id,
            notes: orderNote || undefined,
            tipAmount: tip > 0 ? tip : undefined,
            items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
          });
          createdCartOrderId.current = newOrder.id;
          queue.push({ id: newOrder.id, remaining: newOrder.totalAmount + (tip > 0 ? tip : 0) });
        }

        for (const o of openOrders) {
          // D4/G1 — utiliser le solde réel (totalAmount - paiements déjà encaissés)
          const paid = (o.payments ?? [])
            .filter(p => p.status === 'COMPLETED')
            .reduce((s, p) => s + p.amount, 0)
          const remaining = Math.max(0, o.totalAmount - paid)
          if (remaining > 0.01) queue.push({ id: o.id, remaining })
        }

        setOrderQueue(queue);
        setAmountStr(String(Math.round(grandTotal + tip)));
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur création commande');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  async function addPayment() {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { setError('Montant invalide'); return; }
    if (amount > remaining + 0.01) { setError(`Maximum restant : ${formatCurrency(remaining)}`); return; }

    // WALLET cap: check customer has enough points
    if (method === 'WALLET') {
      if (!customer) { setError('Sélectionnez un client pour utiliser les points fidélité'); return; }
      const maxWallet = (customer.loyaltyAccount?.points ?? 0) * POINTS_RATE;
      if (amount > maxWallet + 0.01) { setError(`Points insuffisants — max ${formatCurrency(maxWallet)}`); return; }
    }

    setBusy(true); setError('');
    try {
      let toDistribute = amount;
      const newQueue = [...orderQueue];

      for (let i = 0; i < newQueue.length && toDistribute > 0.01; i++) {
        if (newQueue[i]!.remaining <= 0.01) continue;
        const pay = Math.min(newQueue[i]!.remaining, toDistribute);
        await apiPost(token, '/payments', { orderId: newQueue[i]!.id, amount: pay, method });
        newQueue[i] = { ...newQueue[i]!, remaining: newQueue[i]!.remaining - pay };
        toDistribute -= pay;
      }

      // WALLET point deduction is handled atomically by POST /payments — no extra call needed
      setOrderQueue(newQueue);
      setPayments(prev => [...prev, { method, amount }]);
      const newRemaining = remaining - amount;
      setAmountStr(newRemaining > 0.01 ? String(Math.round(newRemaining)) : '');
      if (newRemaining <= 0.01) setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur paiement');
    } finally {
      setBusy(false);
    }
  }

  const methodLabel = (v: string) => allowedMethods.find(m => m.value === v)?.label ?? POS_PAYMENT_METHODS.find(m => m.value === v)?.label ?? v;

  // BUG 2 — annuler l'ordre créé depuis le panier si on ferme sans payer
  async function handleClose() {
    if (!done && createdCartOrderId.current) {
      try { await apiPatch(token, `/orders/${createdCartOrderId.current}/status`, { status: 'CANCELLED', notes: 'Paiement annulé par le caissier' }); } catch {}
      createdCartOrderId.current = null;
    }
    onClose();
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative w-full sm:max-w-md bg-gray-800 rounded-t-2xl sm:rounded-2xl p-5 z-10 text-center">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-lg font-bold mb-0.5">Addition soldée</p>
          <p className="text-gray-400 text-sm mb-3">{formatCurrency(grandTotalWithTip)} encaissé{tip > 0 ? ` (dont ${formatCurrency(tip)} pourboire)` : ''}</p>
          <div className="bg-gray-700/50 rounded-xl p-3 mb-4 text-left space-y-1">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{methodLabel(p.method)}</span>
                <span className="font-semibold">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
          <button onClick={onComplete} className="w-full bg-orange-500 hover:bg-orange-400 text-white py-3 rounded-xl font-bold">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : handleClose} />
      <div className="relative w-full sm:max-w-md bg-gray-800 rounded-t-2xl sm:rounded-2xl z-10 max-h-[95vh] overflow-y-auto">
        <div className="p-4">
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">L'addition — {tableLabel}</h3>
            <button onClick={handleClose} disabled={busy} className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">&times;</button>
          </div>

          {/* Totals */}
          <div className={`bg-gray-700/50 rounded-xl px-3 py-2 mb-2 grid gap-1 text-center ${tip > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div>
              <p className="text-gray-400 text-[10px]">Sous-total</p>
              <p className="font-bold text-sm">{formatCurrency(grandTotal)}</p>
            </div>
            {tip > 0 && (
              <div>
                <p className="text-gray-400 text-[10px]">Pourboire</p>
                <p className="font-bold text-sm text-purple-400">{formatCurrency(tip)}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-[10px]">Payé</p>
              <p className="font-bold text-sm text-green-400">{formatCurrency(totalPaid)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px]">Reste</p>
              <p className="font-bold text-sm text-orange-400">{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* Pourboire */}
          {payments.length === 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-400 mb-1">Pourboire (optionnel)</p>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map(pct => (
                  <button key={pct} onClick={() => {
                    const t = pct === 0 ? 0 : Math.round(grandTotal * pct / 100);
                    setTip(t);
                    setTipInput(pct === 0 ? '' : String(t));
                    setAmountStr(String(Math.round(grandTotal + t)));
                  }}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      tip === (pct === 0 ? 0 : Math.round(grandTotal * pct / 100)) && (pct > 0 || tip === 0)
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}>
                    {pct === 0 ? 'Sans' : `${pct}%`}
                  </button>
                ))}
                <input
                  type="number" min="0" step="100"
                  value={tipInput}
                  onChange={e => {
                    const v = e.target.value;
                    setTipInput(v);
                    const t = Math.max(0, parseInt(v) || 0);
                    setTip(t);
                    setAmountStr(String(Math.round(grandTotal + t)));
                  }}
                  placeholder="Autre"
                  className="flex-1 bg-gray-700 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500 w-16"
                />
              </div>
            </div>
          )}

          {/* Payments added */}
          {payments.length > 0 && (
            <div className="bg-gray-700/30 rounded-xl px-2 py-1.5 mb-2 space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between text-xs px-1">
                  <span className="text-gray-300">{methodLabel(p.method)}</span>
                  <span className="text-green-400 font-semibold">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-400 text-xs mb-2 bg-red-900/30 rounded-xl px-3 py-1.5">{error}</p>}

          {!ready ? (
            <p className="text-center text-gray-400 py-4 text-sm">{busy ? '⏳ Préparation…' : ''}</p>
          ) : (
            <>
              {/* Amount input */}
              <div className="mb-2">
                <label className="text-[10px] text-gray-400 mb-0.5 block">Montant (Ar)</label>
                <input
                  type="number" min="1" step="1"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder={String(Math.round(remaining))}
                  className="w-full bg-gray-700 rounded-xl px-4 py-2.5 text-lg font-bold outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Method grid — 4 colonnes, 3 rangées, tout visible d'un coup */}
              <div className="grid grid-cols-4 gap-1 mb-2">
                {allowedMethods.map(m => (
                  <button key={m.value} onClick={() => {
                    setMethod(m.value)
                    // Auto-fill max wallet amount when customer selected
                    if (m.value === 'WALLET' && customer?.loyaltyAccount) {
                      const maxWallet = Math.min(remaining, customer.loyaltyAccount.points * POINTS_RATE)
                      setAmountStr(String(Math.round(maxWallet)))
                    }
                  }}
                    className={`py-2 px-1 rounded-lg border text-center text-[11px] font-semibold transition-all leading-tight ${
                      method === m.value
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-gray-600 text-gray-300 hover:border-gray-500'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Loyalty points info when WALLET selected */}
              {method === 'WALLET' && (
                <div className={`rounded-xl px-3 py-2 mb-2 text-xs ${
                  customer?.loyaltyAccount
                    ? 'bg-blue-900/30 border border-blue-500/30'
                    : 'bg-yellow-900/30 border border-yellow-500/30'
                }`}>
                  {customer?.loyaltyAccount ? (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">
                        Points de {customer.firstName} :
                        <span className="text-blue-300 font-bold ml-1">
                          {customer.loyaltyAccount.points.toLocaleString('fr-FR')} pts
                        </span>
                      </span>
                      <span className="text-blue-200 font-semibold">
                        = {formatCurrency(customer.loyaltyAccount.points * POINTS_RATE)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-yellow-400">⚠️ Aucun client sélectionné — impossible d'utiliser les points fidélité</p>
                  )}
                </div>
              )}

              <button onClick={addPayment} disabled={busy || remaining <= 0}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm transition-colors">
                {busy ? '⏳ Traitement…' : `➕ Encaisser ${amountStr ? formatCurrency(parseFloat(amountStr) || 0) : '…'} en ${methodLabel(method)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cart / Ticket panel ───────────────────────────────────────────────────────

function CartPanel({
  token, cart, orderNote, activeTable, orderType, openOrders,
  onAdd, onRemove, onNoteChange, onSendToKitchen, onShowPayment, onShowReceipt, onClearCart, onClose,
  sending, isMobile, selectedCustomer, onSelectCustomer,
}: {
  token: string; cart: CartItem[]; orderNote: string;
  activeTable: Table | null; orderType: 'DINE_IN' | 'TAKEAWAY';
  openOrders: Order[];
  onAdd: (p: Product) => void; onRemove: (id: string) => void;
  onNoteChange: (v: string) => void;
  onSendToKitchen: () => void; onShowPayment: () => void; onShowReceipt: () => void; onClearCart: () => void;
  onClose?: () => void; sending: boolean; isMobile?: boolean;
  selectedCustomer: CustomerLite | null; onSelectCustomer: (c: CustomerLite | null) => void;
}) {
  const existingTotal = openOrders.reduce((s, o) => s + orderRemaining(o), 0);
  const cartTotal     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal    = existingTotal + cartTotal;

  const tableLabel = activeTable
    ? `Table ${activeTable.number}`
    : orderType === 'TAKEAWAY' ? '🥡 Emporté' : 'Aucune table';

  return (
    <div className={`flex flex-col ${isMobile ? 'h-full' : 'w-80 lg:w-96 border-l border-gray-700'} bg-gray-800`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold">{tableLabel}</h2>
          <p className="text-xs text-gray-400">
            {cart.reduce((s, i) => s + i.quantity, 0)} nouv. · {openOrders.length} en cuisine
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button onClick={onClearCart} className="text-xs text-red-400 hover:text-red-300">Vider</button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center">&times;</button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Open orders in kitchen */}
        {openOrders.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">👨‍🍳 En cuisine</p>
            {openOrders.map(order => (
              <div key={order.id} className="bg-gray-700/40 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">{order.orderNumber}</span>
                  <span className="text-xs text-amber-400">{order.status}</span>
                </div>
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-xs text-gray-400 py-0.5">
                    <span>{item.quantity}× {item.product.name}</span>
                    <span>{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-gray-600 mt-1">
                  <span>Sous-total</span><span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New cart items */}
        {cart.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">➕ Nouvelle commande</p>
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-xl p-2.5 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-orange-400">{formatCurrency(item.product.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onRemove(item.product.id)}
                    className="w-7 h-7 rounded-full bg-gray-600 hover:bg-red-700 flex items-center justify-center text-sm">−</button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => onAdd(item.product)}
                    className="w-7 h-7 rounded-full bg-gray-600 hover:bg-green-700 flex items-center justify-center text-sm">+</button>
                </div>
                <span className="text-orange-400 font-bold text-sm w-20 text-right">
                  {formatCurrency(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}

        {openOrders.length === 0 && cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm">{activeTable ? 'Table vide' : 'Sélectionnez une table'}</p>
          </div>
        )}
      </div>

      {/* Customer + Note */}
      <div className="px-3 pb-2 flex-shrink-0 space-y-2">
        <CustomerSearch token={token} selected={selectedCustomer} onSelect={onSelectCustomer} />
        <input type="text" placeholder="Note pour la cuisine..." value={orderNote}
          onChange={e => onNoteChange(e.target.value)}
          className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500" />
      </div>

      {/* Totals */}
      <div className="px-3 border-t border-gray-700 flex-shrink-0">
        {openOrders.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 pt-2">
            <span>En cuisine</span><span>{formatCurrency(existingTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Panier</span><span>{formatCurrency(cartTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg py-3">
          <span>Total ticket</span>
          <span className="text-orange-400">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 space-y-2 flex-shrink-0">
        {cart.length > 0 && (
          <button onClick={onSendToKitchen} disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold transition-colors">
            {sending ? '⏳ Envoi...' : '👨‍🍳 Envoyer en cuisine'}
          </button>
        )}
        {(openOrders.length > 0 || cart.length > 0) && (
          <div className="flex gap-2">
            <button onClick={onShowReceipt}
              className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3.5 rounded-xl font-bold transition-colors text-sm whitespace-nowrap">
              🧾 Reçu
            </button>
            {(openOrders.length > 0 || (orderType === 'TAKEAWAY' && cart.length > 0)) && (
              <button onClick={onShowPayment}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white py-3.5 rounded-xl font-bold transition-colors text-sm">
                💳 L'addition — {formatCurrency(grandTotal)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customer search (loyalty) ────────────────────────────────────────────────

function CustomerSearch({
  token, selected, onSelect,
}: { token: string; selected: CustomerLite | null; onSelect: (c: CustomerLite | null) => void }) {
  const [open, setOpen]   = useState(false)
  const [q, setQ]         = useState('')
  const [results, setResults] = useState<CustomerLite[]>([])
  const [busy, setBusy]   = useState(false)

  const doSearch = useCallback(async (val: string) => {
    if (!val.trim()) { setResults([]); return }
    setBusy(true)
    try {
      const data = await apiFetch<CustomerLite[]>(token, `/customers?search=${encodeURIComponent(val)}&limit=8`)
      setResults(data)
    } catch { setResults([]) }
    finally { setBusy(false) }
  }, [token])

  useEffect(() => {
    const t = setTimeout(() => doSearch(q), 300)
    return () => clearTimeout(t)
  }, [q, doSearch])

  const tierColor = (tier?: string) =>
    tier === 'PLATINUM' ? 'text-purple-400' : tier === 'GOLD' ? 'text-yellow-400' :
    tier === 'SILVER'   ? 'text-gray-300'   : 'text-amber-700'

  if (selected) {
    const pts = selected.loyaltyAccount?.points ?? 0
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-900/30 border border-blue-500/30 rounded-xl mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{selected.firstName} {selected.lastName}</p>
          <p className={`text-[10px] ${tierColor(selected.loyaltyAccount?.tier)}`}>
            {pts.toLocaleString('fr-FR')} pts · {(pts * POINTS_RATE).toLocaleString('fr-FR')} Ar
          </p>
        </div>
        <button onClick={() => onSelect(null)} className="text-gray-500 hover:text-gray-300 text-lg w-5 h-5 flex items-center justify-center">&times;</button>
      </div>
    )
  }

  return (
    <div className="relative mb-2">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-700/40 border border-gray-600 rounded-xl transition-colors">
          👤 Associer un client (fidélité)
        </button>
      ) : (
        <div className="bg-gray-800 border border-gray-600 rounded-xl overflow-hidden shadow-xl">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-700">
            <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Rechercher par nom / téléphone…"
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-500" />
            {busy && <span className="text-gray-500 text-xs">⏳</span>}
            <button onClick={() => { setOpen(false); setQ(''); setResults([]) }}
              className="text-gray-500 hover:text-gray-300 text-lg">&times;</button>
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} onClick={() => { onSelect(c); setOpen(false); setQ(''); setResults([]) }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center justify-between text-xs border-b border-gray-700/50 last:border-0">
                  <div>
                    <p className="font-medium">{c.firstName} {c.lastName}</p>
                    {c.phone && <p className="text-gray-500">{c.phone}</p>}
                  </div>
                  {c.loyaltyAccount && (
                    <span className={`${tierColor(c.loyaltyAccount.tier)} font-semibold`}>
                      {c.loyaltyAccount.points} pts
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {q.trim() && !busy && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">Aucun client trouvé</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Product image with emoji fallback ───────────────────────────────────────

function ProductImage({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full h-16 bg-gray-700 rounded-lg mb-1.5 flex items-center justify-center text-2xl">
        🍽️
      </div>
    )
  }
  return (
    <img
      src={src} alt={alt}
      className="w-full h-16 object-cover rounded-lg mb-1.5"
      onError={() => setErr(true)}
    />
  )
}

// ─── Terminal selector ────────────────────────────────────────────────────────

function TerminalSelector({ terminals, onSelect }: {
  terminals: any[];
  onSelect: (t: any) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-4xl mb-2">🖥️</p>
          <h1 className="text-2xl font-bold text-white">Choisir un terminal</h1>
          <p className="text-gray-400 text-sm mt-1">Sélectionnez votre poste de caisse</p>
        </div>
        <div className="space-y-3">
          {terminals.map((t: any) => (
            <button key={t.id} onClick={() => onSelect(t)}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-2xl p-4 text-left transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/30">
                  <span className="text-xl">🖥️</span>
                </div>
                <div>
                  <p className="font-bold text-white">{t.name}</p>
                  {t.description && <p className="text-gray-400 text-xs">{t.description}</p>}
                  {t.warehouse && <p className="text-gray-500 text-xs mt-0.5">📦 {t.warehouse.name}</p>}
                </div>
                {t.code && <span className="ml-auto text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-lg">{t.code}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const [token,            setToken]           = useState<string | null>(null);
  const [initialized,      setInitialized]     = useState(false);
  const [terminalId,       setTerminalId]      = useState<string | null>(null);
  const [terminal,         setTerminal]        = useState<any>(null);
  const [terminalsList,    setTerminalsList]   = useState<any[] | null>(null);  // null=loading, []=no terminals

  // Synchronise le state local avec le token du module (pour les refresh auto)
  // Le callback ne triggere setToken QUE si la valeur change (évite la boucle
  // quand le composant lui-même push un token vers le module).
  useEffect(() => {
    return subscribeToken((newToken) => {
      setToken(prev => prev === newToken ? prev : newToken);
      if (newToken) localStorage.setItem('pos_token', newToken);
      else localStorage.removeItem('pos_token');
    });
  }, []);

  // SSO depuis admin : token URL → localStorage, terminal URL → localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // ?reset=1 → vide le cache et recharge proprement
    if (params.get('reset') === '1') {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_terminal_id');
      setAccessToken(null);
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
      return;
    }

    const urlToken = params.get('token');
    const urlTerminal = params.get('terminal');

    if (urlToken) {
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem('pos_token', urlToken);
      setToken(urlToken);          // state local immédiat (SSO doit marcher au 1er render)
      setAccessToken(urlToken);    // + module pour les refresh ultérieurs
    } else {
      const saved = localStorage.getItem('pos_token');
      if (saved) {
        setToken(saved);
        setAccessToken(saved);
      }
    }

    if (urlTerminal) {
      localStorage.setItem('pos_terminal_id', urlTerminal);
      setTerminalId(urlTerminal);
    } else {
      const saved = localStorage.getItem('pos_terminal_id');
      if (saved) setTerminalId(saved);
    }

    setInitialized(true);
  }, []);

  // Fetch terminals list when token is available but no terminal selected.
  // terminalsList in deps so "Réessayer" (setTerminalsList(null)) re-triggers this.
  useEffect(() => {
    if (!token || terminalId || terminalsList !== null) return;
    authFetch('/api/pos-terminals')
      .then(r => r.json())
      .then((d: any) => {
        const active = (d.data ?? []).filter((t: any) => t.status === 'ACTIVE');
        if (active.length === 1) {
          // Auto-select single terminal
          const t = active[0];
          localStorage.setItem('pos_terminal_id', t.id);
          setTerminalId(t.id);
          setTerminal(t);
          setTerminalsList(null);
        } else {
          setTerminalsList(active);
        }
      })
      .catch(() => setTerminalsList([]));
  }, [token, terminalId, terminalsList]);

  // Fetch terminal details when terminalId known
  useEffect(() => {
    if (!token || !terminalId || terminal) return;
    authFetch(`/api/pos-terminals/${terminalId}`)
      .then(r => r.json())
      .then((d: any) => {
        if (d.success) {
          setTerminal(d.data);
        } else {
          // Terminal ID invalide (supprimé?) → on repart sans terminal
          localStorage.removeItem('pos_terminal_id');
          setTerminalId(null);
          setTerminal(null);
          setTerminalsList(null); // Relance la sélection
        }
      })
      .catch(() => {
        // Erreur réseau → on charge quand même sans filtre entrepôt
        setTerminal({});
      });
  }, [token, terminalId, terminal]);

  // Payment methods filtered by terminal config (null = all)
  const allowedMethods: typeof POS_PAYMENT_METHODS = useMemo(() => {
    const ap = terminal?.allowedPaymentMethods
    if (!ap || !Array.isArray(ap) || (ap as string[]).length === 0) return POS_PAYMENT_METHODS
    return POS_PAYMENT_METHODS.filter(m => (ap as string[]).includes(m.value))
  }, [terminal])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [search,           setSearch]           = useState('');
  const [cart,             setCart]             = useState<CartItem[]>([]);
  const [orderNote,        setOrderNote]        = useState('');
  const [activeTable,      setActiveTable]      = useState<Table | null>(null);
  const [orderType,        setOrderType]        = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [sending,          setSending]          = useState(false);
  const [showPayModal,     setShowPayModal]      = useState(false);
  const [showReceipt,      setShowReceipt]       = useState(false);
  const [showRefund,       setShowRefund]        = useState(false);
  const [cartOpen,         setCartOpen]          = useState(false);
  const [toast,            setToast]            = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // Keyboard shortcuts (Ctrl+F search, Ctrl+Enter send, Ctrl+P pay, Esc clear)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && cart.length > 0 && !showPayModal) {
        e.preventDefault();
        void sendToKitchen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && cart.length > 0) {
        e.preventDefault();
        setShowPayModal(true);
      } else if (e.key === 'Escape' && !inField) {
        if (showPayModal) setShowPayModal(false);
        else if (showRefund) setShowRefund(false);
        else if (showReceipt) setShowReceipt(false);
        else if (search) setSearch('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, showPayModal, showRefund, showReceipt, search]);

  const { data: tables = [], error: tablesError, isLoading: tablesLoading } = useQuery<Table[]>({
    queryKey: ['pos-tables', token],
    queryFn: () => apiFetch<Table[]>(token!, '/tables'),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: categories = [], error: categoriesError } = useQuery<Category[]>({
    queryKey: ['pos-categories', token],
    queryFn: () => apiFetch<Category[]>(token!, '/categories'),
    enabled: !!token,
    staleTime: 600_000,
  });

  // Attendre initialized ET le terminal chargé avant de fetcher les produits
  // initialized=false → terminalId est encore null (pas lu du localStorage)
  const terminalReady = initialized && (!terminalId || terminal !== null);

  const { data: products = [], error: productsError, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['pos-products', token, selectedCategory, terminal?.warehouseId ?? null],
    queryFn: () => apiFetch<Product[]>(token!,
      `/products?isAvailable=true&limit=200${selectedCategory ? `&categoryId=${selectedCategory}` : ''}&warehouseId=${terminal!.warehouseId}`),
    enabled: !!token && terminalReady && !!terminal?.warehouseId,
    staleTime: 30_000,
  });

  const { data: openOrders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['pos-open-orders', token, activeTable?.id],
    queryFn: () => apiFetch<Order[]>(token!,
      `/orders?tableId=${activeTable!.id}&status=PENDING,CONFIRMED,PREPARING,READY&limit=50`),
    enabled: !!token && !!activeTable?.id,
    refetchInterval: 30_000,
  });

  const { data: caisseSession, isFetched: caisseFetched } = useQuery<{id: string; status: string} | null>({
    queryKey: ['pos-caisse-session', token],
    queryFn: () => apiFetch<{id: string; status: string} | null>(token!, '/caisse/current'),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const caisseOpen = caisseSession?.status === 'OPEN';
  const needsCaisseOpen = !!token && !!terminal && caisseFetched && !caisseOpen;

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(search.trim()))
    )
  }, [products, search]);

  function handleBarcodeEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const val = search.trim()
    if (!val) return
    // Exact barcode or SKU match → add to cart immediately
    const match = products.find(p =>
      p.barcode === val || p.sku === val ||
      (val.length >= 8 && p.barcode?.includes(val))
    )
    if (match) {
      addToCart(match)
      setSearch('')
      showToast(`${match.name} ajouté`, true)
    }
  }

  const addToCart = useCallback((product: Product) => {
    if (product.stockAvailable !== null && product.stockAvailable !== undefined) {
      const currentQty = cart.find(i => i.product.id === product.id)?.quantity ?? 0;
      if (currentQty + 1 > product.stockAvailable) {
        showToast(
          product.stockAvailable === 0
            ? `"${product.name}" est épuisé`
            : `Stock insuffisant pour "${product.name}" — max ${product.stockAvailable} disponible(s)`,
          false,
        );
        return;
      }
    }
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, [cart]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev =>
      prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0));
  }, []);

  function selectTable(table: Table) {
    if (activeTable?.id === table.id) return;
    setActiveTable(table);
    setOrderType('DINE_IN');
    setCart([]);
  }

  async function sendToKitchen() {
    if (sending) return; // idempotent guard : protège du Ctrl+Enter répété
    if (cart.length === 0) return;
    if (orderType === 'DINE_IN' && !activeTable) { showToast('Sélectionnez une table', false); return; }
    setSending(true);
    try {
      const order = await apiPost<{ orderNumber: string }>(token!, '/orders', {
        type: orderType,
        status: 'CONFIRMED',
        tableId: activeTable?.id,
        notes: orderNote || undefined,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
      });
      setCart([]);
      setOrderNote('');
      await refetchOrders();
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      showToast(`Commande ${order.orderNumber} envoyée en cuisine`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi', false);
    } finally {
      setSending(false);
    }
  }

  function handlePaymentComplete() {
    const total = grandTotal;
    showToast(`${activeTable ? `Table ${activeTable.number}` : 'Emporté'} — ${formatCurrency(total)} encaissé`);
    setCart([]);
    setOrderNote('');
    setSelectedCustomer(null);
    setShowPayModal(false);
    setCartOpen(false);
    qc.invalidateQueries({ queryKey: ['pos-products'] });
    if (activeTable) {
      setActiveTable(null);
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
    }
    refetchOrders();
  }

  // Auto-logout si token expiré (401), sinon affiche l'erreur
  const apiError = tablesError || categoriesError || productsError;
  useEffect(() => {
    if (!apiError) return;
    if ((apiError as any).status === 401) {
      localStorage.removeItem('pos_token');
      setAccessToken(null);
    } else {
      setToast({ msg: `Erreur chargement: ${apiError.message}`, ok: false });
      setTimeout(() => setToast(null), 6000);
    }
  }, [apiError]);

  const existingTotal = openOrders.reduce((s, o) => s + orderRemaining(o), 0);
  const cartTotal     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal    = existingTotal + cartTotal;
  const cartCount     = cart.reduce((s, i) => s + i.quantity, 0);
  const tableLabel    = activeTable ? `Table ${activeTable.number}` : orderType === 'TAKEAWAY' ? 'Emporté' : '';

  if (!initialized) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
      <div className="text-gray-400 text-sm">Chargement...</div>
      <button
        onClick={() => {
          localStorage.removeItem('pos_token');
          localStorage.removeItem('pos_terminal_id');
          window.location.reload();
        }}
        className="text-xs text-gray-700 hover:text-gray-500 underline"
      >
        Réinitialiser la session
      </button>
    </div>
  );

  if (!token) return <LoginScreen onLogin={(t) => { localStorage.setItem('pos_token', t); setAccessToken(t); setTerminal(null); setTerminalsList(null); }} />;

  // En attente de la liste des terminaux
  if (!terminalId && terminalsList === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
          Chargement des terminaux...
        </div>
        <button onClick={() => { localStorage.removeItem('pos_token'); setAccessToken(null); }} className="text-xs text-gray-700 hover:text-gray-500">Déconnexion</button>
      </div>
    );
  }

  // En attente des détails du terminal sélectionné
  if (terminalId && !terminal) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
          Connexion au terminal...
        </div>
        <button onClick={() => { localStorage.removeItem('pos_token'); localStorage.removeItem('pos_terminal_id'); setAccessToken(null); setTerminalId(null); }} className="text-xs text-gray-700 hover:text-gray-500">Réinitialiser</button>
      </div>
    );
  }

  // Aucun terminal configuré → inviter l'admin à en créer un
  if (terminalsList !== null && terminalsList.length === 0 && !terminalId) {
    const adminUrl = process.env['NEXT_PUBLIC_ADMIN_URL'] || 'https://admin.sakafio.mg';
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-5xl mb-4">🖥️</p>
        <h1 className="text-2xl font-bold text-white mb-2">Aucun terminal configuré</h1>
        <p className="text-gray-400 text-sm max-w-xs mb-6">
          Vous devez créer au moins un terminal POS dans l'interface d'administration avant de pouvoir utiliser la caisse.
        </p>
        <a
          href={`${adminUrl}/terminaux`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-2xl transition-colors text-sm"
        >
          ➕ Créer un terminal dans l'administration
        </a>
        <button
          onClick={() => { setTerminalsList(null); }}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 underline"
        >
          Réessayer
        </button>
        <button
          onClick={() => { localStorage.removeItem('pos_token'); setAccessToken(null); }}
          className="mt-2 text-xs text-gray-600 hover:text-gray-400"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  // Sélection de terminal si plusieurs disponibles
  if (terminalsList !== null && terminalsList.length > 0 && !terminalId) {
    return <TerminalSelector terminals={terminalsList} onSelect={(t) => {
      localStorage.setItem('pos_terminal_id', t.id);
      setTerminalId(t.id);
      setTerminal(t);
      setTerminalsList(null);
    }} />;
  }

  const cartPanelProps = {
    token: token!, cart, orderNote, activeTable, orderType,
    openOrders: openOrders as Order[],
    onAdd: addToCart, onRemove: removeFromCart, onNoteChange: setOrderNote,
    onSendToKitchen: sendToKitchen, onShowPayment: () => setShowPayModal(true),
    onShowReceipt: () => setShowReceipt(true),
    onClearCart: () => setCart([]), sending,
    selectedCustomer, onSelectCustomer: setSelectedCustomer,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl ${toast.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
          {toast.msg}
        </div>
      )}

      {/* Caisse-open gate — blocks the POS until a session is opened */}
      {needsCaisseOpen && (
        <OpenCaisseModal
          token={token!}
          onOpened={() => {
            qc.invalidateQueries({ queryKey: ['pos-caisse-session', token] })
            showToast('Caisse ouverte', true)
          }}
          onLogout={() => {
            localStorage.removeItem('pos_token')
            localStorage.removeItem('pos_terminal_id')
            setAccessToken(null); setTerminalId(null); setTerminal(null)
          }}
        />
      )}

      {/* Refund modal */}
      {showRefund && (
        <RefundModal token={token!} onClose={() => setShowRefund(false)} />
      )}

      {/* Receipt modal */}
      {showReceipt && (
        <ReceiptModal
          token={token!}
          activeTable={activeTable}
          orderType={orderType}
          openOrders={openOrders as Order[]}
          cart={cart}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Payment modal */}
      {showPayModal && (
        <PaymentModal
          token={token!}
          grandTotal={grandTotal}
          tableLabel={tableLabel}
          openOrders={openOrders as Order[]}
          cart={cart}
          orderType={orderType}
          activeTable={activeTable}
          orderNote={orderNote}
          allowedMethods={allowedMethods}
          customer={selectedCustomer}
          onComplete={handlePaymentComplete}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold">🍽️ Caisse POS</h1>
          {terminal && (
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-lg font-medium">
              🖥️ {terminal.name}
            </span>
          )}
          {terminal?.warehouse ? (
            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-lg font-medium">
              📦 {terminal.warehouse.name}
            </span>
          ) : terminal && (
            <span className="text-xs bg-gray-600/40 text-gray-400 border border-gray-600 px-2 py-0.5 rounded-lg">
              Tous les produits
            </span>
          )}
          {token && (
            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium border ${
              caisseOpen
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'
            }`}>
              {caisseOpen ? '🏧 Caisse ouverte' : '🔒 Caisse fermée'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRefund(true)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white border border-gray-600 px-3 py-1.5 rounded-lg transition-colors font-medium">
            ↩ Retour
          </button>
          {terminal && (
            <button
              onClick={() => { localStorage.removeItem('pos_terminal_id'); setTerminalId(null); setTerminal(null); setTerminalsList(null); }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Changer terminal
            </button>
          )}
          <button onClick={() => { localStorage.removeItem('pos_token'); localStorage.removeItem('pos_terminal_id'); setAccessToken(null); setTerminalId(null); setTerminal(null); }} className="text-xs text-gray-500 hover:text-gray-300">Déconnexion</button>
        </div>
      </div>

      {/* Table selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border-b border-gray-700 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => { setActiveTable(null); setOrderType('TAKEAWAY'); setCart([]); }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            orderType === 'TAKEAWAY' && !activeTable
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'border-gray-600 text-gray-400 hover:border-orange-500/40'
          }`}>
          🥡 Emporté
        </button>
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        {(tables as Table[]).map(table => {
          const isActive = activeTable?.id === table.id;
          return (
            <button key={table.id} onClick={() => selectTable(table)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
                isActive ? 'bg-orange-500 border-orange-500 text-white' : (TABLE_COLOR[table.status] ?? TABLE_COLOR['AVAILABLE']!)
              }`}>
              <span>T{table.number}</span>
              <span className="font-normal text-[10px] opacity-75">{TABLE_LABEL[table.status] ?? ''}</span>
            </button>
          );
        })}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Products panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + categories */}
          <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
            <input
              ref={searchInputRef}
              type="text" placeholder="🔍 Rechercher / scanner (Ctrl+F)..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleBarcodeEnter}
              className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setSelectedCategory(undefined)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${!selectedCategory ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-400'}`}>
                Tous
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${selectedCategory === cat.id ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-400'}`}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-24 md:pb-3">
            {(productsLoading || tablesLoading) && (
              <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
                Chargement...
              </div>
            )}
            {!productsLoading && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
                <p className="text-3xl">📦</p>
                {!terminal?.warehouseId
                  ? <p className="text-sm text-center">Ce terminal n'a pas d'entrepôt configuré.<br/><span className="text-xs text-gray-700">Assignez un entrepôt dans Admin → Terminaux POS.</span></p>
                  : <p className="text-sm text-center">Aucun article dans cet entrepôt.<br/><span className="text-xs text-gray-700">Assignez des articles à l'entrepôt dans Admin → Menu.</span></p>
                }
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {filteredProducts.map(product => {
                const inCart = cart.find(i => i.product.id === product.id);
                const hasStock = product.stockAvailable !== null && product.stockAvailable !== undefined;
                const outOfStock = hasStock && product.stockAvailable! <= 0;
                const lowStock = hasStock && product.stockAvailable! > 0 && product.stockAvailable! <= 5;
                return (
                  <button key={product.id} onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`rounded-xl p-2 text-left transition-all active:scale-95 relative border ${
                      outOfStock
                        ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
                        : 'bg-gray-800 hover:bg-gray-700 border-transparent hover:border-orange-500/30'
                    }`}>
                    {inCart && !outOfStock && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center z-10">
                        {inCart.quantity}
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-md z-10 leading-none">
                        ÉPUISÉ
                      </span>
                    )}
                    <ProductImage src={product.image} alt={product.name} />
                    <p className="font-medium text-[11px] leading-tight line-clamp-2 mb-0.5 pr-3">{product.name}</p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-orange-400 font-bold text-xs">{formatCurrency(product.price)}</p>
                      {hasStock && (
                        <span className={`text-[10px] font-semibold px-1 rounded ${
                          outOfStock ? 'text-red-400' : lowStock ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {product.stockAvailable}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop cart panel */}
        <div className="hidden md:flex">
          <CartPanel {...cartPanelProps} />
        </div>
      </div>

      {/* Mobile: floating cart button */}
      {!cartOpen && (cartCount > 0 || openOrders.length > 0) && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 bg-orange-500 hover:bg-orange-400 text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-between px-6 z-20">
          <span>
            🛒 {cartCount > 0 ? `${cartCount} article${cartCount > 1 ? 's' : ''}` : `${openOrders.length} en cuisine`}
            {activeTable ? ` · Table ${activeTable.number}` : ''}
          </span>
          <span>{formatCurrency(grandTotal)}</span>
        </button>
      )}

      {/* Mobile: cart drawer */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col">
          <div className="flex-1 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="bg-gray-800 rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <CartPanel {...cartPanelProps} isMobile onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
