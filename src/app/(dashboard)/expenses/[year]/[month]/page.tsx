import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getExpenseForMonth } from '../../detail-actions'
import { ExpenseGrid } from '@/components/expenses/ExpenseGrid'
import { FileSpreadsheet, FileText } from 'lucide-react'

type Props = { params: { year: string; month: string } }

export async function generateMetadata() {
  return { title: 'Nota spese' }
}

export default async function ExpenseMonthPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'EXPENSES')) redirect('/dashboard')

  const year  = parseInt(params.year)
  const month = parseInt(params.month)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound()

  const data = await getExpenseForMonth(year, month)

  const qs = `year=${year}&month=${month}`

  return (
    <div className="space-y-3">
      {/* Barra export */}
      <div className="flex justify-end gap-2">
        <a
          href={`/api/export/me/expenses?${qs}`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel
        </a>
        <a
          href={`/api/export/me/expenses/pdf?${qs}`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FileText className="h-4 w-4 text-red-500" />
          PDF
        </a>
      </div>

      <ExpenseGrid
        data={data}
        canRequestAmendment={hasSection(session, 'EXPENSES_AMENDMENT')}
      />
    </div>
  )
}
