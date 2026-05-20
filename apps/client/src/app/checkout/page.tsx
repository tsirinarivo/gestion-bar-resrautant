'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@restaurant/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo';

interface CartItem { productId: string; name: string; price: number; quantity: number; notes?: string }

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('cart') ?? '[]') as CartItem[]; } catch { return []; }
}

type OrderType = 'TAKEAWAY' | 'DELIVERY';
type Step = 'form' | 'confirm' | 'done';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [type, setType] = useState<OrderType>('TAKEAWAY');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [tip, setTip] = useState(0);
  const [step, setStep] = useState<Step>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);

  useEffect(() => {
    setCart(getCart());
    // Pre-fill from saved account info
    try {
      const saved = JSON.parse(localStorage.getItem('customer-info') ?? '{}') as { name?: string; phone?: string; address?: string; city?: string };
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
      if (saved.address) setAddress(saved.address);
      if (saved.city) setCity(saved.city);
    } catch {}
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/info`)
      .then(r => r.json())
      .then((d: { data: { deliveryFee?: number } }) => { if (d.data?.deliveryFee) setDeliveryFee(d.data.deliveryFee); })
      .catch(() => null);
  }, []);

  // Auto-redirect to order tracking after placing order
  useEffect(() => {
    if (step !== 'done' || !orderNumber) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); router.push(`/orders/${orderNumber}`); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, orderNumber, router]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee = type === 'DELIVERY' ? deliveryFee : 0;
  const total = Math.max(0, subtotal + fee + tip - couponDiscount);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponChecking(true); setCouponError('');
    try {
      const res = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), orderAmount: subtotal }),
      });
      const data = await res.json() as { success: boolean; data?: { discount: number }; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Code invalide');
      setCouponDiscount(data.data?.discount ?? 0);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Code invalide');
      setCouponDiscount(0);
    } finally { setCouponChecking(false); }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Votre nom est requis'); return; }
    if (!phone.trim()) { setError('Votre numéro de téléphone est requis'); return; }
    if (type === 'DELIVERY' && !address.trim()) { setError('L\'adresse de livraison est requise'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price, notes: i.notes })),
          customerName: name,
          customerPhone: phone,
          deliveryAddress: type === 'DELIVERY' ? address : undefined,
          deliveryCity: type === 'DELIVERY' ? city : undefined,
          notes: notes || undefined,
          tipAmount: tip > 0 ? tip : undefined,
          couponCode: couponDiscount > 0 ? couponCode.trim() : undefined,
        }),
      });
      const data = (await res.json()) as { success: boolean; data?: { id: string; orderNumber: string }; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Erreur lors de la commande');
      const num = data.data!.orderNumber;
      setOrderNumber(num);
      // Persist order history in localStorage for tracking
      const history = JSON.parse(localStorage.getItem('orders') ?? '[]') as string[];
      history.unshift(num);
      localStorage.setItem('orders', JSON.stringify(history.slice(0, 20)));
      // Save contact info for future orders
      localStorage.setItem('customer-info', JSON.stringify({ name, phone, email: '', address, city }));
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cart-updated'));
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && step !== 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🛒</p>
          <p className="text-xl text-gray-600 mb-6">Panier vide</p>
          <Link href="/menu" className="btn-primary">Voir le menu</Link>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-serif font-bold mb-2">Commande reçue !</h1>
          <p className="text-gray-600 mb-2">Numéro de commande :</p>
          <p className="text-3xl font-mono font-bold text-amber-600 mb-6">{orderNumber}</p>
          <p className="text-gray-500 text-sm mb-8">
            {type === 'DELIVERY'
              ? 'Votre commande sera livrée dès qu\'elle est prête. Merci de rester joignable.'
              : 'Votre commande est en préparation. Venez la récupérer au comptoir.'}
          </p>
          <p className="text-xs text-gray-400 mb-4">Redirection automatique dans {countdown}s…</p>
          <Link href={`/orders/${orderNumber}`} className="btn-primary block w-full py-3 rounded-xl mb-3 text-center">Suivre ma commande</Link>
          <Link href="/menu" className="block w-full py-3 rounded-xl border border-gray-300 text-center text-gray-600 hover:bg-gray-50 transition-colors">Nouvelle commande</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-narrow py-4 flex items-center gap-4">
          <Link href="/cart" className="text-amber-600 hover:text-amber-700 font-medium">← Panier</Link>
          <h1 className="text-2xl font-serif font-bold">Commande</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="container-narrow py-8 max-w-2xl mx-auto space-y-6">

        {/* Order type */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Type de commande</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['TAKEAWAY', 'DELIVERY'] as const).map(t => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`py-4 rounded-xl font-semibold border-2 transition-colors ${type === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-200'}`}
              >
                {t === 'TAKEAWAY' ? '🥡 À emporter' : '🛵 Livraison'}
              </button>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">Vos coordonnées</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Votre nom"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)} required
              placeholder="+261 34 00 000 00"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {type === 'DELIVERY' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de livraison *</label>
                <input
                  value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Rue, quartier..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Antananarivo"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Allergies, demandes spéciales..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Récapitulatif</h2>
          <div className="divide-y divide-gray-100">
            {cart.map(item => (
              <div key={item.productId} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-gray-600 text-sm">
              <span>Sous-total</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {type === 'DELIVERY' && (
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Livraison</span><span>{formatCurrency(fee)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Pourboire</span><span>{formatCurrency(tip)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-600 text-sm">
                <span>🎟️ Code promo ({couponCode})</span><span>-{formatCurrency(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2">
              <span>Total</span><span className="text-amber-600">{formatCurrency(total)}</span>
            </div>
          </div>
          {/* Coupon */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Code promo</p>
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); if (!e.target.value) setCouponDiscount(0); }}
                placeholder="MONCODE" disabled={couponDiscount > 0}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-green-50 disabled:border-green-300" />
              {couponDiscount > 0 ? (
                <button type="button" onClick={() => { setCouponDiscount(0); setCouponCode(''); setCouponError('') }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-500 border border-red-200">
                  Retirer
                </button>
              ) : (
                <button type="button" onClick={applyCoupon} disabled={couponChecking || !couponCode.trim()}
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50">
                  {couponChecking ? '…' : 'Appliquer'}
                </button>
              )}
            </div>
            {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
          </div>
          {/* Tip */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Pourboire (optionnel)</p>
            <div className="flex gap-2 flex-wrap">
              {[0, Math.round(subtotal * 0.05 / 100) * 100, Math.round(subtotal * 0.1 / 100) * 100, Math.round(subtotal * 0.15 / 100) * 100].map((amt, i) => (
                <button key={amt}
                  type="button"
                  onClick={() => setTip(amt)}
                  className={`px-3 py-1.5 rounded-xl text-sm border-2 transition-colors ${tip === amt ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold' : 'border-gray-200 text-gray-500'}`}
                >
                  {i === 0 ? 'Aucun' : i === 1 ? '5%' : i === 2 ? '10%' : '15%'}
                  {amt > 0 && ` (${formatCurrency(amt)})`}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">💵 Paiement à la réception</p>
        </div>

        {error && <p className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 border border-red-200">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full btn-primary py-4 rounded-2xl text-lg font-bold disabled:opacity-50"
        >
          {loading ? 'Envoi en cours...' : `Confirmer la commande — ${formatCurrency(total)}`}
        </button>
      </form>
    </div>
  );
}
