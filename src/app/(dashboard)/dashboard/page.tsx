import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { Clock, Receipt, ChevronRight, Timer } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) return null

  const { firstName, sections } = session.user
  const currentMonth = new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  // Card di accesso rapido filtrate per sezione
  const quickLinks = [
    {
      label:       'Consuntivazione',
      description: `Inserisci le ore di ${currentMonth}`,
      href:        '/timesheet',
      icon:        Clock,
      color:       'bg-blue-50 text-blue-600',
      show:        hasSection(session, 'TIMESHEET'),
    },
    {
      label:       'Consuntivazione extra',
      description: `Inserisci le ore extra di ${currentMonth}`,
      href:        '/timesheet-extra',
      icon:        Timer,
      color:       'bg-orange-50 text-orange-600',
      show:        hasSection(session, 'TIMESHEET_EXTRA'),
    },
    {
      label:       'Note spese',
      description: `Gestisci le spese di ${currentMonth}`,
      href:        '/expenses',
      icon:        Receipt,
      color:       'bg-green-50 text-green-600',
      show:        hasSection(session, 'EXPENSES'),
    },
  ].filter((l) => l.show)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Intestazione */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Ciao, {firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Benvenuto nel portale HR.
        </p>
      </div>

      {/* Accesso rapido */}
      {quickLinks.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Accesso rapido</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5
                             hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${link.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{link.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
