'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'

type Props = {
  tenantId: string
  tenantSlug: string
}

export function SeedDemoButton({ tenantId, tenantSlug }: Props) {
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/seed-demo`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec du chargement des données démo')
      return body
    },
    onSuccess: () => {
      toast.success(`Données démo chargées pour ${tenantSlug}`)
      router.refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <button
      onClick={() => {
        if (!confirm(`Charger les données démo (catégories, stock, produits, recettes MG) dans « ${tenantSlug} » ? Sans supprimer l'existant.`)) return
        mutation.mutate()
      }}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
    >
      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      Données démo
    </button>
  )
}
