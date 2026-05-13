'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { UserCog, Plus, Clock, Calendar } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, initials } from '@restaurant/utils'

export default function EmployeesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
  })

  const employees = data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressources Humaines</h1>
          <p className="text-brand-muted text-sm">{employees.length} employé{employees.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvel employé
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)
        ) : employees.length === 0 ? (
          <div className="col-span-full text-center py-16 text-brand-muted">
            <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun employé trouvé</p>
          </div>
        ) : (
          employees.map((employee: any) => {
            const user = employee.user
            const isClockedIn = employee.timeEntries?.[0] && !employee.timeEntries[0].clockOut
            return (
              <motion.div key={employee.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}>
                    {user ? initials(user.firstName, user.lastName) : '??'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                      <div className={`w-2.5 h-2.5 rounded-full ${isClockedIn ? 'bg-green-400' : 'bg-brand-muted'}`} />
                    </div>
                    <p className="text-xs text-brand-muted">{employee.position}</p>
                    <p className="text-xs text-brand-orange capitalize">{user?.role?.displayName}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-brand-muted">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Statut</span>
                    <span className={isClockedIn ? 'text-green-400' : 'text-brand-muted'}>
                      {isClockedIn ? '● En service' : '○ Hors service'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Depuis</span>
                    <span>{employee.hireDate ? formatDate(employee.hireDate) : '—'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-brand-border flex gap-2">
                  <button className="flex-1 text-xs py-1.5 rounded-lg border border-brand-border hover:border-brand-orange/30 transition-colors">
                    Profil
                  </button>
                  <button className="flex-1 text-xs py-1.5 rounded-lg border border-brand-border hover:border-brand-orange/30 transition-colors">
                    Planning
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
