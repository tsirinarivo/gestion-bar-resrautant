'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SavedInfo { name: string; phone: string; email: string; address: string; city: string }

const STORAGE_KEY = 'customer-info';

function loadInfo(): SavedInfo {
  if (typeof window === 'undefined') return { name: '', phone: '', email: '', address: '', city: '' };
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return { name: '', phone: '', email: '', address: '', city: '' } }
}

export default function AccountPage() {
  const [info, setInfo] = useState<SavedInfo>({ name: '', phone: '', email: '', address: '', city: '' });
  const [orderHistory, setOrderHistory] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInfo(loadInfo());
    try {
      const history = JSON.parse(localStorage.getItem('orders') ?? '[]') as string[];
      setOrderHistory(history);
    } catch { setOrderHistory([]) }
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function clearOrders() {
    if (!confirm('Effacer l\'historique de toutes vos commandes ?')) return;
    localStorage.removeItem('orders');
    setOrderHistory([]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-narrow py-4 flex items-center gap-4">
          <Link href="/menu" className="text-amber-600 hover:text-amber-700 font-medium">← Menu</Link>
          <h1 className="text-2xl font-serif font-bold">Mon compte</h1>
        </div>
      </header>

      <div className="container-narrow py-8 max-w-2xl mx-auto space-y-6">

        {/* Saved info */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Mes coordonnées</h2>
          <p className="text-xs text-gray-500 mb-4">Ces informations seront pré-remplies lors de votre prochaine commande.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input value={info.name} onChange={e => setInfo(i => ({ ...i, name: e.target.value }))}
                placeholder="Votre nom"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={info.phone} onChange={e => setInfo(i => ({ ...i, phone: e.target.value }))}
                placeholder="+261 34 00 000 00"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={info.email} onChange={e => setInfo(i => ({ ...i, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de livraison</label>
              <input value={info.address} onChange={e => setInfo(i => ({ ...i, address: e.target.value }))}
                placeholder="Rue, quartier..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input value={info.city} onChange={e => setInfo(i => ({ ...i, city: e.target.value }))}
                placeholder="Antananarivo"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
            </div>
          </div>
          <button onClick={save} className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl transition-colors">
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>

        {/* Order history */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Mes commandes ({orderHistory.length})</h2>
            {orderHistory.length > 0 && (
              <button onClick={clearOrders} className="text-xs text-red-500 hover:underline">Effacer</button>
            )}
          </div>
          {orderHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Aucune commande encore. <Link href="/menu" className="text-amber-600 underline">Voir le menu</Link></p>
          ) : (
            <div className="space-y-2">
              {orderHistory.slice(0, 10).map(num => (
                <Link key={num} href={`/orders/${num}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                  <div>
                    <p className="font-mono font-bold">{num}</p>
                  </div>
                  <span className="text-amber-600 text-sm">Suivre →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
