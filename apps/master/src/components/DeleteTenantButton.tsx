'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'

type Props = {
  tenantId: string
  tenantSlug: string
  tenantName: string
}

export function DeleteTenantButton({ tenantId, tenantSlug, tenantName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Suppression échouée')
      return body
    },
    onSuccess: () => {
      toast.success(`Tenant ${tenantSlug} supprimé`)
      router.push('/dashboard/tenants')
      router.refresh()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const confirmEnabled = confirmText === tenantSlug && !mutation.isPending

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          setConfirmText('')
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer le tenant
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !mutation.isPending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Supprimer ce tenant ?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Cette action est <strong>irréversible</strong>. Les containers, la base
                  de données, la config nginx et tout l&apos;historique de{' '}
                  <strong>{tenantName}</strong> seront définitivement supprimés.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Ce qui sera supprimé :</p>
              <ul className="mt-1 list-disc pl-4">
                <li>5 containers Docker (api, web, pos, kds, client)</li>
                <li>Base de données <code className="font-mono">tenant_{tenantSlug}</code></li>
                <li>Dossier <code className="font-mono">tenants/{tenantSlug}/</code></li>
                <li>Config Nginx + reload automatique</li>
              </ul>
              <p className="mt-2 text-amber-700">
                Les certificats SSL Let&apos;s Encrypt restent (expireront dans 90j).
              </p>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-700">
              Tape <code className="font-mono font-bold text-red-700">{tenantSlug}</code> pour confirmer :
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={mutation.isPending}
              autoFocus
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-slate-50"
              placeholder={tenantSlug}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={!confirmEnabled}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Suppression…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
