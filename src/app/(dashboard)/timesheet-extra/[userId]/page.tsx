import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getTimesheetExtraYearDataForUser } from './[year]/[month]/actions'
import { TimesheetYearGrid } from '@/components/timesheet/TimesheetYearGrid'
import { ArrowLeft, User } from 'lucide-react'

export const metadata = { title: 'Consuntivazione extra' }

type Props = {
  params:       { userId: string }
  searchParams: { year?: string }
}

export default async function TimesheetExtraUserYearPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'TIMESHEET_EXTRA')) redirect('/dashboard')

  const currentYear = new Date().getFullYear()
  const year        = searchParams.year ? parseInt(searchParams.year) : currentYear
  const validYear   = isNaN(year) ? currentYear : year

  let data: Awaited<ReturnType<typeof getTimesheetExtraYearDataForUser>>
  try {
    data = await getTimesheetExtraYearDataForUser(params.userId, validYear)
  } catch {
    // Non autorizzato o userId non valido
    redirect('/timesheet-extra')
  }

  const { months, summary, currentYear: curYear, targetUserName } = data

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/timesheet-extra"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Seleziona utente
      </Link>

      {/* Banner utente */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <User className="h-4 w-4 text-teal-500 shrink-0" />
        <span className="text-sm text-teal-800">
          Stai compilando la consuntivazione extra di{' '}
          <strong>{targetUserName}</strong>
        </span>
      </div>

      {/* Header + navigazione anno */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Consuntivazione extra {validYear}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Seleziona un mese per aprire o modificare il consuntivo extra
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/timesheet-extra/${params.userId}?year=${validYear - 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200
                       bg-white text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ‹
          </Link>
          <span className="text-sm font-semibold text-gray-900 w-12 text-center">
            {validYear}
          </span>
          <Link
            href={`/timesheet-extra/${params.userId}?year=${validYear + 1}`}
            className={validYear >= curYear
              ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-300 pointer-events-none'
              : 'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors'
            }
          >
            ›
          </Link>
        </div>
      </div>

      {/* Griglia mesi */}
      <TimesheetYearGrid
        months={months}
        year={validYear}
        basePath={`/timesheet-extra/${params.userId}`}
      />

      {/* Riepilogo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Inviati</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{summary.submitted}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">In bozza</p>
          <p className="mt-1 text-3xl font-bold text-amber-500">{summary.draft}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Non aperti</p>
          <p className="mt-1 text-3xl font-bold text-gray-400">{summary.notOpened}</p>
        </div>
      </div>
    </div>
  )
}
