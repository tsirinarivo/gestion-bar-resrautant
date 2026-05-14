'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, X, ChefHat,
  BookOpen, Tag, DollarSign, TrendingUp, Package, Star, Flame
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, calculateMargin, ALLERGENS } from '@restaurant/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string; name: string; shortDesc?: string; description?: string
  price: number; costPrice?: number; image?: string
  isAvailable: boolean; isFeatured: boolean; isNew: boolean
  prepTime?: number; allergens: string[]; tags: string[]
  categoryId: string; category?: { name: string; icon?: string }
  recipeItems?: RecipeItem[]
}
type Category = { id: string; name: string; icon?: string; color?: string; _count?: { products: number } }
type StockItem = { id: string; name: string; unit: string; costPerUnit: number; currentQuantity: number }
type RecipeItem = {
  id: string; quantity: number; unit: string; yieldRate: number; notes?: string
  ingredient: { name: string; unit: string; costPerUnit: number; stockItem?: StockItem }
}
type RecipeLine = { stockItemId: string; name: string; unit: string; quantity: number; yieldRate: number; notes: string }

const UNITS = ['g', 'kg', 'ml', 'cl', 'L', 'pièce', 'portion', 'cuillère', 'pincée']
const CATEGORY_ICONS = ['🍽️', '🥩', '🍔', '🍕', '🍝', '🥗', '🍰', '🥤', '🍹', '☕', '🥐', '🍜', '🦐', '🥚', '🧀']

// ─── Product Form Modal ───────────────────────────────────────────────────────

