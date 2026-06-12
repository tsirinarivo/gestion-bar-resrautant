'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const FAQ = [
  {
    q: "Combien de temps pour démarrer ?",
    a: "Moins de 5 minutes. Vous créez votre compte, vous choisissez des données démo (menu malgache pré-rempli) ou vous démarrez à vide. Votre instance est prête immédiatement.",
  },
  {
    q: "Faut-il une connexion internet permanente ?",
    a: "Oui pour le POS et le KDS, car les commandes sont synchronisées en temps réel entre les terminaux. Sakafio est hébergé à Madagascar pour minimiser la latence. Une fibre ou 4G stable suffit.",
  },
  {
    q: "Puis-je importer mon catalogue depuis Dolibarr ou Excel ?",
    a: "Oui — un export CSV (Réf, Libellé, Prix TTC, TVA, Code-barres, Stock) est importable en 1 clic. Sakafio détecte automatiquement les colonnes en français et anglais.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Vos données restent isolées de celles des autres restaurants. Sauvegardes chiffrées quotidiennes avec longue rétention, HTTPS partout, infrastructure hébergée à Madagascar. Export complet disponible à la demande.",
  },
  {
    q: "Combien de terminaux puis-je connecter ?",
    a: "Illimité, même dans le plan Starter. Tablette serveur, smartphone caissier, écran cuisine, tous se connectent à la même instance sans frais supplémentaire.",
  },
  {
    q: "Et si je veux arrêter ?",
    a: "Aucun engagement. Vous pouvez résilier à tout moment depuis votre admin. On vous fournit un export complet de vos données (CSV + JSON) en moins de 24h.",
  },
  {
    q: "Vous prenez en charge MVola, Orange Money et Airtel Money ?",
    a: "Oui — natifs dans la liste des moyens de paiement, avec tracking automatique en caisse et rapports comptables.",
  },
  {
    q: "Y a-t-il un support en Malagasy ?",
    a: "Oui — support email et WhatsApp en français et Malagasy. Documentation également bilingue.",
  },
]

export function Faq() {
  return (
    <section className="bg-slate-50 py-14 sm:py-20 dark:bg-slate-900/50 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
          >
            Questions fréquentes
          </motion.h2>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {FAQ.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
