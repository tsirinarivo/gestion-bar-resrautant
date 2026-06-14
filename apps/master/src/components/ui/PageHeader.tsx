'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Retour',
  actions,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-7"
    >
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PROVISIONING: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 ring-amber-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  ERROR: 'bg-red-50 text-red-700 ring-red-200',
  RUNNING: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
  PENDING: 'bg-blue-50 text-blue-700 ring-blue-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-200',
  CANCELED: 'bg-slate-100 text-slate-500 ring-slate-200',
  TRIAL: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
  const showDot = dot && ['ACTIVE', 'PROVISIONING', 'RUNNING'].includes(status)
  const dotColor =
    status === 'ACTIVE' || status === 'SUCCESS' || status === 'PAID'
      ? 'bg-emerald-500'
      : status === 'ERROR' || status === 'FAILED' || status === 'OVERDUE'
        ? 'bg-red-500'
        : status === 'SUSPENDED'
          ? 'bg-amber-500'
          : 'bg-blue-500'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor} animate-pulse-soft`} />}
      {status}
    </span>
  )
}