function ProductModal({
  product, categories, onClose, onSave
}: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    shortDesc: product?.shortDesc ?? '',
    description: product?.description ?? '',
    price: product?.price?.toString() ?? '',
    costPrice: product?.costPrice?.toString() ?? '',
    prepTime: product?.prepTime?.toString() ?? '10',
    categoryId: product?.categoryId ?? (categories[0]?.id ?? ''),
    isAvailable: product?.isAvailable ?? true,
    isFeatured: product?.isFeatured ?? false,
    isNew: product?.isNew ?? false,
    allergens: product?.allergens ?? [] as string[],
    tags: product?.tags?.join(', ') ?? '',
  })

  const margin = form.price && form.costPrice
    ? calculateMargin(parseFloat(form.price), parseFloat(form.costPrice))
    : null

  function toggle(field: 'isAvailable' | 'isFeatured' | 'isNew') {
    setForm(f => ({ ...f, [field]: !f[field] }))
  }

  function toggleAllergen(code: string) {
    setForm(f => ({
      ...f,
      allergens: f.allergens.includes(code)
        ? f.allergens.filter(a => a !== code)
        : [...f.allergens, code],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error('Prix requis'); return }
    if (!form.categoryId) { toast.error('Catégorie requise'); return }
    onSave({
      name: form.name.trim(),
      shortDesc: form.shortDesc.trim() || undefined,
      description: form.description.trim() || undefined,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      prepTime: form.prepTime ? parseInt(form.prepTime) : 10,
      categoryId: form.categoryId,
      isAvailable: form.isAvailable,
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      allergens: form.allergens,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold">{product ? 'Modifier le produit' : 'Nouveau produit'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-sm text-brand-muted mb-1 block">Nom du produit *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input-field" placeholder="Ex: Romazava" required />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Catégorie *</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="input-field">
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Description courte</label>
            <input value={form.shortDesc} onChange={e => setForm(f => ({ ...f, shortDesc: e.target.value }))}
              className="input-field" placeholder="Résumé en une ligne" />
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Description complète</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={2} placeholder="Ingrédients, préparation, notes..." />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Prix de vente *</label>
              <div className="relative">
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="input-field pr-10" placeholder="0" min="0" required />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted text-xs">Ar</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Coût de revient</label>
              <div className="relative">
                <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                  className="input-field pr-10" placeholder="Auto (recette)" min="0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted text-xs">Ar</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Temps prep.</label>
              <div className="relative">
                <input type="number" value={form.prepTime} onChange={e => setForm(f => ({ ...f, prepTime: e.target.value }))}
                  className="input-field pr-10" placeholder="10" min="1" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted text-xs">min</span>
              </div>
            </div>
          </div>

          {/* Margin indicator */}
          {margin !== null && (
            <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
              margin >= 70 ? 'bg-green-500/10 text-green-400' :
              margin >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
            }`}>
              Marge : {margin.toFixed(1)}% — {margin >= 70 ? 'Excellente' : margin >= 50 ? 'Correcte' : 'Faible'}
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'isAvailable', label: 'Disponible', icon: '✅' },
              { key: 'isFeatured', label: 'Vedette', icon: '⭐' },
              { key: 'isNew', label: 'Nouveau', icon: '🆕' },
            ].map(({ key, label, icon }) => (
              <button key={key} type="button"
                onClick={() => toggle(key as 'isAvailable' | 'isFeatured' | 'isNew')}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                  form[key as keyof typeof form] ? 'bg-brand-orange/20 border-brand-orange text-white' : 'border-brand-border text-brand-muted'
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Tags (séparés par virgule)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="input-field" placeholder="végétarien, épicé, populaire" />
          </div>

          {/* Allergens */}
          <div>
            <label className="text-sm text-brand-muted mb-2 block">Allergènes</label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map(a => (
                <button key={a.code} type="button"
                  onClick={() => toggleAllergen(a.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    form.allergens.includes(a.code) ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'border-brand-border text-brand-muted'
                  }`}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">
              {product ? 'Enregistrer' : 'Créer le produit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Quick Stock Item Creator (inside recipe modal) ───────────────────────────

function QuickIngredientForm({
  defaultName,
  onCreated,
  onCancel,
}: {
  defaultName: string
  onCreated: (item: StockItem) => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(defaultName)
  const [unit, setUnit] = useState('g')
  const [costPerUnit, setCostPerUnit] = useState('')

  const create = useMutation({
    mutationFn: (data: any) => api.post('/stock', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ingredients-list'] })
      toast.success(`"${res.data.data.name}" ajouté au stock`)
      onCreated(res.data.data)
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur création'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nom requis'); return }
    create.mutate({
      name: name.trim(),
      unit,
      costPerUnit: parseFloat(costPerUnit) || 0,
      currentQuantity: 0,
      minQuantity: 0,
      reorderQuantity: 0,
    })
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-4 space-y-3"
    >
      <p className="text-sm font-semibold text-brand-orange flex items-center gap-2">
        <Plus className="w-4 h-4" /> Nouvel ingrédient dans le stock
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1">
          <label className="text-xs text-brand-muted mb-1 block">Nom *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="input-field py-1.5 text-sm" placeholder="Ex: Viande zébu" required />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Unité *</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}
            className="input-field py-1.5 text-sm">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Coût / unité (Ar)</label>
          <input type="number" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)}
            className="input-field py-1.5 text-sm" placeholder="0" min="0" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 btn-secondary py-1.5 text-sm">Annuler</button>
        <button type="submit" disabled={create.isPending} className="flex-1 btn-primary py-1.5 text-sm disabled:opacity-50">
          {create.isPending ? 'Création...' : 'Créer et ajouter'}
        </button>
      </div>
    </motion.form>
  )
}

// ─── Recipe Builder Modal ─────────────────────────────────────────────────────

function RecipeModal({
  product, onClose
}: {
  product: Product
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [lines, setLines] = useState<RecipeLine[]>([])
  const [search, setSearch] = useState('')
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ['ingredients-list'],
    queryFn: () => api.get('/products/ingredients/list').then(r => r.data.data),
  })

  const { data: existingItems = [] } = useQuery<RecipeItem[]>({
    queryKey: ['recipe', product.id],
    queryFn: () => api.get(`/products/${product.id}/recipe`).then(r => r.data.data),
  })

  useEffect(() => {
    if (existingItems.length > 0) {
      setLines(existingItems.map(item => ({
        stockItemId: item.ingredient.stockItem?.id ?? '',
        name: item.ingredient.name,
        unit: item.unit,
        quantity: item.quantity,
        yieldRate: item.yieldRate,
        notes: item.notes ?? '',
      })))
    }
  }, [existingItems])

  const saveRecipe = useMutation({
    mutationFn: (items: RecipeLine[]) =>
      api.put(`/products/${product.id}/recipe`, { items }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['recipe', product.id] })
      toast.success(`Recette enregistrée — Coût: ${formatCurrency(res.data.totalCost)}`)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const filtered = stockItems.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    !lines.find(l => l.stockItemId === s.id)
  )

  function addLine(item: StockItem) {
    setLines(l => [...l, { stockItemId: item.id, name: item.name, unit: item.unit, quantity: 1, yieldRate: 1, notes: '' }])
    setSearch('')
    setShowQuickCreate(false)
  }

  function updateLine(idx: number, field: keyof RecipeLine, value: any) {
    setLines(l => l.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  function removeLine(idx: number) {
    setLines(l => l.filter((_, i) => i !== idx))
  }

  const totalCost = lines.reduce((sum, line) => {
    const stock = stockItems.find(s => s.id === line.stockItemId)
    if (!stock) return sum
    return sum + (line.quantity * stock.costPerUnit) / (line.yieldRate || 1)
  }, 0)

  const margin = totalCost > 0 ? calculateMargin(product.price, totalCost) : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-orange" /> Recette — {product.name}
            </h2>
            <p className="text-brand-muted text-sm mt-0.5">Prix de vente : {formatCurrency(product.price)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Cost summary */}
          {totalCost > 0 && (
            <div className={`p-4 rounded-xl grid grid-cols-3 gap-4 text-center ${
              (margin ?? 0) >= 70 ? 'bg-green-500/10 border border-green-500/20' :
              (margin ?? 0) >= 50 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div>
                <p className="text-xs text-brand-muted">Coût recette</p>
                <p className="font-bold text-lg">{formatCurrency(Math.round(totalCost))}</p>
              </div>
              <div>
                <p className="text-xs text-brand-muted">Prix vente</p>
                <p className="font-bold text-lg text-brand-orange">{formatCurrency(product.price)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-muted">Marge</p>
                <p className={`font-bold text-lg ${(margin ?? 0) >= 70 ? 'text-green-400' : (margin ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {margin?.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {/* Quick ingredient creator */}
          {showQuickCreate && (
            <QuickIngredientForm
              defaultName={search}
              onCreated={(item) => addLine(item)}
              onCancel={() => setShowQuickCreate(false)}
            />
          )}

          {/* Search to add ingredient */}
          {!showQuickCreate && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => { setSearch(e.target.value); setShowQuickCreate(false) }}
              className="input-field pl-10"
              placeholder="Rechercher un ingrédient du stock..." />
            {search && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-card border border-brand-border rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                {filtered.map(item => (
                  <button key={item.id} onClick={() => addLine(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 text-left text-sm transition-colors">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-brand-muted text-xs">{formatCurrency(item.costPerUnit)} / {item.unit} · stock: {item.currentQuantity} {item.unit}</span>
                  </button>
                ))}
              </div>
            )}
            {search && filtered.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-card border border-brand-border rounded-xl overflow-hidden z-10">
                <div className="px-4 py-3 text-brand-muted text-sm border-b border-brand-border">
                  Aucun ingrédient trouvé pour &quot;{search}&quot;
                </div>
                <button
                  onClick={() => setShowQuickCreate(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-brand-orange hover:bg-brand-orange/10 text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" />
                  Créer &quot;{search}&quot; dans le stock
                </button>
              </div>
            )}
          </div>
          )}

          {/* Recipe lines */}
          {lines.length === 0 ? (
            <div className="text-center py-8 text-brand-muted">
              <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun ingrédient dans la recette</p>
              <p className="text-sm mt-1">Recherchez un ingrédient ci-dessus pour l&apos;ajouter</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-brand-muted px-1">
                <span className="col-span-4">Ingrédient</span>
                <span className="col-span-2">Quantité</span>
                <span className="col-span-2">Unité</span>
                <span className="col-span-2">Rendement</span>
                <span className="col-span-1">Coût</span>
                <span className="col-span-1"></span>
              </div>
              {lines.map((line, idx) => {
                const stock = stockItems.find(s => s.id === line.stockItemId)
                const lineCost = stock ? (line.quantity * stock.costPerUnit) / (line.yieldRate || 1) : 0
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/3 rounded-xl p-2">
                    <div className="col-span-4">
                      <p className="text-sm font-medium truncate">{line.name}</p>
                      {stock && <p className="text-xs text-brand-muted">{formatCurrency(stock.costPerUnit)}/{stock.unit}</p>}
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={line.quantity} min="0.01" step="0.01"
                        onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="input-field py-1 text-sm text-center" />
                    </div>
                    <div className="col-span-2">
                      <select value={line.unit} onChange={e => updateLine(idx, 'unit', e.target.value)}
                        className="input-field py-1 text-sm">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={line.yieldRate} min="0.1" max="1" step="0.05"
                        onChange={e => updateLine(idx, 'yieldRate', parseFloat(e.target.value) || 1)}
                        className="input-field py-1 text-sm text-center"
                        title="1 = 100% de rendement, 0.85 = 15% de perte" />
                    </div>
                    <div className="col-span-1 text-xs text-brand-muted text-right">
                      {formatCurrency(Math.round(lineCost))}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeLine(idx)} className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-brand-border flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
          <button onClick={() => saveRecipe.mutate(lines)}
            disabled={saveRecipe.isPending}
            className="flex-1 btn-primary disabled:opacity-50">
            {saveRecipe.isPending ? 'Enregistrement...' : 'Enregistrer la recette'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({
  category, onClose, onSave
}: {
  category: Category | null
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    icon: category?.icon ?? '🍽️',
    color: category?.color ?? '#FF4D00',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    onSave({ name: form.name.trim(), icon: form.icon, color: form.color })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="text-lg font-bold">{category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Nom *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="Ex: Plats principaux" required />
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-2 block">Icône</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(icon => (
                <button key={icon} type="button"
                  onClick={() => setForm(f => ({ ...f, icon }))}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all ${
                    form.icon === icon ? 'border-brand-orange bg-brand-orange/20' : 'border-brand-border'
                  }`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Couleur</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
              <span className="text-sm font-mono text-brand-muted">{form.color}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">
              {category ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null })
  const [recipeModal, setRecipeModal] = useState<Product | null>(null)
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null })
  const [showCategories, setShowCategories] = useState(false)
  const qc = useQueryClient()

  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })

  const { data: productsData, isLoading } = useQuery<Product[]>({
    queryKey: ['products', selectedCategory, search],
    queryFn: () => api.get(`/products?${selectedCategory ? `categoryId=${selectedCategory}&` : ''}${search ? `search=${encodeURIComponent(search)}&` : ''}limit=100`).then(r => r.data.data),
  })

  const categories = categoriesData ?? []
  const products = productsData ?? []

  // ── Product mutations
  const createProduct = useMutation({
    mutationFn: (data: any) => api.post('/products', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Produit créé'); setProductModal({ open: false, product: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur création'),
  })

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/products/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Produit mis à jour'); setProductModal({ open: false, product: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur modification'),
  })

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch(`/products/${id}/availability`, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Produit supprimé') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur suppression'),
  })

  // ── Category mutations
  const createCategory = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Catégorie créée'); setCategoryModal({ open: false, category: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/categories/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Catégorie mise à jour'); setCategoryModal({ open: false, category: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Catégorie supprimée') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Impossible de supprimer'),
  })

  function handleProductSave(data: any) {
    if (productModal.product) {
      updateProduct.mutate({ id: productModal.product.id, data })
    } else {
      createProduct.mutate(data)
    }
  }

  function handleCategorySave(data: any) {
    if (categoryModal.category) {
      updateCategory.mutate({ id: categoryModal.category.id, data })
    } else {
      createCategory.mutate(data)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion du Menu</h1>
          <p className="text-brand-muted text-sm">{products.length} produit{products.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategories(v => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showCategories ? 'border-brand-orange text-brand-orange' : ''}`}>
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Catégories</span>
          </button>
          <button onClick={() => setProductModal({ open: true, product: null })}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau produit</span>
          </button>
        </div>
      </div>

      {/* Category management panel */}
      <AnimatePresence>
        {showCategories && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Catégories</h3>
              <button onClick={() => setCategoryModal({ open: true, category: null })}
                className="flex items-center gap-1 text-sm text-brand-orange hover:underline">
                <Plus className="w-3.5 h-3.5" /> Nouvelle catégorie
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {categories.map(cat => (
                <div key={cat.id}
                  className="flex items-center justify-between bg-white/3 rounded-xl px-3 py-2 group">
                  <span className="text-sm truncate">{cat.icon} {cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setCategoryModal({ open: true, category: cat })}
                      className="p-1 hover:text-brand-orange rounded"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => { if (confirm(`Supprimer "${cat.name}" ?`)) deleteCategory.mutate(cat.id) }}
                      className="p-1 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
            !selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
          }`}>
          Tout ({products.length})
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 ${
              selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
            }`}>
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
            <span className="text-xs opacity-70">({cat._count?.products ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..." className="input-field pl-10" />
      </div>

      {/* Stats bar */}
      {products.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Disponibles', value: products.filter(p => p.isAvailable).length, icon: Eye, color: 'text-green-400' },
            { label: 'Vedettes', value: products.filter(p => p.isFeatured).length, icon: Star, color: 'text-yellow-400' },
            { label: 'Avec recette', value: products.filter(p => (p.recipeItems?.length ?? 0) > 0).length, icon: ChefHat, color: 'text-brand-orange' },
          ].map(s => (
            <div key={s.label} className="glass-card p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="font-bold">{s.value}</p>
                <p className="text-xs text-brand-muted">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
            products.map(product => (
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
                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
                      {product.category?.icon ?? '🍽️'}
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    {product.isFeatured && <span className="px-1.5 py-0.5 bg-yellow-400 text-black text-xs rounded-md font-bold">⭐</span>}
                    {product.isNew && <span className="px-1.5 py-0.5 bg-brand-orange text-white text-xs rounded-md font-bold">New</span>}
                    {!product.isAvailable && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-md font-bold">Off</span>}
                    {(product.recipeItems?.length ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-purple-500/80 text-white text-xs rounded-md font-bold flex items-center gap-0.5">
                        <ChefHat className="w-2.5 h-2.5" />{product.recipeItems!.length}
                      </span>
                    )}
                  </div>
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => setProductModal({ open: true, product })}
                      className="p-2 bg-white/10 hover:bg-brand-orange/30 rounded-xl transition-colors" title="Modifier">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setRecipeModal(product)}
                      className="p-2 bg-white/10 hover:bg-purple-500/30 rounded-xl transition-colors" title="Recette">
                      <BookOpen className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleAvailability.mutate({ id: product.id, isAvailable: !product.isAvailable })}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors" title={product.isAvailable ? 'Désactiver' : 'Activer'}>
                      {product.isAvailable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer "${product.name}" ?`)) deleteProduct.mutate(product.id) }}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl transition-colors" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs text-brand-muted mb-0.5">{product.category?.icon} {product.category?.name}</p>
                  <h3 className="font-semibold text-sm mb-1 truncate">{product.name}</h3>
                  {product.shortDesc && (
                    <p className="text-xs text-brand-muted line-clamp-1 mb-2">{product.shortDesc}</p>
                  )}

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-bold text-brand-orange">{formatCurrency(product.price)}</p>
                      {product.costPrice ? (
                        <p className={`text-xs font-medium ${
                          calculateMargin(product.price, product.costPrice) >= 70 ? 'text-green-400' :
                          calculateMargin(product.price, product.costPrice) >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          Marge {calculateMargin(product.price, product.costPrice).toFixed(0)}%
                        </p>
                      ) : (
                        <button onClick={() => setRecipeModal(product)}
                          className="text-xs text-brand-muted hover:text-brand-orange transition-colors">
                          + Ajouter recette
                        </button>
                      )}
                    </div>
                    {product.prepTime && (
                      <span className="text-xs text-brand-muted">{product.prepTime}min</span>
                    )}
                  </div>

                  {product.allergens.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {product.allergens.slice(0, 4).map(code => {
                        const a = ALLERGENS.find(x => x.code === code)
                        return a ? <span key={code} title={a.label} className="text-xs">{a.icon}</span> : null
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {productModal.open && (
        <ProductModal
          product={productModal.product}
          categories={categories}
          onClose={() => setProductModal({ open: false, product: null })}
          onSave={handleProductSave}
        />
      )}
      {recipeModal && (
        <RecipeModal product={recipeModal} onClose={() => setRecipeModal(null)} />
      )}
      {categoryModal.open && (
        <CategoryModal
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false, category: null })}
          onSave={handleCategorySave}
        />
      )}
    </div>
  )
}
