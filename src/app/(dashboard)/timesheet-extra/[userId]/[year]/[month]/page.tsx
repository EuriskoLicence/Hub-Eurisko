import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getTimesheetExtraPageDataForUser } from './actions'
import { ExtraMonthGrid } from '@/components/timesheet/ExtraMonthGrid'
import { FileSpreadsheet, FileText } from 'lucide-react'

type Props = { params: { userId: string; year: string; month: string } }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export async function generateMetadata({ params }: Props) {
  const y = parseInt(params.year)
  const m = parseInt(params.month)
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return {}
  return { title: `Consuntivazione extra — ${IT_MONTHS[m - 1]} ${y}` }
}

export default async function TimesheetExtraUserGridPage({ params }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'TIMESHEET_EXTRA')) redirect('/dashboard')

  const year  = parseInt(params.year)
  const month = parseInt(params.month)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound()

  let data: Awaited<ReturnType<typeof getTimesheetExtraPageDataForUser>>
  try {
    data = await getTimesheetExtraPageDataForUser(params.userId, year, month)
  } catch {
    redirect('/timesheet-extra')
  }

  const qs = `year=${year}&month=${month}&userId=${params.userId}`

  return (
    <div className="space-y-3">
      {/* Barra export */}
      <div className="flex justify-end gap-2">
        <a
          href={`/api/export/me/timesheet-extra?${qs}`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel
        </a>
        <a
          href={`/api/export/me/timesheet-extra/pdf?${qs}`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FileText className="h-4 w-4 text-red-500" />
          PDF
        </a>
      </div>

      <ExtraMonthGrid
        data={data}
        targetUserId={params.userId}
        targetUserName={data.targetUserName}
      />
    </div>
  )
}
