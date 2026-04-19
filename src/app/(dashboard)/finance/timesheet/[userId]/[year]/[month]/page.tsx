import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getFinanceTimesheetView } from './actions'
import { MonthGrid } from '@/components/timesheet/MonthGrid'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

type Props = { params: { userId: string; year: string; month: string } }

export async function generateMetadata({ params }: Props) {
  return { title: 'Finance — Consuntivazione utente' }
}

export default async function FinanceTimesheetPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'FINANCE_DASHBOARD')) redirect('/dashboard')

  const year  = parseInt(params.year)
  const month = parseInt(params.month)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound()

  const data = await getFinanceTimesheetView(params.userId, year, month)

  return (
    <div className="space-y-4">
      {/* Banner utente */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <User className="h-4 w-4 text-indigo-500 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="text-indigo-700 font-medium">Visualizzazione in sola lettura</span>
          <span className="text-indigo-500 ml-2">—</span>
          <span className="text-indigo-600 ml-2">
            Consuntivazione di <strong>{data.targetUserName}</strong> — {IT_MONTHS[month - 1]} {year}
          </span>
        </div>
        <Link
          href={`/finance?year=${year}&month=${month}`}
          className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Torna alla dashboard
        </Link>
      </div>

      <MonthGrid
        data={data}
        canRequestAmendment={false}
        readOnly
      />
    </div>
  )
}
