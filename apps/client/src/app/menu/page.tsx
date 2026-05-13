'use client';

import { useQuery } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { formatCurrency } from '@restaurant/utils';

const queryClient = new QueryClient();
const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  image?: string;
  allergens: string[];
  tags: string[];
  calories?: number;
  prepTime?: number;
  isAvailable: boolean;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories?isActive=true`);
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

function MenuPageInner() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-client'],
    queryFn: fetchCategories,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-client', selectedCategory],
    queryFn: () => fetchProducts(selectedCategory),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-narrow py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold">Notre Menu</h1>
          <a href="/cart" className="btn-primary py-2 px-4 text-sm rounded-xl">
            Mon Panier
          </a>
        </div>
      </header>

      {/* Category Filters */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="container-narrow py-3 flex gap-2">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`category-pill ${!selectedCategory ? 'category-pill-active' : 'category-pill-inactive'}`}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`category-pill whitespace-nowrap ${selectedCategory === cat.id ? 'category-pill-active' : 'category-pill-inactive'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="container-narrow py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="product-card h-80 animate-pulse bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="product-card cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center">
                  <span className="text-5xl">🍽️</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1 leading-tight">{product.name}</h3>
                  {product.description && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-amber-600">{formatCurrency(product.price)}</span>
                    <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      Ajouter
                    </button>
                  </div>
                  {product.prepTime && (
                    <p className="text-xs text-gray-400 mt-2">⏱ {product.prepTime} min</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {products.length === 0 && !isLoading && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="text-lg">Aucun produit disponible dans cette catégorie</p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center rounded-t-2xl">
              <span className="text-6xl">🍽️</span>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-serif font-bold mb-2">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-gray-600 mb-4 leading-relaxed">{selectedProduct.description}</p>
              )}
              {selectedProduct.allergens.length > 0 && (
                <p className="text-xs text-gray-400 mb-4">
                  Allergènes : {selectedProduct.allergens.join(', ')}
                </p>
              )}
              <div className="flex items-center justify-between mt-6">
                <span className="text-3xl font-bold text-amber-600">
                  {formatCurrency(selectedProduct.price)}
                </span>
                <button className="btn-primary">
                  Ajouter au panier
                </button>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
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
