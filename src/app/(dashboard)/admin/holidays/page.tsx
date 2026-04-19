import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getHolidays } from '../actions'
import { HolidaysClient } from '@/components/admin/HolidaysClient'
import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Festività' }

type Props = { searchParams: { year?: string } }

export default async function AdminHolidaysPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_HOLIDAYS')) redirect('/dashboard')

  const currentYear = parseInt(searchParams.year ?? String(new Date().getFullYear()))
  const holidays    = await getHolidays(currentYear)

  const years: number[] = []
  const base = new Date().getFullYear()
  for (let y = base - 1; y <= base + 3; y++) years.push(y)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
          <CalendarDays className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Festività</h1>
          <p className="text-sm text-gray-500">Festività italiane e aziendali</p>
        </div>
      </div>

      <HolidaysClient holidays={holidays} currentYear={currentYear} years={years} />
    </div>
  )
}
