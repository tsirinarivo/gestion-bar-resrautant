'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@restaurant/utils';
import Link from 'next/link';

interface CartItem { productId: string; name: string; price: number; quantity: number; notes?: string }

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('cart') ?? '[]') as CartItem[]; } catch { return []; }
}
function saveCart(items: CartItem[]) {
  localStorage.setItem('cart', JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  useEffect(() => { setCart(getCart()); }, []);

  const update = (productId: string, delta: number) => {
    const next = cart
      .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0);
    setCart(next);
    saveCart(next);
  };

  const setNote = (productId: string, notes: string) => {
    const next = cart.map(i => i.productId === productId ? { ...i, notes: notes || undefined } : i);
    setCart(next);
    saveCart(next);
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-narrow py-4 flex items-center gap-4">
          <Link href="/menu" className="text-amber-600 hover:text-amber-700 font-medium">← Menu</Link>
          <h1 className="text-2xl font-serif font-bold">Mon Panier</h1>
        </div>
      </header>

      <div className="container-narrow py-8 max-w-2xl mx-auto">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🛒</p>
            <p className="text-xl text-gray-600 mb-6">Votre panier est vide</p>
            <Link href="/menu" className="btn-primary">Voir le menu</Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 mb-6">
              {cart.map(item => (
                <div key={item.productId} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-amber-600 font-medium">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => update(item.productId, -1)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center font-bold transition-colors">−</button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => update(item.productId, 1)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-green-100 hover:text-green-600 flex items-center justify-center font-bold transition-colors">+</button>
                    </div>
                    <span className="font-bold text-gray-900 w-24 text-right">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                  {/* Item note */}
                  <div className="mt-2 ml-16">
                    {editingNotes === item.productId ? (
                      <input
                        autoFocus
                        type="text"
                        defaultValue={item.notes ?? ''}
                        onBlur={e => { setNote(item.productId, e.target.value); setEditingNotes(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="Sans oignon, pain à part..."
                        className="w-full text-sm border border-amber-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    ) : (
                      <button onClick={() => setEditingNotes(item.productId)}
                        className="text-xs text-gray-500 hover:text-amber-600 transition-colors">
                        {item.notes ? `📝 ${item.notes}` : '+ Ajouter une note'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <div className="flex justify-between text-gray-600 mb-2">
                <span>Sous-total</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t border-gray-100">
                <span>Total</span><span className="text-amber-600">{formatCurrency(subtotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">TVA incluse · Frais de livraison calculés à l&apos;étape suivante</p>
            </div>

            <Link href="/checkout" className="block w-full btn-primary text-center py-4 rounded-2xl text-lg font-bold">
              Commander — {formatCurrency(subtotal)}
            </Link>

            <button
              onClick={() => { setCart([]); saveCart([]); }}
              className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              Vider le panier
            </button>
          </>
        )}
      </div>
    </div>
  );
}
