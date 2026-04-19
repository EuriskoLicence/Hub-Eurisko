import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getExpenseDashboard } from '../actions'
import { ExpenseDashboardClient } from '@/components/finance/ExpenseDashboardClient'

export const metadata = { title: 'Dashboard Note Spese' }

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function getDefaultPeriod() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

type Props = { searchParams: { year?: string; month?: string } }

export default async function ExpenseDashboardPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'FINANCE_DASHBOARD')) redirect('/dashboard')

  const canExport = hasSection(session, 'FINANCE_EXPORT')
  const def       = getDefaultPeriod()
  const year      = parseInt(searchParams.year  ?? String(def.year))
  const month     = parseInt(searchParams.month ?? String(def.month))

  const rows = await getExpenseDashboard(year, month)

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
    <ExpenseDashboardClient
      rows={rows}
      currentYear={year}
      currentMonth={month}
      periods={periods}
      canExport={canExport}
    />
  )
}
