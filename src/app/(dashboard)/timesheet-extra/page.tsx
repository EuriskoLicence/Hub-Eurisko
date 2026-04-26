import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getManagedUsers } from './[userId]/[year]/[month]/actions'
import { ArrowLeft, ChevronRight, User, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Consuntivazione extra' }

export default async function TimesheetExtraPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'TIMESHEET_EXTRA')) redirect('/dashboard')

  const managedUsers = await getManagedUsers()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna alla home
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consuntivazione extra</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seleziona l&apos;utente per cui compilare la consuntivazione extra
        </p>
      </div>

      {managedUsers.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          Non sei responsabile di nessuna commessa con utenti abilitati.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {managedUsers.map((u) => (
            <Link
              key={u.id}
              href={`/timesheet-extra/${u.id}`}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4
                         hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-600 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">
                {u.lastName} {u.firstName}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
