'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatCurrency } from '@restaurant/utils';

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  categoryId: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories?includeInactive=false`);
  const data = (await res.json()) as { data: Category[] };
  return data.data ?? [];
}

async function fetchProducts(categoryId?: string): Promise<Product[]> {
  const url = categoryId
    ? `${API_URL}/api/products?categoryId=${categoryId}&isAvailable=true`
    : `${API_URL}/api/products?isAvailable=true`;
  const res = await fetch(url);
  const data = (await res.json()) as { data: Product[] };
  return data.data ?? [];
}

export default function POSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => fetchProducts(selectedCategory),
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = total * 0.1;

  const clearCart = () => setCart([]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h1 className="text-xl font-bold">Le Bistrot Moderne — Caisse</h1>
        </div>

        {/* Categories */}
        <div className="flex gap-2 p-4 overflow-x-auto border-b border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap pos-btn ${
              !selectedCategory ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap pos-btn ${
                selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="product-grid">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center text-3xl">
                  🍽️
                </div>
                <p className="font-medium text-sm leading-tight line-clamp-2">{product.name}</p>
                <p className="text-orange-400 font-bold mt-1">{formatCurrency(product.price)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">Commande en cours</h2>
          <p className="text-sm text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-sm">Panier vide</p>
              <p className="text-xs mt-1">Cliquez sur un produit pour l&apos;ajouter</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="ticket-item">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(item.product.price)} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="w-7 h-7 rounded-full bg-gray-700 hover:bg-red-600 flex items-center justify-center text-sm transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item.product)}
                    className="w-7 h-7 rounded-full bg-gray-700 hover:bg-green-600 flex items-center justify-center text-sm transition-colors"
                  >
                    +
                  </button>
                  <span className="w-20 text-right font-medium text-orange-400">
                    {formatCurrency(item.product.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note */}
        <div className="px-4 pb-2">
          <input
            type="text"
            placeholder="Note de commande..."
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Totals */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Sous-total HT</span>
            <span>{formatCurrency(total / 1.1)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>TVA (10%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-gray-600">
            <span>Total TTC</span>
            <span className="text-orange-400">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button className="pos-btn bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold">
              💵 Espèces
            </button>
            <button className="pos-btn bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold">
              💳 Carte
            </button>
          </div>
          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="w-full pos-btn bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 py-3 rounded-xl text-sm"
          >
            Annuler la commande
          </button>
        </div>
      </div>
    </div>
  );
}
