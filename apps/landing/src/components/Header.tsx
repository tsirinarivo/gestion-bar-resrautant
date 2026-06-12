'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Moon, Sun, Menu, X } from 'lucide-react'

const NAV = [
  { href: '/#fonctionnalites', label: 'Fonctionnalités' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/#temoignages', label: 'Témoignages' },
  { href: '/contact', label: 'Contact' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80'
          : 'border-b border-transparent'
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative h-9 w-9">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/30 transition-transform group-hover:scale-105" />
            <span className="absolute inset-0 flex items-center justify-center text-lg">🍽️</span>
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight">Sakafio</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Changer de thème"
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:block"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="hidden items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition-all hover:shadow-lg hover:shadow-brand-500/40 hover:brightness-110 active:scale-[0.98] md:inline-flex"
          >
            Essai gratuit
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-72 bg-white p-6 dark:bg-slate-950"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-bold">Menu</span>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {n.label}
                </Link>
              ))}
              <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="mt-2 block rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-brand-500/25"
              >
                Essai gratuit 3 jours
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
