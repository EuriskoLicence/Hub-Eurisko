import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { BarChart2, Clock, ChevronRight, List, Users, ShoppingCart, Tag } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Report' }

type ReportCard = {
  title:       string
  description: string
  href:        string
  icon:        React.ElementType
  color:       string
  iconColor:   string
  requires?:   'CLIENTS_VIEW' | 'PURCHASE_ORDERS_VIEW'
}

const REPORTS: ReportCard[] = [
  {
    title:       'Report ore per commessa',
    description: 'Riepilogo delle ore consuntivate per cliente, progetto e commessa, con dettaglio per persona.',
    href:        '/clients/reports/ore-commessa',
    icon:        Clock,
    color:       'bg-amber-50 border-amber-100',
    iconColor:   'bg-amber-100 text-amber-600',
    requires:    'CLIENTS_VIEW',
  },
  {
    title:       'Report lista commesse',
    description: 'Elenco completo delle commesse con codici, progetto, cliente, responsabile e stato attivo/inattivo.',
    href:        '/clients/reports/lista-commesse',
    icon:        List,
    color:       'bg-blue-50 border-blue-100',
    iconColor:   'bg-blue-100 text-blue-600',
    requires:    'CLIENTS_VIEW',
  },
  {
    title:       'Elenco commesse per utente',
    description: 'Tutte le commesse a cui ogni utente è abilitato, con responsabile commessa. Filtrabile per utente, commessa e responsabile.',
    href:        '/clients/reports/commesse-per-utente',
    icon:        Users,
    color:       'bg-violet-50 border-violet-100',
    iconColor:   'bg-violet-100 text-violet-600',
    requires:    'CLIENTS_VIEW',
  },
  {
    title:       'Lista OdA',
    description: 'Elenco di tutti gli Ordini di Acquisto con dettaglio testata e posizioni. Filtrabile per cliente e responsabile.',
    href:        '/clients/reports/oda-list',
    icon:        ShoppingCart,
    color:       'bg-purple-50 border-purple-100',
    iconColor:   'bg-purple-100 text-purple-600',
    requires:    'PURCHASE_ORDERS_VIEW',
  },
  {
    title:       'OdA per commessa',
    description: 'Riepilogo OdA collegati a ogni commessa (escluse tipologie «NO OdA»). Le commesse senza OdA sono comunque elencate.',
    href:        '/clients/reports/oda-per-commessa',
    icon:        Tag,
    color:       'bg-fuchsia-50 border-fuchsia-100',
    iconColor:   'bg-fuchsia-100 text-fuchsia-600',
    requires:    'PURCHASE_ORDERS_VIEW',
  },
]

export default async function ClientReportsHubPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'CLIENTS_VIEW')) redirect('/dashboard')

  // Filtra le card in base ai permessi dell'utente
  const visibleReports = REPORTS.filter((r) => !r.requires || hasSection(session, r.requires))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
          <BarChart2 className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report</h1>
          <p className="text-sm text-gray-500">Seleziona il report da visualizzare</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleReports.map((r) => {
          const Icon = r.icon
          return (
            <Link
              key={r.href}
              href={r.href}
              className={`group flex flex-col gap-4 rounded-xl border p-5 transition-shadow hover:shadow-md ${r.color}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${r.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{r.title}</p>
                <p className="mt-1 text-sm text-gray-500 leading-snug">{r.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
