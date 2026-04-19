import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getTimesheetYearData } from './[year]/[month]/actions'
import { TimesheetYearGrid } from '@/components/timesheet/TimesheetYearGrid'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Consuntivazione' }

export default async function TimesheetListPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const session = await auth()
  if (!session || !hasSection(session, 'TIMESHEET')) redirect('/dashboard')

  const currentYear = new Date().getFullYear()
  const year = searchParams.year ? parseInt(searchParams.year) : currentYear
  const validYear = isNaN(year) ? currentYear : year

  const { months, summary, currentYear: curYear } = await getTimesheetYearData(validYear)
  const { firstName } = session.user

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna alla home
      </Link>

      {/* Header + navigazione anno */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            I miei consuntivi {validYear}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Seleziona un mese per aprire o modificare il consuntivo
          </p>
        </div>

        {/* Navigazione anno */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/timesheet?year=${validYear - 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200
                       bg-white text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ‹
          </Link>
          <span className="text-sm font-semibold text-gray-900 w-12 text-center">
            {validYear}
          </span>
          <Link
            href={`/timesheet?year=${validYear + 1}`}
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
      <TimesheetYearGrid months={months} year={validYear} />

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
