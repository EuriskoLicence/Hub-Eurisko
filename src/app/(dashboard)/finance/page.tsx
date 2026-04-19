import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getFinanceDashboard, getUsersWithoutSubmittedTimesheet } from './actions'
import { FinanceDashboardClient } from '@/components/finance/FinanceDashboardClient'

export const metadata = { title: 'Dashboard Consuntivazioni' }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function getDefaultPeriod() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

type Props = { searchParams: { year?: string; month?: string } }

export default async function FinanceDashboardPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'FINANCE_DASHBOARD')) redirect('/dashboard')

  const canExport   = hasSection(session, 'FINANCE_EXPORT')
  const def         = getDefaultPeriod()
  const year        = parseInt(searchParams.year  ?? String(def.year))
  const month       = parseInt(searchParams.month ?? String(def.month))

  const [rows, missing] = await Promise.all([
    getFinanceDashboard(year, month),
    getUsersWithoutSubmittedTimesheet(year, month),
  ])

  // Build period options (last 13 months)
  const periods: { year: number; month: number; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    let m = now.getMonth() + 1 - i
    let y = now.getFullYear()
    while (m <= 0) { m += 12; y-- }
    periods.push({ year: y, month: m, label: `${IT_MONTHS[m - 1]} ${y}` })
  }

  return (
    <FinanceDashboardClient
      rows={rows}
      missingUsers={missing}
      currentYear={year}
      currentMonth={month}
      periods={periods}
      canExport={canExport}
    />
  )
}
