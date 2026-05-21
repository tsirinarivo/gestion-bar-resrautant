'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, Users, Package, ShoppingCart, Table2, LayoutDashboard, Receipt, ChefHat, Calendar, Settings, BarChart3, TrendingUp, Star, Boxes, Megaphone } from 'lucide-react'
import { api } from '@/lib/api'

type Item = {
  id: string
  type: 'page' | 'order' | 'customer' | 'product' | 'table'
  label: string
  hint?: string
  icon: any
  href: string
}

const PAGES: Item[] = [
  { id: 'p-dash', type: 'page', label: 'Dashboard',     icon: LayoutDashboard, href: '/dashboard' },
  { id: 'p-ord',  type: 'page', label: 'Commandes',     icon: ShoppingCart, href: '/orders' },
  { id: 'p-tbl',  type: 'page', label: 'Plan de salle', icon: Table2, href: '/tables' },
  { id: 'p-menu', type: 'page', label: 'Menu',          icon: Boxes, href: '/menu' },
  { id: 'p-stk',  type: 'page', label: 'Stock',         icon: Package, href: '/stock' },
  { id: 'p-cli',  type: 'page', label: 'Clients',       icon: Users, href: '/customers' },
  { id: 'p-emp',  type: 'page', label: 'Employés',      icon: Users, href: '/employees' },
  { id: 'p-pln',  type: 'page', label: 'Planning',      icon: Calendar, href: '/planning' },
  { id: 'p-res',  type: 'page', label: 'Réservations',  icon: Calendar, href: '/reservations' },
  { id: 'p-kds',  type: 'page', label: 'Cuisine (KDS)', icon: ChefHat, href: '/kds' },
  { id: 'p-cais', type: 'page', label: 'Caisse',        icon: Receipt, href: '/caisse' },
  { id: 'p-fin',  type: 'page', label: 'Finances',      icon: TrendingUp, href: '/finances' },
  { id: 'p-ana',  type: 'page', label: 'Analytiques',   icon: BarChart3, href: '/analytics' },
  { id: 'p-rev',  type: 'page', label: 'Avis clients',  icon: Star, href: '/reviews' },
  { id: 'p-cmp',  type: 'page', label: 'Campagnes',     icon: Megaphone, href: '/campaigns' },
  { id: 'p-set',  type: 'page', label: 'Paramètres',    icon: Settings, href: '/settings' },
]

const TYPE_COLOR: Record<string, string> = {
  page: 'text-brand-muted',
  order: 'text-amber-400',
  customer: 'text-blue-400',
  product: 'text-emerald-400',
  table: 'text-purple-400',
}

const TYPE_LABEL: Record<string, string> = {
  page: 'Page',
  order: 'Commande',
  customer: 'Client',
  product: 'Produit',
  table: 'Table',
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setQ('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const term = q.trim()

  const { data: customers } = useQuery({
    queryKey: ['cmdk-customers', term],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(term)}&limit=5`).then(r => r.data.data ?? []),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  })
  const { data: products } = useQuery({
    queryKey: ['cmdk-products', term],
    queryFn: () => api.get(`/products?search=${encodeURIComponent(term)}&limit=5`).then(r => r.data.data ?? []),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  })
  const { data: orders } = useQuery({
    queryKey: ['cmdk-orders', term],
    queryFn: () => api.get(`/orders?orderNumber=${encodeURIComponent(term)}&limit=5`).then(r => r.data.data ?? []),
    enabled: open && term.length >= 3,
    staleTime: 30_000,
  })
  const { data: tables } = useQuery({
    queryKey: ['cmdk-tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data ?? []),
    enabled: open,
    staleTime: 300_000,
  })

  const items: Item[] = useMemo(() => {
    if (!term) return PAGES
    const lower = term.toLowerCase()

    const pageMatches = PAGES.filter(p => p.label.toLowerCase().includes(lower))

    const orderItems: Item[] = (orders ?? []).map((o: any) => ({
      id: `o-${o.id}`, type: 'order', label: o.orderNumber,
      hint: `${o.status} · ${o.totalAmount} Ar`,
      icon: ShoppingCart,
      href: `/orders?search=${encodeURIComponent(o.orderNumber)}`,
    }))

    const customerItems: Item[] = (customers ?? []).map((c: any) => ({
      id: `c-${c.id}`, type: 'customer', label: `${c.firstName} ${c.lastName ?? ''}`.trim(),
      hint: c.phone ?? c.email ?? '',
      icon: Users,
      href: `/customers?search=${encodeURIComponent(c.firstName)}`,
    }))

    const productItems: Item[] = (products ?? []).map((p: any) => ({
      id: `p-${p.id}`, type: 'product', label: p.name,
      hint: `${p.category?.name ?? ''} · ${p.price} Ar`,
      icon: Boxes,
      href: '/menu',
    }))

    const tableItems: Item[] = (tables ?? [])
      .filter((t: any) => String(t.number).includes(lower) || (t.section ?? '').toLowerCase().includes(lower) || (t.name ?? '').toLowerCase().includes(lower))
      .slice(0, 5)
      .map((t: any) => ({
        id: `t-${t.id}`, type: 'table', label: t.name ? `Table ${t.number} — ${t.name}` : `Table ${t.number}`,
        hint: `${t.section ?? ''} · ${t.status}`,
        icon: Table2,
        href: '/tables',
      }))

    return [...pageMatches, ...orderItems, ...customerItems, ...productItems, ...tableItems]
  }, [term, orders, customers, products, tables])

  useEffect(() => { setSelected(0) }, [items.length])

  function navigate(item: Item) {
    router.push(item.href)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(items.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selected]
      if (item) navigate(item)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl bg-brand-card border border-brand-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border">
              <Search className="w-4 h-4 text-brand-muted flex-shrink-0" />
              <input
                ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Rechercher pages, commandes, clients, produits, tables…"
                className="flex-1 bg-transparent outline-none text-sm placeholder-brand-muted"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-brand-border text-brand-muted">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-brand-muted">Aucun résultat</p>
              ) : items.map((item, i) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => navigate(item)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-white/5' : ''}`}
                  >
                    <Icon className="w-4 h-4 text-brand-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.label}</span>
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${TYPE_COLOR[item.type]} bg-white/5`}>
                          {TYPE_LABEL[item.type]}
                        </span>
                      </div>
                      {item.hint && <p className="text-xs text-brand-muted truncate">{item.hint}</p>}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-brand-muted opacity-0 group-hover:opacity-100" />
                  </button>
                )
              })}
            </div>

            <div className="px-4 py-2 border-t border-brand-border flex items-center justify-between text-[10px] text-brand-muted">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.5 rounded border border-brand-border">↑↓</kbd> naviguer</span>
                <span><kbd className="px-1 py-0.5 rounded border border-brand-border">⏎</kbd> ouvrir</span>
              </div>
              <span>⌘ + K pour ouvrir</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
