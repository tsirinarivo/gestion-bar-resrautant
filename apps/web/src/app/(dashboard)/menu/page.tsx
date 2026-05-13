'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Tag, Filter, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, calculateMargin } from '@restaurant/utils'
import { toast } from 'sonner'

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', selectedCategory, search],
    queryFn: () => api.get(`/products?${selectedCategory ? `categoryId=${selectedCategory}&` : ''}${search ? `search=${search}&` : ''}limit=100`).then(r => r.data.data),
  })

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch(`/products/${id}/availability`, { isAvailable }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Disponibilité mise à jour')
    },
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Produit supprimé')
    },
  })

  const categories = categoriesData || []
  const products = productsData || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion du Menu</h1>
          <p className="text-brand-muted text-sm">{products.length} produits</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtres
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouveau produit
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
            !selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted hover:border-brand-orange/30'
          }`}
        >
          Tout ({products.length})
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all flex items-center gap-2 ${
              selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted hover:border-brand-orange/30'
            }`}
          >
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
            <span className="text-xs opacity-70">({cat._count?.products || 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..." className="input-field pl-10" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card p-4 skeleton h-64" />
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full text-center py-16 text-brand-muted">
              <p className="text-4xl mb-4">🍽️</p>
              <p>Aucun produit trouvé</p>
            </div>
          ) : (
            products.map((product: any) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card overflow-hidden group transition-all duration-200 ${!product.isAvailable ? 'opacity-60' : ''}`}
              >
                {/* Image */}
                <div className="h-36 bg-gradient-to-br from-brand-card to-brand-darker relative">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
                      🍽️
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {product.isFeatured && (
                      <span className="px-1.5 py-0.5 bg-brand-gold text-black text-xs rounded-md font-bold">⭐ Vedette</span>
                    )}
                    {product.isNew && (
                      <span className="px-1.5 py-0.5 bg-brand-orange text-white text-xs rounded-md font-bold">Nouveau</span>
                    )}
                    {!product.isAvailable && (
                      <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-md font-bold">Indisponible</span>
                    )}
                  </div>
                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleAvailability.mutate({ id: product.id, isAvailable: !product.isAvailable })}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      {product.isAvailable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { if (confirm('Supprimer ce produit ?')) deleteProduct.mutate(product.id) }}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-xs text-brand-muted mb-1">{product.category?.name}</p>
                  <h3 className="font-semibold text-sm mb-1 truncate">{product.name}</h3>
                  {product.shortDesc && (
                    <p className="text-xs text-brand-muted line-clamp-2 mb-3">{product.shortDesc}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-brand-orange">{formatCurrency(product.price)}</p>
                      {product.costPrice && (
                        <p className="text-xs text-brand-muted">
                          Marge: {calculateMargin(product.price, product.costPrice).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    {product.prepTime && (
                      <span className="text-xs text-brand-muted">{product.prepTime}min</span>
                    )}
                  </div>

                  {product.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {product.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-white/5 rounded-md text-brand-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
