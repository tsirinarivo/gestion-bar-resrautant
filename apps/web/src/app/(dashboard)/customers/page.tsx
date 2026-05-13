'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Search, Star, ShoppingBag, Award } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatCurrency, initials } from '@restaurant/utils'

const TIER_CONFIG = {
  BRONZE: { label: 'Bronze', color: '#CD7F32', icon: '🥉' },
  SILVER: { label: 'Argent', color: '#C0C0C0', icon: '🥈' },
  GOLD: { label: 'Or', color: '#FFD700', icon: '🥇' },
  PLATINUM: { label: 'Platine', color: '#E5E4E2', icon: '💎' },
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => api.get(`/customers?${search ? `search=${search}&` : ''}page=${page}&limit=20`).then(r => r.data),
  })

  const customers = data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-brand-muted text-sm">{data?.pagination?.total || 0} clients</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Users className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, téléphone..." className="input-field pl-10" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Fidélité</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Commandes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border/30">
                  <td colSpan={5} className="px-4 py-3"><div className="skeleton h-8 rounded" /></td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-brand-muted">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              customers.map((customer: any) => {
                const tier = customer.loyaltyAccount?.tier || 'BRONZE'
                const tierConf = TIER_CONFIG[tier as keyof typeof TIER_CONFIG]
                return (
                  <motion.tr key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-brand-border/30 hover:bg-white/2 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}>
                          {initials(customer.firstName, customer.lastName)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer.firstName} {customer.lastName}</p>
                          <p className="text-xs text-brand-muted">{customer.city || 'Paris'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-muted">
                      <p>{customer.email || '—'}</p>
                      <p>{customer.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{tierConf.icon}</span>
                        <div>
                          <p className="text-sm font-medium" style={{ color: tierConf.color }}>{tierConf.label}</p>
                          <p className="text-xs text-brand-muted">{customer.loyaltyAccount?.points || 0} pts</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{customer._count?.orders || 0}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-muted">
                      {formatDate(customer.createdAt)}
                    </td>
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
