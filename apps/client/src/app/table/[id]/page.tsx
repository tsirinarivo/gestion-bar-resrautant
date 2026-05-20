'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo';

interface TableInfo { id: string; number: number; name?: string; capacity: number; section?: string }

export default function TablePage() {
  const params = useParams();
  const tableId = params['id'] as string;
  const [table, setTable] = useState<TableInfo | null>(null);
  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/tables/${tableId}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: TableInfo }) => { if (d.success && d.data) setTable(d.data) })
      .catch(() => setError('Table introuvable'));
  }, [tableId]);

  async function callWaiter() {
    setCalling(true);
    try {
      await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/tables/${tableId}/call-waiter`, { method: 'POST' });
      setCalled(true);
      setTimeout(() => setCalled(false), 5000);
    } catch {
      setError('Impossible d\'appeler le serveur');
    } finally {
      setCalling(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl mb-3">❓</p>
          <p className="text-gray-600">{error}</p>
          <Link href="/menu" className="mt-4 inline-block text-amber-600 underline">Voir le menu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="bg-white rounded-3xl shadow-lg p-10 max-w-sm w-full">
        {table ? (
          <>
            <p className="text-6xl mb-4">🪑</p>
            <h1 className="text-3xl font-bold mb-1">Table {table.number}</h1>
            {table.name && <p className="text-gray-500 mb-1">{table.name}</p>}
            {table.section && <p className="text-xs text-gray-400 mb-6">{table.section}</p>}

            <div className="space-y-3">
              <Link
                href={`/menu?table=${tableId}`}
                className="block w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
              >
                📋 Voir le menu
              </Link>

              <button
                onClick={callWaiter}
                disabled={calling || called}
                className={`w-full font-bold py-4 rounded-2xl text-lg transition-colors border-2 ${
                  called
                    ? 'bg-green-50 border-green-400 text-green-600'
                    : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                } disabled:opacity-70`}
              >
                {called ? '✅ Serveur appelé !' : calling ? '⏳ Appel en cours...' : '🔔 Appeler le serveur'}
              </button>
            </div>

            {called && (
              <p className="text-xs text-green-500 mt-3">Un serveur arrive bientôt à votre table.</p>
            )}
          </>
        ) : (
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}
