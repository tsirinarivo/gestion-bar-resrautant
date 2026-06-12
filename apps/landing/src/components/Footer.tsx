import Link from 'next/link'
import { Mail, MessageCircle, MapPin } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="container-x py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="relative h-9 w-9">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700" />
                <span className="absolute inset-0 flex items-center justify-center text-lg">🍽️</span>
              </div>
              <span className="font-display text-xl font-extrabold">Sakafio</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              Logiciel tout-en-un pour restaurants et bars. Fait à Madagascar 🇲🇬.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Produit</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#fonctionnalites" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">Fonctionnalités</Link></li>
              <li><Link href="/#tarifs" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">Tarifs</Link></li>
              <li><Link href="/signup" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">Essai gratuit</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Société</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">Contact</Link></li>
              <li><Link href="/cgv" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">CGV</Link></li>
              <li><Link href="/confidentialite" className="text-slate-600 hover:text-brand-600 dark:text-slate-300">Confidentialité</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contact</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><a href="mailto:contact@sakafio.mg" className="hover:text-brand-600">contact@sakafio.mg</a></li>
              <li className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5" />WhatsApp +261 34 00 000 00</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />Antananarivo, Madagascar</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © {new Date().getFullYear()} Sakafio — Tous droits réservés. Fait avec 🧡 à Madagascar.
        </div>
      </div>
    </footer>
  )
}
