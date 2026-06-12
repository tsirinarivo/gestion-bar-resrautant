'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Mail, MessageCircle, MapPin, Send, Loader2 } from 'lucide-react'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erreur envoi')
      toast.success('Message envoyé ! On vous répond dans 24h.')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-x">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Parlons de votre <span className="gradient-text">restaurant</span>
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Vous voulez une démo personnalisée ? Un devis Enterprise ? Une question technique ? On vous répond sous 24h.
          </p>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-8 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <ContactBlock icon={Mail} title="Email" value="contact@sakafio.mg" href="mailto:contact@sakafio.mg" />
            <ContactBlock icon={MessageCircle} title="WhatsApp" value="+261 34 00 000 00" href="https://wa.me/26134000000000" />
            <ContactBlock icon={MapPin} title="Adresse" value="Antananarivo, Madagascar" />
          </motion.div>

          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              <Field label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
            </div>
            <div className="mt-4">
              <Field label="Sujet" value={form.subject} onChange={v => setForm(f => ({ ...f, subject: v }))} placeholder="Demande de démo, devis Enterprise, question technique…" />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                required
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500"
                placeholder="Dites-nous ce dont vous avez besoin…"
              />
            </div>
            <button type="submit" disabled={loading}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  )
}

function ContactBlock({ icon: Icon, title, value, href }: any) {
  const Content = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950/50">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
  return href ? <a href={href}>{Content}</a> : Content
}

function Field({ label, value, onChange, ...props }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <input
        {...props}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500"
      />
    </div>
  )
}
