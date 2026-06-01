'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pause, Play, Loader2 } from 'lucide-react'

type Props = {
  tenantId: string
  tenantSlug: string
  status: string
}

export function SuspendResumeButton({ tenantId, tenantSlug, status }: Props) {
  const router = useRouter()
  const isSuspended = status === 'SUSPENDED'
  const action: 'suspend' | 'resume' = isSuspended ? 'resume' : 'suspend'

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `${action} échoué`)
      return body
    },
    onSuccess: () => {
      toast.success(`Tenant ${tenantSlug} ${isSuspended ? 'réactivé' : 'suspendu'}`)
      router.refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (status !== 'ACTIVE' && status !== 'SUSPENDED') return null

  return (
    <button
      onClick={() => {
        if (!confirm(isSuspended ? `Réactiver ${tenantSlug} ?` : `Suspendre ${tenantSlug} ? Le client perdra l'accès à son admin/POS.`)) return
        mutation.mutate()
      }}
      disabled={mutation.isPending}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
        isSuspended
          ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
          : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
      }`}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSuspended ? (
        <Play className="h-4 w-4" />
      ) : (
        <Pause className="h-4 w-4" />
      )}
      {isSuspended ? 'Réactiver' : 'Suspendre'}
    </button>
  )
}
