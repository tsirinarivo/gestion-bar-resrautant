'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Shield,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Lock,
  Check,
  X,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api'

type Resource = { key: string; label: string }
type Catalog = { resources: Resource[]; actions: ('view' | 'manage')[] }

type Role = {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  usersCount: number
  permissions: string[]
}

export default function RolesPage() {
  const qc = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)

  const { data: catalog } = useQuery<Catalog>({
    queryKey: ['roles-catalog'],
    queryFn: () => api.get('/roles/catalog').then(r => r.data.data),
  })

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data.data),
  })

  // Sélection par défaut : 1er rôle non-system, sinon 1er
  useEffect(() => {
    if (!roles || roles.length === 0 || selectedRoleId) return
    const firstNonSystem = roles.find(r => !r.isSystem)
    setSelectedRoleId(firstNonSystem?.id ?? roles[0]!.id)
  }, [roles, selectedRoleId])

  const selectedRole = useMemo(
    () => roles?.find(r => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  )

  // Recharge le draft quand on change de rôle
  useEffect(() => {
    if (!selectedRole) return
    setDraft(new Set(selectedRole.permissions))
    setDirty(false)
  }, [selectedRole])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return
      await api.put(`/roles/${selectedRole.id}/permissions`, {
        permissions: Array.from(draft),
      })
    },
    onSuccess: () => {
      toast.success('Permissions enregistrées')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success('Rôle supprimé')
      setSelectedRoleId(null)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur'),
  })

  function toggleCell(resource: string, action: string): void {
    if (!selectedRole || selectedRole.name === 'superadmin') return
    const key = `${resource}:${action}`
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setDirty(true)
  }

  function toggleRow(resource: string, on: boolean): void {
    if (!selectedRole || selectedRole.name === 'superadmin') return
    setDraft(prev => {
      const next = new Set(prev)
      for (const a of catalog?.actions ?? []) {
        const k = `${resource}:${a}`
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })
    setDirty(true)
  }

  const isLocked = selectedRole?.name === 'superadmin'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" /> Retour à l'équipe
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Shield className="h-6 w-6 text-brand-orange" />
            Rôles & Permissions
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Définissez ce que chaque rôle peut voir et faire dans l'application.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nouveau rôle
        </button>
      </div>

      {isLoading || !roles || !catalog ? (
        <div className="card p-10 text-center text-brand-muted">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Liste rôles */}
          <aside className="card p-3 lg:max-h-[70vh] lg:overflow-auto">
            <div className="space-y-1">
              {roles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`group w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selectedRoleId === r.id
                      ? 'bg-brand-orange/10 ring-1 ring-brand-orange/30'
                      : 'hover:bg-brand-darker'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.name === 'superadmin' && <Lock className="h-3 w-3 flex-shrink-0 text-brand-muted" />}
                      <div className="truncate font-semibold text-white">{r.displayName}</div>
                    </div>
                    {!r.isSystem && (
                      <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-brand-muted">
                    <span className="truncate font-mono">{r.name}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {r.usersCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Matrice */}
          {selectedRole ? (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedRole.displayName}</h2>
                    {selectedRole.isSystem && (
                      <span className="rounded-full bg-brand-darker px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-muted">
                        Système
                      </span>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="mt-0.5 text-xs text-brand-muted">{selectedRole.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!selectedRole.isSystem && (
                    <>
                      <button
                        onClick={() => setEditingRole(selectedRole)}
                        className="rounded-lg p-2 text-brand-muted hover:bg-brand-darker hover:text-white"
                        aria-label="Renommer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer le rôle "${selectedRole.displayName}" ?`))
                            deleteMut.mutate(selectedRole.id)
                        }}
                        disabled={deleteMut.isPending}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => saveMut.mutate()}
                    disabled={!dirty || saveMut.isPending || isLocked}
                    className="btn-primary"
                  >
                    {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                  </button>
                </div>
              </div>

              {isLocked && (
                <div className="border-b border-brand-border bg-brand-darker/40 px-5 py-2 text-xs text-brand-muted">
                  <Lock className="mr-1 inline h-3 w-3" />
                  Le rôle <strong>superadmin</strong> a toujours toutes les permissions
                  (sécurité). Pour limiter un admin, créez un rôle custom.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-darker/40">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                        Module
                      </th>
                      {catalog.actions.map(a => (
                        <th
                          key={a}
                          className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-brand-muted"
                        >
                          {a === 'view' ? 'Voir' : 'Gérer'}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                        Tout
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {catalog.resources.map(r => {
                      const allOn = catalog.actions.every(a => draft.has(`${r.key}:${a}`))
                      return (
                        <tr key={r.key} className="hover:bg-brand-darker/30">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-white">{r.label}</div>
                            <div className="font-mono text-[11px] text-brand-muted">{r.key}</div>
                          </td>
                          {catalog.actions.map(a => {
                            const on = isLocked || draft.has(`${r.key}:${a}`)
                            return (
                              <td key={a} className="px-5 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleCell(r.key, a)}
                                  disabled={isLocked}
                                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                                    on
                                      ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/30'
                                      : 'border border-brand-border bg-brand-darker text-brand-muted hover:border-brand-orange/40'
                                  } ${isLocked ? 'cursor-not-allowed opacity-70' : ''} mx-auto`}
                                  aria-label={`${a} ${r.label}`}
                                >
                                  {on ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 opacity-30" />}
                                </button>
                              </td>
                            )
                          })}
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleRow(r.key, !allOn)}
                              disabled={isLocked}
                              className="text-[11px] font-semibold text-brand-orange hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {allOn ? 'Aucun' : 'Tout'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center text-brand-muted">
              Sélectionnez un rôle pour voir ses permissions.
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <RoleFormModal
            onClose={() => setShowCreate(false)}
            onCreated={(id) => {
              setShowCreate(false)
              setSelectedRoleId(id)
              qc.invalidateQueries({ queryKey: ['roles'] })
            }}
            catalog={catalog ?? null}
          />
        )}
        {editingRole && (
          <RoleEditModal
            role={editingRole}
            onClose={() => setEditingRole(null)}
            onSaved={() => {
              setEditingRole(null)
              qc.invalidateQueries({ queryKey: ['roles'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function RoleFormModal({
  onClose,
  onCreated,
  catalog,
}: {
  onClose: () => void
  onCreated: (id: string) => void
  catalog: Catalog | null
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/roles', {
        name,
        displayName,
        description: description || undefined,
        permissions: Array.from(perms),
      })
      toast.success('Rôle créé')
      onCreated(res.data.data.id)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="card w-full max-w-lg max-h-[88vh] overflow-auto p-6"
      >
        <h2 className="text-lg font-bold text-white">Nouveau rôle</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Créez un rôle custom adapté à votre équipe (ex: Barmaid weekend, Plongeur).
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-muted">
              Clé (technique) *
            </label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="barmaid_weekend"
              className="w-full rounded-xl border border-brand-border bg-brand-darker px-3 py-2 font-mono text-sm text-white placeholder:text-brand-muted/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-muted">
              Nom affiché *
            </label>
            <input
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Barmaid weekend"
              className="w-full rounded-xl border border-brand-border bg-brand-darker px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-muted">
              Description (facultatif)
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Service au bar les vendredis et samedis soir"
              className="w-full rounded-xl border border-brand-border bg-brand-darker px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        {catalog && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold text-brand-muted">Permissions</div>
            <div className="space-y-1.5 rounded-xl border border-brand-border bg-brand-darker/30 p-2">
              {catalog.resources.map(r => (
                <div key={r.key} className="flex items-center justify-between gap-2 px-2 py-1">
                  <div>
                    <div className="text-sm text-white">{r.label}</div>
                    <div className="font-mono text-[10px] text-brand-muted">{r.key}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {catalog.actions.map(a => {
                      const k = `${r.key}:${a}`
                      const on = perms.has(k)
                      return (
                        <button
                          type="button"
                          key={a}
                          onClick={() =>
                            setPerms(prev => {
                              const next = new Set(prev)
                              if (next.has(k)) next.delete(k)
                              else next.add(k)
                              return next
                            })
                          }
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                            on
                              ? 'bg-brand-orange text-white'
                              : 'border border-brand-border bg-brand-darker text-brand-muted'
                          }`}
                        >
                          {a === 'view' ? 'Voir' : 'Gérer'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

function RoleEditModal({
  role,
  onClose,
  onSaved,
}: {
  role: Role
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(role.displayName)
  const [description, setDescription] = useState(role.description ?? '')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/roles/${role.id}`, { displayName, description })
      toast.success('Rôle mis à jour')
      onSaved()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="card w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold text-white">Renommer le rôle</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-muted">
              Nom affiché
            </label>
            <input
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-brand-darker px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-muted">
              Description
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-brand-darker px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
