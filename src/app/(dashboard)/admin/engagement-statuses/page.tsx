import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getEngagementStatuses } from '../actions'
import { SimpleListClient } from '@/components/admin/SimpleListClient'
import { Activity } from 'lucide-react'

export const metadata = { title: 'Stati commessa' }

export default async function AdminEngagementStatusesPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_ENGAGEMENT_STATUSES')) redirect('/dashboard')

  const items = await getEngagementStatuses()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
          <Activity className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stati commessa</h1>
          <p className="text-sm text-gray-500">Codice 3 caratteri alfanumerici + descrizione (facoltativi sulle commesse)</p>
        </div>
      </div>

      <SimpleListClient
        type="engagement-statuses"
        items={items.map((i) => ({ id: i.id, code: i.code, label: i.description, active: i.active }))}
      />
    </div>
  )
}
