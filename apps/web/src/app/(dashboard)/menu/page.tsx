'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, X, ChefHat,
  BookOpen, Tag, DollarSign, TrendingUp, Package, Star, Flame,
  TrendingDown, AlertCircle, Target, ArrowUpDown, Calculator, BarChart3,
  ChevronUp, ChevronDown, Filter, Upload, FileUp, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, calculateMargin, convertUnit, ALLERGENS } from '@restaurant/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string; name: string; shortDesc?: string; description?: string
  price: number; costPrice?: number; image?: string
  isAvailable: boolean; isFeatured: boolean; isNew: boolean
  requiresPreparation: boolean; sortOrder: number
  sku?: string; barcode?: string; kdsStation?: string | null; images?: string[]
  prepTime?: number; allergens: string[]; tags: string[]
  categoryId: string; category?: { name: string; icon?: string }
  warehouseId?: string | null; warehouse?: { id: string; name: string }
  recipeItems?: RecipeItem[]
  variants?: { id: string; name: string; price: number; isDefault: boolean; isActive: boolean }[]
}
type Category = { id: string; name: string; icon?: string; color?: string; _count?: { products: number } }
type StockItem = { id: string; name: string; unit: string; costPerUnit: number; currentQuantity: number }
type RecipeItem = {
  id: string; quantity: number; unit: string; yieldRate: number; notes?: string
  ingredient: { name: string; unit: string; costPerUnit: number; stockItem?: StockItem }
}
type RecipeLine = { stockItemId: string; name: string; unit: string; quantity: number; yieldRate: number; notes: string }

const UNITS = ['g', 'kg', 'ml', 'cl', 'L', 'pièce', 'portion', 'cuillère', 'pincée']

const UNIT_GROUPS: Record<string, string[]> = {
  weight: ['g', 'kg'],
  volume: ['ml', 'cl', 'L'],
}

function getCompatibleUnits(stockUnit: string): string[] {
  for (const group of Object.values(UNIT_GROUPS)) {
    if (group.includes(stockUnit)) return group
  }
  // Unité non métrique : seule cette unité est compatible
  return [stockUnit]
}
const CATEGORY_ICONS = ['🍽️', '🥩', '🍔', '🍕', '🍝', '🥗', '🍰', '🥤', '🍹', '☕', '🥐', '🍜', '🦐', '🥚', '🧀']

// ─── Product Form Modal ───────────────────────────────────────────────────────

function ImgWithFallback({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div className={`${className} bg-gray-700 flex items-center justify-center text-xl`}>❌</div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setErr(true)} />
}

function ImportCsvModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dryRunResult, setDryRunResult] = useState<{
    total: number; created: number; skipped: number; preview: any[]; errors: { line: number; reason: string }[]
  } | null>(null)
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: { line: number; reason: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function runImport(dryRun: boolean) {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/products/import${dryRun ? '?dryRun=true' : ''}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data.data
      if (dryRun) {
        setDryRunResult(data)
      } else {
        setImportResult(data)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur d'import")
    } finally {
      setLoading(false)
    }
  }

  // Étape 3 : import réussi
  if (importResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg p-6"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import terminé</h2>
              <p className="text-sm text-brand-muted">{importResult.created} produit{importResult.created > 1 ? 's' : ''} créé{importResult.created > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Lignes" value={importResult.total} />
            <Stat label="Créés" value={importResult.created} color="text-green-400" />
            <Stat label="Ignorés" value={importResult.skipped} color="text-yellow-400" />
          </div>
          {importResult.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 max-h-40 overflow-auto">
              <div className="text-sm font-medium text-red-400 mb-2">{importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''} :</div>
              <ul className="text-xs space-y-1">
                {importResult.errors.slice(0, 15).map((e, i) => (
                  <li key={i} className="text-brand-muted">Ligne {e.line} : {e.reason}</li>
                ))}
                {importResult.errors.length > 15 && <li className="text-brand-muted italic">… et {importResult.errors.length - 15} autres</li>}
              </ul>
            </div>
          )}
          <button onClick={onDone} className="w-full btn-primary">Voir mes produits</button>
        </motion.div>
      </div>
    )
  }

  // Étape 2 : preview après dryRun
  if (dryRunResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
          onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-brand-border sticky top-0 bg-brand-card z-10">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold">Aperçu de l'import</h2>
                <p className="text-sm text-brand-muted">Vérifiez avant de confirmer</p>
              </div>
              <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <Stat label="Lignes" value={dryRunResult.total} />
              <Stat label="À créer" value={dryRunResult.created} color="text-green-400" />
              <Stat label="Doublons" value={dryRunResult.skipped} color="text-yellow-400" />
              <Stat label="Erreurs" value={dryRunResult.errors.length} color={dryRunResult.errors.length ? 'text-red-400' : ''} />
            </div>
          </div>

          <div className="p-6 space-y-4">
            {dryRunResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-400 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Lignes en erreur (seront ignorées)
                </div>
                <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                  {dryRunResult.errors.slice(0, 15).map((e, i) => (
                    <li key={i} className="text-brand-muted">Ligne {e.line} : {e.reason}</li>
                  ))}
                  {dryRunResult.errors.length > 15 && <li className="text-brand-muted italic">… et {dryRunResult.errors.length - 15} autres</li>}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-brand-muted uppercase tracking-wider mb-2">Aperçu (10 premiers)</div>
              <div className="border border-brand-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-brand-dark/50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Prix</th>
                      <th className="px-3 py-2 text-left">Catégorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunResult.preview.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-brand-border">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-brand-muted">{r.sku ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{r.price.toLocaleString('fr-FR')} Ar</td>
                        <td className="px-3 py-2 text-brand-muted">{r.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setDryRunResult(null); setFile(null) }} className="btn-secondary flex-1">
                Annuler / changer fichier
              </button>
              <button onClick={() => runImport(false)} disabled={loading || dryRunResult.created === 0} className="btn-primary flex-1">
                {loading ? 'Import en cours…' : `Importer ${dryRunResult.created} produit${dryRunResult.created > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // Étape 1 : upload
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Importer des produits depuis un CSV</h2>
            <p className="text-sm text-brand-muted">Format Dolibarr (export Produits/Services) ou autre ERP</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-brand-orange bg-brand-orange/5' : 'border-brand-border hover:border-brand-orange/50'}`}>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
          <FileUp className="w-10 h-10 mx-auto mb-3 text-brand-muted" />
          {file ? (
            <div>
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-brand-muted mt-1">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <div>
              <div className="font-medium">Cliquez pour sélectionner un fichier CSV</div>
              <div className="text-xs text-brand-muted mt-1">Max 10 MB · délimiteur , ou ;</div>
            </div>
          )}
        </label>

        <div className="mt-4 text-xs text-brand-muted space-y-1">
          <div className="font-medium text-white">Colonnes reconnues :</div>
          <div>• <span className="font-mono">label</span> / <span className="font-mono">name</span> / <span className="font-mono">nom</span> → nom du produit</div>
          <div>• <span className="font-mono">ref</span> / <span className="font-mono">sku</span> → référence (doublons skip)</div>
          <div>• <span className="font-mono">price_ttc</span> ou <span className="font-mono">price</span> → prix TTC (sinon HT + TVA = TTC calculé)</div>
          <div>• <span className="font-mono">tva_tx</span> → TVA %</div>
          <div>• <span className="font-mono">categories</span> → catégorie (créée si manquante)</div>
          <div>• <span className="font-mono">barcode</span>, <span className="font-mono">description</span> (optionnels)</div>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={() => runImport(true)} disabled={!file || loading} className="btn-primary flex-1">
            {loading ? 'Analyse…' : 'Analyser le fichier'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Stat({ label, value, color = '' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-brand-dark/50 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-brand-muted mt-1">{label}</div>
    </div>
  )
}

function ProductModal({
  product, categories, warehouses, onClose, onSave
}: {
  product: Product | null
  categories: Category[]
  warehouses: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    shortDesc: product?.shortDesc ?? '',
    description: product?.description ?? '',
    image: product?.image ?? '',
    price: product?.price?.toString() ?? '',
    costPrice: product?.costPrice?.toString() ?? '',
    prepTime: product?.prepTime?.toString() ?? '10',
    sortOrder: product?.sortOrder?.toString() ?? '0',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    kdsStation: product?.kdsStation ?? '',
    images: product?.images?.join('\n') ?? '',
    calories: (product as any)?.calories?.toString() ?? '',
    proteins: (product as any)?.proteins?.toString() ?? '',
    carbs: (product as any)?.carbs?.toString() ?? '',
    fats: (product as any)?.fats?.toString() ?? '',
    categoryId: product?.categoryId ?? (categories[0]?.id ?? ''),
    warehouseId: product?.warehouseId ?? '',
    isAvailable: product?.isAvailable ?? true,
    isFeatured: product?.isFeatured ?? false,
    isNew: product?.isNew ?? false,
    hasRecipe: !(product?.tags?.includes('no-recipe') ?? false),
    requiresPreparation: product?.requiresPreparation ?? true,
    allergens: product?.allergens ?? [] as string[],
    tags: product?.tags?.filter(t => t !== 'no-recipe').join(', ') ?? '',
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
      image: form.image.trim() || undefined,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      prepTime: form.prepTime ? parseInt(form.prepTime) : 10,
      sortOrder: parseInt(form.sortOrder) || 0,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      kdsStation: form.kdsStation || null,
      images: form.images.split('\n').map(u => u.trim()).filter(Boolean),
      calories: form.calories ? parseInt(form.calories) : undefined,
      proteins: form.proteins ? parseFloat(form.proteins) : undefined,
      carbs: form.carbs ? parseFloat(form.carbs) : undefined,
      fats: form.fats ? parseFloat(form.fats) : undefined,
      categoryId: form.categoryId,
      warehouseId: form.warehouseId || null,
      isAvailable: form.isAvailable,
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      requiresPreparation: form.requiresPreparation,
      allergens: form.allergens,
      tags: [
        ...form.tags.split(',').map(t => t.trim()).filter(Boolean),
        ...(form.hasRecipe ? [] : ['no-recipe']),
      ],
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
            <div className="col-span-2">
              <label className="text-sm text-brand-muted mb-1 block">
                Entrepôt / Terminal
                <span className="text-xs text-brand-muted ml-2">(vide = visible sur tous les terminaux)</span>
              </label>
              {warehouses.length === 0 ? (
                <div className="input-field text-brand-muted text-xs">
                  Aucun entrepôt configuré —{' '}
                  <a href="/warehouses" className="text-brand-orange underline">créer un entrepôt</a>
                </div>
              ) : (
                <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="input-field">
                  <option value="">— Tous les terminaux —</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Image</label>
            <div className="flex gap-2">
              <input
                value={form.image}
                onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                className="input-field flex-1"
                placeholder="https://images.unsplash.com/..."
              />
              <label className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-brand-border rounded-xl text-sm transition-colors flex-shrink-0 cursor-pointer flex items-center gap-1.5" title="Téléverser une image">
                📤
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append('image', file)
                    try {
                      const res = await api.post('/products/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                      setForm(f => ({ ...f, image: res.data.data.url }))
                      toast.success('Image téléversée')
                    } catch { toast.error('Erreur upload') }
                  }}
                />
                Upload
              </label>
              <button
                type="button"
                title="Chercher sur Unsplash"
                onClick={() => form.name && window.open(`https://unsplash.com/s/photos/${encodeURIComponent(form.name + ' food')}`, '_blank')}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-brand-border rounded-xl text-sm transition-colors flex-shrink-0"
              >
                🔍 Unsplash
              </button>
            </div>
            {form.image && (
              <div className="mt-2 relative w-24 h-24 rounded-xl overflow-hidden border border-brand-border">
                <ImgWithFallback src={form.image} alt="Aperçu" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Image gallery */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">
              Galerie d'images
              <span className="ml-2 text-xs opacity-60">Une URL par ligne</span>
            </label>
            <textarea value={form.images} onChange={e => setForm(f => ({ ...f, images: e.target.value }))}
              rows={3} placeholder="https://example.com/img1.jpg&#10;https://example.com/img2.jpg"
              className="input-field resize-none text-sm font-mono" />
            {form.images.trim() && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {form.images.split('\n').map(u => u.trim()).filter(Boolean).map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-brand-border">
                    <ImgWithFallback src={url} alt={`img ${i+1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SKU / Barcode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">SKU</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                className="input-field font-mono text-sm" placeholder="PLT-001" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Code-barres</label>
              <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                className="input-field font-mono text-sm" placeholder="3760123450123" />
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
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Ordre d'affichage</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                className="input-field" placeholder="0" min="0"
                title="Les produits sont affichés par ordre croissant (0 = premier)" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Station KDS</label>
              <select value={form.kdsStation} onChange={e => setForm(f => ({ ...f, kdsStation: e.target.value }))}
                className="input-field">
                <option value="">— Auto —</option>
                <option value="hot">🔥 Chaud</option>
                <option value="cold">❄️ Froid</option>
                <option value="drinks">🍹 Boissons</option>
                <option value="desserts">🍰 Desserts</option>
              </select>
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
            <button type="button"
              onClick={() => setForm(f => ({ ...f, hasRecipe: !f.hasRecipe }))}
              className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                form.hasRecipe ? 'bg-purple-500/20 border-purple-500/60 text-purple-300' : 'border-brand-border text-brand-muted'
              }`}
              title={form.hasRecipe ? 'Désactiver pour les boissons/produits vendus tels quels' : 'Activer pour les plats préparés'}>
              🍳 {form.hasRecipe ? 'A une recette' : 'Vendu tel quel'}
            </button>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, requiresPreparation: !f.requiresPreparation }))}
              className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                form.requiresPreparation
                  ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                  : 'bg-green-500/20 border-green-500/60 text-green-300'
              }`}
              title={form.requiresPreparation ? 'Ce produit est préparé en cuisine' : 'Ce produit ne passe pas en cuisine (servi directement)'}>
              {form.requiresPreparation ? '👨‍🍳 Passe en cuisine' : '⚡ Prêt à servir'}
            </button>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Tags (séparés par virgule)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="input-field" placeholder="végétarien, épicé, populaire" />
          </div>

          {/* Nutritional info */}
          <div>
            <label className="text-sm text-brand-muted mb-2 block">Informations nutritionnelles <span className="text-xs opacity-60">(par portion)</span></label>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Calories</label>
                <input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} className="input-field text-sm" placeholder="kcal" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Protéines</label>
                <input type="number" step="0.1" value={form.proteins} onChange={e => setForm(f => ({ ...f, proteins: e.target.value }))} className="input-field text-sm" placeholder="g" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Glucides</label>
                <input type="number" step="0.1" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} className="input-field text-sm" placeholder="g" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Lipides</label>
                <input type="number" step="0.1" value={form.fats} onChange={e => setForm(f => ({ ...f, fats: e.target.value }))} className="input-field text-sm" placeholder="g" />
              </div>
            </div>
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
      setLines(existingItems.map(item => {
        const stockUnit = item.ingredient.stockItem?.unit
        // H1 — si l'unité sauvegardée n'est plus compatible avec l'unité du stock, on repart sur l'unité stock
        const compatible = stockUnit ? getCompatibleUnits(stockUnit) : [item.unit]
        const unit = compatible.includes(item.unit) ? item.unit : (stockUnit ?? item.unit)
        return {
          stockItemId: item.ingredient.stockItem?.id ?? '',
          name: item.ingredient.name,
          unit,
          quantity: item.quantity,
          yieldRate: item.yieldRate,
          notes: item.notes ?? '',
        }
      }))
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
    // Convertir l'unité recette → unité stock si différentes (ex: cl → L, g → kg)
    let qty = line.quantity
    if (line.unit && line.unit !== stock.unit) {
      const converted = convertUnit(line.quantity, line.unit, stock.unit)
      if (converted !== null) qty = converted
      // Si null (unités incompatibles), on garde la quantité brute plutôt que d'afficher rien
    }
    return sum + (qty * stock.costPerUnit) / (line.yieldRate || 1)
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
                let lineQty = line.quantity
                if (stock && line.unit && line.unit !== stock.unit) {
                  const converted = convertUnit(line.quantity, line.unit, stock.unit)
                  if (converted !== null) lineQty = converted
                }
                const lineCost = stock ? (lineQty * stock.costPerUnit) / (line.yieldRate || 1) : 0
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
                        {getCompatibleUnits(stock?.unit ?? line.unit).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
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
    sortOrder: (category as any)?.sortOrder?.toString() ?? '0',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    onSave({ name: form.name.trim(), icon: form.icon, color: form.color, sortOrder: parseInt(form.sortOrder) || 0 })
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Couleur</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                <span className="text-sm font-mono text-brand-muted">{form.color}</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Ordre d'affichage</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                className="input-field" placeholder="0" min="0" />
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

// ─── Marge View ───────────────────────────────────────────────────────────────

type MargeLevel = 'excellente' | 'bonne' | 'correcte' | 'faible' | 'negative' | 'unknown'

const MARGE_LEVELS: Record<MargeLevel, { label: string; color: string; min: number }> = {
  excellente: { label: 'Excellente', color: '#10B981', min: 75 },
  bonne:      { label: 'Bonne',      color: '#3B82F6', min: 60 },
  correcte:   { label: 'Correcte',   color: '#F59E0B', min: 40 },
  faible:     { label: 'Faible',     color: '#EF4444', min: 0  },
  negative:   { label: 'Négative',   color: '#7F1D1D', min: -Infinity },
  unknown:    { label: 'Sans coût',  color: '#6B7280', min: -Infinity },
}

function getMargeLevel(tauxMarque: number | null): MargeLevel {
  if (tauxMarque === null) return 'unknown'
  if (tauxMarque >= 75) return 'excellente'
  if (tauxMarque >= 60) return 'bonne'
  if (tauxMarque >= 40) return 'correcte'
  if (tauxMarque >= 0)  return 'faible'
  return 'negative'
}

function MargeView({ products, categories, onEdit }: {
  products: Product[]
  categories: Category[]
  onEdit: (p: Product) => void
}) {
  const [targetMargin, setTargetMargin]   = useState(65)
  const [sortBy, setSortBy]               = useState<'tauxMarque' | 'margeAr' | 'price' | 'name'>('tauxMarque')
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('desc')
  const [filterLevel, setFilterLevel]     = useState<MargeLevel | ''>('')
  const [filterCat, setFilterCat]         = useState('')
  const [simProduct, setSimProduct]       = useState<Product | null>(null)
  const [simPrice, setSimPrice]           = useState('')
  const [simCost, setSimCost]             = useState('')

  // Compute margin metrics for each product
  const rows = products.map(p => {
    const price = p.price
    const cost  = p.costPrice ?? null
    const margeAr     = cost !== null ? price - cost : null
    const tauxMarque  = cost !== null && price > 0 ? ((price - cost) / price) * 100 : null
    const tauxMarge   = cost !== null && cost > 0  ? ((price - cost) / cost)  * 100 : null
    const prixCible   = cost !== null ? cost / (1 - targetMargin / 100) : null
    const level       = getMargeLevel(tauxMarque)
    return { ...p, margeAr, tauxMarque, tauxMarge, prixCible, level }
  })

  // KPIs
  const withCost   = rows.filter(r => r.margeAr !== null)
  const negatives  = withCost.filter(r => (r.tauxMarque ?? 0) < 0)
  const belowTarget = withCost.filter(r => (r.tauxMarque ?? 0) < targetMargin)
  const avgMargin  = withCost.length ? withCost.reduce((s, r) => s + (r.tauxMarque ?? 0), 0) / withCost.length : 0
  const best       = withCost.length ? withCost.reduce((a, b) => (b.tauxMarque ?? -Infinity) > (a.tauxMarque ?? -Infinity) ? b : a) : undefined
  const worst      = withCost.length ? withCost.reduce((a, b) => (b.tauxMarque ?? Infinity) < (a.tauxMarque ?? Infinity) ? b : a) : undefined

  // Filter + sort
  const filtered = rows
    .filter(r => !filterLevel || r.level === filterLevel)
    .filter(r => !filterCat || r.categoryId === filterCat)
    .sort((a, b) => {
      let va: number, vb: number
      if (sortBy === 'tauxMarque') { va = a.tauxMarque ?? -9999; vb = b.tauxMarque ?? -9999 }
      else if (sortBy === 'margeAr') { va = a.margeAr ?? -9999; vb = b.margeAr ?? -9999 }
      else if (sortBy === 'price')  { va = a.price; vb = b.price }
      else { return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name) }
      return sortDir === 'asc' ? va - vb : vb - va
    })

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-30" />

  // Simulation
  const simP = simPrice ? parseFloat(simPrice) : (simProduct?.price ?? 0)
  const simC = simCost  ? parseFloat(simCost)  : (simProduct?.costPrice ?? 0)
  const simMargeAr   = simP - simC
  const simTauxMarque = simP > 0 ? ((simP - simC) / simP) * 100 : 0
  const simTauxMarge  = simC > 0 ? ((simP - simC) / simC) * 100 : 0
  const simLevel      = getMargeLevel(simTauxMarque)

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Marge moyenne', value: `${avgMargin.toFixed(1)}%`, sub: `sur ${withCost.length} produits coûtés`, icon: TrendingUp, color: avgMargin >= targetMargin ? '#10B981' : '#EF4444' },
          { label: 'Produits à marge négative', value: negatives.length, sub: 'à corriger en priorité', icon: AlertCircle, color: negatives.length > 0 ? '#EF4444' : '#10B981' },
          { label: 'Sous l\'objectif', value: belowTarget.length, sub: `objectif ${targetMargin}%`, icon: Target, color: belowTarget.length > 0 ? '#F59E0B' : '#10B981' },
          { label: 'Meilleure marge', value: best ? `${(best.tauxMarque ?? 0).toFixed(1)}%` : '—', sub: best?.name ?? '', icon: Star, color: '#FFB800' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-brand-muted uppercase tracking-wide">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-brand-muted mt-1 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Config + Filters ── */}
      <div className="glass-card p-4 space-y-4">
        {/* Target margin */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Target className="w-4 h-4 text-brand-orange flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">Objectif de marge</span>
            <input type="range" min={0} max={95} step={1} value={targetMargin}
              onChange={e => setTargetMargin(Number(e.target.value))}
              className="flex-1 accent-brand-orange" />
            <span className="text-brand-orange font-bold text-sm w-10 text-right">{targetMargin}%</span>
          </div>
          <div className="text-xs text-brand-muted">
            Prix minimum = <strong>coût ÷ (1 − {targetMargin}%)</strong>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-4 h-4 text-brand-muted flex-shrink-0" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field py-1.5 text-sm w-auto">
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          {(['', 'negative', 'faible', 'correcte', 'bonne', 'excellente', 'unknown'] as const).map(l => (
            <button key={l} onClick={() => setFilterLevel(l === filterLevel ? '' : l)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${filterLevel === l
                ? 'bg-brand-orange text-white border-brand-orange'
                : 'border-brand-border text-brand-muted'}`}>
              {l === '' ? 'Tous' : MARGE_LEVELS[l as MargeLevel].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left">
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1">
                    Produit <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">
                  <button onClick={() => toggleSort('price')} className="flex items-center gap-1">
                    Prix vente <SortIcon col="price" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">Coût de revient</th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">
                  <button onClick={() => toggleSort('margeAr')} className="flex items-center gap-1">
                    Marge brute <SortIcon col="margeAr" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">
                  <button onClick={() => toggleSort('tauxMarque')} className="flex items-center gap-1">
                    Taux de marque <SortIcon col="tauxMarque" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">Taux de marge</th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">Prix cible ({targetMargin}%)</th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase">Statut</th>
                <th className="px-4 py-3 text-xs text-brand-muted uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-brand-muted">Aucun produit</td></tr>
              ) : filtered.map(row => {
                const lv = MARGE_LEVELS[row.level]
                const belowTgt = row.tauxMarque !== null && row.tauxMarque < targetMargin
                return (
                  <tr key={row.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-brand-muted">{row.category?.icon} {row.category?.name}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(row.price)}</td>
                    <td className="px-4 py-3 text-brand-muted">
                      {row.costPrice ? formatCurrency(row.costPrice) : <span className="text-xs italic">Non défini</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.margeAr !== null
                        ? <span className={row.margeAr >= 0 ? 'text-green-400' : 'text-red-400'} style={{ color: lv.color }}>
                            {formatCurrency(row.margeAr)}
                          </span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.tauxMarque !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-brand-border rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, row.tauxMarque))}%`, background: lv.color }} />
                          </div>
                          <span className="font-semibold" style={{ color: lv.color }}>
                            {row.tauxMarque.toFixed(1)}%
                          </span>
                          {belowTgt && <span title="Sous l'objectif" className="text-yellow-400 text-xs">⚠️</span>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-brand-muted">
                      {row.tauxMarge !== null ? `${row.tauxMarge.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.prixCible !== null ? (
                        <span className={row.price >= row.prixCible ? 'text-green-400' : 'text-brand-orange font-semibold'}>
                          {formatCurrency(row.prixCible)}
                          {row.price < row.prixCible && (
                            <span className="block text-xs opacity-70">
                              +{formatCurrency(row.prixCible - row.price)}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${lv.color}20`, color: lv.color }}>
                        {lv.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setSimProduct(row as unknown as Product)
                          setSimPrice(row.price.toString())
                          setSimCost(row.costPrice?.toString() ?? '')
                        }}
                          className="p-1.5 text-brand-muted hover:text-brand-orange hover:bg-brand-orange/10 rounded-lg"
                          title="Simuler">
                          <Calculator className="w-4 h-4" />
                        </button>
                        <button onClick={() => onEdit(row as unknown as Product)}
                          className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg"
                          title="Modifier le produit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary row */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-brand-border bg-white/2 flex items-center gap-6 text-xs text-brand-muted flex-wrap">
            <span><strong>{filtered.length}</strong> produits</span>
            <span>Marge moy. : <strong style={{ color: avgMargin >= targetMargin ? '#10B981' : '#EF4444' }}>{avgMargin.toFixed(1)}%</strong></span>
            <span>Sous objectif : <strong className="text-brand-orange">{belowTarget.length}</strong></span>
            <span>Sans coût : <strong>{rows.filter(r => r.margeAr === null).length}</strong></span>
          </div>
        )}
      </div>

      {/* ── Simulation Modal ── */}
      <AnimatePresence>
        {simProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSimProduct(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-brand-orange" /> Simulation de marge
                </h2>
                <button onClick={() => setSimProduct(null)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-brand-muted mb-4">{simProduct.name}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Prix de vente (Ar)</label>
                  <input type="number" min="0" value={simPrice}
                    onChange={e => setSimPrice(e.target.value)}
                    className="input-field" />
                  <p className="text-xs text-brand-muted mt-1">Actuel : {formatCurrency(simProduct.price)}</p>
                </div>
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Coût de revient (Ar)</label>
                  <input type="number" min="0" value={simCost}
                    onChange={e => setSimCost(e.target.value)}
                    className="input-field" />
                  <p className="text-xs text-brand-muted mt-1">Actuel : {simProduct.costPrice ? formatCurrency(simProduct.costPrice) : '—'}</p>
                </div>
              </div>

              {/* Live results */}
              <div className="space-y-3 p-4 rounded-xl bg-white/3 border border-brand-border mb-4">
                {[
                  { label: 'Marge brute', value: formatCurrency(simMargeAr), color: simMargeAr >= 0 ? '#10B981' : '#EF4444' },
                  { label: 'Taux de marque', value: `${simTauxMarque.toFixed(2)}%`, color: MARGE_LEVELS[simLevel].color },
                  { label: 'Taux de marge (markup)', value: `${simTauxMarge.toFixed(2)}%`, color: MARGE_LEVELS[simLevel].color },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-brand-muted">{label}</span>
                    <span className="font-bold text-lg" style={{ color }}>{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                  <span className="text-sm text-brand-muted">Statut</span>
                  <span className="text-sm px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${MARGE_LEVELS[simLevel].color}20`, color: MARGE_LEVELS[simLevel].color }}>
                    {MARGE_LEVELS[simLevel].label}
                  </span>
                </div>
              </div>

              {/* Target price suggestion */}
              <div className="p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20 text-sm">
                <p className="text-brand-muted mb-1">Prix pour atteindre <strong>{targetMargin}%</strong> de marge</p>
                <p className="text-xl font-bold text-brand-orange">
                  {simCost ? formatCurrency(parseFloat(simCost) / (1 - targetMargin / 100)) : '—'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Variants Modal ───────────────────────────────────────────────────────────

interface Variant { id: string; name: string; sku?: string | null; price: number; costPrice?: number | null; isDefault: boolean; isActive: boolean; sortOrder: number }

function VariantsModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', price: '', costPrice: '', isDefault: false })
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({})

  const { data: variants = [], isLoading } = useQuery<Variant[]>({
    queryKey: ['variants', product.id],
    queryFn: () => api.get(`/products/${product.id}/variants`).then(r => r.data.data),
  })

  const createVariant = useMutation({
    mutationFn: (data: any) => api.post(`/products/${product.id}/variants`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variants', product.id] }); setAdding(false); setForm({ name: '', sku: '', price: '', costPrice: '', isDefault: false }); toast.success('Variante ajoutée') },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const updateVariant = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/products/${product.id}/variants/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variants', product.id] }); setEditId(null); toast.success('Variante mise à jour') },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const deleteVariant = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${product.id}/variants/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variants', product.id] }); toast.success('Variante supprimée') },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price) { toast.error('Nom et prix requis'); return }
    createVariant.mutate({
      name: form.name,
      sku: form.sku || undefined,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      isDefault: form.isDefault,
    })
  }

  function startEdit(v: Variant) {
    setEditId(v.id)
    setEditForm({ name: v.name, sku: v.sku ?? '', price: String(v.price), costPrice: String(v.costPrice ?? ''), isDefault: v.isDefault, isActive: v.isActive })
  }

  function handleUpdate(id: string) {
    if (!editForm.name || !editForm.price) { toast.error('Nom et prix requis'); return }
    updateVariant.mutate({
      id,
      data: {
        name: editForm.name,
        sku: editForm.sku || undefined,
        price: parseFloat(String(editForm.price)),
        costPrice: editForm.costPrice ? parseFloat(String(editForm.costPrice)) : undefined,
        isDefault: editForm.isDefault,
        isActive: editForm.isActive,
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">Variantes</h2>
            <p className="text-xs text-brand-muted mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-2 mb-4">
            {variants.length === 0 && !adding && (
              <p className="text-sm text-brand-muted text-center py-4">Aucune variante. Ajoutez des tailles, portions, etc.</p>
            )}
            {variants.map(v => (
              <div key={v.id} className="border border-brand-border rounded-xl p-3">
                {editId === v.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={String(editForm.name)} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="input-field text-sm" />
                      <input value={String(editForm.sku)} onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU (opt.)" className="input-field text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={String(editForm.price)} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} placeholder="Prix (Ar)" className="input-field text-sm" />
                      <input type="number" value={String(editForm.costPrice)} onChange={e => setEditForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="Coût (Ar)" className="input-field text-sm" />
                    </div>
                    <div className="flex gap-3 text-sm">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={Boolean(editForm.isDefault)} onChange={e => setEditForm(f => ({ ...f, isDefault: e.target.checked }))} />
                        Par défaut
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} />
                        Actif
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditId(null)} className="btn-secondary flex-1 text-sm">Annuler</button>
                      <button onClick={() => handleUpdate(v.id)} className="btn-primary flex-1 text-sm">Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v.name}</span>
                        {v.isDefault && <span className="text-xs px-1.5 py-0.5 rounded bg-brand-orange/10 text-brand-orange border border-brand-orange/30">Défaut</span>}
                        {!v.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-brand-surface text-brand-muted border border-brand-border">Inactif</span>}
                      </div>
                      <p className="text-xs text-brand-muted mt-0.5">
                        {formatCurrency(v.price)}
                        {v.costPrice ? ` · Coût: ${formatCurrency(v.costPrice)}` : ''}
                        {v.sku ? ` · ${v.sku}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(v)} className="p-1.5 text-brand-muted hover:text-brand-orange rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteVariant.mutate(v.id)} className="p-1.5 text-brand-muted hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {adding && (
              <form onSubmit={handleCreate} className="border border-brand-orange/30 rounded-xl p-3 bg-brand-orange/5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom (ex: Large)" className="input-field text-sm" required />
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU (opt.)" className="input-field text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Prix (Ar)" className="input-field text-sm" required />
                  <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="Coût (Ar)" className="input-field text-sm" />
                </div>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
                  Variante par défaut
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdding(false)} className="btn-secondary flex-1 text-sm">Annuler</button>
                  <button type="submit" className="btn-primary flex-1 text-sm">Ajouter</button>
                </div>
              </form>
            )}
          </div>
        )}

        {!adding && editId === null && (
          <button onClick={() => setAdding(true)} className="w-full btn-secondary flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Ajouter une variante
          </button>
        )}
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [activeView, setActiveView] = useState<'products' | 'marge'>('products')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null })
  const [recipeModal, setRecipeModal] = useState<Product | null>(null)
  const [variantModal, setVariantModal] = useState<Product | null>(null)
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null })
  const [showCategories, setShowCategories] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()

  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })

  const { data: warehousesData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['warehouses-list'],
    queryFn: () => api.get('/warehouses').then(r => r.data.data),
  })

  const { data: topProductsData } = useQuery<{ productId: string; totalSold: number; totalRevenue: number }[]>({
    queryKey: ['top-products-menu'],
    queryFn: () => api.get('/dashboard/live').then(r => r.data.data?.topProducts ?? []),
    staleTime: 5 * 60_000,
  })
  const topProductMap = Object.fromEntries((topProductsData ?? []).map(p => [p.productId, p]))

  const { data: productsData, isLoading } = useQuery<Product[]>({
    queryKey: ['products', selectedCategory, search],
    queryFn: () => api.get(`/products?${selectedCategory ? `categoryId=${selectedCategory}&` : ''}${search ? `search=${encodeURIComponent(search)}&` : ''}limit=100`).then(r => r.data.data),
  })

  const categories = categoriesData ?? []
  const warehouses = warehousesData ?? []
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
          <button onClick={() => setActiveView(v => v === 'marge' ? 'products' : 'marge')}
            className={`btn-secondary flex items-center gap-2 text-sm ${activeView === 'marge' ? 'border-brand-orange text-brand-orange' : ''}`}>
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analyse des marges</span>
          </button>
          <button onClick={() => setShowCategories(v => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showCategories ? 'border-brand-orange text-brand-orange' : ''}`}>
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Catégories</span>
          </button>
          <button onClick={() => setShowImport(true)}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importer CSV</span>
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

      {activeView === 'marge' && (
        <MargeView
          products={products}
          categories={categories}
          onEdit={p => setProductModal({ open: true, product: p })}
        />
      )}

      {/* Category filter */}
      {activeView === 'products' && <div className="flex gap-2 overflow-x-auto pb-1">
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
      </div>}

      {/* Search */}
      {activeView === 'products' && <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..." className="input-field pl-10" />
      </div>}

      {/* Stats bar */}
      {activeView === 'products' && products.length > 0 && (
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
      {activeView === 'products' && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    {product.sortOrder > 0 && <span className="px-1.5 py-0.5 bg-black/50 text-white text-xs rounded-md font-mono">#{product.sortOrder}</span>}
                    {!product.tags?.includes('no-recipe') && (product.recipeItems?.length ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-purple-500/80 text-white text-xs rounded-md font-bold flex items-center gap-0.5">
                        <ChefHat className="w-2.5 h-2.5" />{product.recipeItems!.length}
                      </span>
                    )}
                    {topProductMap[product.id] && (topProductsData?.findIndex(p => p.productId === product.id) ?? -1) < 5 && (
                      <span className="px-1.5 py-0.5 bg-green-500/80 text-white text-xs rounded-md font-bold" title={`${topProductMap[product.id]?.totalSold} vendus`}>
                        🔥 {topProductMap[product.id]?.totalSold}
                      </span>
                    )}
                  </div>
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => setProductModal({ open: true, product })}
                      className="p-2 bg-white/10 hover:bg-brand-orange/30 rounded-xl transition-colors" title="Modifier">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!product.tags?.includes('no-recipe') && (
                      <button onClick={() => setRecipeModal(product)}
                        className="p-2 bg-white/10 hover:bg-purple-500/30 rounded-xl transition-colors" title="Recette">
                        <BookOpen className="w-4 h-4" />
                      </button>
                    )}
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
                      ) : !product.tags?.includes('no-recipe') ? (
                        <button onClick={() => setRecipeModal(product)}
                          className="text-xs text-brand-muted hover:text-brand-orange transition-colors">
                          + Ajouter recette
                        </button>
                      ) : (
                        <span className="text-xs text-brand-muted">Vendu tel quel</span>
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

                  {/* Variants & recipe quick buttons */}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => setVariantModal(product)}
                      className="text-xs px-2 py-0.5 rounded-lg border border-brand-border text-brand-muted hover:border-brand-orange/40 hover:text-brand-orange transition-colors"
                    >
                      {(product.variants?.length ?? 0) > 0 ? `${product.variants!.length} variante(s)` : '+ Variantes'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>}

      {/* Modals */}
      {showImport && (
        <ImportCsvModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['categories'] }) }}
        />
      )}
      {productModal.open && (
        <ProductModal
          product={productModal.product}
          categories={categories}
          warehouses={warehouses}
          onClose={() => setProductModal({ open: false, product: null })}
          onSave={handleProductSave}
        />
      )}
      {recipeModal && (
        <RecipeModal product={recipeModal} onClose={() => setRecipeModal(null)} />
      )}
      {variantModal && (
        <VariantsModal product={variantModal} onClose={() => setVariantModal(null)} />
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
