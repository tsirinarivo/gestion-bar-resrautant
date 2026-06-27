'use client';

import { useQuery } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@restaurant/utils';

const queryClient = new QueryClient();
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('cart') ?? '[]') as CartItem[]; } catch { return []; }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem('cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

function addToCart(item: CartItem) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.productId === item.productId);
  if (idx >= 0) { cart[idx]!.quantity += 1; } else { cart.push({ ...item, quantity: 1 }); }
  saveCart(cart);
}

interface Category { id: string; name: string; icon?: string; slug: string }
interface Product {
  id: string; name: string; slug: string; description?: string; image?: string;
  price: number; allergens: string[]; prepTime?: number; isAvailable: boolean;
}

async function fetchMenu() {
  const res = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/menu`);
  const data = (await res.json()) as { data: { categories: Array<Category & { products: Product[] }> } };
  return data.data;
}

const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function isCurrentlyOpen(hours: Record<string, { open: boolean; start: string; end: string }> | null | undefined): boolean | null {
  if (!hours) return null;
  const now = new Date();
  const key = DAY_KEYS[now.getDay()];
  const day = key ? hours[key] : undefined;
  if (!day || !day.open) return false;
  const [sh=9, sm=0] = (day.start ?? '09:00').split(':').map(Number);
  const [eh=22, em=0] = (day.end ?? '22:00').split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= sh * 60 + sm && cur < eh * 60 + em;
}

const ALLERGEN_LABELS: Record<string, string> = {
  GLUTEN: 'Gluten',
  LACTOSE: 'Lactose',
  EGGS: 'Œufs',
  PEANUTS: 'Arachides',
  NUTS: 'Fruits à coque',
  SOY: 'Soja',
  FISH: 'Poisson',
  CRUSTACEANS: 'Crustacés',
  MOLLUSCS: 'Mollusques',
  CELERY: 'Céleri',
  MUSTARD: 'Moutarde',
  SESAME: 'Sésame',
  SULPHITES: 'Sulfites',
  LUPIN: 'Lupin',
}

const FILTER_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'GLUTEN', label: 'Sans gluten' },
  { code: 'LACTOSE', label: 'Sans lactose' },
  { code: 'NUTS', label: 'Sans fruits à coque' },
  { code: 'EGGS', label: 'Sans œufs' },
]

function MenuPageInner() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [excludedAllergens, setExcludedAllergens] = useState<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name?: string; openingHours?: any } | null>(null);
  const [promos, setPromos] = useState<Array<{ id: string; name: string; description?: string; type: string; value: number; minOrderAmount?: number; endDate?: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/info`)
      .then(r => r.json())
      .then((d: { data?: any }) => { if (d.data) setRestaurantInfo(d.data) })
      .catch(() => null);

    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/promotions`)
      .then(r => r.json())
      .then((d: { data?: any[] }) => { if (d.data?.length) setPromos(d.data) })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTableId(params.get('table'));
  }, []);

  async function callWaiter() {
    if (!tableId) return;
    setCallingWaiter(true);
    try {
      await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/tables/${tableId}/call-waiter`, { method: 'POST' });
      setWaiterCalled(true);
      setTimeout(() => setWaiterCalled(false), 10_000);
    } catch {}
    finally { setCallingWaiter(false); }
  }

  const { data, isLoading } = useQuery({ queryKey: ['client-menu'], queryFn: fetchMenu });

  useEffect(() => {
    const update = () => setCartCount(getCart().reduce((s, i) => s + i.quantity, 0));
    update();
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, []);

  const categories = data?.categories ?? [];
  const allProducts = categories.flatMap(c => c.products);
  const filterByAllergens = (list: Product[]) =>
    excludedAllergens.size === 0 ? list : list.filter(p => !(p.allergens ?? []).some(a => excludedAllergens.has(a)))
  const products = filterByAllergens(selectedCategory
    ? (categories.find(c => c.id === selectedCategory)?.products ?? [])
    : allProducts)

  function toggleAllergenFilter(code: string) {
    setExcludedAllergens(s => {
      const next = new Set(s)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  const handleAdd = (product: Product) => {
    addToCart({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
    setAdded(product.id);
    setSelectedProduct(null);
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-narrow py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-serif font-bold">{restaurantInfo?.name ?? 'Notre Menu'}</h1>
            <div className="flex items-center gap-2">
              {tableId && <p className="text-xs text-gray-500">Sur place — Table sélectionnée</p>}
              {(() => {
                const open = isCurrentlyOpen(restaurantInfo?.openingHours);
                if (open === null) return null;
                return (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {open ? '● Ouvert' : '● Fermé'}
                  </span>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tableId && (
              <button
                onClick={callWaiter}
                disabled={callingWaiter || waiterCalled}
                className={`py-2 px-3 text-sm rounded-xl font-medium transition-colors ${
                  waiterCalled
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200'
                }`}
              >
                {waiterCalled ? '✅ Serveur appelé' : callingWaiter ? '⏳' : '🔔 Appeler'}
              </button>
            )}
            <a href="/account" title="Mon compte"
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-amber-100 flex items-center justify-center transition-colors text-lg">
              👤
            </a>
            <a href="/cart" className="relative btn-primary py-2 px-4 text-sm rounded-xl">
              🛒 Panier
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </a>
          </div>
        </div>
      </header>

      {/* Active promotions banner */}
      {promos.length > 0 && (
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 px-4">
          <div className="container-narrow flex gap-3 overflow-x-auto">
            {promos.map(p => (
              <div key={p.id} className="flex-shrink-0 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-sm">
                <p className="font-bold flex items-center gap-1">
                  🎉 {p.name}
                </p>
                <p className="text-xs opacity-90">
                  {p.type === 'PERCENTAGE' ? `-${p.value}%` :
                   p.type === 'FIXED_AMOUNT' ? `-${p.value} Ar` :
                   p.type === 'FREE_DELIVERY' ? 'Livraison gratuite' : p.description}
                  {p.minOrderAmount ? ` · dès ${p.minOrderAmount} Ar` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="container-narrow py-3 flex gap-2">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`category-pill ${!selectedCategory ? 'category-pill-active' : 'category-pill-inactive'}`}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`category-pill whitespace-nowrap ${selectedCategory === cat.id ? 'category-pill-active' : 'category-pill-inactive'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Allergen filters */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="container-narrow py-2.5 flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap flex-shrink-0">🌿 Filtres :</span>
          {FILTER_OPTIONS.map(opt => {
            const active = excludedAllergens.has(opt.code)
            return (
              <button key={opt.code} onClick={() => toggleAllergenFilter(opt.code)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}>
                {opt.label}
              </button>
            )
          })}
          {excludedAllergens.size > 0 && (
            <button onClick={() => setExcludedAllergens(new Set())}
              className="text-xs text-gray-400 hover:text-gray-700 ml-1">
              Effacer
            </button>
          )}
        </div>
      </div>

      <div className="container-narrow py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="product-card h-80 animate-pulse bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <div key={product.id} className="product-card cursor-pointer" onClick={() => setSelectedProduct(product)}>
                <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center overflow-hidden">
                  {product.image
                    ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    : <span className="text-5xl">🍽️</span>}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1 leading-tight">{product.name}</h3>
                  {product.description && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-2">{product.description}</p>
                  )}
                  {product.allergens && product.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {product.allergens.slice(0, 3).map(a => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ {ALLERGEN_LABELS[a] ?? a}
                        </span>
                      ))}
                      {product.allergens.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">+{product.allergens.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-amber-600">{formatCurrency(product.price)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleAdd(product); }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${added === product.id ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                    >
                      {added === product.id ? '✓ Ajouté' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {products.length === 0 && !isLoading && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="text-lg">Aucun produit disponible</p>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center rounded-t-2xl overflow-hidden">
              {selectedProduct.image
                ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                : <span className="text-6xl">🍽️</span>}
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-serif font-bold mb-2">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-gray-600 mb-4 leading-relaxed">{selectedProduct.description}</p>
              )}
              {selectedProduct.allergens.length > 0 && (
                <p className="text-xs text-gray-400 mb-4">Allergènes : {selectedProduct.allergens.join(', ')}</p>
              )}
              {selectedProduct.prepTime && (
                <p className="text-sm text-gray-500 mb-4">⏱ Préparation : {selectedProduct.prepTime} min</p>
              )}
              <div className="flex items-center justify-between mt-6">
                <span className="text-3xl font-bold text-amber-600">{formatCurrency(selectedProduct.price)}</span>
                <button
                  onClick={() => handleAdd(selectedProduct)}
                  className="btn-primary px-6 py-3 rounded-xl"
                >
                  Ajouter au panier
                </button>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <MenuPageInner />
    </QueryClientProvider>
  );
}
