import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getFinanceExpenseView } from './actions'
import { ExpenseGrid } from '@/components/expenses/ExpenseGrid'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

type Props = { params: { userId: string; year: string; month: string } }

export async function generateMetadata({ params }: Props) {
  return { title: 'Finance — Nota spese utente' }
}

export default async function FinanceExpensePage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'FINANCE_DASHBOARD')) redirect('/dashboard')

  const year  = parseInt(params.year)
  const month = parseInt(params.month)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound()

  const data = await getFinanceExpenseView(params.userId, year, month)

  return (
    <div className="space-y-4">
      {/* Banner utente */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <User className="h-4 w-4 text-teal-500 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="text-teal-700 font-medium">Visualizzazione in sola lettura</span>
          <span className="text-teal-500 ml-2">—</span>
          <span className="text-teal-600 ml-2">
            Nota spese di <strong>{data.targetUserName}</strong> — {IT_MONTHS[month - 1]} {year}
          </span>
        </div>
        <Link
          href={`/finance?year=${year}&month=${month}`}
          className="flex items-center gap-1.5 text-xs text-teal-500 hover:text-teal-700 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Torna alla dashboard
        </Link>
      </div>

      <ExpenseGrid
        data={data}
        canRequestAmendment={false}
        readOnly
      />
    </div>
  )
}
